import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import type { VaultDenial } from "../../src/core/index.ts";
import { prepareVaultFolder } from "../../src/vault/files.ts";
import { type Vault, VaultFailure } from "../../src/vault/index.ts";
import { temporary } from "../fixtures/service.ts";
import { denialsOf, distinctiveSecret, type FakeCustody, fakeCustody, request, vaultOn } from "../fixtures/vault.ts";

/** Every file of the Vault's folder with its bytes, to show that a refused write changed nothing. */
const snapshotOf = (folder: string) =>
  Object.fromEntries(readdirSync(folder).map((name) => [name, readFileSync(join(folder, name), "utf8")]));

/** The one records file of the folder, which the header names. */
const recordsPathOf = (folder: string) =>
  join(folder, readdirSync(folder).find((name) => name.startsWith("records-")) ?? "");

describe("keeping secrets in the Vault", () => {
  it.effect("makes itself at the first secret, shows its kind and date and never its value", () =>
    Effect.gen(function* () {
      const custody = fakeCustody();
      const { folder, vault: making } = vaultOn([custody]);
      const vault = yield* making;
      expect(yield* vault.state).toEqual({ _tag: "Absent" });
      const secret = distinctiveSecret();
      yield* vault.put(request("composio", secret));
      expect(yield* vault.state).toMatchObject({ _tag: "Ready", holder: { name: "keychain" } });
      const [entry] = yield* vault.list;
      expect(entry).toMatchObject({ connectorId: "composio", holder: "Fake keychain", kind: "API key" });
      expect(Object.keys(entry ?? {}).sort()).toEqual(["addedAt", "connectorId", "holder", "kind"]);
      expect(JSON.stringify(snapshotOf(folder))).not.toContain(secret);
      expect(statSync(folder).mode & 0o777).toBe(0o700);
      for (const name of readdirSync(folder)) expect(statSync(join(folder, name)).mode & 0o777).toBe(0o600);
    }),
  );

  it.effect("hands the secret to a callback and nowhere else, as a value that prints as redacted", () =>
    Effect.gen(function* () {
      const { vault: making } = vaultOn([fakeCustody()]);
      const vault = yield* making;
      const secret = distinctiveSecret();
      yield* vault.put(request("composio", secret));
      const seen = yield* vault.withSecret("composio", "API key", (value) =>
        Effect.succeed({ printed: String(value), used: Redacted.value(value) }),
      );
      expect(seen).toEqual({ printed: "<redacted>", used: secret });
    }),
  );

  it.effect("answers a missing secret with a plain refusal", () =>
    Effect.gen(function* () {
      const { vault: making } = vaultOn([fakeCustody()]);
      const vault = yield* making;
      expect((yield* Effect.flip(vault.withSecret("composio", "API key", () => Effect.void))).kind).toBe("Missing");
      yield* vault.put(request("composio", "one"));
      expect((yield* Effect.flip(vault.withSecret("apple", "API key", () => Effect.void))).kind).toBe("Missing");
    }),
  );

  it.effect("refuses a second secret of the same kind, and replaces only one that exists", () =>
    Effect.gen(function* () {
      const { vault: making } = vaultOn([fakeCustody()]);
      const vault = yield* making;
      expect((yield* Effect.flip(vault.replace(request("composio", "a")))).kind).toBe("Missing");
      yield* vault.put(request("composio", "first"));
      expect((yield* Effect.flip(vault.put(request("composio", "again")))).kind).toBe("Exists");
      yield* vault.replace(request("composio", "second"));
      expect(yield* vault.withSecret("composio", "API key", (value) => Effect.succeed(Redacted.value(value)))).toBe(
        "second",
      );
      expect(yield* vault.list).toHaveLength(1);
    }),
  );

  it.effect("refuses a connector, a kind or a value it cannot store", () =>
    Effect.gen(function* () {
      const { vault: making } = vaultOn([fakeCustody()]);
      const vault = yield* making;
      for (const bad of [
        request("a/b", "x"),
        request("composio", "x", "bad/kind"),
        request("composio", ""),
        request("composio", "x".repeat(9000)),
      ])
        expect((yield* Effect.flip(vault.put(bad))).kind).toBe("Invalid");
      expect(yield* vault.state).toEqual({ _tag: "Absent" });
    }),
  );

  it.effect("removes one secret and all of a connector's, again and again without failing", () =>
    Effect.gen(function* () {
      const { vault: making } = vaultOn([fakeCustody()]);
      const vault = yield* making;
      yield* vault.removeAllOf("composio");
      yield* vault.put(request("composio", "a"));
      yield* vault.put(request("composio", "b", "Token"));
      yield* vault.put(request("apple", "c"));
      yield* vault.remove("composio", "Token");
      expect((yield* vault.list).map((entry) => `${entry.connectorId}/${entry.kind}`).sort()).toEqual([
        "apple/API key",
        "composio/API key",
      ]);
      yield* vault.removeAllOf("composio");
      yield* vault.removeAllOf("composio");
      expect((yield* vault.list).map((entry) => entry.connectorId)).toEqual(["apple"]);
    }),
  );

  it.effect("keeps every record when puts, replaces and removes run at once", () =>
    Effect.gen(function* () {
      const { vault: making } = vaultOn([fakeCustody()]);
      const vault = yield* making;
      yield* vault.put(request("seed", "s"));
      const connectors = Array.from({ length: 12 }, (_, index) => `connector_${index}`);
      yield* Effect.all(
        [
          ...connectors.map((connector) => vault.put(request(connector, `secret-${connector}`))),
          vault.replace(request("seed", "replaced")),
          vault.removeAllOf("connector_3"),
        ],
        { concurrency: "unbounded" },
      );
      const stored = (yield* vault.list).map((entry) => entry.connectorId).sort();
      expect(stored).toEqual(["seed", ...connectors.filter((connector) => connector !== "connector_3")].sort());
      expect(yield* vault.withSecret("seed", "API key", (value) => Effect.succeed(Redacted.value(value)))).toBe(
        "replaced",
      );
    }),
  );

  it.effect("keeps its secrets across a restart with the same holder, and uses the header's holder alone", () =>
    Effect.gen(function* () {
      const first = fakeCustody("keychain");
      const other = fakeCustody("keyFile");
      const { folder, vault: making } = vaultOn([first, other]);
      yield* (yield* making).put(request("composio", "kept"));
      // A later start lists the adapters in another order: the header, not the order, decides.
      const restarted = yield* vaultOn([other, first], { folder }).vault;
      expect(yield* restarted.withSecret("composio", "API key", (value) => Effect.succeed(Redacted.value(value)))).toBe(
        "kept",
      );
      expect(other.calls).toEqual([]);
    }),
  );

  it.effect("chooses the holder once, the first adapter that keeps the key and reads it back", () =>
    Effect.gen(function* () {
      const refusing = fakeCustody("keychain");
      refusing.isRefusingWrites = true;
      const wrong = fakeCustody("secretService");
      wrong.isReadingBackWrong = true;
      const file = fakeCustody("keyFile");
      const { vault: making } = vaultOn([refusing, wrong, file]);
      const vault = yield* making;
      yield* vault.put(request("composio", "x"));
      expect(yield* vault.state).toMatchObject({ _tag: "Ready", holder: { name: "keyFile" } });
      // The adapter that read back a wrong key was asked to remove what it was given.
      expect(wrong.keys.size).toBe(0);
      expect(file.keys.size).toBe(1);
    }),
  );
});

describe("a Vault that cannot be used", () => {
  const withSecretStored = (custody: FakeCustody) =>
    Effect.gen(function* () {
      const { folder, vault: making } = vaultOn([custody]);
      const vault = yield* making;
      yield* vault.put(request("composio", "stored"));
      return { folder, vault };
    });

  it.effect("is Locked while its holder cannot be reached: nothing is written, no key is made, and it recovers", () =>
    Effect.gen(function* () {
      const custody = fakeCustody();
      const { folder, vault } = yield* withSecretStored(custody);
      const before = snapshotOf(folder);
      const callsBefore = [...custody.calls];
      custody.locked = "The Keychain is locked.";
      expect(yield* vault.state).toMatchObject({ _tag: "Locked", reason: "The Keychain is locked." });
      for (const attempt of [
        vault.put(request("apple", "new")),
        vault.replace(request("composio", "new")),
        vault.remove("composio", "API key"),
        vault.removeAllOf("composio"),
        vault.withSecret("composio", "API key", () => Effect.void),
        vault.moveKey("keyFile"),
      ])
        expect((yield* Effect.flip(attempt)).kind).toBe("Unavailable");
      expect(snapshotOf(folder)).toEqual(before);
      expect(custody.calls).toEqual(callsBefore);
      custody.locked = null;
      expect(yield* vault.state).toMatchObject({ _tag: "Ready" });
      expect(yield* vault.withSecret("composio", "API key", (value) => Effect.succeed(Redacted.value(value)))).toBe(
        "stored",
      );
    }),
  );

  it.effect(
    "is Lost when its holder says the key is gone: nothing is made again, and removing every secret starts over",
    () =>
      Effect.gen(function* () {
        const custody = fakeCustody();
        const { folder, vault } = yield* withSecretStored(custody);
        custody.keys.clear();
        custody.calls.length = 0;
        const before = snapshotOf(folder);
        expect(yield* vault.state).toMatchObject({ _tag: "Lost" });
        expect((yield* Effect.flip(vault.put(request("apple", "new")))).kind).toBe("Unavailable");
        expect((yield* Effect.flip(vault.withSecret("composio", "API key", () => Effect.void))).kind).toBe(
          "Unavailable",
        );
        expect(snapshotOf(folder)).toEqual(before);
        expect(custody.calls).toEqual([]);
        // The owner removes the secrets, which a Lost Vault allows, and the Vault is Absent again.
        expect(yield* vault.list).toHaveLength(1);
        yield* vault.removeAllOf("composio");
        expect(yield* vault.state).toEqual({ _tag: "Absent" });
        yield* vault.put(request("composio", "again"));
        expect(yield* vault.state).toMatchObject({ _tag: "Ready" });
      }),
  );

  it.effect("is Lost when the records belong to another key than the header's", () =>
    Effect.gen(function* () {
      const custody = fakeCustody();
      const { folder, vault } = yield* withSecretStored(custody);
      const records = JSON.parse(readFileSync(recordsPathOf(folder), "utf8"));
      records.records[0].keyId = "f".repeat(32);
      writeFileSync(recordsPathOf(folder), JSON.stringify(records));
      expect(yield* vault.state).toMatchObject({ _tag: "Lost" });
    }),
  );

  it.effect("is Corrupt when a record fails to authenticate, and overwrites nothing", () =>
    Effect.gen(function* () {
      const custody = fakeCustody();
      const { folder, vault } = yield* withSecretStored(custody);
      const records = JSON.parse(readFileSync(recordsPathOf(folder), "utf8"));
      records.records[0].connectorId = "apple";
      writeFileSync(recordsPathOf(folder), JSON.stringify(records));
      const before = snapshotOf(folder);
      expect(yield* vault.state).toMatchObject({ _tag: "Corrupt" });
      for (const attempt of [vault.put(request("x", "y")), vault.remove("apple", "API key"), vault.list])
        expect((yield* Effect.flip(attempt)).kind).toBe("Unavailable");
      expect(snapshotOf(folder)).toEqual(before);
    }),
  );

  it.effect("is Corrupt when the header does not decode or names a format this build does not know", () =>
    Effect.gen(function* () {
      const { folder, vault } = yield* withSecretStored(fakeCustody());
      writeFileSync(join(folder, "header.json"), "not json");
      expect(yield* vault.state).toMatchObject({ _tag: "Corrupt", reason: "The Vault's header does not decode." });
      writeFileSync(
        join(folder, "header.json"),
        JSON.stringify({ holder: "keychain", keyId: "00".repeat(16), version: 2 }),
      );
      expect(yield* vault.state).toMatchObject({ _tag: "Corrupt" });
    }),
  );

  it.effect("is Corrupt when the header is a link in place of a file, and the link is not followed", () =>
    Effect.gen(function* () {
      const { folder, vault } = yield* withSecretStored(fakeCustody());
      const headerPath = join(folder, "header.json");
      const text = readFileSync(headerPath, "utf8");
      writeFileSync(join(folder, "elsewhere"), text);
      rmSync(headerPath);
      symlinkSync(join(folder, "elsewhere"), headerPath);
      expect(yield* vault.state).toMatchObject({ _tag: "Corrupt", reason: "header.json is not a plain file." });
    }),
  );

  it.effect("is Locked, not Lost, when this computer lacks the holder the header names", () =>
    Effect.gen(function* () {
      const { folder } = yield* withSecretStored(fakeCustody("keychain"));
      const elsewhere = yield* vaultOn([fakeCustody("keyFile")], { folder }).vault;
      expect(yield* elsewhere.state).toMatchObject({ _tag: "Locked", holder: { name: "keychain" } });
    }),
  );
});

describe("moving the key to another holder", () => {
  const stored = () =>
    Effect.gen(function* () {
      const from = fakeCustody("keychain");
      const to = fakeCustody("keyFile");
      const { folder, vault: making } = vaultOn([from, to]);
      const vault = yield* making;
      yield* vault.put(request("composio", "stays"));
      return { folder, from, to, vault };
    });
  const stillReads = (vault: typeof Vault.Service) =>
    vault.withSecret("composio", "API key", (value) => Effect.succeed(Redacted.value(value)));

  it.effect("rewrites the records under the new key, then deletes the old key", () =>
    Effect.gen(function* () {
      const { folder, from, to, vault } = yield* stored();
      yield* vault.moveKey("keyFile");
      expect(yield* vault.state).toMatchObject({ _tag: "Ready", holder: { name: "keyFile" } });
      expect(yield* stillReads(vault)).toBe("stays");
      expect(from.keys.size).toBe(0);
      expect(to.keys.size).toBe(1);
      expect(readdirSync(folder).filter((name) => name.startsWith("records-"))).toHaveLength(1);
    }),
  );

  it.effect("keeps the old key and every secret when the new holder refuses or reads back another key", () =>
    Effect.gen(function* () {
      for (const break_ of ["refuse", "wrong"] as const) {
        const { from, to, vault } = yield* stored();
        if (break_ === "refuse") to.isRefusingWrites = true;
        else to.isReadingBackWrong = true;
        expect((yield* Effect.flip(vault.moveKey("keyFile"))).kind).toBe("WriteFailed");
        expect(from.keys.size).toBe(1);
        expect(to.keys.size).toBe(0);
        expect(yield* vault.state).toMatchObject({ _tag: "Ready", holder: { name: "keychain" } });
        expect(yield* stillReads(vault)).toBe("stays");
      }
    }),
  );

  it.effect("keeps the old key and every secret when writing the new records or the header fails", () =>
    Effect.gen(function* () {
      for (const failing of ["records-", "header.json"] as const) {
        const from = fakeCustody("keychain");
        const to = fakeCustody("keyFile");
        let hasStarted = false;
        const { vault: making } = vaultOn([from, to], {
          writeFile: (path, text) =>
            hasStarted && path.includes(failing)
              ? Effect.fail(new VaultFailure({ kind: "WriteFailed", message: "disk full" }))
              : Effect.sync(() => writeFileSync(path, text)),
        });
        const vault = yield* making;
        yield* vault.put(request("composio", "stays"));
        hasStarted = true;
        expect((yield* Effect.flip(vault.moveKey("keyFile"))).message).toBe("disk full");
        hasStarted = false;
        expect(from.keys.size).toBe(1);
        expect(to.keys.size).toBe(0);
        expect(yield* vault.state).toMatchObject({ _tag: "Ready", holder: { name: "keychain" } });
        expect(yield* stillReads(vault)).toBe("stays");
      }
    }),
  );

  it.effect("refuses a holder this computer lacks, and the one that already keeps the key", () =>
    Effect.gen(function* () {
      const { vault } = yield* stored();
      expect((yield* Effect.flip(vault.moveKey("windows"))).kind).toBe("Invalid");
      expect((yield* Effect.flip(vault.moveKey("keychain"))).kind).toBe("Invalid");
    }),
  );
});

describe("protected, or no secrets", () => {
  it.effect(
    "refuses a secret, with the harness named, while an installed harness has no verified denial and the key can be read from a sandbox",
    () =>
      Effect.gen(function* () {
        const custody = fakeCustody("keyFile");
        const { folder, vault: making } = vaultOn([custody], {
          denials: Effect.succeed([
            { harness: "claude", reason: "It was readable.", status: "Unverified" },
            { harness: "codex", reason: "Denied.", status: "Verified" },
            { harness: "opencode", reason: "Not installed.", status: "NotInstalled" },
          ]),
        });
        const vault = yield* making;
        const refused = yield* Effect.flip(vault.put(request("composio", "x")));
        expect(refused).toMatchObject({
          kind: "NotProtected",
          message: "Not protected from Claude Code: It was readable.",
        });
        // Nothing was made: no header, no key.
        expect(yield* vault.state).toEqual({ _tag: "Absent" });
        expect(custody.keys.size).toBe(0);
        expect(readdirSync(folder).filter((name) => name === "header.json")).toEqual([]);
        expect(yield* vault.protection).toMatchObject({ isAllowed: false, unverified: [{ harness: "claude" }] });
      }),
  );

  it.effect("allows a secret once every installed harness is verified, asks first, or is not installed", () =>
    Effect.gen(function* () {
      const { vault: making } = vaultOn([fakeCustody("keyFile")], {
        denials: Effect.succeed([
          { harness: "claude", reason: "", status: "Verified" },
          { harness: "opencode", reason: "", status: "AsksFirst" },
          { harness: "codex", reason: "", status: "NotInstalled" },
        ]),
      });
      const vault = yield* making;
      yield* vault.put(request("composio", "x"));
      expect(yield* vault.protection).toMatchObject({ isAllowed: true });
    }),
  );

  it.effect(
    "allows a secret for a holder no sandbox can read, though a harness is unverified, and names the harness",
    () =>
      Effect.gen(function* () {
        const { vault: making } = vaultOn([fakeCustody("keychain", false)], { denials: denialsOf("Unverified") });
        const vault = yield* making;
        yield* vault.put(request("composio", "x"));
        expect((yield* vault.protection).unverified.map((entry) => entry.harness)).toEqual([
          "claude",
          "codex",
          "opencode",
        ]);
      }),
  );

  it.effect("refuses to replace a secret, or move the key to a holder a sandbox can read, once the report turns", () =>
    Effect.gen(function* () {
      let report: Effect.Effect<ReadonlyArray<VaultDenial>> = denialsOf("Verified");
      const { vault: making } = vaultOn([fakeCustody("keychain", false), fakeCustody("keyFile")], {
        denials: Effect.suspend(() => report),
      });
      const vault = yield* making;
      yield* vault.put(request("composio", "x"));
      report = denialsOf("Unverified");
      expect((yield* Effect.flip(vault.moveKey("keyFile"))).kind).toBe("NotProtected");
      yield* vault.replace(request("composio", "y"));
    }),
  );
});

describe("the Vault's folder", () => {
  it.effect("is made plain at start: a link in its place is removed, not followed, and the mode is 0700", () =>
    Effect.gen(function* () {
      const outside = temporary("outlore-outside-");
      const folder = join(temporary("outlore-parent-"), "vault");
      symlinkSync(outside, folder);
      yield* prepareVaultFolder(folder);
      expect(lstatSync(folder).isDirectory()).toBe(true);
      expect(readdirSync(outside)).toEqual([]);
      mkdirSync(join(folder, "kept"));
      chmodSync(folder, 0o755);
      yield* prepareVaultFolder(folder);
      expect(statSync(folder).mode & 0o777).toBe(0o700);
      expect(readdirSync(folder)).toEqual(["kept"]);
    }),
  );
});

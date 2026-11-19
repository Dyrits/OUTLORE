import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { HarnessName, Request } from "@outlore/contracts";
import { Effect, Layer, Redacted } from "effect";
import type { CatalogEntry, ConnectorBackend, ConnectorBackends } from "../../src/connectors/index.ts";
import { Harness, type HarnessAdapter, vaultFolderOf } from "../../src/core/index.ts";
import { fakeHarnessLayer } from "../../src/harness/index.ts";
import { readClaudeVaultDenial, runClaudeVaultDenialLive } from "../../src/harness/vaultDenials.ts";
import { serviceLayer } from "../../src/index.ts";
import { calendarEntry, failureOf, fakeBackendsLayer } from "../fixtures/connectorBackend.ts";
import { fakeClaudeLiveRun } from "../fixtures/fakeClaudeLive.ts";
import { call, read, settle, startMission, temporary } from "../fixtures/service.ts";
import { distinctiveSecret, fakeCustody } from "../fixtures/vault.ts";

// The Vault's owner requests through the whole service: the real Vault behind the gateway's port, the requests wired
// into the router, the stricter rule (a secret is stored only while every installed harness's denial is verified), and
// the live probe's stamp. Everything runs on fakes: a fake key holder, a fake harness, a stand-in `claude`.

/** A service with the real Vault over one fake key holder, and the harness given (the fake one by default). */
const vaultWorld = (
  options: {
    readonly harness?: Layer.Layer<Harness>;
    readonly backends?: Layer.Layer<ConnectorBackends>;
    readonly catalog?: ReadonlyArray<CatalogEntry>;
  } = {},
) => {
  const directory = temporary("outlore-vaultreq-");
  const custody = fakeCustody();
  const layer = serviceLayer({
    filename: join(directory, "store.sqlite"),
    harness: options.harness ?? fakeHarnessLayer("10 millis"),
    keyCustodies: [custody],
    ...(options.backends === undefined ? {} : { connectorBackends: options.backends }),
    ...(options.catalog === undefined ? {} : { connectorCatalog: options.catalog }),
    homeFolder: directory,
    scratchRoot: join(directory, "missions"),
  });
  return { custody, directory, layer, vaultFolder: vaultFolderOf(directory) };
};

const inVaultWorld = <A, E, R>(
  options: Parameters<typeof vaultWorld>[0],
  body: (world: ReturnType<typeof vaultWorld>) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const world = vaultWorld(options);
    return yield* body(world).pipe(Effect.provide(world.layer));
  });

/** A harness whose Claude Code denial is the stamp the stand-in `claude`'s live probe leaves. */
const claudeStampHarness = (
  version: string,
  live: { readonly deniedTurnReadsMarker?: boolean; readonly openTurnReadsMarker?: boolean } = {},
) =>
  Layer.effect(
    Harness,
    Effect.map(Harness, (base): HarnessAdapter => {
      const run = fakeClaudeLiveRun(version, live);
      return {
        ...base,
        readVaultDenial: (harness: HarnessName, folder: string) =>
          readClaudeVaultDenial({ command: "claude", run }, harness, folder),
        runVaultDenialLive: (harness: HarnessName, folder: string) =>
          runClaudeVaultDenialLive({ command: "claude", run }, harness, folder),
      };
    }),
  ).pipe(Layer.provide(fakeHarnessLayer("10 millis")));

/** A harness that reports every sandbox's denial unverified, as Claude Code's does before the live probe. */
const unverifiedHarness = Layer.effect(
  Harness,
  Effect.map(
    Harness,
    (base): HarnessAdapter => ({
      ...base,
      readVaultDenial: (harness: HarnessName) =>
        Effect.succeed({ harness, reason: `${harness} was not verified.`, status: "Unverified" }),
    }),
  ),
).pipe(Layer.provide(fakeHarnessLayer("10 millis")));

/** A server that refuses the connector's credentials. */
const refusingBackend: ConnectorBackend = {
  call: () => Effect.fail(failureOf("Disconnected")),
  close: Effect.void,
  listTools: () => Effect.fail(failureOf("Disconnected")),
};

const put = (connectorId: string, secret: string, kind = "API key") =>
  call({ _tag: "PutSecret", connectorId, kind, secret: Redacted.make(secret) } satisfies Request);
const replace = (connectorId: string, secret: string, kind = "API key") =>
  call({ _tag: "ReplaceSecret", connectorId, kind, secret: Redacted.make(secret) } satisfies Request);
const readVault = () => call({ _tag: "ReadVault" });
const remove = (connectorId: string, kind = "API key") => call({ _tag: "RemoveSecret", connectorId, kind });
const verify = () => call({ _tag: "VerifyClaudeVaultDenial" });
const card = (id: string) =>
  call({ _tag: "ListConnectors" }).pipe(Effect.map((cards) => cards.find((entry) => entry.id === id)));

/** Every file under a folder, as bytes, to search them for a secret. */
const filesUnder = (folder: string): Array<{ name: string; bytes: Buffer }> =>
  readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [{ bytes: readFileSync(path), name: path }];
  });

describe("the Vault's section as the owner reads it", () => {
  it.live("is empty at first, then lists a stored secret's connector, kind, date and holder, never its value", () =>
    inVaultWorld({}, () =>
      Effect.gen(function* () {
        const empty = yield* readVault();
        expect(empty).toMatchObject({ entries: [], holder: null, state: "Absent" });
        const secret = distinctiveSecret();
        const after = yield* put("composio", secret);
        expect(after.state).toBe("Ready");
        expect(after.holder).toEqual({ isReadableFromSandbox: true, label: "Fake keychain" });
        expect(after.entries).toHaveLength(1);
        expect(after.entries[0]).toMatchObject({ connectorId: "composio", holder: "Fake keychain", kind: "API key" });
        expect(Object.keys(after.entries[0] ?? {}).sort()).toEqual(["addedAt", "connectorId", "holder", "kind"]);
        expect(JSON.stringify(after)).not.toContain(secret);
      }),
    ),
  );

  it.live("refuses a second secret of the same kind, replaces one that exists, and removes one idempotently", () =>
    inVaultWorld({}, () =>
      Effect.gen(function* () {
        yield* put("composio", "first");
        const twice = yield* Effect.flip(put("composio", "second"));
        expect(twice).toMatchObject({ kind: "InvalidInput" });
        const missing = yield* Effect.flip(replace("apple", "x"));
        expect(missing).toMatchObject({ kind: "NotFound" });
        yield* replace("composio", "second");
        expect((yield* readVault()).entries).toHaveLength(1);
        yield* remove("composio");
        expect((yield* readVault()).entries).toEqual([]);
        // Removing one already gone is not a failure.
        yield* remove("composio");
        expect((yield* readVault()).entries).toEqual([]);
      }),
    ),
  );

  it.live("refuses a connector, a kind or a value it cannot store", () =>
    inVaultWorld({}, () =>
      Effect.gen(function* () {
        expect(yield* Effect.flip(put("not a connector", "x"))).toMatchObject({ kind: "InvalidInput" });
        expect(yield* Effect.flip(put("composio", ""))).toMatchObject({ kind: "InvalidInput" });
        expect(yield* Effect.flip(put("composio", "x", "kind with !"))).toMatchObject({ kind: "InvalidInput" });
      }),
    ),
  );

  it.live(
    "keeps a stored secret out of every file of the service and out of every plain rendering of the request",
    () =>
      inVaultWorld({}, (world) =>
        Effect.gen(function* () {
          const secret = distinctiveSecret();
          yield* put("composio", secret);
          yield* replace("composio", `${secret}-rotated`);
          const rotated = `${secret}-rotated`;
          for (const file of filesUnder(world.directory)) {
            expect(file.bytes.includes(Buffer.from(secret)), file.name).toBe(false);
            expect(file.bytes.includes(Buffer.from(rotated)), file.name).toBe(false);
          }
          expect(
            JSON.stringify({
              _tag: "PutSecret",
              connectorId: "composio",
              kind: "API key",
              secret: Redacted.make(secret),
            }),
          ).not.toContain(secret);
          expect(`${Redacted.make(secret)}`).not.toContain(secret);
          const view = yield* readVault();
          expect(JSON.stringify(view)).not.toContain(rotated);
          // The Vault's folder holds only its own files, each mode 0600, and the stamp file is not there without a probe.
          expect(statSync(world.vaultFolder).mode & 0o777).toBe(0o700);
          for (const name of readdirSync(world.vaultFolder)) {
            expect(statSync(join(world.vaultFolder, name)).mode & 0o777).toBe(0o600);
          }
        }),
      ),
  );
});

describe("the protected-or-no-secrets rule over the requests", () => {
  it.live("refuses to store while a harness's denial is unverified, and names it in the Vault's view", () =>
    inVaultWorld({ harness: unverifiedHarness }, () =>
      Effect.gen(function* () {
        const view = yield* readVault();
        expect(view.protection.isAllowed).toBe(false);
        expect(view.protection.reason).toContain("Not protected from");
        expect(view.protection.unverified.map((entry) => entry.harness)).toContain("Claude Code");
        const refused = yield* Effect.flip(put("composio", distinctiveSecret()));
        expect(refused).toMatchObject({ kind: "AccessRefused" });
        expect(refused.message).toContain("Not protected from");
        expect((yield* readVault()).entries).toEqual([]);
      }),
    ),
  );

  it.live(
    "stores once the owner-run live probe has verified Claude Code's denial, and the stamp is in the Vault's folder",
    () =>
      inVaultWorld({ harness: claudeStampHarness("2.1.326") }, (world) =>
        Effect.gen(function* () {
          // No stamp yet: the Vault refuses.
          expect(yield* Effect.flip(put("composio", distinctiveSecret()))).toMatchObject({ kind: "AccessRefused" });
          const check = yield* verify();
          expect(check).toMatchObject({ status: "Verified" });
          expect(check.reason).toContain("2.1.326");
          // The stamp is in the Vault's folder, and the rule reads it again without a restart.
          expect(readdirSync(world.vaultFolder)).toContain("claude-denial-stamp.json");
          expect((yield* readVault()).protection.isAllowed).toBe(true);
          const secret = distinctiveSecret();
          yield* put("composio", secret);
          expect((yield* readVault()).entries).toHaveLength(1);
          expect(JSON.stringify(yield* readVault())).not.toContain(secret);
        }),
      ),
  );

  it.live("keeps refusing when the live probe fails closed, and says what it saw", () =>
    inVaultWorld({ harness: claudeStampHarness("2.1.326", { deniedTurnReadsMarker: true }) }, () =>
      Effect.gen(function* () {
        const check = yield* verify();
        expect(check).toMatchObject({ status: "Unverified" });
        expect(check.reason).toContain("could read the Vault's folder");
        expect(yield* Effect.flip(put("composio", distinctiveSecret()))).toMatchObject({ kind: "AccessRefused" });
      }),
    ),
  );
});

describe("a replaced secret clearing the connector's Needs connecting", () => {
  it.live("clears it only on replace, as the owner has given the connector a new key", () =>
    inVaultWorld({ backends: fakeBackendsLayer({ calendar: refusingBackend }), catalog: [calendarEntry] }, () =>
      Effect.gen(function* () {
        // The secret is stored first, so installing meets a server that refuses it: Needs connecting.
        yield* put("calendar", distinctiveSecret());
        const installed = yield* call({ _tag: "InstallConnector", connectorId: "calendar", hasConfirmedNotice: true });
        expect(installed).toMatchObject({
          needs: expect.stringContaining("refused its sign-in"),
          state: "NeedsConnecting",
        });
        // Storing again over the same kind is refused; replacing is what clears the refusal.
        expect(yield* Effect.flip(put("calendar", distinctiveSecret()))).toMatchObject({ kind: "InvalidInput" });
        expect((yield* card("calendar"))?.needs).not.toBeNull();
        yield* replace("calendar", distinctiveSecret());
        expect((yield* card("calendar"))?.needs).toBeNull();
        expect((yield* card("calendar"))?.state).toBe("Ready");
      }),
    ),
  );
});

describe("a thread reaching for the Vault's requests", () => {
  it.live("finds no tool by which to read or change the Vault", () =>
    inVaultWorld({}, () =>
      Effect.gen(function* () {
        yield* put("composio", distinctiveSecret());
        const started = yield* startMission({
          text: "call ReadVault {}\ncall PutSecret {}\ncall ReplaceSecret {}\ncall RemoveSecret {}\ncall VerifyClaudeVaultDenial {}",
        });
        const done = yield* settle(
          started.missionId,
          (detail) => detail.thread.state === "Idle" && detail.messages.some((message) => message.sender === "agent"),
        );
        const reply = done.messages.filter((message) => message.sender === "agent").at(-1)?.text ?? "";
        expect(reply).toBe(
          "Echo: Unknown tool: ReadVault | Unknown tool: PutSecret | Unknown tool: ReplaceSecret | Unknown tool: RemoveSecret | Unknown tool: VerifyClaudeVaultDenial",
        );
        expect(done.questions).toEqual([]);
        // The Vault is unchanged.
        expect((yield* readVault()).entries).toHaveLength(1);
        void read;
      }),
    ),
  );
});

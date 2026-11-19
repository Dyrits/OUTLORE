import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import { fakeHarnessLayer, serviceLayer } from "../../src/index.ts";
import { Vault } from "../../src/vault/index.ts";
import { call, databaseFile, read, start } from "../fixtures/approvals.ts";
import { temporary } from "../fixtures/service.ts";
import { fakeCustody, request } from "../fixtures/vault.ts";

/** Every way a secret could be written down: raw, URL-encoded, base64 (both alphabets) and hex. */
const formsOf = (secret: string) => [
  secret,
  encodeURIComponent(secret),
  Buffer.from(secret).toString("base64"),
  Buffer.from(secret).toString("base64url"),
  Buffer.from(secret).toString("hex"),
];

/** The files under a folder, with their bytes. */
const filesUnder = (folder: string): Array<string> =>
  readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

/** The forms of the secret found in any file under the folder, as `path: form` lines (never the secret itself in a message). */
const foundIn = (folder: string, secret: string) =>
  filesUnder(folder).flatMap((path) => {
    const bytes = readFileSync(path);
    return formsOf(secret)
      .filter((form) => bytes.includes(Buffer.from(form)))
      .map((_, index) => `${path.slice(folder.length)} holds form ${index}`);
  });

/** A secret from an alphabet that urlencodes and base64-encodes differently, never the same twice. */
const randomSecret = () => `sk-${randomBytes(9).toString("base64")}+/ &=%${randomBytes(4).toString("hex")}`;

describe("a secret appears nowhere but sealed in the Vault, and nowhere after removal", () => {
  it.live(
    "keeps every secret out of the data folder in clear, the service's answers and its own errors, through a turn and a removal",
    () => {
      const filename = databaseFile();
      const custody = fakeCustody("keychain", false);
      const layer = serviceLayer({
        filename,
        harness: fakeHarnessLayer("10 millis"),
        homeFolder: dirname(filename),
        keyCustodies: [custody],
        scratchRoot: join(dirname(filename), "missions"),
      });
      return Effect.gen(function* () {
        const vault = yield* Vault;
        for (let round = 0; round < 6; round++) {
          const secret = randomSecret();
          const connector = `connector_${round}`;
          yield* vault.put(request(connector, secret));
          // A turn runs while the secret is stored, and the secret is used through the only read.
          const started = yield* start("Hello");
          const used = yield* vault.withSecret(connector, "API key", (value) =>
            Effect.succeed(Redacted.value(value).length),
          );
          expect(used).toBe(secret.length);
          const seen = JSON.stringify([
            yield* read(started.missionId),
            yield* call({ _tag: "ListOpenQuestions" }),
            yield* call({ _tag: "ReadSettings" }),
            yield* vault.list,
            yield* vault.state,
            yield* vault.protection,
            // The Vault's own refusals say nothing of a value either.
            yield* Effect.flip(vault.put(request(connector, secret))),
            yield* Effect.flip(vault.withSecret("other", "API key", () => Effect.void)),
          ]);
          for (const form of formsOf(secret)) expect(seen).not.toContain(form);
          expect(foundIn(dirname(filename), secret)).toEqual([]);
          // The key is in the holder, never in a file here.
          for (const key of custody.keys.values())
            expect(
              filesUnder(dirname(filename)).map((path) => readFileSync(path).includes(key.toString("hex"))),
            ).not.toContain(true);
          yield* vault.removeAllOf(connector);
          expect(foundIn(dirname(filename), secret)).toEqual([]);
          expect((yield* vault.list).map((entry) => entry.connectorId)).not.toContain(connector);
        }
      }).pipe(Effect.provide(layer));
    },
  );
});

describe("the search for a secret", () => {
  it("finds it in clear, URL-encoded, base64 and hex, so a clean result means something", () => {
    const folder = temporary("outlore-search-");
    const secret = randomSecret();
    for (const [index, form] of formsOf(secret).entries())
      writeFileSync(join(folder, `form-${index}`), `before ${form} after`);
    const files = new Set(foundIn(folder, secret).map((line) => line.split(" ")[0]));
    expect([...files].sort()).toEqual(formsOf(secret).map((_, index) => `/form-${index}`));
  });
});

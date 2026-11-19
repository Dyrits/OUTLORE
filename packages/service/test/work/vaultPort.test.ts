import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SecretMissing, VaultUnavailable } from "../../src/connectors/index.ts";
import { vaultPortOf } from "../../src/work/vaultWiring.ts";
import { denialsOf, distinctiveSecret, fakeCustody, request, vaultOn } from "../fixtures/vault.ts";

describe("the real Vault behind the gateway's VaultPort", () => {
  it.effect("says whether it holds a secret, and lends the value only to the callback", () =>
    Effect.gen(function* () {
      const custody = fakeCustody();
      const { vault: making } = vaultOn([custody]);
      const vault = yield* making;
      const port = vaultPortOf(vault);
      const secret = distinctiveSecret();
      expect(yield* port.holds("composio", "API key")).toBe(false);
      yield* vault.put(request("composio", secret));
      expect(yield* port.holds("composio", "API key")).toBe(true);
      expect(yield* port.holds("composio", "token")).toBe(false);
      // The callback gets a plain string, and the Vault keeps no copy of it after.
      expect(yield* port.withSecret("composio", "API key", (value) => Effect.succeed(value))).toBe(secret);
      expect(yield* Effect.flip(port.withSecret("apple", "API key", () => Effect.void))).toBeInstanceOf(SecretMissing);
    }),
  );

  it.effect("removes every secret of a connector, idempotently", () =>
    Effect.gen(function* () {
      const { vault: making } = vaultOn([fakeCustody()]);
      const vault = yield* making;
      const port = vaultPortOf(vault);
      yield* vault.put(request("composio", "first"));
      yield* vault.put(request("composio", "token", "token"));
      yield* vault.put(request("apple", "second"));
      yield* port.removeAllOf("composio");
      expect(yield* port.holds("composio", "API key")).toBe(false);
      expect(yield* port.holds("composio", "token")).toBe(false);
      expect(yield* port.holds("apple", "API key")).toBe(true);
      yield* port.removeAllOf("composio");
      expect(yield* port.holds("apple", "API key")).toBe(true);
    }),
  );

  it.effect("answers a locked Vault as VaultUnavailable, and a missing secret as SecretMissing", () =>
    Effect.gen(function* () {
      const custody = fakeCustody();
      const { vault: making } = vaultOn([custody]);
      const vault = yield* making;
      const port = vaultPortOf(vault);
      yield* vault.put(request("composio", "first"));
      custody.locked = "The keychain is locked.";
      const unavailable = yield* Effect.flip(port.holds("composio", "API key"));
      expect(unavailable).toBeInstanceOf(VaultUnavailable);
      expect((unavailable as VaultUnavailable).reason).toBe("Locked");
      const missing = yield* Effect.flip(port.withSecret("composio", "API key", () => Effect.void));
      expect(missing).toBeInstanceOf(VaultUnavailable);
      // Unlocked again, a secret the Vault does not hold is SecretMissing, not a Vault failure.
      custody.locked = null;
      const absent = yield* Effect.flip(port.withSecret("apple", "API key", () => Effect.void));
      expect(absent).toBeInstanceOf(SecretMissing);
    }),
  );

  it.effect("lets a connector that needs no secret through without the Vault", () =>
    Effect.gen(function* () {
      // A Vault that is Absent answers holds with false and withSecret with SecretMissing, never with a value.
      const { vault: making } = vaultOn([fakeCustody()], { denials: denialsOf("Verified") });
      const port = vaultPortOf(yield* making);
      expect(yield* port.holds("apple", "API key")).toBe(false);
      expect((yield* Effect.flip(port.withSecret("apple", "API key", () => Effect.void)))._tag).toBe("SecretMissing");
    }),
  );
});

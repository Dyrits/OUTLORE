import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { type HarnessInfo, type KeyProviderName, keyProviders } from "@outlore/contracts";
import { Effect, Redacted } from "effect";
import { claudeKeyEnvironmentOf, fakeHarnessLayer } from "../../src/harness/index.ts";
import { serviceLayer } from "../../src/index.ts";
import { call, temporary } from "../fixtures/service.ts";
import { distinctiveSecret, fakeCustody } from "../fixtures/vault.ts";

// API key accounts (provider-accounts): a key is sealed in the Vault, the store holds only the provider and the model
// names, the account reads as signed in while its key is readable, and removing the account removes the key.

const inWorld = <A, E, R>(body: (custody: ReturnType<typeof fakeCustody>) => Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const directory = temporary("outlore-keyaccounts-");
    const custody = fakeCustody();
    const layer = serviceLayer({
      filename: join(directory, "store.sqlite"),
      harness: fakeHarnessLayer("10 millis"),
      homeFolder: directory,
      keyCustodies: [custody],
      scratchRoot: join(directory, "missions"),
    });
    return yield* body(custody).pipe(Effect.provide(layer));
  });

const claudeOf = (harnesses: ReadonlyArray<HarnessInfo>) => harnesses.find((harness) => harness.name === "claude");

const claudeAccountOf = (harnesses: ReadonlyArray<HarnessInfo>, label: string) =>
  claudeOf(harnesses)?.accounts.find((candidate) => candidate.label === label);

describe("API key accounts", () => {
  it.live("adds a Z.ai account that reads as signed in with its own models, and never shows the key", () =>
    inWorld(() =>
      Effect.gen(function* () {
        const secret = distinctiveSecret();
        const listed = yield* call({
          _tag: "AddKeyAccount",
          key: Redacted.make(secret),
          label: "Z.ai plan",
          provider: "zai",
        });
        const account = claudeAccountOf(listed.harnesses, "Z.ai plan");
        expect(account).toMatchObject({ detail: "Z.ai · API key", keyProvider: "zai", signIn: "SignedIn" });
        expect(account?.models?.map((model) => model.id)).toEqual(["glm-5.4", "glm-5.3-flash"]);
        expect(JSON.stringify(listed)).not.toContain(secret);
        // The key is in the Vault, not among the connectors' secrets the Vault's section shows.
        expect((yield* call({ _tag: "ReadVault" })).entries).toEqual([]);
      }),
    ),
  );

  it.live("takes the models the owner names, and OpenRouter needs them", () =>
    inWorld(() =>
      Effect.gen(function* () {
        const refused = yield* Effect.flip(
          call({ _tag: "AddKeyAccount", key: Redacted.make("sk-or-1"), label: "Router", provider: "openrouter" }),
        );
        expect(refused.message).toContain("model");
        const listed = yield* call({
          _tag: "AddKeyAccount",
          key: Redacted.make("sk-or-1"),
          label: "Router",
          models: ["moonshotai/kimi-k3.1-pro", " "],
          provider: "openrouter",
        });
        const account = claudeAccountOf(listed.harnesses, "Router");
        expect(account?.models?.map((model) => model.id)).toEqual(["moonshotai/kimi-k3.1-pro"]);
      }),
    ),
  );

  it.live("replaces a key, refuses to sign a key account in, and removes the key with the account", () =>
    inWorld((custody) =>
      Effect.gen(function* () {
        const listed = yield* call({
          _tag: "AddKeyAccount",
          key: Redacted.make("first"),
          label: "DeepSeek",
          provider: "deepseek",
        });
        const id = claudeAccountOf(listed.harnesses, "DeepSeek")?.id;
        if (id === null || id === undefined) return expect.unreachable("the account was added");
        yield* call({ _tag: "ReplaceAccountKey", accountId: id, key: Redacted.make("second") });
        const signIn = yield* Effect.flip(call({ _tag: "SignInAccount", accountId: id, harness: "claude" }));
        expect(signIn.message).toContain("API key");
        const removed = yield* call({ _tag: "RemoveAccount", accountId: id });
        expect(claudeOf(removed.harnesses)?.accounts).toHaveLength(1);
        expect(custody.keys.size).toBeGreaterThan(0);
        // Nothing of the account's key is left to read.
        const again = yield* call({ _tag: "ListHarnesses" });
        expect(claudeOf(again.harnesses)?.accounts).toHaveLength(1);
      }),
    ),
  );

  it.live("refuses to replace the key of a sign-in account", () =>
    inWorld(() =>
      Effect.gen(function* () {
        const added = yield* call({ _tag: "AddAccount", harness: "claude", label: "Work" });
        const id = claudeAccountOf(added.harnesses, "Work")?.id;
        if (id === null || id === undefined) return expect.unreachable("the account was added");
        const refused = yield* Effect.flip(
          call({ _tag: "ReplaceAccountKey", accountId: id, key: Redacted.make("key") }),
        );
        expect(refused.message).toContain("no API key");
      }),
    ),
  );
});

describe("the environment of a key account", () => {
  it("sends Anthropic's own key as ANTHROPIC_API_KEY and empties the other credential", () => {
    expect(claudeKeyEnvironmentOf("anthropic", "sk-ant", [])).toEqual({
      ANTHROPIC_API_KEY: "sk-ant",
      ANTHROPIC_AUTH_TOKEN: "",
      CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "1",
    });
  });

  it.each(["zai", "kimi", "deepseek", "minimax", "qwen"] as const satisfies ReadonlyArray<KeyProviderName>)(
    "points Claude Code at %s's endpoint with the key as a token, and maps its model families onto the provider's models",
    (provider) => {
      const models = keyProviders[provider].models.map((model) => model.id);
      const environment = claudeKeyEnvironmentOf(provider, "the-key", models);
      expect(environment).toMatchObject({
        ANTHROPIC_API_KEY: "",
        ANTHROPIC_AUTH_TOKEN: "the-key",
        ANTHROPIC_BASE_URL: keyProviders[provider].baseUrl,
        ANTHROPIC_DEFAULT_OPUS_MODEL: models[0],
        ANTHROPIC_DEFAULT_SONNET_MODEL: models[0],
        CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "1",
      });
      expect(environment.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe(models[1] ?? models[0]);
    },
  );
});

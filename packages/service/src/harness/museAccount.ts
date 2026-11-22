import { MuseClient } from "@muse-code/sdk";
import type { EffortChoice, ModelOption } from "@outlore/contracts";
import { Effect } from "effect";
import { fieldOf, HarnessFailure, reducedEnvironmentOf, textFieldOf } from "../core/index.ts";
import { museReasoningEffortOf } from "./museProtocol.ts";

// Muse's catalog and sign_in, read through a short-lived `muse serve` host (upstream pinned the same SDK
// for its Muse driver). The model list is provider-qualified — `provider/<model>` — because Muse's
// `session/setModel` routes by `providerId` beside `modelId`, and the profile a pick was made from can
// supply a different provider (docs/architecture/providers.md, Muse: the SDK supplies `sessionMcp` and
// reads durable items to recover missed events).

/**
 * Splits a qualified Muse model id back into the upstream provider and the model id; null when the id is
 * not qualified. The provider part is URI-encoded, so the first slash is always the separator.
 */
export const museModelPartsOf = (id: string): { readonly model: string; readonly provider: string } | null => {
  const separator = id.indexOf("/");
  if (separator < 1) return null;
  try {
    return { model: id.slice(separator + 1), provider: decodeURIComponent(id.slice(0, separator)) };
  } catch {
    return null;
  }
};

/** The model selection a qualified id names, for Muse's `session/setModel` and `session/start`; null for the default. */
export const museModelSelectionOf = (
  model: string,
): { readonly modelId: string; readonly providerId: string } | null => {
  if (model === "default") return null;
  const parts = museModelPartsOf(model);
  return parts === null ? null : { modelId: parts.model, providerId: parts.provider };
};

/** Selects a catalog's rows as Outlore lists them, qualifying each id with its provider; empty when the row is malformed. */
export const museModelOptionsOf = (list: unknown): Array<ModelOption> => {
  if (typeof list !== "object" || list === null) return [];
  const models = fieldOf(list, "models");
  if (!Array.isArray(models)) return [];
  const efforts = (model: unknown): Array<EffortChoice> => {
    const variants = fieldOf(model, "variants");
    return Array.isArray(variants)
      ? variants.flatMap((variant) =>
          typeof variant === "string" && museReasoningEffortOf(variant) !== null ? [variant] : [],
        )
      : [];
  };
  return models.flatMap((model): Array<ModelOption> => {
    const id = textFieldOf(model, "modelId");
    const provider = textFieldOf(model, "providerId");
    if (id === null || provider === null) return [];
    const qualified = `${encodeURIComponent(provider)}/${id}`;
    return [
      {
        efforts: efforts(model),
        id: qualified,
        label: textFieldOf(model, "displayLabel") ?? qualified,
      },
    ];
  });
};

/** What the service tells a spawned Muse host about itself. */
const clientInfo = { name: "outlore", title: "Outlore", version: "0.0.0" };

/** Starts a short-lived Muse host with the account's environment, for reads the registry needs between turns. */
const withMuseHost = <A>(
  command: string,
  prefixArgs: ReadonlyArray<string>,
  read: (client: MuseClient) => Promise<A>,
): Effect.Effect<A, HarnessFailure> =>
  Effect.gen(function* () {
    const client = yield* Effect.tryPromise({
      catch: (error) => museStartFailure(error),
      try: () =>
        MuseClient.spawn({
          args: [...prefixArgs, "serve"],
          clientInfo,
          env: reducedEnvironmentOf({}),
          museBin: command,
        }),
    });
    return yield* Effect.tryPromise({
      catch: (error) => museAnswerFailure(error),
      try: async () => {
        try {
          return await read(client);
        } finally {
          await client.close().catch(() => undefined);
        }
      },
    });
  });

/** A host start failure, in the words the owner reads. */
const museStartFailure = (error: unknown): HarnessFailure =>
  new HarnessFailure({
    reason: `Muse's host did not start: ${String(error instanceof Error ? error.message : error)}`,
  });

/** A host answer failure, in the words the owner reads. */
const museAnswerFailure = (error: unknown): HarnessFailure =>
  new HarnessFailure({ reason: `Muse did not answer: ${String(error instanceof Error ? error.message : error)}` });

/**
 * The models a Muse host accepts, each qualified with its provider, as its `model/list` answers them; none
 * when the host could not be asked. A cached list never proves sign-in (upstream's own limit), so the
 * picker shows the list while the account's state stays whatever `readMuseSignIn` reports.
 */
export const listMuseModels = (
  command: string,
  prefixArgs: ReadonlyArray<string> = [],
): Effect.Effect<ReadonlyArray<ModelOption>, HarnessFailure> =>
  withMuseHost(command, prefixArgs, (client) => client.listModels()).pipe(Effect.map(museModelOptionsOf));

/**
 * Who a Muse sign-in is, as its own CLI says. UNVERIFIED, and deliberately Unknown: `muse login` needs a
 * terminal the service cannot give (upstream starts the `muse serve` device sign-in for the same reason),
 * and the account probe (`account/read`) rides experimental MSP this session host never opts into — the
 * surface a live check must still confirm before this returns anything but Unknown.
 */
export const readMuseSignIn = (): Effect.Effect<{ detail: string | null; signIn: "Unknown" }> =>
  Effect.succeed({ detail: null, signIn: "Unknown" });

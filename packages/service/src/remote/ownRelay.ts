import { newRoomName } from "@outlore/channel";
import { closeCodes, connectClient, relayWorkerBundle, relayWorkerCompatibilityDate } from "@outlore/relay";
import { Duration, Effect, Schema } from "effect";
import { fieldOf, isRecord } from "../core/records.ts";

// A user who does not want to share the project's relay deploys the same Worker to their own Cloudflare account with
// one API token (device-pairing, own relay). The token is used for this one deployment: it is never stored, never
// logged, and sent only to Cloudflare's API.

/** Where Cloudflare's API lives; the token is sent nowhere else. */
export const cloudflareApiBase = "https://api.cloudflare.com/client/v4";

/** What marks a Worker as made by this feature, so a Worker of the same name that someone else made is left alone. */
export const ownRelayTag = "outlore-relay";

/** The Worker's name on the user's account, and so the first part of its address. */
export const defaultWorkerName = "outlore-relay";

/** One call to Cloudflare's API; `form` is a multipart upload, `body` a JSON one. */
export type CloudflareCall = {
  readonly body?: unknown;
  readonly form?: FormData;
  readonly method: "GET" | "POST" | "PUT";
  readonly path: string;
};

/** What Cloudflare answered: the HTTP status, and the body when it was JSON. */
export type CloudflareAnswer = {
  readonly json: unknown;
  readonly status: number;
};

/** Cloudflare's API as one account's token sees it; a stand-in answers in tests. */
export interface CloudflareApi {
  call(request: CloudflareCall): Promise<CloudflareAnswer>;
}

const callMillis = 30_000;

/** Cloudflare's API with `token` as the bearer; the only place the token leaves this process. */
export const cloudflareApiFor = (token: string, fetchImpl: typeof fetch = fetch): CloudflareApi => ({
  call: async (request) => {
    const hasJson = request.body !== void 0;
    const body = request.form ?? (hasJson ? JSON.stringify(request.body) : null);
    const response = await fetchImpl(`${cloudflareApiBase}${request.path}`, {
      ...(body === null ? {} : { body }),
      headers: { Authorization: `Bearer ${token}`, ...(hasJson ? { "Content-Type": "application/json" } : {}) },
      method: request.method,
      // The token must never follow a redirect somewhere else.
      redirect: "error",
      signal: AbortSignal.timeout(callMillis),
    });
    const text = await response.text();
    try {
      return { json: JSON.parse(text) as unknown, status: response.status };
    } catch {
      return { json: null, status: response.status };
    }
  },
});

const deployFailureKinds = Schema.Literals([
  "cloudflare-error",
  "many-accounts",
  "name-taken",
  "no-account",
  "no-permission",
  "not-ready",
  "token-rejected",
  "unreachable",
]);

/** Why deploying the owner's own relay failed, naming the step that refused. */
export type DeployFailureKind = typeof deployFailureKinds.Type;

/** How a deployment ended: the relay's address, or why it could not be made and what the user can do. */
export type DeployResult =
  | {
      readonly accountName: string;
      /** Whether the account had no workers.dev subdomain, so one was made. */
      readonly hasCreatedSubdomain: boolean;
      readonly ok: true;
      readonly origin: string;
      /** Whether this replaced a relay this feature deployed before. */
      readonly wasUpdated: boolean;
      readonly workerName: string;
    }
  | { readonly failure: DeployFailureKind; readonly message: string; readonly ok: false };

/** What a deployment takes: the Cloudflare account to reach, and how the fresh address is probed. */
export type DeployOptions = {
  /** Asks whether the relay at an address answers; the default opens a connection and reads the relay's reply. */
  readonly answers?: (origin: string) => Promise<boolean>;
  readonly api: CloudflareApi;
  /** How many times to ask whether the new address answers: a fresh workers.dev address takes a moment. */
  readonly attempts?: number;
  readonly pauseMillis?: number;
  /** The token, only so that no message ever repeats it. */
  readonly token: string;
  readonly workerName?: string;
};

const tokenWords = "Create it from the “Edit Cloudflare Workers” template and paste all of it.";
const messages = {
  "no-account": "That token does not give access to any Cloudflare account.",
  "no-permission": `That token is not allowed to deploy Workers. ${tokenWords}`,
  "not-ready":
    "The relay was deployed to your account but does not answer yet. Wait a minute and try again; Outlore still uses its previous relay.",
  "token-rejected": `Cloudflare did not accept that token. ${tokenWords}`,
  unreachable: "Could not reach Cloudflare. Check your internet connection.",
} as const;

/** Stops the deployment at the step that refused, with what the user can do about it. */
export class DeployStopped extends Schema.TaggedError<DeployStopped>()("DeployStopped", {
  failure: deployFailureKinds,
  message: Schema.String,
}) {}

/** The first of the `errors` Cloudflare lists in a reply, or null when the reply lists none. */
const firstErrorOf = (json: unknown): Record<string, unknown> | null => {
  const errors = fieldOf(json, "errors");
  if (!Array.isArray(errors)) return null;
  const first: unknown = errors[0];
  return isRecord(first) ? first : null;
};

const errorTextOf = (json: unknown): string => {
  const message = firstErrorOf(json)?.message;
  return typeof message === "string" ? message : "no reason given";
};

const errorCodeOf = (json: unknown): number | null => {
  const code = firstErrorOf(json)?.code;
  return typeof code === "number" ? code : null;
};

const resultOf = (json: unknown): unknown => fieldOf(json, "result") ?? null;

const hexOf = (length: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) => byte.toString(16).padStart(2, "0")).join("");

/** Whether a relay answers at `origin`: a device with no host in a fresh room is turned away with "host offline". */
export const relayAnswers = async (origin: string): Promise<boolean> => {
  const connected = await Effect.runPromise(
    connectClient({ relayOrigin: origin, room: newRoomName() }).pipe(
      Effect.match({
        onFailure: () => ({ ok: false as const }),
        onSuccess: (value) => ({ ok: true as const, value }),
      }),
    ),
  );
  if (!connected.ok) return false;
  const { carrier, closeCode } = connected.value;
  const code = await new Promise<number | null>((resolve) => {
    const timer = setTimeout(() => resolve(closeCode()), 5_000);
    carrier.onClose(() => {
      clearTimeout(timer);
      resolve(closeCode());
    });
  });
  carrier.close();
  return code === closeCodes.hostOffline;
};

/** What a successful answer to the list of accounts holds: each account's id and its name. */
const accountsOf = (json: unknown) => {
  const result = resultOf(json);
  return (Array.isArray(result) ? result : []).flatMap((entry: unknown) => {
    const id = fieldOf(entry, "id");
    const name = fieldOf(entry, "name");
    return typeof id === "string" ? [{ id, name: typeof name === "string" ? name : id }] : [];
  });
};

/** The steps of one deployment, which stops at the first refusal. */
const deploymentOf = (options: DeployOptions) => {
  const { api, token } = options;
  const workerName = options.workerName ?? defaultWorkerName;
  const scrub = (text: string) => (token === "" ? text : text.split(token).join("[token]"));
  const stop = (failure: DeployFailureKind, message: string) => new DeployStopped({ failure, message });
  // Any call that does not get an answer, whatever the reason, is a Cloudflare that cannot be reached.
  const ask = (request: CloudflareCall) =>
    Effect.tryPromise({ catch: () => stop("unreachable", messages.unreachable), try: () => api.call(request) });

  const call = Effect.fnUntraced(function* (step: string, request: CloudflareCall, accepted: readonly number[] = []) {
    const answer = yield* ask(request);
    if (answer.status >= 200 && answer.status < 300) return answer;
    if (accepted.includes(answer.status)) return answer;
    const code = errorCodeOf(answer.json);
    // Cloudflare answers a token it does not know with 403 and code 9109, and one that is not shaped like a token
    // with 400 and code 6003 or 6111 (seen on 2026-11-12), so the code says it, not the status.
    if (answer.status === 401 || code === 9109 || code === 6003 || code === 6111)
      return yield* stop("token-rejected", messages["token-rejected"]);
    if (answer.status === 403) return yield* stop("no-permission", messages["no-permission"]);
    return yield* stop(
      "cloudflare-error",
      scrub(`Cloudflare refused “${step}” (${answer.status}): ${errorTextOf(answer.json)}.`),
    );
  });

  const chooseAccount = Effect.fnUntraced(function* () {
    const listed = yield* call("list your accounts", { method: "GET", path: "/accounts" });
    const accounts = accountsOf(listed.json);
    const [account, ...others] = accounts;
    if (account === void 0) return yield* stop("no-account", messages["no-account"]);
    if (others.length > 0)
      return yield* stop(
        "many-accounts",
        `That token reaches ${accounts.length} Cloudflare accounts (${accounts.map((entry) => entry.name).join(", ")}). When you create it, choose one account under Account Resources.`,
      );
    return account;
  });

  /** The account's workers.dev subdomain, and whether this call made it. */
  const subdomainOf = Effect.fnUntraced(function* (base: string) {
    const answer = yield* call("read your workers.dev subdomain", { method: "GET", path: `${base}/subdomain` }, [404]);
    const existing = fieldOf(resultOf(answer.json), "subdomain");
    if (typeof existing === "string" && answer.status === 200) return { hasCreated: false, subdomain: existing };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const wanted = `outlore-${yield* Effect.sync(() => hexOf(4))}`;
      const made = yield* ask({ body: { subdomain: wanted }, method: "PUT", path: `${base}/subdomain` });
      if (made.status === 401) return yield* stop("token-rejected", messages["token-rejected"]);
      if (made.status === 403) return yield* stop("no-permission", messages["no-permission"]);
      if (made.status >= 200 && made.status < 300) return { hasCreated: true, subdomain: wanted };
      if (attempt === 2)
        return yield* stop(
          "cloudflare-error",
          scrub(`Cloudflare refused “create your workers.dev subdomain” (${made.status}): ${errorTextOf(made.json)}.`),
        );
    }
    return yield* stop("cloudflare-error", "Cloudflare did not give your account a workers.dev subdomain.");
  });

  /** Whether a Worker of this name already exists; one that this feature did not make is left alone. */
  const existsOf = Effect.fnUntraced(function* (base: string) {
    const known = yield* call(
      "look for an existing relay",
      { method: "GET", path: `${base}/scripts/${workerName}/settings` },
      [404],
    );
    const isKnown = known.status === 200;
    if (isKnown) {
      const tags = fieldOf(resultOf(known.json), "tags");
      if (!Array.isArray(tags) || !tags.includes(ownRelayTag))
        return yield* stop(
          "name-taken",
          `Your account already has a Worker named “${workerName}” that Outlore did not create, so it was left as it is. Rename or delete it in Cloudflare, then try again.`,
        );
    }
    return isKnown;
  });

  const upload = Effect.fnUntraced(function* (base: string, isUpdate: boolean) {
    // The Durable Object is created by the first upload's migration; Cloudflare refuses the same migration again.
    const metadata = {
      bindings: [{ class_name: "Room", name: "ROOM", type: "durable_object_namespace" }],
      compatibility_date: relayWorkerCompatibilityDate,
      main_module: "worker.js",
      ...(isUpdate ? {} : { migrations: { new_sqlite_classes: ["Room"], new_tag: "v1" } }),
      tags: [ownRelayTag],
    };
    const form = new FormData();
    form.set("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.set("worker.js", new Blob([relayWorkerBundle], { type: "application/javascript+module" }), "worker.js");
    yield* call("upload the relay", { form, method: "PUT", path: `${base}/scripts/${workerName}` });
    yield* call("turn on its workers.dev address", {
      body: { enabled: true, previews_enabled: false },
      method: "POST",
      path: `${base}/scripts/${workerName}/subdomain`,
    });
  });

  /** Waits for the new address to answer, asking `attempts` times. */
  const waitForAnswer = Effect.fnUntraced(function* (origin: string) {
    const answers = options.answers ?? relayAnswers;
    const attempts = options.attempts ?? 15;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const isAnswering = yield* Effect.tryPromise(() => answers(origin)).pipe(Effect.orElseSucceed(() => false));
      if (isAnswering) return;
      if (attempt < attempts) yield* Effect.sleep(Duration.millis(options.pauseMillis ?? 2_000));
    }
    return yield* stop("not-ready", messages["not-ready"]);
  });

  return Effect.gen(function* () {
    const account = yield* chooseAccount();
    const base = `/accounts/${account.id}/workers`;
    const { hasCreated, subdomain } = yield* subdomainOf(base);
    const isUpdate = yield* existsOf(base);
    yield* upload(base, isUpdate);
    const origin = `https://${workerName}.${subdomain}.workers.dev`;
    yield* waitForAnswer(origin);
    return {
      accountName: account.name,
      hasCreatedSubdomain: hasCreated,
      ok: true as const,
      origin,
      wasUpdated: isUpdate,
      workerName,
    };
  });
};

/**
 * Deploys the relay Worker to the account the token reaches, and returns its workers.dev address once it answers.
 * Nothing in Outlore changes here: the caller switches to the new address only after a success.
 */
export const deployRelayToCloudflare = (options: DeployOptions): Promise<DeployResult> =>
  Effect.runPromise(
    deploymentOf(options).pipe(
      Effect.catchTag("DeployStopped", (stopped) =>
        Effect.succeed({ failure: stopped.failure, message: stopped.message, ok: false as const }),
      ),
    ),
  );

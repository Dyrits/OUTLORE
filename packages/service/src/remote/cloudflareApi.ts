import { newRoomName } from "@outlore/channel";
import { closeCodes, connectClient } from "@outlore/relay";
import { Effect } from "effect";
import { fieldOf, isRecord } from "../core/records.ts";

/** Where Cloudflare's API lives; the token is sent nowhere else. */
export const cloudflareApiBase = "https://api.cloudflare.com/client/v4";

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
      const json: unknown = JSON.parse(text);
      return { json, status: response.status };
    } catch {
      return { json: null, status: response.status };
    }
  },
});

/** The first of the `errors` Cloudflare lists in a reply, or null when the reply lists none. */
const firstErrorOf = (json: unknown): Record<string, unknown> | null => {
  const errors = fieldOf(json, "errors");
  if (!Array.isArray(errors)) return null;
  const first: unknown = errors[0];
  return isRecord(first) ? first : null;
};

/** The message from the first Cloudflare error in a reply, or a fallback phrase. */
export const errorTextOf = (json: unknown): string => {
  const message = firstErrorOf(json)?.message;
  return typeof message === "string" ? message : "no reason given";
};

/** The numeric error code from the first Cloudflare error in a reply, or null. */
export const errorCodeOf = (json: unknown): number | null => {
  const code = firstErrorOf(json)?.code;
  return typeof code === "number" ? code : null;
};

/** The `result` field of a Cloudflare API reply, or null when absent. */
export const resultOf = (json: unknown): unknown => fieldOf(json, "result") ?? null;

/** What a successful answer to the list of accounts holds: each account's id and its name. */
export const accountsOf = (json: unknown) => {
  const result = resultOf(json);
  return (Array.isArray(result) ? result : []).flatMap((entry: unknown) => {
    const id = fieldOf(entry, "id");
    const name = fieldOf(entry, "name");
    return typeof id === "string" ? [{ id, name: typeof name === "string" ? name : id }] : [];
  });
};

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

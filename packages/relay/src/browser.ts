// What a browser needs from the relay package: the client's connection and the close codes, with nothing that needs
// Node (no `ws`, no server). The app imports this entry, never the package's main one.
import { Effect } from "effect";
import { connectClient as connectClientEffect } from "./client.ts";

export type { ClientConnection, ConnectResult } from "./client.ts";
export const connectClient = (options: Parameters<typeof connectClientEffect>[0]) =>
  Effect.runPromise(
    connectClientEffect(options).pipe(
      Effect.match({
        onFailure: (error) => ({ kind: error.kind, ok: false as const }),
        onSuccess: (value) => ({ ok: true as const, value }),
      }),
    ),
  );
export { closeCodes, readClosingFrame } from "./roomCore.ts";

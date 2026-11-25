import { Context, Effect, Layer } from "effect";
import { readSettings, ServiceFailure, Sessions, sessionsLayer } from "../core/index.ts";
import type { TerminalHost, TerminalScope } from "./terminalHost.ts";
import { type ConversationTerminals, makeConversationTerminals } from "./terminalSessions.ts";

// The conversation shells as the service's requests reach them (conversation-terminal, ADR 0020): the layer that owns
// them, the gate that keeps a paired device's shell off until the owner's switch is on, and the terminal requests.

export { hostTerminalHost, prepareTerminalHelper, type TerminalHost, type TerminalScope } from "./terminalHost.ts";
export type { ConversationTerminals } from "./terminalSessions.ts";

/** The service the request handlers reach the conversation shells through. */
export class Terminals extends Context.Service<Terminals, ConversationTerminals>()("outlore/Terminals") {}

/** The host's conversation shells, in their own layer so each shell ends when the layer closes (ADR 0020). */
export const terminalsLayer = (host: TerminalHost) =>
  Layer.effect(
    Terminals,
    Effect.gen(function* () {
      const sessions = yield* Sessions;
      const terminals = yield* makeConversationTerminals(host, sessions.broadcast);
      yield* Effect.addFinalizer(() => terminals.dispose);
      return terminals;
    }),
  ).pipe(Layer.provide(sessionsLayer));

/** Refuses a paired device's terminal while the host's "Allow terminals from paired devices" switch is off. */
const admitScope = Effect.fnUntraced(function* (scope: TerminalScope) {
  if (scope !== "remote") return;
  const settings = yield* readSettings;
  if (!settings.shouldAllowRemoteTerminals)
    return yield* new ServiceFailure({
      kind: "AccessRefused",
      message: "Terminals from paired devices are off. Turn them on in this host's Workshop.",
    });
});

/**
 * Opens the conversation's shell, once a paired device asks and its owner allows: the host's own window opens the full
 * login shell, a paired device's shell only while the "Allow terminals from paired devices" switch is on
 * (conversation-terminal, ADR 0020).
 */
export const openConversationTerminal = Effect.fnUntraced(function* (
  terminals: ConversationTerminals,
  giveaway: { readonly cwd: string | null; readonly id: string },
  scope: TerminalScope,
) {
  yield* admitScope(scope);
  return yield* terminals.open(scope, giveaway.id, giveaway.cwd);
});

/** Starts a one-shot interactive command inside Outlore's inline terminal service, gating paired devices on the host's switch. */
export const openCommandTerminal = Effect.fnUntraced(function* (
  terminals: ConversationTerminals,
  giveaway: {
    readonly command: string;
    readonly cwd?: string | null;
    readonly env?: Readonly<Record<string, string>>;
    readonly id: string;
  },
  scope: TerminalScope,
) {
  yield* admitScope(scope);
  return yield* terminals.openCommand(scope, giveaway.id, {
    command: giveaway.command,
    cwd: giveaway.cwd ?? null,
    ...(giveaway.env === undefined ? {} : { env: giveaway.env }),
  });
});

/**
 * Runs one of the terminal's ways that answers nothing, as the null its request's result schema requires: an
 * undefined answer fails encoding after the work already ran, and every screen is told the service failed.
 */
const answeringNull = (work: Effect.Effect<void, ServiceFailure>) => work.pipe(Effect.as(null));

/** The terminal requests every screen of the host makes, for the service's one request table. */
export const terminalHandlers = (terminals: ConversationTerminals, scope: TerminalScope) => ({
  CloseTerminal: (given: { readonly id: string }) => answeringNull(terminals.close(scope, given.id)),
  OpenTerminal: (given: { readonly cwd: string | null; readonly id: string }) =>
    openConversationTerminal(terminals, given, scope),
  ResizeTerminal: (given: { readonly cols: number; readonly id: string; readonly rows: number }) =>
    answeringNull(terminals.resize(scope, given.id, given.cols, given.rows)),
  WriteTerminalInput: (given: { readonly data: string; readonly id: string }) =>
    answeringNull(terminals.write(scope, given.id, given.data)),
});

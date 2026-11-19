import { Clock, Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { ConnectorAsking, ConnectorNotices } from "../connectors/index.ts";
import { Changes } from "../core/index.ts";
import { Approvals } from "./approvals.ts";
import { insertThreadLine } from "./handover.ts";

// What the connectors need from this folder, which they do not import (connectors blueprint, Shape): asking the owner
// about a call, and putting a warning line in a thread.

/** Asking about a connector's tool goes through the approvals, as a command or a file change does. */
export const connectorAskingLayer = Layer.effect(
  ConnectorAsking,
  Effect.gen(function* () {
    const approvals = yield* Approvals;
    return { askToolUse: (threadId, use) => approvals.askToolUse(threadId, use) };
  }),
);

/** A warning is a line in the thread's conversation, the same line a lost session or a handover leaves (CHG-0208). */
export const connectorNoticesLayer = Layer.effect(
  ConnectorNotices,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    return {
      warn: (threadId, text) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          yield* sql.withTransaction(
            insertThreadLine(threadId, text, now).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
          );
          yield* changes.publish;
        }).pipe(Effect.orDie),
    };
  }),
);

import type { HarnessName } from "@outlore/contracts";
import { Deferred, type Duration, Effect, Layer } from "effect";
import { type Containment, Harness, type TurnRequest } from "../core/index.ts";
import { callThreadTool, type FakeTurn, fakeDraftOf, imagesNoteOf, scriptedCall } from "./fakeHarnessScript.ts";

export { callThreadTool, fakeDraftOf };

/** A deterministic harness for checks that runs scripted tool calls, accepts steered messages, and echoes after a delay. */
export const fakeHarnessLayer = (
  replyDelay: Duration.Input,
  containment: Containment | Partial<Record<HarnessName, Containment>> = "Sandboxed",
) =>
  Layer.sync(Harness, () => {
    const running = new Map<string, FakeTurn>();
    const script = Effect.fnUntraced(function* (request: TurnRequest, turn: FakeTurn) {
      yield* Effect.sleep(replyDelay);
      const echoOf = Effect.fnUntraced(function* (text: string) {
        const results: Array<string> = [];
        for (const line of text.split("\n")) {
          const call = scriptedCall(request, line.trim(), turn);
          if (call !== null) results.push(yield* call);
        }
        return results.length === 0 ? text : results.join(" | ");
      });
      let echo = (yield* echoOf(request.text)) + imagesNoteOf(request.images);
      // Steered messages are acted on too, including those steered in while one is acted on.
      for (let index = 0; index < turn.steered.length; index++) {
        echo += ` + ${yield* echoOf(turn.steered[index] ?? "")}`;
      }
      running.delete(request.threadId);
      yield* request.onEvent({ _tag: "Reply", text: `Echo: ${echo}`, usage: turn.spent.callUsage });
      return false;
    });
    return {
      containmentOf: (harness) =>
        typeof containment === "string" ? containment : (containment[harness] ?? "Sandboxed"),
      interrupt: (threadId) =>
        Effect.suspend(() => {
          const turn = running.get(threadId);
          return turn === undefined ? Effect.succeed(false) : Deferred.succeed(turn.interrupted, void 0);
        }),
      readPlanLimits: () => Effect.succeed(null),
      runTurn: Effect.fnUntraced(function* (request: TurnRequest) {
        const turn: FakeTurn = {
          interrupted: yield* Deferred.make<void>(),
          onEvent: request.onEvent,
          spent: {
            billing: null,
            callUsage: null,
            contextWindow: null,
            cost: null,
            isReported: false,
            kinds: null,
            tokens: 0,
          },
          steered: [],
        };
        running.set(request.threadId, turn);
        const isInterrupted = yield* Effect.raceFirst(
          script(request, turn),
          Deferred.await(turn.interrupted).pipe(Effect.as(true)),
        ).pipe(Effect.ensuring(Effect.sync(() => running.delete(request.threadId))));
        const { billing, contextWindow, cost, isReported, kinds, tokens } = turn.spent;
        return {
          billing: billing ?? (cost === null ? "Subscription" : "ApiKey"),
          // The fake's context is what it was told to spend: its latest call's whole prompt.
          context: isReported
            ? kinds === null
              ? tokens
              : kinds.input + kinds.cacheRead + kinds.cacheCreation + kinds.output
            : null,
          contextWindow,
          cost: isReported ? cost : null,
          isInterrupted,
          sessionId: request.sessionId ?? `fake-${request.threadId}`,
          usage: isReported ? (kinds ?? { cacheCreation: 0, cacheRead: 0, input: tokens, output: 0 }) : null,
        };
      }),
      steer: (threadId, message) =>
        Effect.suspend(() => {
          const turn = running.get(threadId);
          if (turn === undefined) return Effect.succeed(false);
          turn.steered.push(message.text + imagesNoteOf(message.images));
          return turn.onEvent({ _tag: "Delivered", messageId: message.id }).pipe(Effect.as(true));
        }),
    };
  });

import type { ServerFrame, ThreadId } from "@outlore/contracts";
import { Context, Effect, Layer, PubSub } from "effect";
import { Changes } from "./changes.ts";

/** Where one connected screen's frames go: the owner's window, or a paired device. */
export type SessionSend = (frame: ServerFrame) => void;

/**
 * The screens connected to this service. Every committed change and every reply being written is announced to all
 * of them, whichever way they connected (the loopback socket or a paired device through the relay).
 */
export class Sessions extends Context.Service<
  Sessions,
  {
    /** Registers a screen; the returned function removes it. */
    readonly add: (send: SessionSend) => () => void;
    /** Sends one frame to every connected screen, whichever way each connected. */
    readonly broadcast: (frame: ServerFrame) => void;
  }
>()("outlore/Sessions") {}

/** The registry, and the two fibers that carry changes and drafts to it. */
export const sessionsLayer = Layer.effect(
  Sessions,
  Effect.gen(function* () {
    const changes = yield* Changes;
    const sinks = new Set<SessionSend>();
    const broadcast = (frame: ServerFrame) => {
      for (const send of sinks) send(frame);
    };

    /** Carries every value of `pubsub` to `broadcast` on a fiber of its own, for the layer's lifetime. */
    const relay = <Value>(pubsub: PubSub.PubSub<Value>, send: (value: Value) => void) =>
      PubSub.subscribe(pubsub).pipe(
        Effect.flatMap((subscription) =>
          PubSub.take(subscription).pipe(
            Effect.tap((value) => Effect.sync(() => send(value))),
            Effect.forever,
            Effect.forkScoped,
          ),
        ),
      );

    yield* relay(changes.pubsub, (sequence) => broadcast({ _tag: "Changed", sequence }));
    yield* relay(changes.drafts, ({ threadId, text }) =>
      broadcast({ _tag: "Draft", text, threadId: threadId as ThreadId }),
    );

    return {
      add: (send: SessionSend) => {
        sinks.add(send);
        return () => void sinks.delete(send);
      },
      broadcast: (frame: ServerFrame) => broadcast(frame),
    };
  }),
);

import type { Topic } from "@outlore/contracts";
import { Context, Effect, Layer, PubSub, Ref } from "effect";

/** The reply a thread is writing, as it streams to the owner's screens. */
export type DraftUpdate = {
  /** The reply written so far; empty when the draft ends. */
  readonly text: string;
  readonly threadId: string;
};

/** Announces committed changes with an increasing sequence, and unsaved reply drafts. */
export class Changes extends Context.Service<
  Changes,
  {
    /** Announces a change that may have touched anything, so every screen refetches everything it shows. */
    readonly publish: Effect.Effect<void>;
    /** Announces a change that touched only these topics (idle traffic): a screen refetches only the reads that depend on them. */
    readonly publishTopics: (topics: ReadonlyArray<Topic>) => Effect.Effect<void>;
    /**
     * What the changes since the last call touched, for the next `Changed` frame: null when one may have touched
     * anything, and an empty list when nothing is new since the last call.
     */
    readonly takeTopics: Effect.Effect<ReadonlyArray<Topic> | null>;
    readonly pubsub: PubSub.PubSub<number>;
    readonly drafts: PubSub.PubSub<DraftUpdate>;
  }
>()("outlore/Changes") {}

/** Changes as an in-memory broadcast to every connected screen. */
export const changesLayer = Layer.effect(
  Changes,
  Effect.gen(function* () {
    const pubsub = yield* PubSub.unbounded<number>();
    const drafts = yield* PubSub.unbounded<DraftUpdate>();
    // The sequence, and what the changes not yet announced touched: a change with no topics leaves `isEverything` set until announced.
    const state = yield* Ref.make({ isEverything: false, sequence: 0, topics: new Set<Topic>() });
    const announce = (touched: ReadonlyArray<Topic> | null) =>
      Ref.updateAndGet(state, (current) => ({
        isEverything: current.isEverything || touched === null,
        sequence: current.sequence + 1,
        topics: new Set([...current.topics, ...(touched ?? [])]),
      })).pipe(
        Effect.flatMap((next) => PubSub.publish(pubsub, next.sequence)),
        Effect.asVoid,
      );
    const publish = announce(null);
    const publishTopics = (topics: ReadonlyArray<Topic>) => announce(topics);
    const takeTopics = Ref.modify(state, (current) => [
      current.isEverything ? null : [...current.topics],
      { isEverything: false, sequence: current.sequence, topics: new Set<Topic>() },
    ]);
    return { drafts, publish, publishTopics, pubsub, takeTopics };
  }),
);

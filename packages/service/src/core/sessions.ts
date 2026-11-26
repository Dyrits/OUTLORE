import type { ServerFrame, ThreadId, Topic } from "@outlore/contracts";
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

/** How long Changed frames are held together: a burst of commits reaches a screen as a frame now and one after the window. */
export const changedWindowMillis = 250;
/** How long a thread's draft frames are held together: a reply streams to a screen as at most this many frames a second. */
export const draftWindowMillis = 100;
/** After how many appended frames a draft sends the whole text again, so a screen that missed a frame recovers. */
const framesPerSnapshot = 50;

/** What the screens hold of one thread's reply, and what is still to send them. */
type DraftState = {
  /** The reply as the service has it now. */
  latest: string;
  /** The reply every connected screen holds; null before the first frame. */
  sent: string | null;
  /** Whether a window is open: frames in it wait for its end. */
  isOpen: boolean;
  /** The appended frames sent since the whole text was last sent. */
  appends: number;
};

/**
 * The registry, and the fibers that carry changes and drafts to it. Changes and drafts reach the screens in windows
 * (idle traffic): a burst of commits is one Changed frame now and one after the window carrying the latest sequence, and
 * a reply being written is sent as the text that is new, whole only to a screen that joins mid-reply and now and then
 * so that a screen that missed a frame recovers.
 */
export const sessionsLayer = Layer.effect(
  Sessions,
  Effect.gen(function* () {
    const changes = yield* Changes;
    const scope = yield* Effect.scope;
    const sinks = new Set<SessionSend>();
    const broadcast = (frame: ServerFrame) => {
      for (const send of sinks) send(frame);
    };

    /** Carries every value of `pubsub` to `send` on a fiber of its own, for the layer's lifetime. */
    const relay = <Value>(pubsub: PubSub.PubSub<Value>, send: (value: Value) => Effect.Effect<void>) =>
      PubSub.subscribe(pubsub).pipe(
        Effect.flatMap((subscription) =>
          PubSub.take(subscription).pipe(Effect.flatMap(send), Effect.forever, Effect.forkScoped),
        ),
      );

    // Changed: the first change of a burst goes out at once, later ones wait for the window to end and go out as one.
    let latestSequence = 0;
    let sentSequence = 0;
    let isChangedWindowOpen = false;
    /** Sends one frame for the changes since the last one, naming what they touched when it was only some topics. */
    const announceChanged = Effect.gen(function* () {
      sentSequence = latestSequence;
      const topics: ReadonlyArray<Topic> | null = yield* changes.takeTopics;
      // Changes an earlier frame already announced, whose own sequence is still on its way here, leave no topic: the frame then only carries the latest sequence.
      broadcast({ _tag: "Changed", sequence: sentSequence, ...(topics === null ? {} : { topics }) });
    });
    const changedWindow = Effect.gen(function* () {
      while (true) {
        yield* Effect.sleep(changedWindowMillis);
        if (latestSequence === sentSequence) {
          isChangedWindowOpen = false;
          return;
        }
        yield* announceChanged;
      }
    });
    yield* relay(changes.pubsub, (sequence) =>
      Effect.gen(function* () {
        latestSequence = Math.max(latestSequence, sequence);
        if (isChangedWindowOpen) return;
        isChangedWindowOpen = true;
        yield* announceChanged;
        yield* Effect.forkIn(changedWindow, scope);
      }),
    );

    // Draft: what each screen holds of each thread's reply, so that only what is new is sent.
    const drafts = new Map<string, DraftState>();
    const draftFrame = (threadId: string, text: string, offset?: number): ServerFrame => ({
      _tag: "Draft",
      ...(offset === undefined ? {} : { offset }),
      text,
      threadId: threadId as ThreadId,
    });
    const flush = (threadId: string, state: DraftState) => {
      const { latest, sent } = state;
      if (sent === latest) return;
      if (sent !== null && latest.startsWith(sent) && state.appends < framesPerSnapshot) {
        state.appends += 1;
        broadcast(draftFrame(threadId, latest.slice(sent.length), sent.length));
      } else {
        state.appends = 0;
        broadcast(draftFrame(threadId, latest));
      }
      state.sent = latest;
    };
    const draftWindow = (threadId: string, state: DraftState) =>
      Effect.gen(function* () {
        while (true) {
          yield* Effect.sleep(draftWindowMillis);
          if (drafts.get(threadId) !== state) return;
          if (state.sent === state.latest) {
            state.isOpen = false;
            return;
          }
          flush(threadId, state);
        }
      });
    yield* relay(changes.drafts, ({ text, threadId }) =>
      Effect.gen(function* () {
        const held = drafts.get(threadId);
        if (text === "") {
          // The draft ends at once, and what was waiting for the window is dropped: the saved reply replaces it.
          drafts.delete(threadId);
          if (held !== undefined) broadcast(draftFrame(threadId, ""));
          return;
        }
        const state = held ?? { appends: 0, isOpen: false, latest: text, sent: null };
        drafts.set(threadId, state);
        state.latest = text;
        if (state.isOpen) return;
        state.isOpen = true;
        flush(threadId, state);
        yield* Effect.forkIn(draftWindow(threadId, state), scope);
      }),
    );

    return {
      add: (send: SessionSend) => {
        // A screen that joins mid-reply gets the text so far; the frames after it continue from there.
        for (const [threadId, state] of drafts) {
          if (state.sent !== null) send(draftFrame(threadId, state.sent));
        }
        sinks.add(send);
        return () => void sinks.delete(send);
      },
      broadcast: (frame: ServerFrame) => broadcast(frame),
    };
  }),
);

import { describe, expect, it } from "@effect/vitest";
import { draftAfter, type ServerFrame } from "@outlore/contracts";
import { Effect, Layer, PubSub } from "effect";
import { TestClock } from "effect/testing";
import { Changes, changesLayer, Sessions, sessionsLayer } from "../../src/core/index.ts";

/** The registry's windows (idle traffic): Changed frames and a reply's draft frames, on the test clock. */

const layer = sessionsLayer.pipe(Layer.provideMerge(changesLayer));
const thread = "11111111-1111-4111-8111-111111111111";

/** Lets the fibers that carry published values run. */
const flush = Effect.gen(function* () {
  for (let index = 0; index < 400; index++) yield* Effect.yieldNow;
});
/** Moves the test clock and lets what it wakes run. */
const advance = (millis: number) => TestClock.adjust(millis).pipe(Effect.andThen(flush));

const screen = () => {
  const frames: ServerFrame[] = [];
  return {
    changed: () => frames.flatMap((frame) => (frame._tag === "Changed" ? [frame.sequence] : [])),
    drafts: () => frames.flatMap((frame) => (frame._tag === "Draft" ? [frame] : [])),
    frames,
    /** The reply this screen holds after every frame, as the app rebuilds it. */
    held: () => {
      let text = "";
      for (const frame of frames) if (frame._tag === "Draft") text = draftAfter(text, frame) ?? text;
      return text;
    },
    send: (frame: ServerFrame) => void frames.push(frame),
  };
};

const writeDraft = (text: string) =>
  Effect.gen(function* () {
    const changes = yield* Changes;
    yield* PubSub.publish(changes.drafts, { text, threadId: thread });
    yield* flush;
  });

describe("the Changed frames a screen is sent", () => {
  it.effect("goes out at once for a first change, and once more after the window for a burst", () =>
    Effect.gen(function* () {
      const sessions = yield* Sessions;
      const changes = yield* Changes;
      const one = screen();
      sessions.add(one.send);
      yield* changes.publish;
      yield* flush;
      expect(one.changed()).toEqual([1]);
      for (let index = 0; index < 49; index++) yield* changes.publish;
      yield* flush;
      // Nothing more until the window ends, whatever the burst.
      expect(one.changed()).toEqual([1]);
      yield* advance(250);
      // The last change always leads to a last frame, so no screen stays stale.
      expect(one.changed()).toEqual([1, 50]);
      yield* advance(10_000);
      expect(one.changed()).toEqual([1, 50]);
      // A change after a quiet window goes out at once again.
      yield* changes.publish;
      yield* flush;
      expect(one.changed()).toEqual([1, 50, 51]);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("sends at most four frames a second to a screen while commits never stop", () =>
    Effect.gen(function* () {
      const sessions = yield* Sessions;
      const changes = yield* Changes;
      const one = screen();
      sessions.add(one.send);
      for (let tick = 0; tick < 100; tick++) {
        yield* changes.publish;
        yield* advance(10);
      }
      // 1,000 ms of a commit every 10 ms: the first at once, then one per 250 ms window.
      expect(one.changed().length).toBeLessThanOrEqual(5);
      expect(one.changed().at(-1)).toBeGreaterThanOrEqual(96);
    }).pipe(Effect.provide(layer)),
  );
});

describe("the Draft frames a screen is sent", () => {
  it.effect("carries only the new text, and the screen rebuilds the reply exactly", () =>
    Effect.gen(function* () {
      const sessions = yield* Sessions;
      const one = screen();
      sessions.add(one.send);
      const reply = "The quick brown fox jumps over the lazy dog.";
      for (let length = 3; length <= reply.length + 3; length += 3) {
        yield* writeDraft(reply.slice(0, length));
        yield* advance(10);
      }
      yield* advance(1_000);
      expect(one.held()).toBe(reply);
      const frames = one.drafts();
      expect(frames[0]).toMatchObject({ text: "The" });
      expect(frames[0]?.offset).toBeUndefined();
      // Every later frame continues where the screen's copy ended, and no frame repeats text.
      let length = 0;
      for (const frame of frames) {
        if (frame.offset !== undefined) expect(frame.offset).toBe(length);
        length = frame.offset === undefined ? frame.text.length : frame.offset + frame.text.length;
      }
      expect(frames.map((frame) => frame.text.length).reduce((sum, size) => sum + size, 0)).toBe(reply.length);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("holds at most ten frames a second for a thread, and sends the latest text in the next one", () =>
    Effect.gen(function* () {
      const sessions = yield* Sessions;
      const one = screen();
      sessions.add(one.send);
      for (let length = 1; length <= 40; length++) yield* writeDraft("x".repeat(length));
      expect(one.drafts()).toHaveLength(1);
      yield* advance(100);
      expect(one.drafts()).toHaveLength(2);
      expect(one.held()).toBe("x".repeat(40));
    }).pipe(Effect.provide(layer)),
  );

  it.effect("gives a screen that joins mid-reply the text so far, then only what follows", () =>
    Effect.gen(function* () {
      const sessions = yield* Sessions;
      const early = screen();
      sessions.add(early.send);
      yield* writeDraft("Once upon");
      yield* advance(100);
      yield* writeDraft("Once upon a time");
      yield* advance(100);
      const late = screen();
      sessions.add(late.send);
      expect(late.drafts()).toHaveLength(1);
      expect(late.held()).toBe("Once upon a time");
      yield* writeDraft("Once upon a time, there was");
      yield* advance(100);
      expect(late.held()).toBe("Once upon a time, there was");
      expect(early.held()).toBe("Once upon a time, there was");
      expect(late.drafts().at(-1)?.text).toBe(", there was");
    }).pipe(Effect.provide(layer)),
  );

  it.effect("sends the whole text again every fifty frames, so a screen that missed one recovers", () =>
    Effect.gen(function* () {
      const sessions = yield* Sessions;
      const one = screen();
      sessions.add(one.send);
      let text = "";
      for (let frame = 0; frame < 60; frame++) {
        text += "ab";
        yield* writeDraft(text);
        yield* advance(100);
      }
      const snapshots = one.drafts().filter((frame) => frame.offset === undefined);
      expect(snapshots.length).toBeGreaterThanOrEqual(2);
      expect(snapshots.at(-1)?.text.length).toBeGreaterThan(50);
      expect(one.held()).toBe(text);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("ends at once, drops what waited for the window, and sends nothing for a thread that wrote none", () =>
    Effect.gen(function* () {
      const sessions = yield* Sessions;
      const one = screen();
      sessions.add(one.send);
      yield* writeDraft("");
      expect(one.drafts()).toHaveLength(0);
      yield* writeDraft("first");
      yield* writeDraft("first and more");
      yield* writeDraft("");
      yield* advance(1_000);
      expect(one.drafts().map((frame) => frame.text)).toEqual(["first", ""]);
      expect(one.held()).toBe("");
      // A new reply on the same thread starts from the whole text again.
      yield* writeDraft("second");
      expect(one.drafts().at(-1)).toMatchObject({ text: "second" });
      expect(one.drafts().at(-1)?.offset).toBeUndefined();
    }).pipe(Effect.provide(layer)),
  );

  it.effect("sends the whole text when a reply starts over instead of continuing", () =>
    Effect.gen(function* () {
      const sessions = yield* Sessions;
      const one = screen();
      sessions.add(one.send);
      yield* writeDraft("A first answer");
      yield* advance(100);
      yield* writeDraft("Another");
      yield* advance(100);
      expect(one.held()).toBe("Another");
    }).pipe(Effect.provide(layer)),
  );
});

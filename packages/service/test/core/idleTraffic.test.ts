import { describe, expect, it } from "@effect/vitest";
import { draftAfter, type ServerFrame } from "@outlore/contracts";
import { Effect } from "effect";
import { Changes, changesLayer, Sessions } from "../../src/core/index.ts";
import { fakeDraftOf } from "../../src/harness/fakeHarness.ts";
import { encodeServerFrame } from "../../src/remote/index.ts";
import { fixture, register, settle, startMission } from "../fixtures/service.ts";

/**
 * The traffic a connected screen costs the host while threads work: what the service sends to each screen, counted as
 * the bytes of the frames the wire carries, by frame kind. A reply written in small deltas must cost a small multiple
 * of its own length, and a burst of commits must cost a few Changed frames, not one each (the idle-traffic errand).
 */

type Counted = { bytes: number; frames: number };

/** A screen that counts what it is sent, by frame kind, as the encoded text the wire carries. */
const countingScreen = () => {
  const kinds = new Map<string, Counted>();
  const frames: ServerFrame[] = [];
  return {
    frames,
    kinds,
    of: (kind: string): Counted => kinds.get(kind) ?? { bytes: 0, frames: 0 },
    send: (frame: ServerFrame) => {
      const counted = kinds.get(frame._tag) ?? { bytes: 0, frames: 0 };
      counted.bytes += new TextEncoder().encode(encodeServerFrame(frame)).length;
      counted.frames += 1;
      kinds.set(frame._tag, counted);
      frames.push(frame);
    },
  };
};

describe("what a connected screen is sent", () => {
  it.live("costs a small multiple of its own length for a reply written in small deltas", () => {
    const value = register(fixture());
    const length = 6_000;
    return Effect.gen(function* () {
      const sessions = yield* Sessions;
      const screen = countingScreen();
      sessions.add(screen.send);
      // A pause of a millisecond between deltas, as a harness streams them, so the windows are exercised; the reply then waits out the last window.
      const started = yield* startMission({ text: `write ${length} 3 1\nwait 300` });
      yield* settle(started.missionId, (detail) => detail.thread.state === "Resting");
      // Let the last frames arrive.
      yield* Effect.sleep("600 millis");
      const draft = screen.of("Draft");
      console.log(
        `[idle-traffic] 6000 chars in 3-char deltas: Draft ${draft.frames} frames ${draft.bytes} bytes; Changed ${screen.of("Changed").frames} frames ${screen.of("Changed").bytes} bytes`,
      );
      // Budget: the reply's own length plus its framing, with room for a few snapshots.
      expect(draft.bytes).toBeLessThanOrEqual(length * 8);
      expect(draft.frames).toBeLessThanOrEqual(100);
      // The screen's copy, rebuilt from the frames as the app does, was the whole reply before the draft ended.
      let held = "";
      let longest = "";
      for (const frame of screen.frames) {
        if (frame._tag !== "Draft") continue;
        held = draftAfter(held, frame) ?? held;
        if (held.length > longest.length) longest = held;
      }
      expect(longest).toBe(fakeDraftOf(length));
      expect(held).toBe("");
    }).pipe(Effect.provide(value.layer));
  });

  it.live("sends one Changed frame for a burst of commits, and a last one after it", () => {
    const value = register(fixture());
    return Effect.gen(function* () {
      const sessions = yield* Sessions;
      const changes = yield* Changes;
      const screen = countingScreen();
      sessions.add(screen.send);
      for (let index = 0; index < 50; index++) yield* changes.publish;
      yield* Effect.sleep("600 millis");
      const changed = screen.frames.filter((frame) => frame._tag === "Changed");
      console.log(`[idle-traffic] 50 commits in one burst: Changed ${changed.length} frames`);
      expect(changed.length).toBeLessThanOrEqual(3);
      // The last frame names the last change, so no screen stays stale.
      const last = changed.at(-1);
      expect(last?._tag === "Changed" ? last.sequence : 0).toBeGreaterThanOrEqual(50);
    }).pipe(Effect.provide(value.layer));
  });

  it.live("names the topics a scoped change touched, and none for a change that may have touched anything", () => {
    const value = register(fixture());
    return Effect.gen(function* () {
      const sessions = yield* Sessions;
      const changes = yield* Changes;
      const screen = countingScreen();
      sessions.add(screen.send);
      yield* changes.publishTopics(["work"]);
      yield* Effect.sleep("600 millis");
      yield* changes.publish;
      yield* Effect.sleep("600 millis");
      const changed = screen.frames.flatMap((frame) => (frame._tag === "Changed" ? [frame] : []));
      expect(changed.map((frame) => frame.topics)).toEqual([["work"], undefined]);
    }).pipe(Effect.provide(value.layer));
  });

  it.live("announces a turn's events as the work's only, and its end as the spend's too", () => {
    const value = register(fixture());
    return Effect.gen(function* () {
      const sessions = yield* Sessions;
      const screen = countingScreen();
      const started = yield* startMission({ text: "write 3000 3 1\nwait 600" });
      // The start's own change, which names no topic, goes out before the screen listens.
      yield* Effect.sleep("400 millis");
      sessions.add(screen.send);
      yield* settle(started.missionId, (detail) => detail.thread.state === "Resting");
      yield* Effect.sleep("600 millis");
      const topics = screen.frames.flatMap((frame) => (frame._tag === "Changed" ? [frame.topics?.toSorted()] : []));
      // Nothing after the start left the settings, the Vault or the connectors to refetch: every frame names its topics.
      expect(topics.length).toBeGreaterThan(0);
      expect(topics.filter((named) => named === undefined)).toEqual([]);
      expect(topics.flat()).toContain("spend");
    }).pipe(Effect.provide(value.layer));
  });

  it.effect("keeps the topics of the changes not yet announced, until they are taken", () =>
    Effect.gen(function* () {
      const changes = yield* Changes;
      yield* changes.publishTopics(["work"]);
      yield* changes.publishTopics(["spend"]);
      expect((yield* changes.takeTopics)?.toSorted()).toEqual(["spend", "work"]);
      expect(yield* changes.takeTopics).toEqual([]);
      // One change that may have touched anything leaves the whole burst unscoped.
      yield* changes.publishTopics(["work"]);
      yield* changes.publish;
      expect(yield* changes.takeTopics).toBeNull();
      expect(yield* changes.takeTopics).toEqual([]);
    }).pipe(Effect.provide(changesLayer)),
  );
});

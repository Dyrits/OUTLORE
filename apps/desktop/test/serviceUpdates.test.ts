import { describe, expect, it } from "vitest";
import type { UpdateStatus } from "../../app/src/foundation/updateState.ts";
import { answerServiceUpdates, type ServiceUpdates } from "../src/serviceUpdates.ts";

// The service asks the main process about the updater of a host; the main process answers on the same identifier.

const readyStatus: UpdateStatus = { _tag: "Ready", notes: "", pageUrl: "https://example.test/r", version: "0.1.10" };

const standIn = (state: UpdateStatus, afterCheck: UpdateStatus = state) => {
  const calls = { checks: 0, installs: 0 };
  let status = state;
  const updates: ServiceUpdates = {
    async check() {
      calls.checks++;
      status = afterCheck;
      return { status };
    },
    async install() {
      calls.installs++;
      if (status._tag !== "Ready") throw new Error("There is no update ready to install.");
    },
    state: () => ({ status }),
  };
  return { calls, updates };
};

const run = (updates: Promise<ServiceUpdates>, message: unknown) => {
  const replies: unknown[] = [];
  const handle = answerServiceUpdates(updates, (reply) => replies.push(reply));
  handle(message);
  return { replies, settled: () => new Promise((resolve) => setTimeout(resolve, 5)) };
};

describe("answering the service's calls about updating the host", () => {
  it("answers the state with the updater's status, without the notes and the page", async () => {
    const { updates } = standIn(readyStatus);
    const { replies, settled } = run(Promise.resolve(updates), { call: "state", id: "a", type: "updater" });
    await settled();
    expect(replies).toEqual([
      { error: null, id: "a", status: { _tag: "Ready", version: "0.1.10" }, type: "updaterReply" },
    ]);
  });

  it("checks and answers where the check ended", async () => {
    const { calls, updates } = standIn({ _tag: "Idle", note: null }, readyStatus);
    const { replies, settled } = run(Promise.resolve(updates), { call: "check", id: "b", type: "updater" });
    await settled();
    expect(calls.checks).toBe(1);
    expect(replies).toMatchObject([{ id: "b", status: { _tag: "Ready", version: "0.1.10" } }]);
  });

  it("installs only when the controller has an update ready, and answers its refusal", async () => {
    const ready = standIn(readyStatus);
    const first = run(Promise.resolve(ready.updates), { call: "install", id: "c", type: "updater" });
    await first.settled();
    expect(ready.calls.installs).toBe(1);
    expect(first.replies).toEqual([{ error: null, id: "c", status: null, type: "updaterReply" }]);
    const idle = standIn({ _tag: "Idle", note: null });
    const second = run(Promise.resolve(idle.updates), { call: "install", id: "d", type: "updater" });
    await second.settled();
    expect(second.replies).toEqual([
      { error: "There is no update ready to install.", id: "d", status: null, type: "updaterReply" },
    ]);
  });

  it("holds a call until the updates are set up", async () => {
    const { updates } = standIn({ _tag: "Checking" });
    let setUp: (value: ServiceUpdates) => void = () => undefined;
    const { replies, settled } = run(new Promise<ServiceUpdates>((resolve) => (setUp = resolve)), {
      call: "state",
      id: "e",
      type: "updater",
    });
    await settled();
    expect(replies).toEqual([]);
    setUp(updates);
    await settled();
    expect(replies).toMatchObject([{ id: "e", status: { _tag: "Checking" } }]);
  });

  it("passes a message that is not an updater call, and refuses an unknown call", async () => {
    const { updates } = standIn({ _tag: "Idle", note: null });
    const other = run(Promise.resolve(updates), { port: 5, type: "ready" });
    await other.settled();
    expect(other.replies).toEqual([]);
    const unknown = run(Promise.resolve(updates), { call: "wipe", id: "f", type: "updater" });
    await unknown.settled();
    expect(unknown.replies).toMatchObject([{ error: expect.stringContaining("wipe"), id: "f", status: null }]);
  });

  it("says unsupported as the controller does in a development run", async () => {
    const { updates } = standIn({ _tag: "Unsupported", reason: "Updates apply to the installed app." });
    const { replies, settled } = run(Promise.resolve(updates), { call: "state", id: "g", type: "updater" });
    await settled();
    expect(replies).toMatchObject([{ status: { _tag: "Unsupported", reason: "Updates apply to the installed app." } }]);
  });
});

import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { Service } from "../../src/serviceTag.ts";
import { connectFakePhone, type FakePhoneBehavior } from "../fixtures/fakePhone.ts";
import { callTool, listToolNames } from "../fixtures/mcp.ts";
import { start, withService } from "../fixtures/service.ts";

// A thread's phone tool call end to end over the whole service (phone-control): the tool server, the phone link, a
// fake paired phone's session that receives the PhoneCall frame and answers through AnswerPhoneCall.

const phoneTools = [
  "phone_clipboard_read",
  "phone_clipboard_write",
  "phone_info",
  "phone_location",
  "phone_notify",
  "phone_open",
];
const phoneToolsOf = (names: readonly string[]) => names.filter((name) => name.startsWith("phone_")).sort();

/** A clipboard the fake phone keeps, as the app's device seam would. */
const clipboardPhone = () => {
  let clipboard = "";
  const behave: FakePhoneBehavior = (call) => {
    const args = call.args as { text?: string };
    if (call.tool === "phone_clipboard_write") {
      clipboard = args.text ?? "";
      return { _tag: "Done", value: "Copied." };
    }
    if (call.tool === "phone_clipboard_read") return { _tag: "Done", value: clipboard };
    if (call.tool === "phone_info") return { _tag: "Done", value: { battery: 0.8, isCharging: true } };
    return { _tag: "Refused", reason: "The phone's owner has not allowed this" };
  };
  return behave;
};

describe("a thread using the phone", () => {
  it.live("is offered no phone tool until a phone connects, and then only the tools of the groups on", () =>
    withService(
      Effect.gen(function* () {
        const { threadId } = yield* start("Hello");
        expect(phoneToolsOf(yield* listToolNames(threadId))).toEqual([]);
        const phone = yield* connectFakePhone("pixel", "Pixel", ["Clipboard"]);
        expect(phoneToolsOf(yield* listToolNames(threadId))).toEqual(["phone_clipboard_read", "phone_clipboard_write"]);
        yield* phone.setGroups(["Clipboard", "Information", "Location", "Open", "Notify"]);
        expect(phoneToolsOf(yield* listToolNames(threadId))).toEqual(phoneTools);
        yield* phone.setGroups([]);
        expect(phoneToolsOf(yield* listToolNames(threadId))).toEqual([]);
        yield* phone.setGroups(["Notify"]);
        phone.leave();
        expect(phoneToolsOf(yield* listToolNames(threadId))).toEqual([]);
      }),
    ),
  );

  it.live("shows in the thread panel only the phone tools of the groups on", () =>
    withService(
      Effect.gen(function* () {
        const { threadId } = yield* start("Hello");
        const service = yield* Service;
        const panelTools = () =>
          service
            .handle({ _tag: "ReadThreadPanel", threadId }, { isPairedDevice: false })
            .pipe(Effect.map((panel) => phoneToolsOf((panel as { outloreTools: readonly string[] }).outloreTools)));
        expect(yield* panelTools()).toEqual([]);
        const phone = yield* connectFakePhone("pixel", "Pixel", ["Clipboard"]);
        expect(yield* panelTools()).toEqual(["phone_clipboard_read", "phone_clipboard_write"]);
        phone.leave();
        expect(yield* panelTools()).toEqual([]);
      }),
    ),
  );

  it.live("writes the clipboard and reads it back through the phone", () =>
    withService(
      Effect.gen(function* () {
        const { threadId } = yield* start("Hello");
        const phone = yield* connectFakePhone("pixel", "Pixel", ["Clipboard", "Information"]);
        yield* phone.serve(clipboardPhone());
        const written = yield* callTool(threadId, "phone_clipboard_write", { text: "hello from a thread" });
        expect(written.result).toMatchObject({ isError: false });
        expect(phone.calls()[0]).toMatchObject({
          args: { text: "hello from a thread" },
          tool: "phone_clipboard_write",
        });
        const read = yield* callTool(threadId, "phone_clipboard_read", {});
        expect(read.result.content[0]?.text).toBe("hello from a thread");
        const info = yield* callTool(threadId, "phone_info", {});
        expect(JSON.parse(info.result.content[0]?.text ?? "null")).toEqual({ battery: 0.8, isCharging: true });
      }),
    ),
  );

  it.live("is told the phone's refusal as a plain error", () =>
    withService(
      Effect.gen(function* () {
        const { threadId } = yield* start("Hello");
        const phone = yield* connectFakePhone("pixel", "Pixel", ["Location"]);
        yield* phone.serve(clipboardPhone());
        const answer = yield* callTool(threadId, "phone_location", {});
        expect(answer.result).toMatchObject({
          content: [{ text: "The phone's owner has not allowed this" }],
          isError: true,
        });
      }),
    ),
  );

  it.live("fails at once with no phone connected, and with the group off", () =>
    withService(
      Effect.gen(function* () {
        const { threadId } = yield* start("Hello");
        expect((yield* callTool(threadId, "phone_info", {})).result).toMatchObject({
          content: [{ text: "No phone connected. Open Outlore on the phone." }],
          isError: true,
        });
        const phone = yield* connectFakePhone("pixel", "Pixel", ["Clipboard"]);
        const off = yield* callTool(threadId, "phone_location", {});
        expect(off.result.isError).toBe(true);
        expect(off.result.content[0]?.text).toContain("Location");
        expect(phone.calls()).toEqual([]);
      }),
    ),
  );

  it.live("must name the phone when several are connected, and the call reaches only that one", () =>
    withService(
      Effect.gen(function* () {
        const { threadId } = yield* start("Hello");
        const pixel = yield* connectFakePhone("pixel", "Pixel", ["Information"]);
        const galaxy = yield* connectFakePhone("galaxy", "Galaxy", ["Information"]);
        yield* pixel.serve(() => ({ _tag: "Done", value: "pixel answered" }));
        yield* galaxy.serve(() => ({ _tag: "Done", value: "galaxy answered" }));
        const unnamed = yield* callTool(threadId, "phone_info", {});
        expect(unnamed.result.isError).toBe(true);
        expect(unnamed.result.content[0]?.text).toContain("Pixel, Galaxy");
        const named = yield* callTool(threadId, "phone_info", { phone: "Galaxy" });
        expect(named.result).toMatchObject({ content: [{ text: "galaxy answered" }], isError: false });
        expect(pixel.calls()).toEqual([]);
        expect(galaxy.calls()).toHaveLength(1);
      }),
    ),
  );

  it.live("fails a call that waits when the phone's session is removed", () =>
    withService(
      Effect.gen(function* () {
        const { threadId } = yield* start("Hello");
        const phone = yield* connectFakePhone("pixel", "Pixel", ["Information"]);
        const calling = yield* Effect.forkChild(callTool(threadId, "phone_info", {}));
        for (let attempt = 0; attempt < 200 && phone.calls().length === 0; attempt++) yield* Effect.sleep("5 millis");
        phone.leave();
        const answer = yield* Fiber.join(calling);
        expect(answer.result).toMatchObject({
          content: [{ text: "The phone disconnected before it answered." }],
          isError: true,
        });
      }),
    ),
  );

  it.live("refuses a phone's request from the host window, a thread and Chronicler, which have no device", () =>
    withService(
      Effect.gen(function* () {
        const service = yield* Service;
        for (const request of [
          { _tag: "SetPhoneTools", groups: ["Clipboard"] },
          { _tag: "AnswerPhoneCall", callId: "x", outcome: { _tag: "Done", value: null } },
        ] as const) {
          const refused = yield* Effect.flip(service.handle(request, { isPairedDevice: false }));
          expect(refused.kind).toBe("AccessRefused");
          const noDevice = yield* Effect.flip(service.handle(request, { isPairedDevice: true }));
          expect(noDevice.kind).toBe("AccessRefused");
        }
      }),
    ),
  );

  it.live("sends the phone only what the app reads: a link or an app for phone_open, and a notification's text", () =>
    withService(
      Effect.gen(function* () {
        const { threadId } = yield* start("Hello");
        const phone = yield* connectFakePhone("pixel", "Pixel", ["Open", "Notify"]);
        yield* phone.serve(() => ({ _tag: "Done", value: "Done." }));
        yield* callTool(threadId, "phone_open", { phone: "Pixel", url: "https://example.com" });
        yield* callTool(threadId, "phone_open", { app: "maps" });
        yield* callTool(threadId, "phone_notify", { text: "Build finished" });
        yield* callTool(threadId, "phone_notify", { text: "Build finished", title: "CI" });
        expect(phone.calls().map((call) => [call.tool, call.args])).toEqual([
          ["phone_open", { url: "https://example.com" }],
          ["phone_open", { app: "maps" }],
          ["phone_notify", { text: "Build finished" }],
          ["phone_notify", { text: "Build finished", title: "CI" }],
        ]);
        const neither = yield* callTool(threadId, "phone_open", {});
        const both = yield* callTool(threadId, "phone_open", { app: "maps", url: "https://example.com" });
        expect([neither.result.isError, both.result.isError]).toEqual([true, true]);
        expect(phone.calls()).toHaveLength(4);
      }),
    ),
  );
});

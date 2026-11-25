import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { type ModelChoice, type StartingContext, ThreadId } from "@outlore/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { type TurnRequest, tokensOf } from "../../src/core/index.ts";
import { approvalInstructionsOf } from "../../src/harness/index.ts";
import { prepareStartingContext } from "../../src/work/startingContext.ts";
import { receivedFor, recordingHarnessLayer } from "../fixtures/recordingHarness.ts";
import { call, fixture, open, read, send, settle, start, tool } from "../fixtures/service.ts";

// Stored and wire names keep `intel` so existing data and agents still work: request tags (`"ListIntel"`, ...) and thread tool names (`save_intel`, ...).

const fixtures: ReturnType<typeof fixture>[] = [];
const live = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const preview = (parentThreadId: ThreadId, text: string, model: ModelChoice = "default") =>
  call({ _tag: "PreviewStartingContext", model, parentThreadId, text });
const openBeneath = (parentThreadId: ThreadId, text: string, shouldStartAnyway: boolean) =>
  call({
    _tag: "OpenThread",
    effort: "default",
    model: "default",
    parentThreadId,
    requestId: crypto.randomUUID(),
    shouldStartAnyway,
    text,
  }).pipe(
    Effect.flip,
    Effect.map((failure) => failure.message),
    Effect.orElseSucceed(() => "opened"),
  );
/** The whole starting context as the sum of its parts. */
const sumOf = (context: StartingContext) => Object.values(context.parts).reduce((sum, part) => sum + part, 0);
/** A mission whose top thread has finished its first turn. */
const idle = (text = "Hello") =>
  Effect.gen(function* () {
    const started = yield* start(text);
    yield* settle(started.missionId, (detail) => detail.thread.state === "Resting");
    return started;
  });
describe("previewing a new thread's starting context", () => {
  it.live("keeps the turn and preview rules stable when another exact action of a granted kind is saved", () => {
    const requests: Array<TurnRequest> = [];
    const value = fixture(undefined, undefined, recordingHarnessLayer(requests));
    fixtures.push(value);
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      let previous: string | null = null;
      for (const command of ["git push origin first", "git push origin second"]) {
        yield* send(threadId, `ask ${JSON.stringify({ action: "Push changes", command, outsideSandbox: true })}`);
        const detail = yield* settle(missionId, (detail) =>
          detail.questions.some((question) => question.outcome === null),
        );
        const question = detail.questions.find((question) => question.outcome === null);
        if (question === undefined) return yield* Effect.die("No question");
        yield* call({ _tag: "AnswerQuestion", answer: "AlwaysAllow", message: null, questionId: question.id });
        yield* settle(missionId, (detail) => detail.thread.state === "Resting");
        const shown = yield* preview(threadId, "Continue");
        const child = yield* open(threadId, "Continue");
        const received = yield* receivedFor(requests, child.threadId);
        const rules = approvalInstructionsOf(received.access, "claude");
        expect(received.access.permissionKinds).toEqual(["Run outside the sandbox"]);
        expect(rules).not.toContain(command);
        const context = yield* prepareStartingContext(child.threadId);
        expect(shown.parts.instructions).toBe(
          tokensOf(context.context.slice(context.context.indexOf("# Threads in Outlore"))) + tokensOf(rules),
        );
        if (previous !== null) expect(rules).toBe(previous);
        previous = rules;
      }
    }).pipe(Effect.provide(value.layer));
  });

  it.live("counts the request, the journal, the lore in scope, and the opener's messages", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* tool(threadId, "save_intel", { kind: "fact", scope: "thread", text: "The owner prefers short replies." });
      const shown = yield* preview(threadId, "y".repeat(400));
      expect(shown.parts.request).toBe(100);
      // The new thread recalls its opener's lore, as its opener's own turns carry it.
      const { note } = yield* prepareStartingContext(threadId);
      expect(shown.parts.lore).toBe(tokensOf(note.slice(note.indexOf("# Lore at this turn"))));
      expect(shown.parts.lore).toBeGreaterThan((yield* read(missionId, threadId)).loreGauge.tokens);
      expect(shown.parts.journal).toBeGreaterThan(0);
      expect(shown.parts.openerMessages).toBeGreaterThan(0);
      // A line about the opener's conversation, not the conversation itself.
      expect(shown.parts.openerMessages).toBeLessThan(200);
      expect(shown.tokens).toBe(sumOf(shown));
      expect(shown).toMatchObject({ isOverWarning: false, warningPercent: 25, windowTokens: 200_000 });
    }).pipe(Effect.provide(layer));
  });

  it.live("counts global lore as its index line", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle();
      const before = (yield* preview(threadId, "Go on.")).parts.lore;
      yield* tool(threadId, "save_intel", { kind: "fact", scope: "global", text: "The owner works in Europe." });
      const [change] = (yield* call({ _tag: "ListIntel", scope: null, state: null, threadId: null })).awaiting;
      if (change === undefined) return yield* Effect.die(new Error("The global save awaits no approval."));
      yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: true });
      const after = (yield* preview(threadId, "Go on.")).parts.lore;
      expect(after - before).toBeGreaterThanOrEqual(tokensOf("The owner works in Europe."));
    }).pipe(Effect.provide(layer));
  });

  it.live("warns past a quarter of the chosen model's context window", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle();
      const shown = yield* preview(threadId, "x".repeat(250_000), "sonnet");
      expect(shown).toMatchObject({ isOverWarning: true, windowTokens: 200_000 });
    }).pipe(Effect.provide(layer));
  });

  it.live("offers no larger model while every model has the same context window", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle();
      expect((yield* preview(threadId, "Go on.")).largerModels).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live("counts the workspace's own instructions", () => {
    const { directory, layer } = live();
    const app = join(directory, "app");
    mkdirSync(app);
    writeFileSync(join(app, "AGENTS.md"), "a".repeat(8_000));
    return Effect.gen(function* () {
      const started = yield* start("Hello", app);
      yield* settle(started.missionId, (detail) => detail.thread.state === "Resting");
      const shown = yield* preview(started.threadId, "Go on.");
      expect(shown.parts.workspace).toBeGreaterThan(2_000);
      expect(shown.tokens).toBe(sumOf(shown));
    }).pipe(Effect.provide(layer));
  });

  it.live("counts the instructions every thread receives, its title line, and the budget line", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const bare = yield* preview(threadId, "Go on.");
      expect(bare.parts.instructions).toBeGreaterThan(1_000);
      expect(bare.parts.position).toBeGreaterThan(0);
      expect(bare.parts.budget).toBe(0);
      yield* call({ _tag: "SetMissionBudget", limits: { cost: null, tokens: 1000 }, missionId });
      const budgeted = yield* preview(threadId, "Go on.");
      expect(budgeted.parts.budget).toBeGreaterThan(0);
      expect(budgeted.tokens).toBe(sumOf(budgeted));
    }).pipe(Effect.provide(layer));
  });

  it.live("measures the starting context the new thread then receives", () => {
    const requests: Array<TurnRequest> = [];
    const value = fixture(undefined, undefined, recordingHarnessLayer(requests));
    fixtures.push(value);
    const { layer } = value;
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* tool(threadId, "save_intel", { kind: "fact", scope: "thread", text: "The owner prefers short replies." });
      yield* call({ _tag: "SetMissionBudget", limits: { cost: null, tokens: 1000 }, missionId });
      const request = "Summarize what the owner said.";
      const shown = yield* preview(threadId, request);
      const child = yield* open(threadId, request);
      const received = yield* prepareStartingContext(child.threadId);
      // The approval rules as the child's harness renders them from the access its turn was given.
      const approval = approvalInstructionsOf((yield* receivedFor(requests, child.threadId)).access, "claude");
      const tokens = tokensOf(received.context) + tokensOf(approval) + tokensOf(received.note) + tokensOf(request);
      // Each part is rounded up and the separators between parts are left out.
      expect(Math.abs(shown.tokens - tokens)).toBeLessThanOrEqual(Object.keys(shown.parts).length);
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses an unknown parent thread", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const failure = yield* preview(ThreadId.make(crypto.randomUUID()), "Go on.").pipe(Effect.flip);
      expect(failure.message).toBe("No such thread.");
    }).pipe(Effect.provide(layer));
  });
});

describe("opening a thread with a large starting context", () => {
  it.live("refuses to start it until the owner chooses to start anyway", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const request = "x".repeat(250_000);
      const refusal = yield* openBeneath(threadId, request, false);
      expect(refusal).toMatch(/^Not started: its starting context takes about \d+% of the model's context window/);
      expect((yield* read(missionId, threadId)).threads).toHaveLength(1);
      expect(yield* openBeneath(threadId, request, true)).toBe("opened");
      expect((yield* read(missionId, threadId)).threads).toHaveLength(2);
    }).pipe(Effect.provide(layer));
  });

  it.live("starts a thread whose starting context stays under the warning without asking", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      expect(yield* openBeneath(threadId, "A small request.", false)).toBe("opened");
      expect((yield* read(missionId, threadId)).threads).toHaveLength(2);
    }).pipe(Effect.provide(layer));
  });
});

describe("assembling a thread's starting context", () => {
  it.live("puts the working folder and the fixed instructions in the system part, and the title in the note", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* call({ _tag: "RenameMission", missionId, title: "Release planning" });
      const { context, cwd, isInWorkspace, note } = yield* prepareStartingContext(threadId);
      expect(isInWorkspace).toBe(false);
      expect(context).toContain(
        `# Your working folder\nYou have no workspace. You work in your quest's scratch folder, ${cwd},`,
      );
      expect(context).toContain(`You are thread ${threadId} in an Outlore quest`);
      expect(context).toContain("# Quest journal\n");
      expect(context).toContain("# Lore\n");
      expect(context).not.toContain("Release planning");
      expect(note.startsWith('Your title: "Release planning".\n\n# Quest journal at this turn\n')).toBe(true);
      expect(note).toContain("# Lore at this turn");
      expect(note).not.toContain("Budget:");
    }).pipe(Effect.provide(layer));
  });

  it.live("gives a thread beneath a line on its opener's conversation and the budget line", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle("Plan the release.");
      yield* call({ _tag: "SetMissionBudget", limits: { cost: null, tokens: 1000 }, missionId });
      const child = yield* open(threadId, "Draft the notes.");
      const { context, note } = yield* prepareStartingContext(child.threadId);
      expect(context).toContain(`Thread ${threadId} opened you.`);
      expect(note).toContain(`thread ${threadId}, which opened you, is "`);
      expect(note).toContain("# Your opener's conversation\n");
      expect(note).toContain("your opener had 2 messages");
      // A first turn of a thread the owner opened also carries its opener's latest messages.
      expect(note).toContain("Its latest messages when you were opened");
      expect(note).toContain("Owner:\nPlan the release.");
      expect(note.endsWith("At a limit, Outlore stops the work under it and asks the owner.")).toBe(true);
    }).pipe(Effect.provide(layer));
  });

  it.live("keeps the system part the same across a rename", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const before = yield* prepareStartingContext(threadId);
      yield* call({ _tag: "RenameMission", missionId, title: "Renamed mission" });
      const after = yield* prepareStartingContext(threadId);
      expect(after.context).toBe(before.context);
      expect(after.note).not.toBe(before.note);
    }).pipe(Effect.provide(layer));
  });
});

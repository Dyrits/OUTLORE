import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { AccountId } from "@outlore/contracts";
import { Effect } from "effect";
import { computerNameOf } from "../../src/remote/config.ts";
import { call, read, sendTo, settle, startMission } from "../fixtures/service.ts";
import {
  answerOpen,
  idleWith,
  linkedFolders,
  linkInPlace,
  openQuestionOf,
  replies,
  startedFolderOf,
  startsOf,
  withHarnesses,
} from "../fixtures/standIns.ts";

describe.each(["claude", "codex"] as const)("checking a %s thread's folder before it starts", (harness) => {
  it.live("starts in a plain workspace folder, asking nothing", () => {
    const { layer, logged } = withHarnesses();
    const { workspace } = linkedFolders();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness, text: "one", workspacePath: workspace });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.questions).toEqual([]);
      expect(detail.handovers).toEqual([]);
      expect(startedFolderOf(harness, logged, 0)).toBe(workspace);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks once a kept thread's workspace folder became a link, then starts where it points and says so", () => {
    const { layer, logged } = withHarnesses();
    const { elsewhere, workspace } = linkedFolders();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness, text: "one", workspacePath: workspace });
      yield* settle(started.missionId, idleWith(1));
      // The process is kept between turns: the changed link alone must restart it.
      linkInPlace(workspace, elsewhere);
      yield* sendTo(started.threadId, "two");
      const open = yield* openQuestionOf();
      expect(open).toMatchObject({ pattern: null, permission: null, source: "Harness" });
      expect(open.summary).toContain(workspace);
      expect(open.summary).toContain(elsewhere);
      const refused = yield* Effect.flip(
        call({ _tag: "AnswerQuestion", answer: "AlwaysAllow", message: null, questionId: open.id }),
      );
      expect(refused.message).toContain("one-time");
      yield* answerOpen("Allow");
      const detail = yield* settle(started.missionId, idleWith(2));
      expect(startsOf(logged)).toHaveLength(2);
      expect(startedFolderOf(harness, logged, 1)).toBe(elsewhere);
      expect(detail.handovers.map((line) => line.text)).toEqual([
        expect.stringMatching(new RegExp(`${workspace}.*is a link.*${elsewhere}`)),
      ]);
      expect((yield* call({ _tag: "ReadPermissions", missionId: null })).permissions).toEqual([]);
      // The process it started is kept for the next turn, asking nothing more.
      yield* sendTo(started.threadId, "three");
      const kept = yield* settle(started.missionId, idleWith(3));
      expect(kept.questions).toHaveLength(1);
      expect(startsOf(logged)).toHaveLength(2);
      // The link pointed elsewhere restarts the process, and the start asks again: the answer covered one start.
      const other = join(elsewhere, "..", "other");
      mkdirSync(other);
      linkInPlace(workspace, other);
      yield* sendTo(started.threadId, "four");
      expect((yield* answerOpen("Deny")).summary).toContain(other);
      yield* settle(started.missionId, (current) => current.thread.state === "Failed");
      expect(startsOf(logged)).toHaveLength(2);
    }).pipe(Effect.provide(layer));
  });

  for (const [label, target] of [
    ["the whole disk", () => "/"],
    ["a folder outside the scratch root", () => linkedFolders().elsewhere],
  ] as const)
    it.live(`fails the turn with the reason when the owner refuses a scratch folder linked to ${label}`, () => {
      const { directory, layer, logged } = withHarnesses();
      const pointed = target();
      return Effect.gen(function* () {
        const started = yield* startMission({ harness, text: "one" });
        yield* settle(started.missionId, idleWith(1));
        const scratch = join(directory, "missions", started.missionId);
        linkInPlace(scratch, pointed);
        yield* sendTo(started.threadId, "two");
        const asked = yield* answerOpen("Deny");
        expect(asked.summary).toContain(scratch);
        expect(asked.summary).toContain(`points to ${pointed}`);
        const detail = yield* settle(started.missionId, (current) => current.thread.state === "Failed");
        expect(detail.thread.failure).toContain(scratch);
        expect(detail.thread.failure).toContain(pointed);
        expect(startsOf(logged)).toHaveLength(1);
      }).pipe(Effect.provide(layer));
    });

  it.live("asks when the scratch root itself became a link, and starts in the resolved folder once allowed", () => {
    const { directory, layer, logged } = withHarnesses();
    const { elsewhere } = linkedFolders();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness, text: "one" });
      yield* settle(started.missionId, idleWith(1));
      const root = join(directory, "missions");
      const { renameSync, symlinkSync } = yield* Effect.sync(() => require("node:fs") as typeof import("node:fs"));
      renameSync(root, join(elsewhere, "missions"));
      symlinkSync(join(elsewhere, "missions"), root);
      yield* sendTo(started.threadId, "two");
      const asked = yield* answerOpen("Allow");
      expect(asked.summary).toContain(root);
      expect(asked.summary).toContain(join(elsewhere, "missions"));
      yield* settle(started.missionId, idleWith(2));
      expect(startedFolderOf(harness, logged, 1)).toBe(join(elsewhere, "missions", started.missionId));
    }).pipe(Effect.provide(layer));
  });
});

describe("managing provider accounts", () => {
  it.live("names the computer's own sign-in after the host, and follows a rename", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      yield* call({ _tag: "RenameHost", name: "Studio" });
      const { harnesses } = yield* call({ _tag: "ListHarnesses" });
      for (const harness of harnesses) expect(harness.accounts[0]).toMatchObject({ id: null, label: "Studio" });
      yield* call({ _tag: "RenameHost", name: "" });
      const reset = yield* call({ _tag: "ListHarnesses" });
      expect(reset.harnesses[0]?.accounts[0]?.label).toBe(computerNameOf());
    }).pipe(Effect.provide(layer));
  });

  it.live("renames each sign-in apart from the computer's name, and a blank name returns to it", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      yield* call({ _tag: "RenameHost", name: "Studio" });
      const renamed = yield* call({ _tag: "RenameOwnAccount", harness: "claude", label: " Personal " });
      const labelsOf = (list: typeof renamed) => list.harnesses.map((harness) => harness.accounts[0]?.label);
      expect(labelsOf(renamed)).toEqual(["Personal", "Studio", "Studio"]);
      // A later rename of the computer leaves the sign-in's own name alone.
      yield* call({ _tag: "RenameHost", name: "Laptop" });
      expect(labelsOf(yield* call({ _tag: "ListHarnesses" }))).toEqual(["Personal", "Laptop", "Laptop"]);
      // An added account renames the same way, and shows in the budgets that name it.
      const added = yield* call({ _tag: "AddAccount", harness: "codex", label: "Work" });
      const accountId = added.harnesses[1]?.accounts[1]?.id as AccountId;
      yield* call({ _tag: "RenameAccount", accountId, label: "Client" });
      const budgets = yield* call({ _tag: "ReadAccountBudgets" });
      expect(budgets.map((budget) => budget.label)).toContain("Personal");
      expect(budgets.map((budget) => budget.label)).toContain("Client");
      const reset = yield* call({ _tag: "RenameOwnAccount", harness: "claude", label: "  " });
      expect(labelsOf(reset)[0]).toBe("Laptop");
    }).pipe(Effect.provide(layer));
  });

  it.live("lists every harness with the computer's own sign-in first", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const { harnesses } = yield* call({ _tag: "ListHarnesses" });
      expect(harnesses.map((harness) => harness.name)).toEqual(["claude", "codex", "opencode"]);
      for (const harness of harnesses) {
        expect(harness.accounts[0]).toMatchObject({ id: null, label: computerNameOf(), signIn: "SignedIn" });
        expect(harness.models.map((model) => model.id)).not.toContain("default");
      }
      expect(harnesses[0]?.models.map((model) => model.label)).toEqual([
        "Fable 5.2",
        "Opus 5.5",
        "Sonnet 5.5",
        "Haiku 5.5",
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("lists the models of each signed-in account, so two subscriptions of one harness show apart", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const added = yield* call({ _tag: "AddAccount", harness: "claude", label: "Work" });
      const claude = added.harnesses.find((harness) => harness.name === "claude");
      expect(claude?.accounts.map((account) => account.label)).toHaveLength(2);
      for (const account of claude?.accounts ?? []) expect(account.models).toEqual(claude?.models);
    }).pipe(Effect.provide(layer));
  });

  it.live("runs a thread with an added account's own folder", () => {
    const { accountsRoot, layer, logged } = withHarnesses();
    return Effect.gen(function* () {
      const added = yield* call({ _tag: "AddAccount", harness: "codex", label: " Work " });
      const account = added.harnesses.find((harness) => harness.name === "codex")?.accounts[1];
      expect(account).toMatchObject({ label: "Work", signIn: "SignedIn" });
      const accountId = account?.id as AccountId;
      const started = yield* startMission({ accountId, harness: "codex", text: "Hello" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.thread).toMatchObject({ accountId, accountLabel: "Work", harness: "codex" });
      expect(logged().find((entry) => entry.pid !== undefined)?.home).toEqual({
        CODEX_HOME: join(accountsRoot, accountId),
      });
      // The next quest starts on the default Companion and the computer's own sign-in, not on this account.
      expect(yield* call({ _tag: "ReadStartChoices" })).toMatchObject({ accountId: null, harness: "claude" });
    }).pipe(Effect.provide(layer));
  });

  it.live("runs Claude Code with an added account's own configuration folder", () => {
    const { accountsRoot, layer, logged } = withHarnesses();
    return Effect.gen(function* () {
      const added = yield* call({ _tag: "AddAccount", harness: "claude", label: "Second" });
      const accountId = added.harnesses[0]?.accounts[1]?.id as AccountId;
      const started = yield* startMission({ accountId, harness: "claude", text: "Hello" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.thread.accountLabel).toBe("Second");
      expect(logged().find((entry) => entry.pid !== undefined)?.home).toBe(join(accountsRoot, accountId));
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses an account of another harness", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const added = yield* call({ _tag: "AddAccount", harness: "codex", label: "Work" });
      const accountId = added.harnesses[1]?.accounts[1]?.id as AccountId;
      const refused = yield* startMission({ accountId, harness: "claude", text: "Hello" }).pipe(Effect.flip);
      expect(refused.message).toBe("No such Claude Code account.");
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses to remove an account a mission still uses, and removes it once the mission ended", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const added = yield* call({ _tag: "AddAccount", harness: "codex", label: "Work" });
      const accountId = added.harnesses[1]?.accounts[1]?.id as AccountId;
      const started = yield* startMission({ accountId, harness: "codex", text: "Hello" });
      yield* settle(started.missionId, idleWith(1));
      const refused = yield* call({ _tag: "RemoveAccount", accountId }).pipe(Effect.flip);
      expect(refused.message).toContain('run on "Work"');
      const preview = yield* call({ _tag: "PreviewEnding", ending: "Archived", missionId: started.missionId });
      yield* call({ _tag: "EndMission", ending: "Archived", missionId: started.missionId, snapshot: preview.snapshot });
      const removed = yield* call({ _tag: "RemoveAccount", accountId });
      expect(removed.harnesses[1]?.accounts).toHaveLength(1);
      expect((yield* read(started.missionId)).thread.accountLabel).toBe("Removed account");
    }).pipe(Effect.provide(layer));
  });

  it.live("fails a turn on a removed account with the reason, without starting the harness", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const added = yield* call({ _tag: "AddAccount", harness: "codex", label: "Work" });
      const accountId = added.harnesses[1]?.accounts[1]?.id as AccountId;
      const started = yield* startMission({ accountId, harness: "codex", text: "Hello" });
      yield* settle(started.missionId, idleWith(1));
      const preview = yield* call({ _tag: "PreviewEnding", ending: "Archived", missionId: started.missionId });
      yield* call({ _tag: "EndMission", ending: "Archived", missionId: started.missionId, snapshot: preview.snapshot });
      yield* call({ _tag: "RemoveAccount", accountId });
      yield* call({ _tag: "ReopenMission", missionId: started.missionId });
      const turns = requests("turn/start").length;
      yield* sendTo(started.threadId, "two");
      const failed = yield* settle(started.missionId, (detail) => detail.thread.state === "Failed");
      expect(failed.thread.failure).toContain("removed");
      expect(requests("turn/start")).toHaveLength(turns);
    }).pipe(Effect.provide(layer));
  });

  it.live("opens the harness's own sign-in pointed at the account's folder", () => {
    const { accountsRoot, layer, signIns } = withHarnesses();
    return Effect.gen(function* () {
      const added = yield* call({ _tag: "AddAccount", harness: "claude", label: "Second" });
      const accountId = added.harnesses[0]?.accounts[1]?.id as AccountId;
      yield* call({ _tag: "SignInAccount", accountId, harness: "claude" });
      yield* call({ _tag: "SignInAccount", accountId: null, harness: "opencode" });
      expect(signIns).toEqual([`claude:${join(accountsRoot, accountId)}`, "opencode:"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("lets a thread open a thread on another harness", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({
        harness: "codex",
        model: "gpt-x",
        text: 'call open_thread {"request":"Hello from below","harness":"opencode"}',
      });
      const parent = yield* settle(started.missionId, (detail) => detail.threads.length === 2 && idleWith(1)(detail));
      const childId = parent.threads[1]?.id;
      expect(childId).toBeDefined();
      for (let attempt = 0; attempt < 300; attempt++) {
        const child = yield* call({ _tag: "ReadMission", missionId: started.missionId, threadId: childId ?? null });
        if (replies(child).length === 1) {
          // On another harness the thread starts on that harness's own sign-in and default model.
          expect(child.thread).toMatchObject({ accountId: null, harness: "opencode", model: "default" });
          expect(replies(child)[0]).toMatch(/^Echo: Message from thread .*\nHello from below $/s);
          return;
        }
        yield* Effect.sleep("20 millis");
      }
      expect.fail("the thread beneath never replied");
    }).pipe(Effect.provide(layer));
  });
});

import { describe, expect, it } from "@effect/vitest";
import type { AccountId } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { fakeHarnessToolsLayer } from "../../src/harness/index.ts";
import { refuseUnansweredExchanges } from "../../src/work/companionExchanges.ts";
import { ask, push } from "../fixtures/approvals.ts";
import { call, fixture, read, register, send, settle, tool, withService } from "../fixtures/service.ts";

// A message that names a Companion with @ (thread-messaging, Mentioning a Companion with @; CHG-0781): the named model
// answers in a hidden quest of its own, its answer is copied under the owner's message, and the conversation's own
// Companion carries on and is told of both as context only.

import { companionRows, isRested, repliesOf, restedQuest, token } from "../fixtures/companions.ts";

// A Companion's hidden quest and the menu that offers Companions (thread-messaging, Mentioning a Companion with @;
// CHG-0781).

describe("a Companion's hidden quest", () => {
  it.live("is in no list the owner reads", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* send(quest.threadId, `${token("gpt-5")} hidden?`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 1);
        const [hidden] = yield* companionRows;
        expect(hidden).toBeDefined();
        const lists = [
          yield* call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null }),
          yield* call({ _tag: "ListMentionables" }),
          yield* call({ _tag: "ReadChronicle" }),
          yield* call({ _tag: "ListOpenQuestions" }),
          yield* call({ _tag: "ReadGuildmaster" }),
          yield* call({ _tag: "ReadAccountBudgets" }),
          yield* call({ _tag: "ListRituals" }),
          yield* call({ _tag: "ListMissions", isArchived: false, search: "hidden?", state: null, workspaceId: null }),
          yield* call({ _tag: "ReadGuildHallRecap", since: 0 }),
          yield* call({ _tag: "ReadBudget", missionId: null }),
          yield* call({ _tag: "ReadPermissions", missionId: null }),
          yield* call({ _tag: "ReadUsage", filters: [], period: { _tag: "Days", days: 7 } }),
        ];
        for (const list of lists) {
          const text = JSON.stringify(list);
          expect(text).not.toContain(hidden?.missionId);
          expect(text).not.toContain(hidden?.threadId);
        }
        const detail = yield* read(quest.missionId);
        expect(JSON.stringify(detail.threads)).not.toContain(hidden?.threadId);
      }),
    ),
  );

  it.live("spends under the quest it answered in, and under no quest of its own", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* send(quest.threadId, `${token("gpt-5")}\nspend 100 0.5`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 1);
        const [hidden] = yield* companionRows;
        const usage = yield* call({ _tag: "ReadUsage", filters: [], period: { _tag: "Days", days: 7 } });
        expect(JSON.stringify(usage)).not.toContain(hidden?.missionId);
        const byQuest = yield* call({
          _tag: "ReadUsage",
          filters: [{ dimension: "Quest", key: quest.missionId }],
          period: { _tag: "Days", days: 7 },
        });
        expect(byQuest.quests).toBe(1);
        expect(byQuest.amounts.tokens.input).toBeGreaterThan(0);
      }),
    ),
  );

  it.live("is erased with its conversation", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* send(quest.threadId, `${token("gpt-5")} short lived`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 1);
        const sql = yield* SqlClient.SqlClient;
        const [hidden] = yield* companionRows;
        const preview = yield* call({ _tag: "PreviewDeletion", threadId: quest.threadId });
        yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: quest.threadId });
        expect(yield* sql`SELECT id FROM missions WHERE is_companion = 1`).toEqual([]);
        expect(yield* sql`SELECT thread_id FROM companion_threads`).toEqual([]);
        expect(yield* sql`SELECT id FROM companion_exchanges`).toEqual([]);
        expect(yield* sql`SELECT id FROM threads WHERE id IN (${quest.threadId}, ${hidden?.threadId ?? ""})`).toEqual(
          [],
        );
        expect(yield* sql`SELECT id FROM messages WHERE thread_id = ${hidden?.threadId ?? ""}`).toEqual([]);
        expect(yield* sql`SELECT id FROM missions WHERE id = ${hidden?.missionId ?? ""}`).toEqual([]);
      }),
    ),
  );

  it.live("has no Outlore tool but the two that ask the owner", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* send(quest.threadId, `${token("gpt-5")} tools?`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 1);
        const [hidden] = yield* companionRows;
        const refusal = yield* tool(hidden?.threadId as never, "open_thread", { request: "Do something" });
        expect(refusal).toContain("no Outlore tools beyond asking the owner");
        const messaging = yield* tool(hidden?.threadId as never, "send_thread_message", {
          text: "hi",
          thread: quest.threadId,
        });
        expect(messaging).toContain("no Outlore tools beyond asking the owner");
      }),
    ),
  );

  it.live("shows its approval questions in the conversation it was asked in, where the owner answers them", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* send(quest.threadId, `${token("gpt-5")} ${ask(push)}`);
        const asking = yield* settle(quest.missionId, (detail) =>
          detail.questions.some((question) => question.outcome === null),
        );
        const question = asking.questions.find((each) => each.outcome === null);
        expect(question?.summary).toBeDefined();
        yield* call({ _tag: "AnswerQuestion", answer: "Deny", message: null, questionId: question?.id as never });
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 1);
        const settled = yield* read(quest.missionId);
        expect(settled.questions.every((each) => each.outcome !== null)).toBe(true);
      }),
    ),
  );
});

describe("after a restart", () => {
  it.live("says a question no turn is left to answer will not be", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        const sql = yield* SqlClient.SqlClient;
        yield* send(quest.threadId, `${token("gpt-5")} first`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 1);
        const [hidden] = yield* companionRows;
        // A question asked when the service stopped: no turn runs, and nothing answered it.
        yield* sql`INSERT INTO companion_exchanges (id, parent_thread_id, companion_thread_id, owner_message_id, state, asked_at)
          SELECT 'left-over', ${quest.threadId}, ${hidden?.threadId ?? ""}, id, 'Asked', 1 FROM messages
          WHERE thread_id = ${quest.threadId} AND sender_kind = 'user' ORDER BY sequence DESC LIMIT 1`;
        yield* sql.withTransaction(refuseUnansweredExchanges);
        const detail = yield* read(quest.missionId);
        expect(repliesOf(detail, "gpt-5").at(-1)?.text).toBe("Cannot answer: Outlore restarted before it answered");
        expect(yield* sql`SELECT state FROM companion_exchanges WHERE id = 'left-over'`).toEqual([
          { state: "Answered" },
        ]);
      }),
    ),
  );
});

describe("a message that names no Companion, or one that cannot be asked", () => {
  it.live("treats a malformed @ word as plain text for the main Companion", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* send(quest.threadId, "hello @companion:codex:- please");
        const detail = yield* settle(
          quest.missionId,
          (current) => isRested(current) && current.messages.at(-1)?.text.includes("please") === true,
        );
        expect(detail.messages.at(-1)?.text).toContain("@companion:codex:-");
        expect(yield* companionRows).toEqual([]);
      }),
    ),
  );
});

describe("the menu a typed @ opens", () => {
  it.live("lists the models of every signed-in account, one row per account and model", () =>
    withService(
      Effect.gen(function* () {
        const added = yield* call({ _tag: "AddAccount", harness: "claude", label: "Work" });
        const workId = added.harnesses.find((harness) => harness.name === "claude")?.accounts[1]?.id as AccountId;
        const choices = yield* call({ _tag: "ListCompanions" });
        const claude = choices.filter((choice) => choice.harness === "claude");
        expect(claude.some((choice) => choice.accountId === null)).toBe(true);
        expect(claude.some((choice) => choice.accountId === workId && choice.accountLabel === "Work")).toBe(true);
        expect(choices.every((choice) => choice.model !== "" && choice.modelLabel !== "")).toBe(true);
      }),
    ),
  );

  it.live("lists nothing of a harness that cannot run", () => {
    const missing = fakeHarnessToolsLayer([], { available: {}, updated: [] }, new Set(["codex"] as const));
    return Effect.gen(function* () {
      const choices = yield* call({ _tag: "ListCompanions" });
      expect(choices.some((choice) => choice.harness === "codex")).toBe(false);
      expect(choices.some((choice) => choice.harness === "claude")).toBe(true);
    }).pipe(Effect.provide(register(fixture(missing)).layer));
  });
});

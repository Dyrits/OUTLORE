import { describe, expect, it } from "@effect/vitest";
import type { MissionId, ThreadId } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { call, fixture, open, read, rename, send, settle, start, startNamed, tool } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const live = () => {
  const value = fixture();
  fixtures.push(value);
  return value.layer;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const journal = (missionId: MissionId) => call({ _tag: "ReadJournal", missionId });
const record = (threadId: ThreadId, args: object) => tool(threadId, "update_journal", args);
/** A mission whose top thread has finished its first turn. */
const idle = (text = "Hello") =>
  Effect.gen(function* () {
    const started = yield* startNamed(text);
    yield* settle(started.missionId, (detail) => detail.thread.state === "Resting");
    return started;
  });
/** The starting context a new thread beneath `parentId` receives, as the fake harness echoes it. */
const contextOfChild = (missionId: MissionId, parentId: ThreadId) =>
  Effect.gen(function* () {
    const child = yield* open(parentId, "context");
    const detail = yield* settle(
      missionId,
      (detail) => detail.messages.some((message) => message.sender === "agent"),
      child.threadId,
    );
    return detail.messages.find((message) => message.sender === "agent")?.text ?? "";
  });

describe("keeping a mission's journal", () => {
  it.live("creates an empty journal with each mission", () =>
    Effect.gen(function* () {
      const { missionId } = yield* idle();
      const view = yield* journal(missionId);
      expect(view).toMatchObject({ briefing: "", briefingTokens: 0, entries: [], limit: 2000, version: 0 });
    }).pipe(Effect.provide(live())),
  );

  it.live("adds a thread's entry with its author and time", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle("Plan the release");
      const answer = yield* record(threadId, { entry: "Chose SQLite for storage." });
      expect(answer).toContain("Recorded entry 1");
      const [entry] = (yield* journal(missionId)).entries;
      expect(entry).toMatchObject({
        authorKind: "thread",
        authorTitle: "Plan the release",
        number: 1,
        text: "Chose SQLite for storage.",
      });
      expect(entry?.writtenAt).toBeGreaterThan(0);
    }).pipe(Effect.provide(live())),
  );

  it.live("rewrites the briefing with its entry and a new version", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const answer = yield* record(threadId, {
        basedOn: 0,
        briefing: "Storage is SQLite.",
        entry: "Settled storage.",
      });
      expect(answer).toContain("version 1");
      const view = yield* journal(missionId);
      expect(view).toMatchObject({ briefing: "Storage is SQLite.", briefingTokens: 5, version: 1 });
      expect(view.entries.map((entry) => entry.text)).toEqual(["Settled storage."]);
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses an update without an entry", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const answer = yield* record(threadId, { basedOn: 0, briefing: "No entry with it.", entry: " " });
      expect(answer).toContain("entry");
      expect((yield* journal(missionId)).version).toBe(0);
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses a briefing over the limit with its reason", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, briefingLimit: 10 } });
      const { missionId, threadId } = yield* idle();
      const answer = yield* record(threadId, { basedOn: 0, briefing: "x".repeat(41), entry: "Too long." });
      expect(answer).toContain("11 tokens");
      expect(answer).toContain("limit of 10");
      const view = yield* journal(missionId);
      expect(view).toMatchObject({ briefing: "", entries: [], version: 0 });
      yield* record(threadId, { basedOn: 0, briefing: "x".repeat(40), entry: "Fits." });
      expect((yield* journal(missionId)).version).toBe(1);
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses a stale rewrite with the current briefing, then accepts the merged one", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const child = yield* open(threadId, "Hello");
      yield* settle(missionId, (detail) => detail.thread.state === "Resting", child.threadId);
      yield* record(threadId, { basedOn: 0, briefing: "Storage is SQLite.", entry: "Settled storage." });
      const refused = yield* record(child.threadId, { basedOn: 0, briefing: "The UI is React.", entry: "UI." });
      expect(refused).toContain("version 1");
      expect(refused).toContain("Storage is SQLite.");
      expect((yield* journal(missionId)).briefing).toBe("Storage is SQLite.");
      const missing = yield* record(child.threadId, { briefing: "No version.", entry: "UI." });
      expect(missing).toContain("basedOn");
      yield* record(child.threadId, {
        basedOn: 1,
        briefing: "Storage is SQLite. The UI is React.",
        entry: "Settled the UI.",
      });
      const view = yield* journal(missionId);
      expect(view).toMatchObject({ briefing: "Storage is SQLite. The UI is React.", version: 2 });
      expect(view.entries).toHaveLength(2);
    }).pipe(Effect.provide(live())),
  );

  it.live("reads the latest entries, and older ones from a starting point", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      for (let index = 1; index <= 25; index++) yield* record(threadId, { entry: `Entry ${index}` });
      const latest = yield* tool(threadId, "read_journal", {});
      expect(latest).toContain("Entry 25");
      expect(latest).toContain("Entry 6");
      expect(latest).not.toContain("Entry 5\n");
      expect(latest).toContain("version 0");
      const older = yield* tool(threadId, "read_journal", { before: 6, count: 3 });
      expect(older).toContain("Entry 3");
      expect(older).toContain("Entry 5");
      expect(older).not.toContain("Entry 2\n");
      expect(older).not.toContain("Entry 6");
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses a result without a journal entry and records one given with it", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const child = yield* open(threadId, "Hello");
      yield* settle(missionId, (detail) => detail.thread.state === "Resting", child.threadId);
      const refused = yield* tool(child.threadId, "report_result", { result: "Done." });
      expect(refused).toContain("journal");
      expect((yield* read(missionId)).messages.some((message) => message.isResult)).toBe(false);
      yield* tool(child.threadId, "report_result", { journal: "Counted 42 files.", result: "42 files." });
      const view = yield* journal(missionId);
      expect(view.entries.map((entry) => [entry.authorTitle, entry.text])).toEqual([["Errand", "Counted 42 files."]]);
      const other = yield* open(threadId, "Hello");
      yield* settle(missionId, (detail) => detail.thread.state === "Resting", other.threadId);
      yield* tool(other.threadId, "report_result", { journal: "Nothing to record.", result: "Nothing found." });
      expect((yield* journal(missionId)).entries).toHaveLength(1);
    }).pipe(Effect.provide(live())),
  );

  it.live("starts a thread with the briefing and the 20 latest entries", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* record(threadId, { basedOn: 0, briefing: "We ship on Friday.", entry: "Entry 1" });
      for (let index = 2; index <= 21; index++) yield* record(threadId, { entry: `Entry ${index}` });
      const context = yield* contextOfChild(missionId, threadId);
      expect(context).toContain("We ship on Friday.");
      expect(context).toContain("Entry 21");
      expect(context).toContain("Entry 2\n");
      expect(context).not.toContain("Entry 1\n");
      expect(context).toContain("read_journal");
    }).pipe(Effect.provide(live())),
  );

  it.live("tells a thread opened beneath another how much its opener said, and shows its latest messages", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle("Before the entry");
      yield* record(threadId, { entry: "Decided the plan." });
      yield* send(threadId, "After the entry");
      yield* settle(missionId, (detail) => detail.thread.state === "Resting" && detail.messages.length === 4);
      const context = yield* contextOfChild(missionId, threadId);
      // The opener's title is the mission's first message, so only the opener's section is read.
      const section = context.split("# Your opener's conversation")[1] ?? "";
      expect(section).toContain("your opener had 4 messages");
      expect(section).toContain("read_parent_messages");
      // The owner opened it, so its first turn also carries the opener's latest messages (here all four).
      expect(section).toContain("Owner:\nBefore the entry");
      expect(section).toContain("Owner:\nAfter the entry");
    }).pipe(Effect.provide(live())),
  );

  it.live("gives a thread the owner opens its opener's last five messages, clipped, on its first turn only", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle("Message 0");
      for (const text of ["Message 1", `Message 2 ${"long ".repeat(200)}`, "Message 3"]) {
        yield* send(threadId, text);
        yield* settle(missionId, (detail) => detail.thread.state === "Resting" && detail.messages.length % 2 === 0);
      }
      const child = yield* open(threadId, "context");
      const echoes = (detail: { messages: ReadonlyArray<{ sender: string; text: string }> }) =>
        detail.messages.filter((message) => message.sender === "agent");
      const first = yield* settle(missionId, (detail) => echoes(detail).length === 1, child.threadId);
      const section = echoes(first)[0]?.text.split("# Your opener's conversation")[1] ?? "";
      expect(section).toContain("Its latest messages when you were opened");
      // Five of the opener's eight messages, the oldest three left to read_parent_messages.
      expect(section).toContain("Owner:\nMessage 3");
      expect(section).toContain("Owner:\nMessage 2 long");
      expect(section).not.toContain("Owner:\nMessage 1");
      expect(section).not.toContain("Owner:\nMessage 0");
      expect(section).not.toContain(`${"long ".repeat(200)}`);
      yield* send(child.threadId, "context");
      const second = yield* settle(missionId, (detail) => echoes(detail).length === 2, child.threadId);
      const later = echoes(second)[1]?.text.split("# Your opener's conversation")[1] ?? "";
      expect(later).toContain("your opener had");
      expect(later).not.toContain("Its latest messages when you were opened");
      expect(later).not.toContain("Owner:\nMessage 3");
    }).pipe(Effect.provide(live())),
  );

  it.live("gives a thread an agent opens no tail, since its request is meant to be complete", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle("Message 0");
      yield* tool(threadId, "open_thread", { request: "Look into it" });
      const detail = yield* settle(missionId, (detail) => detail.threads.length === 2);
      const errand = detail.threads.find((candidate) => candidate.parentId === threadId);
      if (errand === undefined) return yield* Effect.die("No errand");
      const sql = yield* SqlClient.SqlClient;
      const [row] = yield* sql<{
        tail: string | null;
      }>`SELECT opener_tail AS tail FROM threads WHERE id = ${errand.id}`;
      expect(row?.tail).toBeNull();
    }).pipe(Effect.provide(live())),
  );

  it.live("reads the opener's messages on demand: newest first, paged back, and searched by words", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle("Message 0");
      for (const [index, text] of [
        "The login page redirects users",
        "Pricing needs a discount code",
        "Message 3",
      ].entries()) {
        yield* send(threadId, text);
        yield* settle(
          missionId,
          (detail) => detail.thread.state === "Resting" && detail.messages.length === 2 * (index + 2),
        );
      }
      const child = yield* open(threadId, "context");
      const latest = yield* tool(child.threadId, "read_parent_messages", { count: 2 });
      // Opening the thread left a copy of its first message in its opener's conversation, the newest message.
      expect(latest).toContain("#9 Owner: context");
      expect(latest).toContain("#8 Opener: Echo: Message 3");
      expect(latest).not.toContain("discount");
      const earlier = yield* tool(child.threadId, "read_parent_messages", { before: 4, count: 1 });
      expect(earlier).toContain("Owner: The login page redirects users");
      expect(earlier).not.toContain("discount");
      // Word endings and several words match, and the better match ranks first.
      const found = yield* tool(child.threadId, "read_parent_messages", { query: "redirected users discount" });
      expect(found).toContain("The login page redirects users");
      expect(found).toContain("Pricing needs a discount code");
      expect(found.indexOf("redirects")).toBeLessThan(found.indexOf("discount"));
      expect(yield* tool(child.threadId, "read_parent_messages", { before: 3, query: "redirect" })).toBe(
        "No such messages.",
      );
      expect(yield* tool(child.threadId, "read_parent_messages", { query: "unrelated" })).toBe("No such messages.");
      expect(yield* tool(threadId, "read_parent_messages", {})).toContain("no opener");
    }).pipe(Effect.provide(live())),
  );

  it.live("searches the opener's messages by words even where the full-text index is missing", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle("The login page redirects users");
      yield* send(threadId, "Pricing needs a discount code");
      yield* settle(missionId, (detail) => detail.thread.state === "Resting" && detail.messages.length === 4);
      const sql = yield* SqlClient.SqlClient;
      for (const trigger of ["insert", "delete", "update"]) yield* sql.unsafe(`DROP TRIGGER messages_fts_${trigger}`);
      yield* sql`DROP TABLE messages_fts`;
      const child = yield* open(threadId, "context");
      const found = yield* tool(child.threadId, "read_parent_messages", { query: "discount login" });
      expect(found).toContain("Owner: Pricing needs a discount code");
      expect(found).toContain("Owner: The login page redirects users");
      expect(yield* tool(child.threadId, "read_parent_messages", { query: "unrelated" })).toBe("No such messages.");
    }).pipe(Effect.provide(live())),
  );

  it.live("starts a top thread with no opener's messages", () =>
    Effect.gen(function* () {
      const started = yield* start("context");
      const detail = yield* settle(started.missionId, (detail) =>
        detail.messages.some((message) => message.sender === "agent"),
      );
      const context = detail.messages.find((message) => message.sender === "agent")?.text ?? "";
      expect(context).toContain("# Quest journal");
      expect(context).not.toContain("opener's messages");
    }).pipe(Effect.provide(live())),
  );

  it.live("records the owner's rewrite and entry as written by the owner", () =>
    Effect.gen(function* () {
      const { missionId } = yield* idle();
      const rewritten = yield* call({
        _tag: "RewriteBriefing",
        basedOn: 0,
        briefing: "Owner's briefing.",
        entry: null,
        missionId,
        requestId: crypto.randomUUID(),
      });
      expect(rewritten).toMatchObject({ briefing: "Owner's briefing.", version: 1 });
      const added = yield* call({
        _tag: "AddJournalEntry",
        missionId,
        requestId: crypto.randomUUID(),
        text: "Budget doubled.",
      });
      expect(added.entries.map((entry) => [entry.authorKind, entry.authorTitle, entry.text])).toEqual([
        ["user", null, "Budget doubled."],
        ["user", null, "Rewrote the briefing"],
      ]);
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses the owner's stale or oversized rewrite", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* record(threadId, { basedOn: 0, briefing: "Thread's briefing.", entry: "Thread rewrote." });
      const rewrite = (briefing: string, basedOn: number) =>
        call({ _tag: "RewriteBriefing", basedOn, briefing, entry: null, missionId, requestId: crypto.randomUUID() });
      const stale = yield* Effect.flip(rewrite("Owner's briefing.", 0));
      expect(stale.kind).toBe("StaleVersion");
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, briefingLimit: 2 } });
      const oversized = yield* Effect.flip(rewrite("Far too long.", 1));
      expect(oversized.kind).toBe("InvalidInput");
      expect((yield* journal(missionId)).briefing).toBe("Thread's briefing.");
    }).pipe(Effect.provide(live())),
  );

  it.live("keeps entries from being edited or deleted", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* record(threadId, { entry: "Permanent." });
      const sql = yield* SqlClient.SqlClient;
      expect((yield* Effect.exit(sql`UPDATE journal_entries SET text = 'Changed'`))._tag).toBe("Failure");
      expect((yield* Effect.exit(sql`DELETE FROM journal_entries`))._tag).toBe("Failure");
      expect((yield* journal(missionId)).entries.map((entry) => entry.text)).toEqual(["Permanent."]);
    }).pipe(Effect.provide(live())),
  );

  it.live("erases the journal with its mission", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* record(threadId, { basedOn: 0, briefing: "Gone soon.", entry: "Will be erased." });
      const preview = yield* call({ _tag: "PreviewDeletion", threadId });
      yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId });
      const sql = yield* SqlClient.SqlClient;
      const [entries] = yield* sql<{ count: number }>`SELECT COUNT(*) AS count FROM journal_entries`;
      const [journals] = yield* sql<{
        count: number;
      }>`SELECT COUNT(*) AS count FROM journals WHERE mission_id = ${missionId}`;
      expect([entries?.count, journals?.count]).toEqual([0, 0]);
      expect((yield* Effect.flip(journal(missionId))).kind).toBe("NotFound");
    }).pipe(Effect.provide(live())),
  );

  it.live("keeps a deleted thread's entries with its saved title", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const child = yield* open(threadId, "Child");
      yield* rename(child.threadId, "Child");
      yield* settle(missionId, (detail) => detail.thread.state === "Resting", child.threadId);
      yield* record(child.threadId, { entry: "Child's decision." });
      const preview = yield* call({ _tag: "PreviewDeletion", threadId: child.threadId });
      yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: child.threadId });
      const [entry] = (yield* journal(missionId)).entries;
      expect(entry).toMatchObject({ authorKind: "thread", authorTitle: "Child", text: "Child's decision." });
    }).pipe(Effect.provide(live())),
  );
});

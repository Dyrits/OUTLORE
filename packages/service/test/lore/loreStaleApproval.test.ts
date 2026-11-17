import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { approveAll, idle, idOf, loreEntryOf, panel, save } from "../fixtures/lore.ts";
import { call, fixture, register, tool } from "../fixtures/service.ts";

// Stored and wire names keep `intel` so existing data and agents still work: request tags (`"EditIntel"`, ...) and thread tool names (`update_intel`, ...).

// A change awaiting approval shows the lore entry's text as it was when the thread proposed it (scoped-intel,
// Duplicates: "its approval card shows the old and the new text"). When the owner has corrected the lore entry since,
// approving would act on text the card never showed, so approval is refused and the owner can decline the card.

const live = () => register(fixture());

/** A global lore entry the owner has approved, and the thread that saved it. */
const approvedGlobal = Effect.gen(function* () {
  const { threadId } = yield* idle();
  yield* save(threadId, "The owner writes in British English.", "global", "preference");
  yield* approveAll();
  const [loreEntry] = (yield* panel()).loreEntries;
  if (loreEntry === undefined) return yield* Effect.die("the global lore entry was not saved");
  return { loreEntryId: loreEntry.id, threadId };
});

const owned = "The owner writes in Canadian English.";

const rejectApproval = Effect.gen(function* () {
  const [change] = (yield* panel()).awaiting;
  if (change === undefined) return yield* Effect.die("Missing proposal");
  const refusal = yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: true }).pipe(Effect.flip);
  expect(refusal.kind).toBe("InvalidInput");
  expect(refusal.message).toContain("Decline");
  expect((yield* panel()).awaiting.map((item) => item.id)).toContain(change.id);
  yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: false });
});

describe("approving a change to a lore entry the owner corrected since", () => {
  it.effect("declines a widening when the lore was moved elsewhere after the proposal", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle("Hello", directory);
      const id = idOf(yield* save(threadId, "The owner likes tables.", "thread"));
      yield* tool(threadId, "update_intel", { id, scope: "workspace" });
      yield* tool(threadId, "update_intel", { id, scope: "global" });
      const awaiting = (yield* panel()).awaiting;
      const workspace = awaiting.find((change) => change.scope === "Workspace");
      const global = awaiting.find((change) => change.scope === "Global");
      if (workspace === undefined || global === undefined) return yield* Effect.die("Missing widening proposals");
      yield* call({ _tag: "ResolveIntelChange", changeId: global.id, isApproved: true });
      const refusal = yield* call({ _tag: "ResolveIntelChange", changeId: workspace.id, isApproved: true }).pipe(
        Effect.flip,
      );
      expect(refusal.message).toContain("changed");
      expect((yield* panel()).awaiting.map((change) => change.id)).toContain(workspace.id);
      expect(yield* loreEntryOf(id)).toMatchObject({ scope: "Global", text: "The owner likes tables." });
    }).pipe(Effect.provide(layer));
  });

  it.effect("declines a replacement when the lore kind changed after the proposal", () =>
    Effect.gen(function* () {
      const { loreEntryId, threadId } = yield* approvedGlobal;
      yield* save(threadId, "The owner writes in British English.", "global", "fact");
      yield* save(threadId, "The owner writes in British English.", "global", "rule");
      const awaiting = (yield* panel()).awaiting;
      const first = awaiting[0];
      const second = awaiting[1];
      if (first === undefined || second === undefined) return yield* Effect.die("Missing replacement proposals");
      yield* call({ _tag: "ResolveIntelChange", changeId: first.id, isApproved: true });
      const refusal = yield* call({ _tag: "ResolveIntelChange", changeId: second.id, isApproved: true }).pipe(
        Effect.flip,
      );
      expect(refusal.message).toContain("changed");
      expect(yield* loreEntryOf(loreEntryId)).toMatchObject({
        kind: "Fact",
        text: "The owner writes in British English.",
      });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("declines a targeted old-format change with no previous text", () =>
    Effect.gen(function* () {
      const { loreEntryId, threadId } = yield* approvedGlobal;
      yield* tool(threadId, "forget_intel", { id: loreEntryId });
      const [change] = (yield* panel()).awaiting;
      if (change === undefined) return yield* Effect.die("Missing deletion proposal");
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE intel_changes SET previous_text = NULL WHERE id = ${change.id}`;
      yield* rejectApproval;
      expect(yield* loreEntryOf(loreEntryId)).toMatchObject({ text: "The owner writes in British English." });
      expect((yield* panel()).awaiting).toHaveLength(0);
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("declines a pending change from before placement and kind were recorded", () =>
    Effect.gen(function* () {
      const { loreEntryId, threadId } = yield* approvedGlobal;
      yield* tool(threadId, "update_intel", { id: loreEntryId, text: "The owner writes in American English." });
      const [change] = (yield* panel()).awaiting;
      if (change === undefined) return yield* Effect.die("Missing correction proposal");
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE intel_changes SET previous_scope = NULL, previous_thread_id = NULL,
        previous_workspace_id = NULL, previous_kind = NULL WHERE id = ${change.id}`;
      expect((yield* panel()).awaiting).toMatchObject([
        { id: change.id, previousText: "The owner writes in British English." },
      ]);
      const refusal = yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: true }).pipe(
        Effect.flip,
      );
      expect(refusal.message).toContain("predates");
      expect((yield* panel()).awaiting).toHaveLength(1);
      yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: false });
      expect(yield* loreEntryOf(loreEntryId)).toMatchObject({ text: "The owner writes in British English." });
      expect((yield* panel()).awaiting).toHaveLength(0);
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("declines a correction instead of overwriting the owner's newer text", () =>
    Effect.gen(function* () {
      const { loreEntryId, threadId } = yield* approvedGlobal;
      yield* tool(threadId, "update_intel", { id: loreEntryId, text: "The owner writes in American English." });
      expect((yield* panel()).awaiting).toHaveLength(1);
      yield* call({ _tag: "EditIntel", loreEntryId, text: owned });
      yield* rejectApproval;
      expect((yield* panel()).awaiting).toHaveLength(0);
      expect(yield* loreEntryOf(loreEntryId)).toMatchObject({ text: owned });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("declines a replacement instead of overwriting the owner's newer text", () =>
    Effect.gen(function* () {
      const { loreEntryId, threadId } = yield* approvedGlobal;
      yield* save(threadId, "The owner writes in American English.", "global", "preference");
      expect((yield* panel()).awaiting).toMatchObject([{ kind: "Replace", loreEntryId }]);
      yield* call({ _tag: "EditIntel", loreEntryId, text: owned });
      yield* rejectApproval;
      expect(yield* loreEntryOf(loreEntryId)).toMatchObject({ text: owned });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("declines a deletion instead of deleting text the card never showed", () =>
    Effect.gen(function* () {
      const { loreEntryId, threadId } = yield* approvedGlobal;
      yield* tool(threadId, "forget_intel", { id: loreEntryId });
      yield* call({ _tag: "EditIntel", loreEntryId, text: owned });
      yield* rejectApproval;
      expect(yield* loreEntryOf(loreEntryId)).toMatchObject({ text: owned });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("still applies a change whose lore entry has not changed since", () =>
    Effect.gen(function* () {
      const { loreEntryId, threadId } = yield* approvedGlobal;
      yield* tool(threadId, "update_intel", { id: loreEntryId, text: "The owner writes in American English." });
      yield* approveAll();
      expect(yield* loreEntryOf(loreEntryId)).toMatchObject({ text: "The owner writes in American English." });
    }).pipe(Effect.provide(live().layer)),
  );
});

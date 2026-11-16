import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { approveAll, idle, loreEntryOf, panel, save } from "../fixtures/lore.ts";
import { call, fixture, register, tool } from "../fixtures/service.ts";

// Stored and wire names keep `intel` so existing data and agents still work: request tags (`"EditIntel"`, ...) and thread tool names (`update_intel`, ...).

// A change awaiting approval shows the lore entry's text as it was when the thread proposed it (scoped-intel,
// Duplicates: "its approval card shows the old and the new text"). When the owner has corrected the lore entry since,
// approving would act on text the card never showed, so the change is declined, as for a lore entry deleted meanwhile.

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

describe("approving a change to a lore entry the owner corrected since", () => {
  it.effect("declines a correction instead of overwriting the owner's newer text", () =>
    Effect.gen(function* () {
      const { loreEntryId, threadId } = yield* approvedGlobal;
      yield* tool(threadId, "update_intel", { id: loreEntryId, text: "The owner writes in American English." });
      expect((yield* panel()).awaiting).toHaveLength(1);
      yield* call({ _tag: "EditIntel", loreEntryId, text: owned });
      yield* approveAll();
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
      yield* approveAll();
      expect(yield* loreEntryOf(loreEntryId)).toMatchObject({ text: owned });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("declines a deletion instead of deleting text the card never showed", () =>
    Effect.gen(function* () {
      const { loreEntryId, threadId } = yield* approvedGlobal;
      yield* tool(threadId, "forget_intel", { id: loreEntryId });
      yield* call({ _tag: "EditIntel", loreEntryId, text: owned });
      yield* approveAll();
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

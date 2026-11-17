import type { LoreEntryId, LoreHistoryEntry, LoreScope, LoreStateFilter, ThreadId } from "@outlore/contracts";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { call, start, tool } from "./service.ts";

// The lore panel's cases (test/lore) share one small world: a mission on the test clock whose turns settle,
// the threads' lore tools, and the owner's lore panel and history.

/** Moves the test clock and lets forked turns and sweeps observe it and commit. */
export const advance = (millis: number) =>
  Effect.gen(function* () {
    yield* TestClock.adjust(millis);
    for (let index = 0; index < 40; index++) yield* Effect.yieldNow;
  });

/** Lets a fake turn (10 millis) and its tool calls finish. */
export const settleTurns = Effect.gen(function* () {
  for (let index = 0; index < 5; index++) yield* advance(20);
});

/** A mission whose top thread has finished its first turn on the test clock. */
export const idle = (text = "Hello", workspacePath: string | null = null) =>
  Effect.gen(function* () {
    const started = yield* start(text, workspacePath);
    yield* settleTurns;
    return started;
  });

/** Saves lore as the thread's `save_intel` tool would. */
export const save = (threadId: ThreadId, text: string, scope: string, kind = "fact", extra: object = {}) =>
  tool(threadId, "save_intel", { kind, scope, text, ...extra });

/** The lore entry identifier a tool answer names. */
export const idOf = (answer: string) => (/lore entry (\S+?)[ .:]/.exec(answer)?.[1] ?? "") as LoreEntryId;

/** Reads the owner's lore panel, optionally narrowed to a state, a thread, or a scope. */
export const panel = (
  select: { scope?: LoreScope | null; state?: LoreStateFilter | null; threadId?: ThreadId | null } = {},
) =>
  call({
    _tag: "ListIntel",
    scope: select.scope ?? null,
    state: select.state ?? null,
    threadId: select.threadId ?? null,
  });

/** The lore entry with that identifier on the panel, or undefined. */
export const loreEntryOf = (id: string) =>
  panel().pipe(Effect.map((view) => view.loreEntries.find((loreEntry) => loreEntry.id === id)));

/** A lore entry's history, newest first. */
export const historyOf = (loreEntryId: LoreEntryId) => call({ _tag: "ReadIntelHistory", loreEntryId });

/** The entries of each kind in a history, in order. */
export const kindsOf = (entries: ReadonlyArray<LoreHistoryEntry>) => entries.map((entry) => entry.kind);

/** Approves (or declines) every lore change awaiting the owner. */
export const approveAll = (isApproved = true) =>
  Effect.gen(function* () {
    for (const change of (yield* panel()).awaiting) {
      yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved });
    }
  });

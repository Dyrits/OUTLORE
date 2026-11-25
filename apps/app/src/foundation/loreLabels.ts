import type {
  LoreChange,
  LoreChangeStatus,
  LoreEntry,
  LoreGauge,
  LoreHistoryEntry,
  LoreHistoryKind,
  LoreOrigin,
  LoreProposal,
} from "@outlore/contracts";
import { percentOf } from "./countLabels";

/** What a thread's change to lore does, for example "Save lore to Global" (scoped-intel). */
export const loreActionOf = (change: Pick<LoreChange, "kind" | "previousText" | "scopeLabel" | "text">) => {
  const scope = scopeNameOf(change.scopeLabel);
  const actions = {
    Forget: `Delete lore from ${scope}`,
    Replace: `Replace lore in ${scope}`,
    Save: `Save lore to ${scope}`,
    // An update that keeps the text only moves the lore.
    Update: change.previousText === change.text ? `Move lore to ${scope}` : `Correct lore in ${scope}`,
  } satisfies Record<LoreChange["kind"], string>;
  return actions[change.kind];
};

/** What a lore entry rests on, for the panel, for example "From journal entry 4: Chose Effect."; null when none. */
export const loreOriginLabelOf = (origin: LoreOrigin | null) => {
  if (origin === null) return null;
  if (origin.kind === "JournalEntry") return `From journal entry ${origin.entryNumber ?? ""}: ${origin.excerpt}`;
  if (origin.from === null) return `From your message: ${origin.excerpt}`;
  return `From a message by "${origin.from}": ${origin.excerpt}`;
};

const loreStatusLabels = {
  Approved: " · approved",
  Awaiting: " · awaiting your approval",
  Declined: " · declined",
  Done: "",
} as const satisfies Record<LoreChangeStatus, string>;

/** A thread's change to lore as one line in its conversation, for example "Save lore to Global · approved". */
export const loreChangeLineOf = (
  change: Pick<LoreChange, "kind" | "previousText" | "scopeLabel" | "status" | "text">,
) => `${loreActionOf(change)}${loreStatusLabels[change.status]}`;

/** The lore icon's text: the count and its share of the model's context window, for example "Lore · 3 · 0.2%". */
export const loreGaugeLabelOf = (gauge: Pick<LoreGauge, "count" | "tokens" | "windowTokens">) =>
  `Lore · ${loreGaugeValueOf(gauge)}`;

/** The lore gauge without its name, for example "3 · 0.2%". */
export const loreGaugeValueOf = (gauge: Pick<LoreGauge, "count" | "tokens" | "windowTokens">) =>
  `${gauge.count} · ${percentOf(gauge.tokens, gauge.windowTokens)}%`;

/** How often threads used a lore entry, for example "used 3 times". */
const usesLabelOf = (uses: number) => {
  if (uses === 0) return "not used yet";
  if (uses === 1) return "used once";
  return `used ${uses} times`;
};

/** A lore entry's fading in the panel, for example "Preference · active · strength 82% · used 3 times · pinned". */
export const loreFadingLabelOf = (loreEntry: Pick<LoreEntry, "isPinned" | "kind" | "state" | "strength" | "uses">) =>
  [
    loreEntry.kind,
    loreEntry.state.toLowerCase(),
    `strength ${Math.round(loreEntry.strength * 100)}%`,
    usesLabelOf(loreEntry.uses),
    ...(loreEntry.isPinned ? ["pinned"] : []),
  ].join(" · ");

const loreHistoryVerbs = {
  Archived: "Became archived",
  Corrected: "Corrected",
  Deleted: "Deleted",
  Dormant: "Became dormant",
  Edited: "Edited",
  Merged: "Merged into one global lore entry",
  Narrowed: "Moved",
  Pinned: "Pinned",
  Replaced: "Replaced by a save",
  Restored: "Restored",
  Saved: "Saved",
  Undone: "Undid",
  Unpinned: "Unpinned",
  Widened: "Moved",
} as const satisfies Record<LoreHistoryKind, string>;

/** Who made a change in a lore entry's history, as its line names them. */
const loreActorLabelOf = (entry: Pick<LoreHistoryEntry, "actor" | "actorTitle">) => {
  const actors = {
    Fading: "fading",
    Owner: "you",
    Thread: `"${entry.actorTitle ?? "a quest"}"`,
  } satisfies Record<LoreHistoryEntry["actor"], string>;
  return actors[entry.actor];
};

/** What a change in a lore entry's history did and who did it, for example "Widened to Global by you". */
const loreHistoryActionOf = (
  entry: Pick<LoreHistoryEntry, "actor" | "actorTitle" | "kind" | "scopeLabel" | "undid">,
) => {
  const verb = loreHistoryVerbs[entry.kind];
  const who = loreActorLabelOf(entry);
  if (entry.kind === "Undone") return `You undid: ${loreHistoryVerbs[entry.undid ?? "Saved"].toLowerCase()}`;
  if (entry.kind === "Replaced") return `${verb} from ${who}`;
  if (entry.kind === "Widened" || entry.kind === "Narrowed")
    return `${verb} to ${scopeNameOf(entry.scopeLabel)} by ${who}`;
  return `${verb} by ${who}`;
};

/**
 * One entry of a lore entry's history as a line in the panel, for example 'Saved by "Build" · approved by you',
 * "Became dormant by fading", or "You undid: deleted" (scoped-intel, History and undo).
 */
export const loreHistoryLineOf = (
  entry: Pick<LoreHistoryEntry, "actor" | "actorTitle" | "approvedAt" | "kind" | "scopeLabel" | "undid" | "undoneAt">,
) =>
  [
    loreHistoryActionOf(entry),
    ...(entry.approvedAt === null ? [] : ["approved by you"]),
    ...(entry.undoneAt === null ? [] : ["undone"]),
  ].join(" · ");

/**
 * Why the service proposes a widening or narrowing, and what approving it does, for example "Used only in
 * Workspace alpha for 45 days, 3 times: move it there" (scoped-intel, Widening and narrowing).
 */
export const loreProposalLineOf = (
  proposal: Pick<LoreProposal, "halfLifeDays" | "kind" | "scopeLabel" | "uses"> & {
    readonly loreEntries: ReadonlyArray<unknown>;
  },
) =>
  proposal.kind === "Widen"
    ? `Saved separately in ${proposal.loreEntries.length} realms: make it one global lore entry`
    : `Used only in ${scopeNameOf(proposal.scopeLabel)} for ${proposal.halfLifeDays ?? 0} days, ${
        proposal.uses === 1 ? "once" : `${proposal.uses ?? 0} times`
      }: move it there`;

/** Renames a service-generated scope prefix while preserving the owner's title verbatim. */
export const scopeNameOf = (label: string) =>
  label.replace(
    /^(Mission|Thread|Workspace)(?= |$)/,
    (term) => ({ Mission: "Quest", Thread: "Errand", Workspace: "Realm" })[term] ?? term,
  );

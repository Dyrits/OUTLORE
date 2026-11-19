import { Schema } from "effect";
import { LoreChangeId, LoreEntryId, LoreHistoryEntryId, LoreProposalId, ThreadId, WorkspaceId } from "./ids.ts";
import { LoreScope, LoreStateFilter } from "./lore.ts";
import { MessageText } from "./texts.ts";

// Request tags such as "ListIntel" are wire names kept as `intel`; the constants follow the code.
/** The lore panel: the lore in a thread's scope, most specific first, or all lore; filtered by scope and state. */
export const ListLore = Schema.TaggedStruct("ListIntel", {
  scope: Schema.NullOr(LoreScope),
  state: Schema.NullOr(LoreStateFilter),
  threadId: Schema.NullOr(ThreadId),
  /** Only the lore of this realm's own scope; absent shows the lore the other filters give. */
  workspaceId: Schema.optionalKey(Schema.NullOr(WorkspaceId)),
});
/** The owner pins a lore entry so it never fades, or unpins it. */
export const PinLoreEntry = Schema.TaggedStruct("PinIntel", { isPinned: Schema.Boolean, loreEntryId: LoreEntryId });
/** The owner makes a dormant or archived lore entry active again, at full strength. */
export const RestoreLoreEntry = Schema.TaggedStruct("RestoreIntel", { loreEntryId: LoreEntryId });
/** The owner corrects a lore entry's text. */
export const EditLoreEntry = Schema.TaggedStruct("EditIntel", { loreEntryId: LoreEntryId, text: MessageText });
/** The owner deletes a lore entry. */
export const DeleteLoreEntry = Schema.TaggedStruct("DeleteIntel", { loreEntryId: LoreEntryId });
/** A lore entry's history, newest first, deleted lore included (scoped-intel, History and undo). */
export const ReadLoreHistory = Schema.TaggedStruct("ReadIntelHistory", { loreEntryId: LoreEntryId });
/** The owner undoes one change in a lore entry's history; undoing a deletion restores the lore. */
export const UndoLoreChange = Schema.TaggedStruct("UndoIntelChange", { entryId: LoreHistoryEntryId });
/** The owner approves or declines a thread's change awaiting approval: a global save, change, or deletion, or a widening. */
export const ResolveLoreChange = Schema.TaggedStruct("ResolveIntelChange", {
  changeId: LoreChangeId,
  isApproved: Schema.Boolean,
});

/** The owner approves or declines a widening or narrowing the service proposed from evidence. */
export const ResolveLoreProposal = Schema.TaggedStruct("ResolveIntelProposal", {
  isApproved: Schema.Boolean,
  proposalId: LoreProposalId,
});

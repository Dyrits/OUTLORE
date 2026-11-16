import {
  deleteLoreEntryByOwner,
  editLoreEntryByOwner,
  pinLoreEntryByOwner,
  readLoreHistory,
  readLoreView,
  resolveLoreChange,
  resolveLoreProposal,
  restoreLoreEntryByOwner,
  undoLoreChange,
} from "../lore/index.ts";
import type { HandlerDependencies, OwnerHandlers } from "./requestContext.ts";
/** Requests for lore share the service request context. */
export const loreHandlers = ({ change }: Pick<HandlerDependencies, "change">) =>
  ({
    DeleteIntel: (given) => change(deleteLoreEntryByOwner(given.loreEntryId)),
    EditIntel: (given) => change(editLoreEntryByOwner(given.loreEntryId, given.text)),
    ListIntel: (list) => readLoreView(list.scope, list.state, list.threadId, list.workspaceId ?? null),
    PinIntel: (given) => change(pinLoreEntryByOwner(given.loreEntryId, given.isPinned)),
    ReadIntelHistory: (read) => readLoreHistory(read.loreEntryId),
    ResolveIntelChange: (given) => change(resolveLoreChange(given.changeId, given.isApproved)),
    ResolveIntelProposal: (given) => change(resolveLoreProposal(given.proposalId, given.isApproved)),
    RestoreIntel: (given) => change(restoreLoreEntryByOwner(given.loreEntryId)),
    UndoIntelChange: (given) => change(undoLoreChange(given.entryId)),
  }) satisfies OwnerHandlers<
    | "DeleteIntel"
    | "EditIntel"
    | "ListIntel"
    | "PinIntel"
    | "ReadIntelHistory"
    | "ResolveIntelChange"
    | "ResolveIntelProposal"
    | "RestoreIntel"
    | "UndoIntelChange"
  >;

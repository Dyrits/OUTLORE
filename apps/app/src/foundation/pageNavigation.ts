import type { BudgetScope, ThreadId } from "@outlore/contracts";
import { createContext, useContext } from "react";

/** The page over a quest conversation; returning to a thread closes it. */
export type QuestPage =
  | { kind: "journal" }
  | { kind: "lore"; id: ThreadId; title: string }
  | { kind: "budget"; scope: BudgetScope }
  | null;

/** Page controls supplied by the window's location owner. */
export const PageNavigation = createContext<{
  page: QuestPage;
  onPage: (page: QuestPage) => void;
  isChroniclerBudgetOpen: boolean;
  onChroniclerBudget: (isOpen: boolean) => void;
}>({ isChroniclerBudgetOpen: false, onChroniclerBudget: () => {}, onPage: () => {}, page: null });

/** Reads the conversation sub-screen owned by the window. */
export const usePageNavigation = () => useContext(PageNavigation);

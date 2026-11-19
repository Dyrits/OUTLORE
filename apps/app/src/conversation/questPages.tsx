import type { BudgetScope, MissionId, ThreadId } from "@outlore/contracts";
import type { ReactNode } from "react";
import { BudgetScreen } from "../editors/budgets";
import type { ServiceClient } from "../foundation/client";
import { usePageNavigation } from "../foundation/pageNavigation";
import { JournalScreen } from "../lore/journal";
import { LoreScreen } from "../lore/lore";

/**
 * The pages that can stand over a quest's conversation (its journal, a thread's lore, a budget), owned by the window's
 * location: how to open each, and the screen to draw instead of the conversation while one is open, or null. A pane
 * among several draws it in place of its own conversation when it is the one the owner pressed last.
 */
export function useQuestPages(client: ServiceClient, missionId: MissionId, title: string) {
  const { page, onPage } = usePageNavigation();
  const close = () => onPage(null);
  const screen: ReactNode =
    page?.kind === "budget" ? (
      <BudgetScreen
        client={client}
        missionId={page.scope === "Mission" ? missionId : null}
        onBack={close}
        title={page.scope === "Mission" ? `Budget · ${title}` : "Global budget"}
      />
    ) : page?.kind === "lore" ? (
      <LoreScreen client={client} onBack={close} threadId={page.id} title={`Lore · ${page.title}`} />
    ) : page?.kind === "journal" ? (
      <JournalScreen client={client} missionId={missionId} onBack={close} title={title} />
    ) : null;
  return {
    openBudget: (scope: BudgetScope) => onPage({ kind: "budget", scope }),
    openJournal: () => onPage({ kind: "journal" }),
    openLore: (thread: { id: ThreadId; title: string }) => onPage({ kind: "lore", ...thread }),
    screen,
  };
}

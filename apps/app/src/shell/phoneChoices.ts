import type { MissionState, ThreadState, ThreadSummary } from "@outlore/contracts";
import { listedErrandsOf } from "../conversation/errandRoster";
import { borderlandsName, type Choice, type ChoiceKind, type PhoneSelection } from "./phoneSelection";
import type { Placements } from "./questTree";

/** One row of the phone's sheet: what it names, a line under it, its state, and what choosing it selects. */
export type PhoneChoice = {
  readonly choice: Choice;
  /** Whether it is the one chosen now, which the sheet marks. */
  readonly isSelected: boolean;
  /** A key that is the same for the same entry. */
  readonly key: string;
  readonly name: string;
  readonly note: string;
  readonly state: ThreadState | MissionState | null;
};

const countOf = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** The realms in the owner's order, then the Borderlands, each with how many quests it holds. */
export const realmChoicesOf = (placements: Placements, selection: PhoneSelection): ReadonlyArray<PhoneChoice> => [
  ...placements.realms.map(
    ({ quests, workspace }): PhoneChoice => ({
      choice: { kind: "realm", realm: { id: workspace.id, name: workspace.name } },
      isSelected: selection.realm?.id === workspace.id,
      key: workspace.id,
      name: workspace.name,
      note: countOf(quests.length, "quest"),
      state: null,
    }),
  ),
  {
    choice: { kind: "realm", realm: { id: null, name: borderlandsName } },
    isSelected: selection.realm !== null && selection.realm.id === null,
    key: "borderlands",
    name: borderlandsName,
    note: `Quests with no realm · ${countOf(placements.borderlands.length, "quest")}`,
    state: null,
  },
];

/** The quests of the chosen realm, newest activity first as the sidebar lists them; none while no realm is chosen. */
export const questChoicesOf = (placements: Placements, selection: PhoneSelection): ReadonlyArray<PhoneChoice> => {
  const { realm } = selection;
  if (realm === null) return [];
  const quests =
    realm.id === null
      ? placements.borderlands
      : (placements.realms.find(({ workspace }) => workspace.id === realm.id)?.quests ?? []);
  return quests.map(
    (quest): PhoneChoice => ({
      choice: { id: quest.id, kind: "quest" },
      isSelected: quest.id === selection.quest,
      key: quest.id,
      name: quest.title,
      note: countOf(Math.max(quest.threadCount - 1, 0), "errand"),
      state: quest.state,
    }),
  );
};

/** The errands of the chosen quest that are not archived, ranked as the sidebar ranks them. */
export const errandChoicesOf = (
  threads: ReadonlyArray<ThreadSummary>,
  selection: PhoneSelection,
): ReadonlyArray<PhoneChoice> =>
  listedErrandsOf(threads).map(
    (thread): PhoneChoice => ({
      choice: { id: thread.id, kind: "errand" },
      isSelected: thread.id === selection.errand,
      key: thread.id,
      name: thread.title,
      note: thread.depth > 1 ? "Errand of an errand" : "Errand",
      state: thread.shownState,
    }),
  );

/** The title a sheet carries for what it chooses. */
export const choiceTitleOf = (kind: ChoiceKind, selection: PhoneSelection, questTitle: string | null): string => {
  if (kind === "realm") return "Choose a realm";
  if (kind === "quest") return `Choose a quest in ${selection.realm?.name ?? borderlandsName}`;
  return `Choose an errand in ${questTitle ?? "the quest"}`;
};

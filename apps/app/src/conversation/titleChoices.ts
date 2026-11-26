import type { MissionState, ThreadState } from "@outlore/contracts";

/** One entry of a title menu: the thing it opens, its name and the state dot shown before it. */
export type TitleChoice<Id extends string> = { id: Id; title: string; state?: ThreadState | MissionState };

/** Whether two choice lists would draw the same menu, so a title can keep its previous list and skip a re-render. */
export const sameTitleChoices = <Id extends string>(
  previous: ReadonlyArray<TitleChoice<Id>>,
  next: ReadonlyArray<TitleChoice<Id>>,
): boolean =>
  previous.length === next.length &&
  previous.every((choice, index) => {
    const other = next[index];
    return (
      other !== undefined && choice.id === other.id && choice.title === other.title && choice.state === other.state
    );
  });

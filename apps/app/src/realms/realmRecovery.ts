import { type RealmAppearance, realmSlugOf } from "@outlore/contracts";
import { folderNameOf } from "./realmLabels";

/** A form's real proposed values: the name as a slug, and an empty name resolves to its chosen folder's name. */
export const proposedRealmOf = <Draft extends { name: string; path: string }>(draft: Draft) => ({
  ...draft,
  name: realmSlugOf(draft.name) || realmSlugOf(folderNameOf(draft.path)),
});

/** Which comparison rows differ. */
export const comparisonOf = (previous: RealmAppearance, proposed: RealmAppearance) => ({
  hasNameDifference: previous.name !== proposed.name,
});

/** The column chosen for each recoverable appearance field. */
export type RecoveryPicks = { name: "old" | "proposed" };

/** Applies the choice without replacing a field the owner chose to keep. */
export const recoveryAppearanceOf = (
  previous: RealmAppearance,
  proposed: RealmAppearance,
  picks: RecoveryPicks,
): RealmAppearance => ({
  name: picks.name === "old" ? previous.name : proposed.name,
});

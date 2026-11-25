import type { TierName } from "@outlore/contracts";

/** The three presets, as the Companions tab and the page name them. */
export const tierNames: ReadonlyArray<{ readonly hint: string; readonly name: TierName }> = [
  { hint: "Small, well-scoped, checkable work: renames, small fixes.", name: "Light" },
  { hint: "Ordinary implementation, debugging, and tests.", name: "Balanced" },
  { hint: "Ambiguous, architectural, or risky work.", name: "Heavy" },
];

/** The built-in tier a preset key names, or null for the default Companion and custom presets. */
export const tierNameOf = (key: string): TierName | null => tierNames.find(({ name }) => name === key)?.name ?? null;

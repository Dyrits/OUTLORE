import type { Theme } from "./themeName";

export type { Theme };

/** The themes offered in the Workshop, each with a light and a dark look. */
export const themes = ["one", "iskios", "mono", "slate"] as const satisfies ReadonlyArray<Theme>;

// Fails to compile when a theme is named in `Theme` and missing from the list.
const everyThemeIsListed: Exclude<Theme, (typeof themes)[number]> extends never ? true : never = true;
void everyThemeIsListed;

/**
 * A name an earlier build stored for a theme that has since been renamed. The Islands theme (CHG-0668) became the
 * Slate theme when Islands turned into a layout (CHG-0672), so an owner who chose it keeps its colors.
 */
const formerNames: Readonly<Record<string, Theme>> = { islands: "slate" };

/** The theme a stored value names; anything unknown, or nothing stored, is One. */
export const themeOf = (stored: string | null): Theme => {
  if (stored === null) return "one";
  if (Object.hasOwn(formerNames, stored)) return formerNames[stored] ?? "one";
  return themes.find((theme) => theme === stored) ?? "one";
};

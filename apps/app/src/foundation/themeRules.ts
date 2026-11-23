import type { Theme } from "./themeName";

export type { Theme };

/** The themes offered in the Workshop, each with a light and a dark look. */
export const themes = ["one", "iskios", "mono", "islands"] as const satisfies ReadonlyArray<Theme>;

// Fails to compile when a theme is named in `Theme` and missing from the list.
const everyThemeIsListed: Exclude<Theme, (typeof themes)[number]> extends never ? true : never = true;
void everyThemeIsListed;

/** The theme a stored value names; anything unknown, or nothing stored, is One. */
export const themeOf = (stored: string | null): Theme => themes.find((theme) => theme === stored) ?? "one";

// What the rail remembers between launches in the browser's storage: whether it is hidden, how wide it is. A platform without storage, or one that refuses it, only loses the memory.

/** The rail's width as it opens, before the owner drags it. */
export const expandedWidth = 288;
/**
 * The widths the owner can drag the open rail between. The least keeps the longest heading, "Borderlands", whole on one
 * line beside its icon, its chevron, and its two hover buttons (measured at 274 px in the web build, CHG-0163), with
 * room to spare for wider system fonts.
 */
export const minRailWidth = 284;
/** The most the open rail can have: a quarter of the window, so the conversation and the right panel stay usable. */
const maxRailShare = 0.25;

/** What the browser kept under a key; null with nothing kept, no browser storage, or storage that refuses to answer. */
const readStored = (key: string): string | null => {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

/** Keeps text under a key where the platform allows; a refusal only loses the memory. */
const keep = (key: string, text: string) => {
  try {
    globalThis.localStorage?.setItem(key, text);
  } catch {}
};

/** The key under which the browser remembers whether the sidebar is hidden. */
const hiddenKey = "outlore:sidebar-hidden";

/** Reads whether the sidebar is hidden; a platform without browser storage starts with it shown. */
export const readHidden = (): boolean => readStored(hiddenKey) === "1";

/** Remembers whether the sidebar is hidden where the platform allows; a refusal only loses the memory. */
export const rememberHidden = (isHidden: boolean) => keep(hiddenKey, isHidden ? "1" : "0");

/** The key under which the browser remembers how wide the open rail is. */
const widthKey = "outlore:sidebar-width";

/**
 * A width held between a pane's least and the most it can have in a window this wide: at most a quarter of the window,
 * never less than the least width, which wins on a window too narrow for its quarter to reach it. The sidebar, the quest
 * panel, and Chronicler's column each have their own least; none goes past a quarter, so four panes can stand together.
 */
export const clampPaneWidth = (width: number, windowWidth: number, leastWidth: number) =>
  Math.max(leastWidth, Math.min(Math.floor(windowWidth * maxRailShare), Math.round(width)));

/** The rail's own bounds: the least width that keeps its longest heading whole, and a quarter of the window. */
export const clampRailWidth = (width: number, windowWidth: number) => clampPaneWidth(width, windowWidth, minRailWidth);

/** The keys under which the browser remembers how wide the quest panel and Chronicler's column are. */
export const questPanelWidthKey = "outlore:quest-panel-width";
export const chroniclerWidthKey = "outlore:assistant-width";

/** Reads a remembered pane width, or `fallback` (the pane's default, and its least) with none stored or no storage. */
export const readPaneWidth = (key: string, fallback: number): number => {
  const stored = Number(readStored(key));
  // The window's quarter is applied where the width is used, since the window can change size after this.
  return Number.isFinite(stored) && stored > 0 ? Math.max(fallback, Math.round(stored)) : fallback;
};

/** Remembers a pane's width where the platform allows; a refusal only loses the memory. */
export const rememberPaneWidth = (key: string, width: number) => keep(key, String(width));

/** Reads the remembered rail width; a platform without browser storage starts at the default. */
export const readRailWidth = (): number => {
  const stored = Number(readStored(widthKey));
  // The window's quarter is applied where the width is used, since the window can change size after this.
  return Number.isFinite(stored) && stored > 0 ? Math.max(minRailWidth, Math.round(stored)) : expandedWidth;
};

/** Remembers the rail width where the platform allows; a refusal only loses the memory. */
export const rememberRailWidth = (width: number) => keep(widthKey, String(width));

/** The key under which the browser remembers whether Chronicler's panel is open. */
const chroniclerKey = "outlore:assistant-open";

/** Reads whether Chronicler's panel is open; a platform without browser storage starts with it folded. */
export const readChroniclerOpen = (): boolean => readStored(chroniclerKey) === "1";

/** Remembers whether Chronicler's panel is open where the platform allows; a refusal only loses the memory. */
export const rememberChroniclerOpen = (isOpen: boolean) => keep(chroniclerKey, isOpen ? "1" : "0");

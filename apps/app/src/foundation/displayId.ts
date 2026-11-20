/** The id the owner reads before a quest's or errand's name: `[Q-1D4E5F]` or `[E-1D4E5F]`. Display only, never stored. */
export const displayIdOf = (kind: "quest" | "errand", id: string): string =>
  `[${kind === "quest" ? "Q" : "E"}-${id.replaceAll("-", "").slice(0, 6).toUpperCase()}]`;

/** A quest's or errand's name with its id before it: `[Q-1D4E5F] Fix the sidebar`. */
export const nameWithId = (kind: "quest" | "errand", id: string, title: string): string =>
  `${displayIdOf(kind, id)} ${title}`;

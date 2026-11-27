/** The schemes a link in an agent's reply may open: a reply is untrusted text, so `javascript:` and the like never become links. */
const safeSchemes = ["http:", "https:", "mailto:"];

/** Lowercase fenced code-block language tags that denote shell commands runnable in the conversation terminal. */
const shellLanguages = new Set(["bash", "bat", "cmd", "console", "fish", "powershell", "pwsh", "sh", "shell", "zsh"]);

/** Where a Markdown link may lead, or null when its scheme is not one of the safe ones. */
export const linkTargetOf = (href: string) => {
  const target = URL.parse(href.trim());
  return target !== null && safeSchemes.includes(target.protocol) ? target.href : null;
};

/** The marker before a list item: a bullet, or its number counted from where the list starts. */
export const listMarkerOf = (list: { ordered: boolean; start: number | "" }, index: number) =>
  list.ordered ? `${(list.start === "" ? 1 : list.start) + index}.` : "•";

/** Returns the trimmed command text for a fenced shell code block, or null when the block is not a runnable shell command. */
export const runnableCommandOf = (info: string | undefined, text: string): string | null => {
  if (info === undefined) return null;
  const language = info.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!shellLanguages.has(language)) return null;
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/^(?:\s*\n)+/, "")
    .trimEnd();
  return normalized.trim() === "" ? null : normalized;
};

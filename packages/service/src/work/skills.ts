import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { markedWordOf, messageMarks, type Skill, skillTokensOf } from "@outlore/contracts";
import { Effect } from "effect";

// The skills a message can name with a `$`, found in the existing skill folders (tool-and-skill-loading, CHG-0777).

/** The skill folders under a root, nearest preference first: `.agents/skills`, then Claude Code's. */
const skillFoldersOf = (root: string) => [join(root, ".agents", "skills"), join(root, ".claude", "skills")];

/** The lines below a block-scalar header (`>` folded, `|` literal) that are indented, up to the next field. */
const blockLinesOf = (lines: ReadonlyArray<string>, start: number) => {
  const block: string[] = [];
  for (const line of lines.slice(start)) {
    if (line.trim() !== "" && !/^\s/.test(line)) break;
    block.push(line.trim());
  }
  while (block.at(-1) === "") block.pop();
  return block;
};

/** A frontmatter field of a SKILL.md, or an empty string; quotes are dropped and a `>` or `|` block is read from the lines below. */
const fieldOf = (text: string, field: string) => {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
  const lines = frontmatter.split(/\r?\n/);
  const index = lines.findIndex((line) => line.startsWith(`${field}:`));
  if (index === -1) return "";
  const value = (lines[index] ?? "").slice(field.length + 1).trim();
  const header = /^([>|])[+-]?$/.exec(value)?.[1];
  if (header === undefined) return value.replace(/^(["'])(.*)\1$/, "$2");
  return blockLinesOf(lines, index + 1).join(header === ">" ? " " : "\n");
};

/** The skills in one skill folder; an unreadable entry is left out. */
const readSkillFolder = (folder: string): ReadonlyArray<Skill> => {
  let names: ReadonlyArray<string>;
  try {
    names = readdirSync(folder);
  } catch {
    return [];
  }
  return names.flatMap((entry) => {
    const path = join(folder, entry, "SKILL.md");
    if (!existsSync(path)) return [];
    try {
      const text = readFileSync(path, "utf8");
      return [{ description: fieldOf(text, "description"), name: fieldOf(text, "name") || entry, path }];
    } catch {
      return [];
    }
  });
};

/**
 * The skills in scope: the workspace's, then the global ones, each with `.agents/skills` before `.claude/skills`;
 * for a name found twice the first wins, so the narrower scope does (tool-and-skill-loading, Name conflicts).
 */
export const listSkills = (workspacePath: string | null, home?: string) =>
  Effect.sync(() => {
    const homeFolder = home ?? homedir();
    const roots = workspacePath === null ? [homeFolder] : [workspacePath, homeFolder];
    const found = new Map<string, Skill>();
    for (const skill of roots.flatMap(skillFoldersOf).flatMap(readSkillFolder)) {
      if (!found.has(skill.name)) found.set(skill.name, skill);
    }
    return [...found.values()].sort((first, second) => first.name.localeCompare(second.name));
  });

/** A message with a line appended telling the harness where the instructions of each skill it names are; unchanged when it names none. */
export const addSkillInstructions = (text: string, skills: ReadonlyArray<Skill>) => {
  const named = [...new Set(skillTokensOf(text).map((token) => token.name))].flatMap((name) => {
    const skill = skills.find((candidate) => candidate.name === name);
    return skill === undefined ? [] : [skill];
  });
  if (named.length === 0) return text;
  const lines = named.map(
    (skill) => `- ${markedWordOf("skill", skill.name)}: read ${skill.path} and follow its instructions.`,
  );
  return `${text}\n\n${messageMarks.skill.deliveryHeading}\n${lines.join("\n")}`;
};

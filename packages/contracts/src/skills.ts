import { Schema } from "effect";
import { skillWordsOf } from "./marks.ts";

// Skills the owner can name in a message with a dollar sign (tool-and-skill-loading; a slash before CHG-0777).

/** A skill found in a skill folder: the name after the dollar sign, what it is for, and where its instructions are. */
export const Skill = Schema.Struct({
  description: Schema.String,
  name: Schema.String,
  /** The skill's SKILL.md file. */
  path: Schema.String,
});
export type Skill = typeof Skill.Type;

/** A `$`-name in a message: its position in the text, starting at the `$`, and the name without it. */
export type SkillToken = {
  readonly end: number;
  readonly name: string;
  readonly start: number;
};

/** The `$`-names in a message: a `$` starting a word, then a name that ends the word, so an amount such as $5.50 is not a skill. */
export const skillTokensOf = (text: string): ReadonlyArray<SkillToken> =>
  skillWordsOf(text).map((token) => ({ end: token.end, name: token.path, start: token.start }));

import { Record } from "effect";
import { harnessLabels, harnessNames } from "../harness/index.ts";
import { modeTerms } from "./threadPermissionMode.ts";

// What the guide's topics share: the topic's shape and the lists of harnesses and permission modes its text names.

/** One topic of the guide. */
export type GuideTopic = {
  readonly body: string;
  /** The short name `read_app_guide` takes. */
  readonly id: string;
  /** Words an owner might use that the text does not, so a question finds the topic. */
  readonly keywords: ReadonlyArray<string>;
  /** What the topic answers, in one line, for the index. */
  readonly summary: string;
  readonly title: string;
};

const listWithAnd = (items: ReadonlyArray<string>): string =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;

/** Every harness's label, as a sentence lists them. */
export const allHarnessLabels = listWithAnd(harnessNames.map((name) => harnessLabels[name]));

/** The words an owner might use for any harness, so a question about one finds the topic. */
export const allHarnessKeywords = harnessNames.flatMap((name) => {
  const words = harnessLabels[name]
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 2);
  return [name, ...words];
});

/** The permission modes' names, as a sentence lists them. */
export const permissionModeLabels = listWithAnd(Record.keys(modeTerms));

import type { Activity, FileChange } from "@outlore/contracts";
import { clockOf } from "../foundation/formatting";

/** A reported call's line, omitting empty fields without changing the target or time. */
export const callTextOf = (activity: Activity, at: number) =>
  ["Ran", activity.summary, activity.detail, clockOf(at)].filter((part) => part !== "").join(" · ");

/** A modified file's counts as they read beside its step, such as "+3" and "−1"; null when the host could not know them. */
export const changeCountsOf = (change: FileChange) =>
  change.added === null || change.removed === null
    ? null
    : { added: `+${change.added}`, removed: `\u2212${change.removed}` };

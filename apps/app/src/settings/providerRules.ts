import type { HarnessInfo } from "@outlore/contracts";

/** Whether the Workshop offers "+ Add account" on a harness: yes unless its host says it takes only the computer's own sign-in (an older host says nothing). */
export const canAddAccount = (harness: Pick<HarnessInfo, "supportsAddedAccounts">) =>
  harness.supportsAddedAccounts !== false;

/** A harness-reported version reduced to its number, retaining unknown reports and absence. */
export const versionOf = (harness: Pick<HarnessInfo, "version">) =>
  harness.version?.match(/\bv?\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?/)?.[0] ?? harness.version;

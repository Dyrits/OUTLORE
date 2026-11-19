import type { VaultDenial } from "../core/index.ts";
import type { HolderInfo } from "./types.ts";

/** Whether the Vault may take a secret now, and what to tell the owner when it may not or when a harness is unchecked. */
export type Protection = {
  readonly isAllowed: boolean;
  /** The harnesses whose denial of the Vault's folder is not verified, with what the probe said. */
  readonly unverified: ReadonlyArray<{ readonly harness: string; readonly reason: string }>;
  /** The plain refusal when not allowed ("Not protected from Codex"), or null. */
  readonly reason: string | null;
};

const listOf = (names: ReadonlyArray<string>) =>
  names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** The harness's name as the owner reads it. */
export const harnessLabelOf = (harness: string) =>
  ({ claude: "Claude Code", codex: "Codex", opencode: "OpenCode", vibe: "Mistral Vibe" })[harness] ?? harness;

/**
 * Protected, or no secrets (ADR 0022): a key a sandboxed command can read counts as no second layer, so a secret is
 * stored only while the folder's read denial is verified for every harness installed here. The ADR first allowed a key
 * in a secret store with an unverified harness; the probe of 2026-11-19 found the macOS Keychain readable from inside
 * every sandbox, so each holder carries whether it is (`isReadableFromSandbox`) and only a holder no sandbox reads
 * could be allowed. A harness that runs no sandbox asks about every action and is never counted.
 */
export const protectionOf = (holder: HolderInfo, denials: ReadonlyArray<VaultDenial>): Protection => {
  const unverified = denials
    .filter((denial) => denial.status === "Unverified")
    .map((denial) => ({ harness: denial.harness, reason: denial.reason }));
  if (unverified.length === 0 || !holder.isReadableFromSandbox) return { isAllowed: true, reason: null, unverified };
  return {
    isAllowed: false,
    reason:
      `Not protected from ${listOf(unverified.map(({ harness }) => harnessLabelOf(harness)))}: ${unverified[0]?.reason ?? ""}`.trim(),
    unverified,
  };
};

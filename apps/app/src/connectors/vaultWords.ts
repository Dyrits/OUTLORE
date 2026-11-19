import type { ConnectorCard, VaultEntry, VaultStatus, VaultView } from "@outlore/contracts";
import { dateOf } from "../foundation/formatting";
import { isInstalledCard } from "./connectorWords";

// The words and small decisions of the Vault's section (connectors specification, The Vault; blueprint, `vault/`).
// Plain code, unit-tested; the screens only draw it. Nothing here ever holds a secret's value: the Vault never sends one.

/** The Vault's state in one word. */
export const vaultStateLabels = {
  Absent: "Nothing stored yet",
  Corrupt: "Damaged",
  Locked: "Locked",
  Lost: "Key lost",
  Ready: "Ready",
} satisfies Record<VaultStatus, string>;

/** What a state not Ready means for the owner, when the service gave no sentence of its own. */
const stateNotes = {
  Absent: "The first secret you add creates the Vault.",
  Corrupt: "A record or the Vault's header cannot be read. Nothing has been overwritten.",
  Locked: "The place that keeps the key cannot be reached now. Nothing is changed, and Outlore tries again.",
  Lost: "The key is gone, so the stored secrets cannot be read. Remove each one and enter it again.",
  Ready: null,
} satisfies Record<VaultStatus, string | null>;

/** The sentence under the state: the service's own reason when it has one, else the state's meaning, or null when Ready. */
export const vaultStateNoteOf = (view: Pick<VaultView, "state" | "stateReason">) =>
  view.stateReason ?? stateNotes[view.state];

/** The line naming what keeps the Vault's key, or null while the Vault holds nothing and names none. */
export const holderLineOf = (view: Pick<VaultView, "holder">) =>
  view.holder === null ? null : `The key is kept by ${view.holder.label}.`;

/** One place a secret is or can be kept: a connector's kind of secret, and the entry that holds it, or null. */
export type SecretSlot = {
  readonly connectorId: string;
  readonly connectorName: string;
  readonly entry: VaultEntry | null;
  readonly kind: string;
};

/**
 * The slots to show: one per kind of secret each installed connector needs, filled when the Vault holds it, then any entry
 * the Vault holds for a connector no card names (so a secret is never hidden from the owner who must be able to remove it).
 */
export const secretSlotsOf = (cards: ReadonlyArray<ConnectorCard>, entries: ReadonlyArray<VaultEntry>) => {
  const slots: Array<SecretSlot> = [];
  for (const card of cards.filter((each) => isInstalledCard(each) && each.state !== "Removing")) {
    for (const kind of card.secretKinds) {
      const entry = entries.find((held) => held.connectorId === card.id && held.kind === kind) ?? null;
      slots.push({ connectorId: card.id, connectorName: card.name, entry, kind });
    }
  }
  for (const entry of entries) {
    if (slots.some((slot) => slot.entry === entry)) continue;
    const card = cards.find((each) => each.id === entry.connectorId);
    slots.push({
      connectorId: entry.connectorId,
      connectorName: card?.name ?? entry.connectorId,
      entry,
      kind: entry.kind,
    });
  }
  return slots;
};

/** Why a secret cannot be stored or replaced now, or null when it can: a refusal of the Vault's rule, or a state that stores nothing. */
export const storingRefusalOf = (view: Pick<VaultView, "protection" | "state" | "stateReason">) => {
  if (view.state === "Locked" || view.state === "Lost" || view.state === "Corrupt") return vaultStateNoteOf(view);
  return view.protection.isAllowed ? null : (view.protection.reason ?? "The Vault does not store secrets now.");
};

/** Whether the live check of Claude Code's sandbox can settle what stands in the way: Claude Code is among the unverified. */
export const canVerifyClaude = (view: Pick<VaultView, "protection">) =>
  view.protection.unverified.some((unchecked) => unchecked.harness === "Claude Code");

/** When a secret was added, as a date. */
export const addedTextOf = (entry: Pick<VaultEntry, "addedAt">) => `Added ${dateOf(Date.parse(entry.addedAt))}`;

/** What the live check of Claude Code found, in the owner's words. */
export const denialResultOf = (check: {
  reason: string;
  status: "Verified" | "Unverified" | "NotInstalled" | "AsksFirst";
}) =>
  ({
    AsksFirst: `Claude Code asks first, so it needs no check. ${check.reason}`,
    NotInstalled: `Claude Code is not installed here. ${check.reason}`,
    Unverified: `Not verified. ${check.reason}`,
    Verified: `Verified. ${check.reason}`,
  })[check.status];

/** What the live check spends and does, said before the owner runs it. */
export const verifyNote =
  "Runs one short turn of Claude Code to see whether it can read the Vault's folder. It uses a fraction of a cent of your own Claude account.";

/** The secret field's name and what saving it means: it is never shown again. */
export const secretFieldNote = "Shown once as you type; Outlore never shows it again, only that it is stored.";

import { type AccountId, type HarnessList, maxBackups, type Tier } from "@outlore/contracts";
import { effortName, modelLabelOf } from "../foundation/formatting";
import { modelsOf } from "./accountModels";
import type { Runner } from "./runner";

/** The most Companions a preset's chain holds: the primary and its backups (companion-presets, Agreed behavior). */
export const maxChain = maxBackups + 1;

const runnerOf = ({ accountId, effort, harness, model }: Runner): Runner => ({ accountId, effort, harness, model });

/** A stack as one ordered chain: the primary Companion first, then each backup in the order a failed turn falls back through them. */
export const chainOf = (stack: Tier): ReadonlyArray<Runner> => [runnerOf(stack), ...stack.backups.map(runnerOf)];

/** A chain as a stack: its first Companion is the primary and the rest are the backups; an empty chain holds no stack. */
export const stackOf = (chain: ReadonlyArray<Runner>): Tier | null => {
  const [primary, ...backups] = chain;
  return primary === undefined ? null : { ...runnerOf(primary), backups: backups.map(runnerOf) };
};

/** Whether the chain has room for another Companion. */
export const canAddTo = (chain: ReadonlyArray<Runner>) => chain.length < maxChain;

/** Whether a Companion can be taken out: the chain always keeps its primary. */
export const canRemoveFrom = (chain: ReadonlyArray<Runner>) => chain.length > 1;

/** Whether the Companion at `index` can be removed without leaving an empty chain or promoting an explicit-account backup into a primary that cannot hold one. */
export const canRemoveAt = (chain: ReadonlyArray<Runner>, index: number, isPrimaryAccountShown = true): boolean =>
  canRemoveFrom(chain) && (isPrimaryAccountShown || index !== 0 || chain[1]?.accountId === null);

/** Whether moving `from` to `to` is allowed: when the primary cannot hold a provider account, a backup with one cannot become row 0. */
export const canMoveIn = (
  chain: ReadonlyArray<Runner>,
  from: number,
  to: number,
  isPrimaryAccountShown = true,
): boolean => {
  if (from === to || to < 0 || to >= chain.length) return false;
  if (isPrimaryAccountShown) return true;
  const moved = chain[from];
  if (moved === undefined) return false;
  if (to === 0 && moved.accountId !== null) return false;
  // Moving row 0 down promotes row 1 into row 0, so block that too when row 1 holds an explicit account.
  if (from === 0 && to > 0 && chain[1]?.accountId !== null) return false;
  return true;
};

/** The chain with the Companion at `from` moved to `to`; the chain as it was when either place is outside it. */
export const movedIn = (chain: ReadonlyArray<Runner>, from: number, to: number): ReadonlyArray<Runner> => {
  if (from === to || to < 0 || to >= chain.length) return chain;
  const next = [...chain];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return chain;
  next.splice(to, 0, moved);
  return next;
};

/** The chain with the Companion at `index` replaced. */
export const replacedIn = (chain: ReadonlyArray<Runner>, index: number, runner: Runner): ReadonlyArray<Runner> =>
  chain.map((current, place) => (place === index ? runner : current));

/** The chain without the Companion at `index`, unless it is the only one. */
export const removedFrom = (chain: ReadonlyArray<Runner>, index: number): ReadonlyArray<Runner> =>
  canRemoveFrom(chain) ? chain.filter((_, place) => place !== index) : chain;

/** The Companion a new row starts as: the first installed harness, on its first account (none where accounts are not shown) and that account's first listed model. */
export const newRunnerOf = (harnesses: HarnessList | null, isAccountShown = true): Runner => {
  const first = harnesses?.harnesses.find((candidate) => candidate.problem === null && candidate.models.length > 0);
  const accountId = isAccountShown ? (first?.accounts[0]?.id ?? null) : null;
  return {
    // Where no account can be chosen, none is chosen for the row either.
    accountId,
    effort: "default",
    harness: first?.name ?? "claude",
    model: modelsOf(first, accountId)[0]?.id ?? "default",
  };
};

/** The chain with a new Companion at its end, or as it was when it is full. */
export const appendedTo = (chain: ReadonlyArray<Runner>, runner: Runner): ReadonlyArray<Runner> =>
  canAddTo(chain) ? [...chain, runner] : chain;

/** The name of the provider account a Companion runs on, when its harness has several and so the name tells them apart; null otherwise. */
export const accountNameOf = (harnesses: HarnessList | null, runner: Runner): string | null => {
  const info = harnesses?.harnesses.find((candidate) => candidate.name === runner.harness);
  if (info === undefined || info.accounts.length < 2) return null;
  const accountId: AccountId | null = runner.accountId;
  return info.accounts.find((account) => account.id === accountId)?.label ?? null;
};

/** A Companion split into its model/account label and its effort label (empty when default). */
export const chainPartsOf = (
  harnesses: HarnessList | null,
  runner: Runner,
): { readonly effort: string; readonly label: string } => {
  const info = harnesses?.harnesses.find((candidate) => candidate.name === runner.harness);
  const models = info?.accounts.find((account) => account.id === runner.accountId)?.models ?? info?.models;
  const account = accountNameOf(harnesses, runner);
  return {
    effort: runner.effort === "default" ? "" : effortName(runner.effort),
    label: `${modelLabelOf(runner.model, models)}${account === null ? "" : ` (${account})`}`,
  };
};

/** A Companion as a row names it: its model, the account in brackets when it tells two apart, and its effort, such as "Sonnet 5.5 (Personal) · High". */
export const chainLabelOf = (harnesses: HarnessList | null, runner: Runner): string => {
  const parts = chainPartsOf(harnesses, runner);
  return parts.effort === "" ? parts.label : `${parts.label} · ${parts.effort}`;
};

const chainPlaceOf = (open: string | null): number | null =>
  open?.startsWith("chain-") === true ? Number(open.slice("chain-".length)) : null;

/** The row id left unfolded after the Companion at `from` moves to `to`: the unfolded one stays with its Companion, whichever rows shift around it. */
export const openAfterMove = (open: string | null, from: number, to: number): string | null => {
  const place = chainPlaceOf(open);
  if (place === null) return open;
  if (place === from) return `chain-${to}`;
  if (from < to && place > from && place <= to) return `chain-${place - 1}`;
  if (from > to && place >= to && place < from) return `chain-${place + 1}`;
  return open;
};

/** The row id left unfolded after the Companion at `removed` is taken out: none when it was that one, else the same Companion's new place. */
export const openAfterRemove = (open: string | null, removed: number): string | null => {
  const place = chainPlaceOf(open);
  if (place === null) return open;
  if (place === removed) return null;
  return place > removed ? `chain-${place - 1}` : open;
};

/** What the chain editor's footer shows: its status line, which controls it offers, and whether they are enabled. */
export const footerOf = ({
  canOverwrite = true,
  canSaveAs,
  isChanged,
  isNew,
}: {
  canOverwrite?: boolean;
  canSaveAs: boolean;
  isChanged: boolean;
  isNew: boolean;
}): { canOverwrite: boolean; canSaveAs: boolean; isDirty: boolean; status: string } => ({
  canOverwrite: !isNew && canOverwrite,
  canSaveAs,
  isDirty: isChanged || isNew,
  status: isNew ? "Not saved yet." : isChanged ? "You changed this companion." : "Nothing changed yet.",
});

/** What follows a successful Save as new: the draft became the new preset, so the source preset goes back to its saved chain and the list drops the draft. */
export const afterSaveAs = (): { discardSource: true; listDraft: null } => ({ discardSource: true, listDraft: null });

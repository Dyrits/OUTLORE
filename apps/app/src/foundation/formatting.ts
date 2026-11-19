import type {
  AccountId,
  EffortChoice,
  HarnessList,
  HarnessName,
  ModelChoice,
  ModelOption,
  TokenUsage,
} from "@outlore/contracts";

/** Each harness by the name the owner reads. */
export const harnessLabels = {
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  vibe: "Mistral Vibe",
} as const satisfies Record<HarnessName, string>;

/** A model's label from its harness's list, or its identifier when the list does not name it. */
export const modelLabelOf = (model: ModelChoice, options: ReadonlyArray<ModelOption> = []) =>
  options.find((option) => option.id === model)?.label ??
  (model === "default"
    ? "Default model"
    : (knownModelOf(model)?.name ?? model.charAt(0).toUpperCase() + model.slice(1)));

/**
 * A runner in few words: its Companion, then its effort when not the model's own, and the account it runs on when the
 * harness has several, so two subscriptions of one harness read apart.
 */
export const runnerSummaryOf = (
  harnesses: HarnessList | null,
  runner: { accountId?: AccountId | null; effort: EffortChoice; harness: HarnessName; model: ModelChoice },
) => {
  const info = harnesses?.harnesses.find((candidate) => candidate.name === runner.harness);
  const accountId = runner.accountId ?? null;
  const models = info?.accounts.find((account) => account.id === accountId)?.models ?? info?.models;
  const account =
    info !== undefined && info.accounts.length > 1 ? info.accounts.find(({ id }) => id === accountId) : undefined;
  return `${modelLabelOf(runner.model, models)}${runner.effort === "default" ? "" : ` · ${effortName(runner.effort)}`}${account === undefined ? "" : ` · ${account.label}`}`;
};

/** Each harness's usual model company, when the model's own identifier names none. */
const harnessProviders = {
  claude: "Anthropic",
  codex: "OpenAI",
  opencode: "OpenCode",
  vibe: "Mistral",
} as const satisfies Record<HarnessName, string>;

const titled = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** A model identifier as company and readable name with version, such as `claude-sonnet-5-5` as Anthropic and "Sonnet 5.5"; null when unrecognised. */
const knownModelOf = (id: string): { name: string; provider: string } | null => {
  const withoutDate = id.replace(/-\d{8}$/, "");
  // Claude: `claude-sonnet-5-5` and `claude-opus-4-1`, or the older `claude-3-5-sonnet`.
  const claude =
    /^claude-(fable|opus|sonnet|haiku)-(\d+(?:-\d+)?)$/.exec(withoutDate) ??
    /^claude-(\d+(?:-\d+)?)-(opus|sonnet|haiku)$/.exec(withoutDate);
  if (claude !== null) {
    const [family, version] = /^\d/.test(claude[1] ?? "") ? [claude[2], claude[1]] : [claude[1], claude[2]];
    return { name: `${titled(family ?? "")} ${(version ?? "").replace("-", ".")}`, provider: "Anthropic" };
  }
  // The bare Claude aliases the thread's chosen model uses: `sonnet`.
  if (/^(fable|opus|sonnet|haiku)$/.test(withoutDate)) return { name: titled(withoutDate), provider: "Anthropic" };
  // OpenAI: `gpt-5.1-codex` as "GPT-5.1 Codex".
  const gpt = /^gpt-(.+)$/.exec(withoutDate);
  if (gpt !== null) return { name: `GPT-${(gpt[1] ?? "").split("-").map(titled).join(" ")}`, provider: "OpenAI" };
  // Mistral: `mistral-large-4` as "Mistral Large 4", `devstral-2` as "Devstral 2".
  if (/^(mistral|devstral|codestral|ministral|pixtral)-/.test(withoutDate))
    return { name: withoutDate.split("-").map(titled).join(" "), provider: "Mistral" };
  return null;
};

/**
 * The Companion's label above its reply: the model company, then the model's name and version, such as
 * "Anthropic - Sonnet 5.5". It uses the model the harness reported for the reply; without one, the thread's
 * chosen model.
 */
export const companionLabelOf = (harness: HarnessName, reported: string | null, chosen: ModelChoice) => {
  const known = reported === null ? null : knownModelOf(reported);
  if (known !== null) return `${known.provider} - ${known.name}`;
  const name = reported ?? modelLabelOf(chosen);
  return `${harnessProviders[harness]} - ${name}`;
};

/**
 * Who wrote an agent reply: the harness and model recorded with it, so a handover leaves earlier replies under their own
 * provider and model (thread-handover). A reply that recorded no harness (from before handovers) is the thread's own;
 * one that recorded no model was written by the harness's default.
 */
export const replyWriterOf = (
  reply: { readonly harness: HarnessName | null; readonly model: string | null },
  threadHarness: HarnessName,
) => {
  const harness = reply.harness ?? threadHarness;
  return { harness, label: companionLabelOf(harness, reply.model, "default") };
};

/** An effort level in title case, such as "High" or "XHigh"; the providers name them in lowercase. */
export const effortName = (effort: EffortChoice) =>
  effort === "default" ? "Default" : effort === "xhigh" ? "XHigh" : effort.charAt(0).toUpperCase() + effort.slice(1);

/** An effort level as the owner reads it. */
export const effortLabel = (effort: EffortChoice) => (effort === "default" ? "Default effort" : effortName(effort));

/** A turn's tokens in full, each kind counted. */
export const usageDetail = (usage: TokenUsage) =>
  `Input ${usage.input}, cache read ${usage.cacheRead}, cache written ${usage.cacheCreation}, output ${usage.output} tokens`;

/** A moment as its date and time, in the owner's locale. */
export const timeOf = (millis: number) => new Date(millis).toLocaleString();

/** A moment as its hours and minutes, in the owner's locale. */
export const clockOf = (millis: number) =>
  new Date(millis).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** A moment as its day, month and year, in the owner's locale. */
export const dateOf = (millis: number) =>
  new Date(millis).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

/** A moment as its date and then its time, such as `19 Nov 2026 · 11:15 AM`, for a message's header. */
export const stampOf = (millis: number) => `${dateOf(millis)} · ${clockOf(millis)}`;

/** A count with thousands separators, for an element's accessible label. */
export const exactCountOf = (count: number) => Math.round(count).toLocaleString("en-US");

/** Seconds as a short span: `16s`, `1m 4s`. */
export const spanOf = (seconds: number) =>
  seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

/** How long ago something happened, in the coarsest unit that fits: "just now", "8 minutes ago", "3 days ago". */
export const agoOf = (millis: number, now: number): string => {
  const minutes = Math.floor(Math.max(0, now - millis) / 60000);
  if (minutes < 1) return "just now";
  const unit = (count: number, name: string) => `${count} ${name}${count === 1 ? "" : "s"} ago`;
  if (minutes < 60) return unit(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return unit(hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return unit(days, "day");
  if (days < 60) return unit(Math.floor(days / 7), "week");
  return unit(Math.floor(days / 30), "month");
};

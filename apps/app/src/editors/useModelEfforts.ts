import type { AccountId, EffortChoice, HarnessInfo, HarnessName, ModelChoice } from "@outlore/contracts";
import { useEffect, useState } from "react";
import type { ServiceClient } from "../foundation/client";

import { listedEffortsOf } from "./runnerChoices";

export { effortFor } from "./runnerChoices";

/** How many times, and how long apart, a failed ask for a model's effort levels is repeated. */
const effortRetries = 3;
const effortRetryMillis = 3000;

/**
 * The effort levels of the chosen model: from the harness's model list, or, when the list does not say (OpenCode),
 * asked of the service when a model is picked, which has read them ahead since the model list was read. While the
 * answer for a newly picked model is awaited, the previous model's levels of the same harness and account stay, so the
 * effort picker does not vanish and return; empty before the first answer or without a client to ask. A failed ask
 * is repeated, not taken for a model without levels.
 */
export function useModelEfforts(
  client: ServiceClient | undefined,
  harness: HarnessInfo | undefined,
  value: { accountId: AccountId | null; harness: HarnessName; model: ModelChoice },
) {
  const listed = listedEffortsOf(harness, value.model);
  const [asked, setAsked] = useState<{ key: string; levels: ReadonlyArray<EffortChoice>; scope: string } | null>(null);
  const scope = `${value.harness}:${value.accountId ?? ""}`;
  const key = `${scope}:${value.model}`;
  const shouldAsk = client !== undefined && harness !== undefined && listed === undefined;
  useEffect(() => {
    if (!shouldAsk) return;
    let isCurrent = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // A failed ask (the provider did not answer) is asked again a few times and never kept as "no levels", which
    // would hide the picker until the model changes; an empty answer is the provider's own and is kept.
    const ask = (retries: number) =>
      client
        .request({ _tag: "ListModelEfforts", accountId: value.accountId, harness: value.harness, model: value.model })
        .then(
          (levels) => {
            if (isCurrent) setAsked({ key, levels, scope });
          },
          () => {
            if (isCurrent && retries > 0) timer = setTimeout(() => ask(retries - 1), effortRetryMillis);
          },
        );
    ask(effortRetries);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [client, key, scope, shouldAsk, value.accountId, value.harness, value.model]);
  return listed ?? (asked?.key === key || asked?.scope === scope ? asked.levels : []);
}

/**
 * The efforts offered: the model's own default, then the levels its provider gives. The chosen effort stays in the
 * list when the model no longer offers it, so the picker says it.
 */
export const effortsOf = (levels: ReadonlyArray<EffortChoice>, effort: EffortChoice): ReadonlyArray<EffortChoice> => {
  const offered = ["default", ...levels];
  return offered.includes(effort) ? offered : [...offered, effort];
};

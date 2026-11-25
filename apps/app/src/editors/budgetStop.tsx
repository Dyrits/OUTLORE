import type { BudgetStop } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { timeOf } from "../foundation/formatting";
import { raisedLimitsOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";

/** The quick raises of an account's budget: +25%, +50%, and double, as the quest's budget offers them (budget-control). */
function AccountRaises({
  client,
  onError,
  stop,
}: {
  client: ServiceClient;
  onError: (message: string | null) => void;
  stop: BudgetStop;
}) {
  const { data: budgets } = useServiceQuery(client, { _tag: "ReadAccountBudgets" }, `account-stop:${stop.id}`);
  const budget = budgets?.find(
    (candidate) => candidate.harness === stop.account?.harness && candidate.accountId === stop.account?.accountId,
  );
  if (budget === undefined) return null;
  const raises = [
    ["+25%", 1.25],
    ["+50%", 1.5],
    ["Double", 2],
  ] as const;
  return (
    <>
      {raises.map(([label, factor]) => (
        <Pressable
          key={label}
          onPress={() =>
            client
              .request({
                _tag: "SetAccountBudget",
                accountId: budget.accountId,
                harness: budget.harness,
                limits: raisedLimitsOf(budget.limits, factor),
                period: budget.period,
                since: budget.period === null ? budget.since : null,
              })
              .then(
                () => onError(null),
                (reason) => onError(messageOf(reason)),
              )
          }
          style={[styles.answer, styles.answerPrimary]}
        >
          <Text style={[styles.answerText, styles.answerTextPrimary]}>Raise budget {label}</Text>
        </Pressable>
      ))}
    </>
  );
}

/** The reached-budget question: Raise budget opens the budget window; Stop (or Stop all) keeps the threads stopped. */
export function BudgetStopCard({
  client,
  stop,
  onRaise,
}: {
  client: ServiceClient;
  stop: BudgetStop;
  onRaise: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const isGlobal = stop.scope === "Global";
  const isAccount = stop.scope === "Account";
  const answer = (request: Parameters<ServiceClient["request"]>[0]) =>
    client.request(request).then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
    );
  return (
    <View style={styles.question}>
      <Text style={styles.questionText}>
        {isGlobal
          ? "The global budget is reached. All running quests and errands stopped."
          : isAccount
            ? `The budget of ${stop.accountLabel ?? "this account"} is reached. Its running quests and errands stopped.`
            : "This quest's budget is reached. Its running work stopped."}
      </Text>
      <Text style={styles.muted}>Reached {timeOf(stop.reachedAt)}</Text>
      <View style={styles.chips}>
        {isAccount ? (
          <AccountRaises client={client} onError={setError} stop={stop} />
        ) : (
          <Pressable onPress={onRaise} style={[styles.answer, styles.answerPrimary]}>
            <Text style={[styles.answerText, styles.answerTextPrimary]}>Raise budget</Text>
          </Pressable>
        )}
        {isAccount && (
          <Pressable onPress={() => answer({ _tag: "SwitchAtBudget", stopId: stop.id })} style={styles.answer}>
            <Text style={styles.answerText}>Switch to a backup Companion</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() =>
            client.request({ _tag: "StopAtBudget", stopId: stop.id }).then(
              () => setError(null),
              (reason) => setError(messageOf(reason)),
            )
          }
          style={styles.answer}
        >
          <Text style={styles.answerText}>{isGlobal ? "Stop all" : "Stop"}</Text>
        </Pressable>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

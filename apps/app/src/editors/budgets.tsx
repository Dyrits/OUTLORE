import {
  type BudgetLimits,
  type BudgetPeriod,
  BudgetPeriod as BudgetPeriods,
  type MissionId,
} from "@outlore/contracts";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { timeOf } from "../foundation/formatting";
import { consumptionDetailsOf, usedTextOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Choice } from "../ui/pickers";
import { BudgetEditor } from "./budgetEditor";
import { BudgetMeters } from "./budgetMeters";

// The budget window is the entry other folders import; the parts it is made of are re-exported so those imports keep working.
export { BudgetEditor } from "./budgetEditor";
export { BudgetMeters, ReserveRows } from "./budgetMeters";
export { BudgetStopCard } from "./budgetStop";

/**
 * The budget window: used of limit, the split by thread (a mission) or by mission (global), the period,
 * and the limits to change. The global budget is saved in Settings.
 */
export function BudgetScreen({
  client,
  missionId,
  title,
  onBack,
}: {
  client: ServiceClient;
  missionId: MissionId | null;
  title: string;
  onBack: () => void;
}) {
  const { data, error } = useServiceQuery(client, { _tag: "ReadBudget", missionId }, `budget:${missionId ?? "global"}`);
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const saveLimits = (limits: BudgetLimits) =>
    missionId !== null
      ? client.request({ _tag: "SetMissionBudget", limits, missionId })
      : settings === null
        ? Promise.reject(new Error("The Workshop is still loading."))
        : client.request({ _tag: "ChangeSettings", change: { globalBudget: limits } });
  const savePeriod = (period: BudgetPeriod) =>
    settings === null
      ? Promise.resolve()
      : client.request({ _tag: "ChangeSettings", change: { globalBudgetPeriod: period } });
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>← Back</Text>
        </Pressable>
        <Text style={[styles.heading, styles.flex]}>{title}</Text>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {data !== null && (
        <View style={styles.section}>
          {data.limits.cost === null && data.limits.tokens === null ? (
            <Text style={styles.muted}>No limit. Used {usedTextOf(data.consumption)}.</Text>
          ) : (
            <BudgetMeters use={data} />
          )}
          {data.period !== null && (
            <View style={styles.section}>
              <Text style={styles.label}>Period</Text>
              <Choice
                label={(period) => period}
                onChange={savePeriod}
                options={BudgetPeriods.literals}
                value={data.period}
              />
              {data.nextStart !== null && <Text style={styles.muted}>Starts over {timeOf(data.nextStart)}</Text>}
            </View>
          )}
          {data.stop !== null && (
            <Text style={styles.error}>Reached: raise the limit below to let the stopped work carry on.</Text>
          )}
          <Text style={styles.label}>Limits</Text>
          <BudgetEditor key={JSON.stringify(data.limits)} limits={data.limits} onSave={saveLimits} />
          <Text style={styles.label}>{missionId === null ? "By quest" : "By quest / errand"}</Text>
          {data.parts.length === 0 && <Text style={styles.muted}>Nothing spent yet.</Text>}
          {data.parts.map((part) => (
            <View key={part.id} style={styles.toggle}>
              <Text numberOfLines={1} style={[styles.body, styles.flex]}>
                {part.title}
              </Text>
              <Text style={styles.muted}>{usedTextOf(part.consumption)}</Text>
            </View>
          ))}
          {consumptionDetailsOf(data.consumption) !== "" && (
            <Text style={styles.muted}>{consumptionDetailsOf(data.consumption)}</Text>
          )}
          <Text style={styles.label}>By harness</Text>
          {data.byHarness.map((part) => (
            <View key={part.id} style={styles.toggle}>
              <Text numberOfLines={1} style={[styles.body, styles.flex]}>
                {part.title}
              </Text>
              <Text style={styles.muted}>{usedTextOf(part.consumption)}</Text>
            </View>
          ))}
          <Text style={styles.label}>By model</Text>
          {data.byModel.map((part) => (
            <View key={part.id} style={styles.toggle}>
              <Text numberOfLines={1} style={[styles.body, styles.flex]}>
                {part.title}
              </Text>
              <Text style={styles.muted}>{usedTextOf(part.consumption)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

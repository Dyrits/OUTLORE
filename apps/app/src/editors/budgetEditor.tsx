import type { BudgetLimits } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { messageOf } from "../foundation/client";
import { raisedLimitsOf } from "../foundation/labels";
import { styles } from "../foundation/styles";

const numberOrNull = (text: string) => {
  const value = Number(text.replace(/[$,\s]/g, ""));
  return text.trim() === "" || !Number.isFinite(value) ? null : value;
};

/** The limits with their fields, the quick raises, and removal; saving hands the new limits over. */
export function BudgetEditor({
  limits,
  onSave,
  saveLabel = "Save budget",
}: {
  limits: BudgetLimits;
  onSave: (limits: BudgetLimits) => Promise<unknown>;
  saveLabel?: string;
}) {
  const [cost, setCost] = useState(limits.cost === null ? "" : String(limits.cost));
  const [tokens, setTokens] = useState(limits.tokens === null ? "" : String(limits.tokens));
  const [error, setError] = useState<string | null>(null);
  const save = (next: BudgetLimits) =>
    onSave(next).then(
      () => {
        setCost(next.cost === null ? "" : String(next.cost));
        setTokens(next.tokens === null ? "" : String(next.tokens));
        setError(null);
      },
      (reason) => setError(messageOf(reason)),
    );
  const typed = (): BudgetLimits => ({ cost: numberOrNull(cost), tokens: numberOrNull(tokens) });
  const hasLimits = limits.cost !== null || limits.tokens !== null;
  return (
    <View style={styles.section}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          accessibilityLabel="Cost limit"
          onChangeText={setCost}
          placeholder="Cost limit ($), empty for none"
          style={[styles.input, styles.flex]}
          value={cost}
        />
        <TextInput
          accessibilityLabel="Token limit"
          onChangeText={setTokens}
          placeholder="Token limit, empty for none"
          style={[styles.input, styles.flex]}
          value={tokens}
        />
      </View>
      <View style={styles.chips}>
        <Pressable onPress={() => save(typed())} style={styles.button}>
          <Text style={styles.buttonText}>{saveLabel}</Text>
        </Pressable>
        {hasLimits &&
          (
            [
              ["+25%", 1.25],
              ["+50%", 1.5],
              ["Double", 2],
            ] as const
          ).map(([label, factor]) => (
            <Pressable key={label} onPress={() => save(raisedLimitsOf(limits, factor))} style={styles.buttonSecondary}>
              <Text style={styles.buttonSecondaryText}>{label}</Text>
            </Pressable>
          ))}
        {hasLimits && (
          <Pressable onPress={() => save({ cost: null, tokens: null })} style={styles.buttonSecondary}>
            <Text style={styles.buttonSecondaryText}>Remove limit</Text>
          </Pressable>
        )}
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

import type { MissionId, Ritual } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { Runner } from "../editors/runners";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { RitualCompanionFields } from "./ritualCompanionFields";
import { ritualStyles } from "./ritualStyles";

export function RitualCompanions({ client, missionId }: { client: ServiceClient; missionId: MissionId }) {
  const { data: ritual, error } = useServiceQuery(client, { _tag: "ReadRitual", missionId }, `ritual:${missionId}`);
  if (error !== null) return <Text style={styles.error}>{error}</Text>;
  return ritual === null ? null : <RitualCompanionEditor client={client} key={ritual.id} ritual={ritual} />;
}

function RitualCompanionEditor({ client, ritual }: { client: ServiceClient; ritual: Ritual }) {
  const [draft, setDraft] = useState<{ fallbacks: ReadonlyArray<Runner>; primary: Runner } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { fallbacks, primary } = draft ?? ritual;
  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      // Read the latest settings so a Companion edit preserves changes made while this tab was open.
      const latest = await client.request({ _tag: "ReadRitual", missionId: ritual.missionId });
      if (latest === null) throw new Error("This Ritual is no longer available.");
      await client.request({
        _tag: "UpdateRitual",
        fallbacks,
        instruction: latest.instruction,
        isOn: latest.isOn,
        primary,
        ritualId: latest.id,
        schedule: latest.schedule,
        title: latest.title,
      });
      setDraft(null);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <ScrollView contentContainerStyle={ritualStyles.content} style={styles.flex}>
      <View pointerEvents={isSaving ? "none" : "auto"}>
        <RitualCompanionFields
          client={client}
          fallbacks={fallbacks}
          onFallbacks={(next) => setDraft({ fallbacks: next, primary })}
          onPrimary={(next) => setDraft({ fallbacks, primary: next })}
          primary={primary}
        />
      </View>
      {error !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <View style={ritualStyles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={draft === null || isSaving}
          onPress={() => void save()}
          style={[styles.button, (draft === null || isSaving) && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>Save Companions</Text>
        </Pressable>
        {draft !== null && (
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => setDraft(null)}
            style={styles.buttonSecondary}
          >
            <Text style={styles.buttonSecondaryText}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

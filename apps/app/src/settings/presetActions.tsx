import type { CompanionPresetEdit, Tier } from "@outlore/contracts";
import { useState } from "react";
import { Text, View } from "react-native";
import { PresetNameForm } from "../editors/presetNameForm";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { Button } from "../ui/button";
import { useWorkshopTabs, type WorkshopFocus } from "./workshopTabs";

/** Sends one preset edit without replacing the rest of the library. */
export const savePresetEdit = (client: ServiceClient, edit: CompanionPresetEdit) =>
  client.request({ _tag: "ChangeCompanionPreset", edit });

/** Rename or delete a saved preset from the Workshop. */
export function PresetActions({ client, name }: { client: ServiceClient; name: string }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await savePresetEdit(client, { _tag: "Delete", name });
      setIsConfirming(false);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      {isConfirming ? (
        <>
          <Text style={styles.body}>Delete “{name}”?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button isDisabled={isDeleting} label="Delete preset" onPress={remove} />
            <Button
              isDisabled={isDeleting}
              isPrimary={false}
              label="Cancel"
              onPress={() => {
                setIsConfirming(false);
                setError(null);
              }}
            />
          </View>
        </>
      ) : (
        <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <PresetNameForm
            initialName={name}
            label="Rename"
            onSave={(nextName) => savePresetEdit(client, { _tag: "Rename", name, nextName })}
          />
          <Button isPrimary={false} label="Delete" onPress={() => setIsConfirming(true)} />
        </View>
      )}
      {error !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

/**
 * Starts a new custom preset as a draft in the Companions tab, from the Companion the tab shows now (`startOf`).
 * It takes a name only when it is saved there.
 */
export function AddPreset({ startOf }: { startOf: (focus: WorkshopFocus) => Tier }) {
  const { focus, startDraft } = useWorkshopTabs();
  return <Button isPrimary={false} label="Add preset" onPress={() => startDraft(startOf(focus), focus)} />;
}

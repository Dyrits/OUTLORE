import { useState } from "react";
import { Text, View } from "react-native";
import { messageOf } from "../foundation/client";
import { styles } from "../foundation/styles";
import { Button } from "../ui/button";
import { type ManagementStep, nextStep } from "./presetManagementFlow";
import { PresetNameForm } from "./presetNameForm";

/**
 * Rename and delete a saved preset, the same under the Workshop's panel and a thread's edit mode: Delete asks first, and a failure shows under the buttons.
 */
export function PresetManagement({
  name,
  onDelete,
  onRename,
}: {
  name: string;
  onDelete: () => Promise<unknown>;
  onRename: (nextName: string) => Promise<unknown>;
}) {
  const [step, setStep] = useState<ManagementStep>({ error: null, stage: "idle" });
  const remove = async () => {
    setStep(nextStep({ kind: "start" }));
    try {
      await onDelete();
      setStep(nextStep({ kind: "done" }));
    } catch (reason) {
      setStep(nextStep({ kind: "failed", message: messageOf(reason) }));
    }
  };
  return (
    <View style={{ gap: 8 }}>
      {step.stage !== "idle" ? (
        <>
          <Text style={styles.body}>Delete “{name}”?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button isDisabled={step.stage === "deleting"} label="Delete preset" onPress={remove} />
            <Button
              isDisabled={step.stage === "deleting"}
              isPrimary={false}
              label="Cancel"
              onPress={() => setStep(nextStep({ kind: "cancel" }))}
            />
          </View>
        </>
      ) : (
        <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <PresetNameForm initialName={name} label="Rename" onSave={onRename} />
          <Button isPrimary={false} label="Delete" onPress={() => setStep(nextStep({ kind: "ask" }))} />
        </View>
      )}
      {step.error !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {step.error}
        </Text>
      )}
    </View>
  );
}

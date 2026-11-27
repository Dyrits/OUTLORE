import { useState } from "react";
import { Text, View } from "react-native";
import { messageOf } from "../foundation/client";
import { styles } from "../foundation/styles";
import { Button } from "../ui/button";

/**
 * Puts a changed Companion and its backups back into the preset it was chosen from, after asking once.
 * Every other thread keeps what it has; only the preset changes.
 */
export function PresetOverwrite({
  isDisabled = false,
  isPrimary = false,
  name,
  onOverwrite,
}: {
  isDisabled?: boolean;
  isPrimary?: boolean;
  name: string;
  onOverwrite: () => Promise<unknown>;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBusy = isDisabled || isSaving;
  const overwrite = async () => {
    if (isBusy) return;
    setIsSaving(true);
    setError(null);
    try {
      await onOverwrite();
      setIsConfirming(false);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      {isConfirming ? (
        <>
          <Text style={styles.body}>Replace “{name}” with this Companion and its backups?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button isDisabled={isBusy} label="Overwrite preset" onPress={overwrite} />
            <Button
              isDisabled={isBusy}
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
        <Button
          isDisabled={isBusy}
          isPrimary={isPrimary}
          label={`Overwrite “${name}”`}
          onPress={() => setIsConfirming(true)}
        />
      )}
      {error !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

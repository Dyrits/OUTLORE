import { useState } from "react";
import { Text, View } from "react-native";
import { messageOf } from "../foundation/client";
import { styles } from "../foundation/styles";
import { Button } from "../ui/button";

/**
 * Puts a changed Companion and its backups back into the preset it was chosen from, after asking once.
 * Every other thread keeps what it has; only the preset changes.
 */
export function PresetOverwrite({ name, onOverwrite }: { name: string; onOverwrite: () => Promise<unknown> }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overwrite = async () => {
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
            <Button isDisabled={isSaving} label="Overwrite preset" onPress={overwrite} />
            <Button
              isDisabled={isSaving}
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
        <Button isPrimary={false} label={`Overwrite “${name}”`} onPress={() => setIsConfirming(true)} />
      )}
      {error !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

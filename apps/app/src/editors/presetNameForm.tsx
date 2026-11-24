import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { messageOf } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { Button } from "../ui/button";

/** Opens an inline name form and leaves it open with the host's error if saving fails. */
export function PresetNameForm({
  initialName = "",
  label,
  onSave,
}: {
  initialName?: string;
  label: string;
  onSave: (name: string) => Promise<unknown>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const close = () => {
    setIsOpen(false);
    setError(null);
    setName(initialName);
  };
  const save = async () => {
    if (saving.current || name.trim() === "") return;
    saving.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(name.trim());
      close();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  return isOpen ? (
    <View style={{ gap: 8 }}>
      <Text style={styles.body}>Preset name</Text>
      <TextInput
        accessibilityLabel="Preset name"
        autoFocus
        editable={!isSaving}
        maxLength={80}
        onChangeText={setName}
        onSubmitEditing={save}
        placeholder="Preset name"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        value={name}
      />
      {error !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button isDisabled={isSaving || name.trim() === ""} label="Save preset" onPress={save} />
        <Button isDisabled={isSaving} isPrimary={false} label="Cancel" onPress={close} />
      </View>
    </View>
  ) : (
    <Button isPrimary={false} label={label} onPress={() => setIsOpen(true)} />
  );
}

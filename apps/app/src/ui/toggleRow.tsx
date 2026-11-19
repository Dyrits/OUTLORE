import { StyleSheet, Text, View } from "react-native";
import { styles } from "../foundation/styles";
import { Toggle } from "./controls";

/** An on and off switch with its words. */
export function ToggleRow({
  isDisabled = false,
  label,
  onChange,
  value,
}: {
  isDisabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={toggleStyles.row}>
      <Toggle isDisabled={isDisabled} label={label} onValueChange={onChange} value={value} />
      <Text style={[styles.body, toggleStyles.label]}>{label}</Text>
    </View>
  );
}

const toggleStyles = StyleSheet.create({
  label: { flexShrink: 1 },
  row: { alignItems: "center", flexDirection: "row", gap: 10 },
});

import { Pressable, Text, View } from "react-native";
import { companionStyles } from "./companionStyles";

/** A row of tabs in the Companions tab's own style. */
export function Tabs<T extends string>({
  onChange,
  options,
  value,
  labelOf,
}: {
  onChange: (option: T) => void;
  options: ReadonlyArray<T>;
  /** The selected option, or none when what the panel shows is not one of them. */
  value: T | null;
  labelOf?: (option: T) => string;
}) {
  return (
    <View accessibilityRole="tablist" style={companionStyles.tabs}>
      {options.map((option) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: option === value }}
          key={option}
          onPress={() => onChange(option)}
          style={[companionStyles.tab, option === value && companionStyles.tabActive]}
        >
          <Text style={[companionStyles.tabText, option === value && companionStyles.tabTextActive]}>
            {labelOf?.(option) ?? option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

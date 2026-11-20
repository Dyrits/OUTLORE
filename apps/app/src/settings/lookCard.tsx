import { StyleSheet, Text, View } from "react-native";
import {
  canChooseColorScheme,
  chooseColorPreference,
  chooseTheme,
  colorPreference,
  theme,
} from "../foundation/colorScheme";
import { colorSchemePreferences } from "../foundation/colorSchemeRules";
import { chooseSidebarMode, chooseSidebarSide, useSidebarPreference } from "../foundation/sidebarPreference";
import { type SidebarMode, type SidebarSide, sidebarModes, sidebarSides } from "../foundation/sidebarPreferenceRules";
import { styles } from "../foundation/styles";
import { type Theme, themes } from "../foundation/themeRules";
import { Choice } from "../ui/pickers";
import { SettingsCard, SettingsRule } from "./settingsParts";

const themeLabels = { iskios: "Iskios", mono: "Black & white", one: "One" } as const satisfies Record<Theme, string>;
const colorSchemeLabels = { dark: "Dark", light: "Light", system: "System" } as const satisfies Record<
  (typeof colorSchemePreferences)[number],
  string
>;

const sidebarModeLabels = { docked: "Docked", overlay: "Overlay" } as const satisfies Record<SidebarMode, string>;
const sidebarSideLabels = { left: "Left", right: "Right" } as const satisfies Record<SidebarSide, string>;

/** The Workshop's local theme and light/dark preferences, applied through the existing reload flow. */
export function LookCard() {
  const { mode, side } = useSidebarPreference();
  if (!canChooseColorScheme) return null;
  return (
    <SettingsCard icon="sliders" title="Look">
      <View style={local.row}>
        <Text style={[styles.body, local.label]}>Theme</Text>
        <Choice
          accessibilityLabel="Theme"
          label={(name) => themeLabels[name]}
          onChange={chooseTheme}
          options={themes}
          value={theme}
        />
      </View>
      <SettingsRule />
      <View style={local.row}>
        <Text style={[styles.body, local.label]}>Appearance · light, dark, or the system's</Text>
        <Choice
          accessibilityLabel="Appearance"
          label={(preference) => colorSchemeLabels[preference]}
          onChange={chooseColorPreference}
          options={colorSchemePreferences}
          value={colorPreference}
        />
      </View>
      <SettingsRule />
      <View style={local.row}>
        <Text style={[styles.body, local.label]}>Sidebar · floats over the panes, or stays beside them</Text>
        <Choice
          accessibilityLabel="Sidebar mode"
          label={(name) => sidebarModeLabels[name]}
          onChange={chooseSidebarMode}
          options={sidebarModes}
          value={mode}
        />
      </View>
      {mode === "overlay" && (
        <>
          <SettingsRule />
          <View style={local.row}>
            <Text style={[styles.body, local.label]}>Sidebar edge · where the pointer calls it</Text>
            <Choice
              accessibilityLabel="Sidebar edge"
              label={(name) => sidebarSideLabels[name]}
              onChange={chooseSidebarSide}
              options={sidebarSides}
              value={side}
            />
          </View>
        </>
      )}
    </SettingsCard>
  );
}

const local = StyleSheet.create({
  label: { flex: 1 },
  row: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
});

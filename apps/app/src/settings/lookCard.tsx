import { StyleSheet, Text, View } from "react-native";
import {
  canChooseColorScheme,
  chooseColorPreference,
  chooseTheme,
  colorPreference,
  theme,
} from "../foundation/colorScheme";
import { colorSchemePreferences } from "../foundation/colorSchemeRules";
import { chooseIslands, useIslands } from "../foundation/islands";
import {
  type IslandCanvas,
  islandCanvases,
  islandGaps,
  islandLifts,
  islandRadii,
  type Layout,
  layouts,
} from "../foundation/islandsRules";
import { chooseSidebarMode, chooseSidebarSide, useSidebarPreference } from "../foundation/sidebarPreference";
import { type SidebarMode, type SidebarSide, sidebarModes, sidebarSides } from "../foundation/sidebarPreferenceRules";
import { styles } from "../foundation/styles";
import { type Theme, themes } from "../foundation/themeRules";
import { Choice, Steps } from "../ui/pickers";
import { SettingsCard, SettingsRule } from "./settingsParts";

const themeLabels = {
  iskios: "Iskios",
  mono: "Black & white",
  one: "One",
  slate: "Slate",
} as const satisfies Record<Theme, string>;
const layoutLabels = { flat: "Flat", islands: "Islands" } as const satisfies Record<Layout, string>;
const colorSchemeLabels = { dark: "Dark", light: "Light", system: "System" } as const satisfies Record<
  (typeof colorSchemePreferences)[number],
  string
>;

const canvasLabels = { cool: "Cool glow", flat: "Flat", warm: "Warm glow" } as const satisfies Record<
  IslandCanvas,
  string
>;
const liftLabels = { "0": "None", "0.5": "Faint", "1": "Soft", "2": "Strong", "3": "Deep" } as const;

const sidebarModeLabels = { docked: "Docked", overlay: "Overlay" } as const satisfies Record<SidebarMode, string>;
const sidebarSideLabels = { left: "Left", right: "Right" } as const satisfies Record<SidebarSide, string>;

/** The Workshop's local theme and light/dark preferences, applied through the existing reload flow. */
export function LookCard() {
  const { mode, side } = useSidebarPreference();
  const { layout } = useIslands();
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
        <Text style={[styles.body, local.label]}>Layout · floating islands on a canvas, or one flat frame</Text>
        <Choice
          accessibilityLabel="Layout"
          label={(name) => layoutLabels[name]}
          onChange={(next) => chooseIslands({ layout: next })}
          options={layouts}
          value={layout}
        />
      </View>
      {layout === "islands" && <IslandRows />}
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

/** The Islands layout's own settings, shown at once with no reload: the canvas, the gap, the corners, and the lift. */
function IslandRows() {
  const islands = useIslands();
  const steps = <T extends number>(
    label: string,
    options: ReadonlyArray<T>,
    value: T,
    name: (option: T) => string,
    onChange: (option: T) => void,
  ) => (
    <>
      <SettingsRule />
      <View style={local.row}>
        <Text style={[styles.body, local.label]}>{label}</Text>
        <View style={local.steps}>
          <Steps
            accessibilityLabel={label}
            label={(option) => name(Number(option) as T)}
            onChange={(option) => onChange(Number(option) as T)}
            options={options.map(String)}
            value={String(value)}
          />
        </View>
      </View>
    </>
  );
  return (
    <>
      <SettingsRule />
      <View style={local.row}>
        <Text style={[styles.body, local.label]}>Canvas · behind the islands</Text>
        <Choice
          accessibilityLabel="Canvas"
          label={(canvas) => canvasLabels[canvas]}
          onChange={(canvas) => chooseIslands({ canvas })}
          options={islandCanvases}
          value={islands.canvas}
        />
      </View>
      {steps("Gap · between the islands", islandGaps, islands.gap, String, (gap) => chooseIslands({ gap }))}
      {steps("Radius · of their corners", islandRadii, islands.radius, String, (radius) => chooseIslands({ radius }))}
      {steps(
        "Lift · the islands' shadow",
        islandLifts,
        islands.lift,
        (lift) => liftLabels[String(lift) as keyof typeof liftLabels],
        (lift) => chooseIslands({ lift }),
      )}
    </>
  );
}

const local = StyleSheet.create({
  label: { flex: 1 },
  row: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  steps: { width: 280 },
});

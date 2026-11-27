import type { Settings, SettingsChange } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ConnectorChoicePanel } from "../connectors";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { CodeModeCard } from "./codeModeCard";
import { ConnectorPanel } from "./connectorPanel";
import { SettingsCard } from "./settingsParts";
import { VaultCard } from "./vaultCard";

/** The tabs that are not a connector. */
type OtherTab = "vault" | "borderlands";

/**
 * The Workshop's Connectors section: a tab for each connector the catalog offers, each with its own panel, then the
 * Vault, and the Borderlands' choices with Code Mode.
 */
export function ConnectorsSection({
  client,
  onSave,
  settings,
}: {
  client: ServiceClient;
  onSave: (change: SettingsChange) => void;
  settings: Settings;
}) {
  const { data, error, refresh } = useServiceQuery(client, { _tag: "ListConnectors" }, "connectors");
  const [chosen, setChosen] = useState<string | null>(null);
  const tabs = [
    ...(data ?? []).map((card) => ({ id: card.id, label: card.name })),
    { id: "vault", label: "The Vault" },
    { id: "borderlands", label: "Borderlands" },
  ];
  const active = tabs.find((tab) => tab.id === chosen)?.id ?? tabs[0]?.id ?? "vault";
  const card = data?.find((each) => each.id === active);
  return (
    <View style={local.section}>
      <View accessibilityRole="tablist" style={local.tabs}>
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              key={tab.id}
              onPress={() => setChosen(tab.id)}
              style={[local.tab, isActive && local.tabActive]}
            >
              <Text style={[local.tabText, isActive && local.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {data === null && <Text style={error === null ? styles.muted : styles.error}>{error ?? "Reading…"}</Text>}
      {card !== undefined && (
        <ConnectorPanel
          card={card}
          client={client}
          key={card.id}
          onChanged={refresh}
          onOpenVault={() => setChosen("vault" satisfies OtherTab)}
        />
      )}
      {active === "vault" && <VaultCard client={client} />}
      {active === "borderlands" && (
        <>
          <SettingsCard icon="layers" summary="Which connectors a quest starts with" title="The Borderlands">
            <ConnectorChoicePanel client={client} level={{ _tag: "Borderlands" }} />
          </SettingsCard>
          <CodeModeCard onSave={onSave} settings={settings} />
        </>
      )}
      {data !== null && error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const local = StyleSheet.create({
  section: { gap: 14 },
  tab: {
    borderColor: "transparent",
    borderRadius: 3,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabActive: { backgroundColor: colors.controlActive, borderColor: colors.edge },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tabText: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  tabTextActive: { color: colors.text, fontWeight: "700" },
});

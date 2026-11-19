import type { ConnectorChoiceLevel } from "@outlore/contracts";
import { useState } from "react";
import { Text, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Button } from "../ui/button";
import { Toggle } from "../ui/controls";
import { choiceOfSwitch, choiceViewOf, levelKeyOf } from "./connectorChoices";

/** The choices for one placement. Errands share their quest's choice. */
export function ConnectorChoicePanel({ client, level }: { client: ServiceClient; level: ConnectorChoiceLevel }) {
  const { data, error } = useServiceQuery(client, { _tag: "ReadConnectorChoices", level }, levelKeyOf(level));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = (connectorId: string, choice: "On" | "Off" | "Reset") => {
    setBusy(true);
    client
      .request({ _tag: "SetConnectorSwitch", choice, connectorId, level })
      .then(
        () => setSaveError(null),
        (reason) => setSaveError(messageOf(reason)),
      )
      .finally(() => setBusy(false));
  };
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.body}>Connectors</Text>
      {data === null && <Text style={error === null ? styles.muted : styles.error}>{error ?? "Reading…"}</Text>}
      {data?.length === 0 && <Text style={styles.muted}>No connectors installed.</Text>}
      {data?.map((card) => {
        const view = choiceViewOf(card);
        return (
          <View key={card.connectorId} style={{ gap: 4 }}>
            <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Toggle
                isDisabled={busy || view.isDisabled}
                label={card.name}
                onValueChange={(value) => save(card.connectorId, choiceOfSwitch(value))}
                value={view.isOn}
              />
              <Text style={styles.body}>{card.name}</Text>
              {view.canReset && (
                <Button
                  isDisabled={busy}
                  isPrimary={false}
                  label="Reset to inherit"
                  onPress={() => save(card.connectorId, "Reset")}
                />
              )}
            </View>
            {view.note !== null && <Text style={styles.muted}>{view.note}</Text>}
            {card.state === "NeedsConnecting" && <Text style={styles.muted}>Needs connecting</Text>}
          </View>
        );
      })}
      {data !== null && error !== null && <Text style={styles.error}>{error}</Text>}
      {saveError !== null && <Text style={styles.error}>{saveError}</Text>}
    </View>
  );
}

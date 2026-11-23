import type { ConnectorCard } from "@outlore/contracts";
import { useState } from "react";
import { Text, View } from "react-native";
import { storingRefusalOf } from "../connectors";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Button } from "../ui/button";
import { SecretField } from "./secretField";

/**
 * The secrets a connector needs, entered in its own panel: one field per kind (Composio's API key). The Vault keeps
 * them; when it refuses to store one now, the panel says why and leads to the Vault tab, where its protection is checked.
 */
export function ConnectorSecrets({
  card,
  client,
  onChanged,
  onOpenVault,
}: {
  card: ConnectorCard;
  client: ServiceClient;
  onChanged: () => void;
  onOpenVault: () => void;
}) {
  const [revision, setRevision] = useState(0);
  const { data: view, error } = useServiceQuery(client, { _tag: "ReadVault" }, `vault:${revision}`);
  if (view === null) return <Text style={error === null ? styles.muted : styles.error}>{error ?? "Reading…"}</Text>;
  const refusal = storingRefusalOf(view);
  return (
    <View style={{ gap: 8 }}>
      {card.secretKinds.map((kind) => (
        <SecretField
          client={client}
          key={kind}
          onChanged={() => {
            setRevision((value) => value + 1);
            onChanged();
          }}
          refusal={refusal}
          slot={{
            connectorId: card.id,
            connectorName: card.name,
            entry: view.entries.find((held) => held.connectorId === card.id && held.kind === kind) ?? null,
            kind,
          }}
        />
      ))}
      {refusal !== null && (
        <View style={{ alignItems: "flex-start", gap: 8 }}>
          <Text style={styles.error}>{refusal}</Text>
          <Button isPrimary={false} label="Open the Vault" onPress={onOpenVault} />
        </View>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

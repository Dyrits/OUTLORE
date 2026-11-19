import { useState } from "react";
import { Text, View } from "react-native";
import {
  canVerifyClaude,
  denialResultOf,
  holderLineOf,
  leftBehindOf,
  storingRefusalOf,
  vaultStateLabels,
  vaultStateNoteOf,
  verifyNote,
} from "../connectors";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Button } from "../ui/button";
import { SecretField } from "./secretField";
import { SettingsCard, SettingsRule } from "./settingsParts";

/** The Vault's state and protection, and the secrets no connector panel holds. It only returns their metadata. */
export function VaultCard({ client }: { client: ServiceClient }) {
  const [revision, setRevision] = useState(0);
  const vault = useServiceQuery(client, { _tag: "ReadVault" }, `vault:${revision}`);
  const connectors = useServiceQuery(client, { _tag: "ListConnectors" }, "connectors");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [confirmVerify, setConfirmVerify] = useState(false);
  const view = vault.data;
  return (
    <SettingsCard icon="shield" title="The Vault">
      {view === null ? (
        <Text style={vault.error === null ? styles.muted : styles.error}>{vault.error ?? "Reading…"}</Text>
      ) : (
        <>
          <Text style={styles.body}>{vaultStateLabels[view.state]}</Text>
          {vaultStateNoteOf(view) !== null && <Text style={styles.muted}>{vaultStateNoteOf(view)}</Text>}
          {holderLineOf(view) !== null && <Text style={styles.muted}>{holderLineOf(view)}</Text>}
          {storingRefusalOf(view) !== null && <Text style={styles.error}>{storingRefusalOf(view)}</Text>}
          {view.protection.unverified.map((item) => (
            <Text key={item.harness} style={styles.muted}>
              {item.harness}: {item.reason}
            </Text>
          ))}
          {canVerifyClaude(view) && !confirmVerify && (
            <Button label="Verify Claude Code" onPress={() => setConfirmVerify(true)} />
          )}
          {confirmVerify && (
            <>
              <Text style={styles.muted}>{verifyNote}</Text>
              <Button
                isDisabled={verifying}
                label={verifying ? "Verifying…" : "Run verification"}
                onPress={() => {
                  setVerifying(true);
                  client
                    .request({ _tag: "VerifyClaudeVaultDenial" })
                    .then(
                      (check) => {
                        setResult(denialResultOf(check));
                        setRevision((value) => value + 1);
                        setError(null);
                        setConfirmVerify(false);
                      },
                      (reason) => setError(messageOf(reason)),
                    )
                    .finally(() => setVerifying(false));
                }}
              />
              <Button isDisabled={verifying} isPrimary={false} label="Cancel" onPress={() => setConfirmVerify(false)} />
            </>
          )}
          {result !== null && <Text style={styles.body}>{result}</Text>}
          <Text style={styles.muted}>
            A connector's own key is entered in that connector's tab. The Vault keeps them, and any secret left behind
            by a connector that is no longer installed.
          </Text>
          {connectors.data !== null &&
            leftBehindOf(connectors.data, view.entries).map((slot) => (
              <View key={`${slot.connectorId}:${slot.kind}`} style={{ gap: 8 }}>
                <SettingsRule />
                <Text style={styles.body}>{slot.connectorName}</Text>
                <SecretField client={client} refusal={storingRefusalOf(view)} slot={slot} />
              </View>
            ))}
        </>
      )}
      {view !== null && vault.error !== null && <Text style={styles.error}>{vault.error}</Text>}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </SettingsCard>
  );
}

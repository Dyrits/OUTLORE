import { Redacted } from "effect";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import {
  addedTextOf,
  canVerifyClaude,
  denialResultOf,
  holderLineOf,
  type SecretSlot,
  secretFieldNote,
  secretSlotsOf,
  storingRefusalOf,
  vaultStateLabels,
  vaultStateNoteOf,
  verifyNote,
} from "../connectors";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Button } from "../ui/button";
import { SettingsCard, SettingsRule } from "./settingsParts";

/** Secrets enter once and the Vault only returns their metadata. */
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
          {connectors.data === null ? (
            <Text style={connectors.error === null ? styles.muted : styles.error}>
              {connectors.error ?? "Reading connectors…"}
            </Text>
          ) : (
            secretSlotsOf(connectors.data, view.entries).map((slot) => (
              <Secret
                client={client}
                key={`${slot.connectorId}:${slot.kind}`}
                refusal={storingRefusalOf(view)}
                slot={slot}
              />
            ))
          )}
        </>
      )}
      {view !== null && vault.error !== null && <Text style={styles.error}>{vault.error}</Text>}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </SettingsCard>
  );
}

function Secret({ client, refusal, slot }: { client: ServiceClient; refusal: string | null; slot: SecretSlot }) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    setBusy(true);
    const request = { connectorId: slot.connectorId, kind: slot.kind, secret: Redacted.make(secret) };
    client
      .request(slot.entry === null ? { _tag: "PutSecret", ...request } : { _tag: "ReplaceSecret", ...request })
      .then(
        () => {
          setSecret("");
          setEditing(false);
          setError(null);
        },
        (reason) => setError(messageOf(reason)),
      )
      .finally(() => setBusy(false));
  };
  return (
    <View style={{ gap: 8 }}>
      <SettingsRule />
      <Text style={styles.body}>
        {slot.connectorName} · {slot.kind}
      </Text>
      <Text style={styles.muted}>{slot.entry === null ? "Not stored" : addedTextOf(slot.entry)}</Text>
      {!editing && (
        <Button
          isDisabled={refusal !== null || busy}
          label={slot.entry === null ? "Add secret" : "Replace secret"}
          onPress={() => setEditing(true)}
        />
      )}
      {editing && (
        <>
          <Text style={styles.muted}>{secretFieldNote}</Text>
          <TextInput
            accessibilityLabel={`${slot.connectorName} ${slot.kind}`}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            onChangeText={setSecret}
            secureTextEntry
            style={{ borderColor: colors.edge, borderWidth: 1, color: colors.text, padding: 8 }}
            value={secret}
          />
          <Button isDisabled={busy || secret.length === 0 || refusal !== null} label="Save secret" onPress={save} />
          <Button
            isDisabled={busy}
            isPrimary={false}
            label="Cancel"
            onPress={() => {
              setSecret("");
              setEditing(false);
            }}
          />
        </>
      )}
      {slot.entry !== null && !removing && (
        <Button isDisabled={busy} isPrimary={false} label="Remove secret" onPress={() => setRemoving(true)} />
      )}
      {removing && (
        <>
          <Text style={styles.muted}>Remove this secret? The connector will need it again.</Text>
          <Button
            isDisabled={busy}
            label="Confirm removal"
            onPress={() => {
              setBusy(true);
              client
                .request({ _tag: "RemoveSecret", connectorId: slot.connectorId, kind: slot.kind })
                .then(
                  () => {
                    setRemoving(false);
                    setError(null);
                  },
                  (reason) => setError(messageOf(reason)),
                )
                .finally(() => setBusy(false));
            }}
          />
          <Button isDisabled={busy} isPrimary={false} label="Cancel" onPress={() => setRemoving(false)} />
        </>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

import { Redacted } from "effect";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { addedTextOf, type SecretSlot, secretFieldNote } from "../connectors";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { Button } from "../ui/button";

/**
 * One secret's field: add, replace or remove the secret of one connector's kind. The value goes to the service once and
 * is never read back. Shown in the connector's own panel; the Vault's card lists only those that no panel holds.
 */
export function SecretField({
  client,
  onChanged,
  refusal,
  slot,
}: {
  client: ServiceClient;
  onChanged?: () => void;
  refusal: string | null;
  slot: SecretSlot;
}) {
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
          onChanged?.();
        },
        (reason) => setError(messageOf(reason)),
      )
      .finally(() => setBusy(false));
  };
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.body}>{slot.kind}</Text>
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
                    onChanged?.();
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

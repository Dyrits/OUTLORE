import type { PairingCode } from "@outlore/contracts";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { useActiveHost } from "../foundation/hostContext";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Button } from "../ui/button";
import { ToggleRow } from "../ui/toggleRow";
import { PairingBlock } from "./pairingBlock";
import { RelayChoice } from "./relayChoice";
import { deviceLineOf, relayStatusTextOf } from "./remoteAccess";
import { remoteAccessStyles } from "./remoteAccessStyles";
import { SettingsCard, SettingsRule } from "./settingsParts";

/**
 * Charter's remote access section: whether other devices may pair with this computer, a pairing
 * code to give to another Outlore, and the devices already paired, each with a Disconnect (device-pairing).
 */
export function RemoteAccessCard({ client }: { client: ServiceClient }) {
  const host = useActiveHost();
  if (host.hostId !== null) {
    return (
      <SettingsCard icon="monitor" title="Remote access · paired devices">
        <Text style={styles.muted}>
          Paired devices are managed on {host.name} itself. Switch to this computer in the host menu to manage the
          devices paired with it.
        </Text>
      </SettingsCard>
    );
  }
  return <RemoteAccessOnHost client={client} />;
}

function RemoteAccessOnHost({ client }: { client: ServiceClient }) {
  const { data: view, error: readError } = useServiceQuery(client, { _tag: "ReadRemoteAccess" }, "remote-access");
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // The clock behind "expires in" and "last active" moves on once a minute.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const attempt = (work: Promise<unknown>) =>
    work.then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
    );
  if (view === null) {
    return (
      <SettingsCard icon="monitor" title="Remote access · paired devices">
        <Text style={readError === null ? styles.muted : styles.error}>{readError ?? "Reading…"}</Text>
      </SettingsCard>
    );
  }
  return (
    <SettingsCard
      icon="monitor"
      summary="Control this computer from another Outlore"
      title="Remote access · paired devices"
    >
      <ToggleRow
        label="Allow paired devices"
        onChange={(isEnabled) => {
          if (!isEnabled) setPairing(null);
          void attempt(client.request({ _tag: "SetRemoteAccess", isEnabled }));
        }}
        value={view.isEnabled}
      />
      <Text accessibilityLabel="Relay status" style={styles.muted}>
        {relayStatusTextOf(view.status, view.isEnabled)}
      </Text>
      <SettingsRule />
      <ToggleRow
        label="Allow terminals from paired devices"
        onChange={(shouldAllowRemoteTerminals) =>
          void attempt(client.request({ _tag: "ChangeSettings", change: { shouldAllowRemoteTerminals } }))
        }
        value={settings?.shouldAllowRemoteTerminals === true}
      />
      <Text style={styles.muted}>
        A paired device that opens a shell runs it inside this computer's sandbox, writing only in its conversation's
        folder.
      </Text>
      <SettingsRule />
      <RelayChoice client={client} deviceCount={view.devices.length} view={view} />
      <SettingsRule />
      <View style={remoteAccessStyles.row}>
        <Button
          isDisabled={!view.isEnabled}
          label="Pair a device"
          onPress={() => void attempt(client.request({ _tag: "CreatePairingCode" }).then(setPairing))}
        />
        {!view.isEnabled && <Text style={styles.muted}>Turn on Allow paired devices first.</Text>}
      </View>
      {pairing !== null && <PairingBlock key={pairing.code} now={now} pairing={pairing} />}
      <SettingsRule />
      <Text style={remoteAccessStyles.label}>Paired devices</Text>
      {view.devices.length === 0 && <Text style={styles.muted}>No device is paired with this computer.</Text>}
      {view.devices.map((device) => (
        <View key={device.id} style={remoteAccessStyles.device}>
          <View style={remoteAccessStyles.deviceText}>
            <Text style={styles.body}>{device.name}</Text>
            <Text style={styles.muted}>{deviceLineOf(device, now)}</Text>
          </View>
          <Button
            isPrimary={false}
            label="Disconnect"
            onPress={() => void attempt(client.request({ _tag: "DisconnectDevice", deviceId: device.id }))}
          />
        </View>
      ))}
      <Text style={styles.muted}>
        Disconnecting a device ends its connection at once and forgets it; it can pair again with a new code.
      </Text>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </SettingsCard>
  );
}

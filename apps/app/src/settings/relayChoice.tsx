import type { RemoteAccessView } from "@outlore/contracts";
import { useState } from "react";
import { Linking, Text, TextInput, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { Button } from "../ui/button";
import { cloudflareTokensUrl, ownRelayNoticeOf, relayLineOf, webAppLineOf } from "./remoteAccess";
import { remoteAccessStyles } from "./remoteAccessStyles";

/**
 * Which relay this host uses. The shared relay needs nothing; the owner may deploy one to their own Cloudflare account
 * with one API token, which is used once and not kept (device-pairing, own relay).
 */
export function RelayChoice({
  client,
  deviceCount,
  view,
}: {
  client: ServiceClient;
  deviceCount: number;
  view: RemoteAccessView;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [token, setToken] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setIsOpen(false);
    setToken("");
    setError(null);
  };
  const deploy = () => {
    setIsWorking(true);
    setError(null);
    client.request({ _tag: "UseOwnRelay", token }).then(
      () => {
        setIsWorking(false);
        close();
      },
      (reason) => {
        setIsWorking(false);
        setError(messageOf(reason));
      },
    );
  };
  const returnToShared = () => {
    setError(null);
    client.request({ _tag: "UseSharedRelay" }).then(
      () => void 0,
      (reason) => setError(messageOf(reason)),
    );
  };
  return (
    <View style={{ gap: 8 }}>
      <Text style={remoteAccessStyles.label}>Relay</Text>
      <Text accessibilityLabel="Relay in use" style={styles.body}>
        {relayLineOf(view)}
      </Text>
      <Text accessibilityLabel="Web app address" selectable style={styles.muted}>
        {webAppLineOf(view)}
      </Text>
      {!isOpen && (
        <View style={remoteAccessStyles.row}>
          <Button
            isPrimary={false}
            label={view.isOwnRelay ? "Update my relay" : "Use my own Cloudflare account"}
            onPress={() => setIsOpen(true)}
          />
          {view.isOwnRelay && <Button isPrimary={false} label="Use the shared relay" onPress={returnToShared} />}
        </View>
      )}
      {isOpen && (
        <View style={remoteAccessStyles.codeBox}>
          <Text style={styles.body}>
            Deploy the relay to your own Cloudflare account instead of sharing the project's. A free Cloudflare account
            is enough.
          </Text>
          <Text style={styles.muted}>
            1. Open Cloudflare's token page, choose Create Token, and use the “Edit Cloudflare Workers” template. Under
            Account Resources, choose your one account.
          </Text>
          <View style={remoteAccessStyles.row}>
            <Button
              isPrimary={false}
              label="Open Cloudflare's token page"
              onPress={() => void Linking.openURL(cloudflareTokensUrl)}
            />
          </View>
          <Text style={styles.muted}>2. Paste the token here.</Text>
          <TextInput
            accessibilityLabel="Cloudflare API token"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isWorking}
            onChangeText={setToken}
            placeholder="Cloudflare API token"
            placeholderTextColor={colors.textDim}
            secureTextEntry
            style={remoteAccessStyles.input}
            value={token}
          />
          <Text style={styles.muted}>{ownRelayNoticeOf(deviceCount)}</Text>
          <View style={remoteAccessStyles.row}>
            <Button
              isDisabled={isWorking || token.trim() === ""}
              label={isWorking ? "Deploying…" : "Deploy and use"}
              onPress={deploy}
            />
            <Button isDisabled={isWorking} isPrimary={false} label="Cancel" onPress={close} />
          </View>
          {isWorking && <Text style={styles.muted}>This takes up to a minute.</Text>}
        </View>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

import type { ConnectorCard } from "@outlore/contracts";
import { useState } from "react";
import { Text, View } from "react-native";
import {
  applePermissionLabelOf,
  appsAfterToggle,
  ConnectorChoicePanel,
  canInstallCard,
  chosenAppsOf,
  connectorStateLabels,
  isInstalledCard,
  remotePermissionNote,
  removalWarning,
  toolClassLabels,
  toolGroupsOf,
} from "../connectors";
import { messageOf, type ServiceClient } from "../foundation/client";
import { useIsRemoteHost } from "../foundation/hostContext";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Button } from "../ui/button";
import { ToggleRow } from "../ui/toggleRow";
import { SettingsCard, SettingsRule } from "./settingsParts";

/** The connector catalog and the Borderlands' choices in the Charter. */
export function ConnectorsCard({ client }: { client: ServiceClient }) {
  const [revision, setRevision] = useState(0);
  const { data, error } = useServiceQuery(client, { _tag: "ListConnectors" }, `connectors:${revision}`);
  return (
    <SettingsCard icon="layers" title="Connectors">
      {data === null && <Text style={error === null ? styles.muted : styles.error}>{error ?? "Reading…"}</Text>}
      {data?.map((card) => (
        <Connector card={card} client={client} key={card.id} onChanged={() => setRevision((value) => value + 1)} />
      ))}
      {data !== null && error !== null && <Text style={styles.error}>{error}</Text>}
      <SettingsRule />
      <Text style={styles.body}>The Borderlands</Text>
      <ConnectorChoicePanel client={client} level={{ _tag: "Borderlands" }} />
    </SettingsCard>
  );
}

function Connector({ card, client, onChanged }: { card: ConnectorCard; client: ServiceClient; onChanged: () => void }) {
  const remote = useIsRemoteHost();
  const [isInstalling, setInstalling] = useState(false);
  const [apps, setApps] = useState(() => chosenAppsOf(card));
  const [isRemoving, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = (work: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    work()
      .then(
        () => {
          setError(null);
          onChanged();
          after?.();
        },
        (reason) => {
          setError(messageOf(reason));
          onChanged();
        },
      )
      .finally(() => setBusy(false));
  };
  const askPermission = () => attempt(() => client.request({ _tag: "RequestApplePermission", connectorId: card.id }));
  const installed = isInstalledCard(card);
  return (
    <View style={{ gap: 8 }}>
      <SettingsRule />
      <Text style={styles.body}>
        {card.name} · {connectorStateLabels[card.state]}
      </Text>
      <Text style={styles.muted}>{card.description}</Text>
      {card.needs !== null && <Text style={styles.muted}>{card.needs}</Text>}
      {canInstallCard(card) && !isInstalling && <Button label="Install" onPress={() => setInstalling(true)} />}
      {isInstalling && (
        <View style={{ gap: 8 }}>
          {card.notice !== null && <Text style={styles.body}>{card.notice}</Text>}
          {card.apps.map((app) => (
            <ToggleRow
              isDisabled={busy}
              key={app.id}
              label={app.name}
              onChange={(value) => setApps(value ? [...apps, app.id] : apps.filter((id) => id !== app.id))}
              value={apps.includes(app.id)}
            />
          ))}
          <Button
            isDisabled={busy}
            label="I have read this · Install"
            onPress={() =>
              attempt(
                async () => {
                  await client.request({
                    _tag: "InstallConnector",
                    connectorId: card.id,
                    hasConfirmedNotice: true,
                    ...(card.apps.length > 0 ? { apps } : {}),
                  });
                  setInstalling(false);
                  if (card.apps.length > 0 && !remote) {
                    await client.request({ _tag: "RequestApplePermission", connectorId: card.id });
                  }
                },
                () => {
                  setInstalling(false);
                },
              )
            }
          />
          <Button isDisabled={busy} isPrimary={false} label="Cancel" onPress={() => setInstalling(false)} />
        </View>
      )}
      {installed && card.state !== "Removing" && (
        <>
          <ToggleRow
            isDisabled={busy}
            label="On everywhere"
            onChange={(value) =>
              attempt(() =>
                client.request({
                  _tag: "SetConnectorSwitch",
                  choice: value ? "On" : "Off",
                  connectorId: card.id,
                  level: { _tag: "Global" },
                }),
              )
            }
            value={card.isEnabled}
          />
          {card.apps.map((app) => (
            <ToggleRow
              isDisabled={busy}
              key={app.id}
              label={app.name}
              onChange={(value) =>
                attempt(() =>
                  client.request({
                    _tag: "ChooseAppleApps",
                    apps: appsAfterToggle(card, app.id, value),
                    connectorId: card.id,
                  }),
                )
              }
              value={app.isChosen}
            />
          ))}
          {card.apps.length > 0 &&
            (remote ? (
              <Text style={styles.muted}>{remotePermissionNote}</Text>
            ) : (
              <Button isDisabled={busy} isPrimary={false} label="Request Apple permission" onPress={askPermission} />
            ))}
          {card.apps
            .filter((app) => app.isChosen)
            .map((app) => (
              <Text key={app.id} style={styles.muted}>
                {app.name}: {applePermissionLabelOf(app.id, app.permission ?? "NotAskedYet")}
              </Text>
            ))}
          {toolGroupsOf(card).map((group) => (
            <View key={group.heading ?? "tools"} style={{ gap: 8 }}>
              <Text style={styles.body}>{group.heading ?? "Tools"}</Text>
              {group.tools.map((tool) => (
                <View key={tool.name} style={{ gap: 3 }}>
                  <ToggleRow
                    isDisabled={busy}
                    label={tool.description}
                    onChange={(isOn) =>
                      attempt(() =>
                        client.request({ _tag: "SetConnectorTool", connectorId: card.id, isOn, tool: tool.name }),
                      )
                    }
                    value={tool.isOn}
                  />
                  <Text style={styles.muted}>
                    {toolClassLabels[tool.class]}
                    {tool.class === "Write"
                      ? " · Always allow is offered when asked; manage grants in Permissions."
                      : ""}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </>
      )}
      {installed && !isRemoving && (
        <Button
          isDisabled={busy}
          isPrimary={false}
          label={card.state === "Removing" ? "Retry removal" : "Remove"}
          onPress={() => setRemoving(true)}
        />
      )}
      {isRemoving && (
        <>
          <Text style={styles.body}>{removalWarning}</Text>
          <Button
            isDisabled={busy}
            label="Remove connector"
            onPress={() =>
              attempt(
                () => client.request({ _tag: "RemoveConnector", connectorId: card.id }),
                () => setRemoving(false),
              )
            }
          />
          <Button isDisabled={busy} isPrimary={false} label="Cancel" onPress={() => setRemoving(false)} />
        </>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

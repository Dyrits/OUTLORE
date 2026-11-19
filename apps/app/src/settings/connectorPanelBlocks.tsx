import type { ConnectorCard } from "@outlore/contracts";
import { type ReactNode, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  applePermissionLabelOf,
  appsAfterToggle,
  chosenAppsOf,
  remotePermissionNote,
  removalWarning,
  toolClassLabels,
  toolGroupsOf,
} from "../connectors";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { Button } from "../ui/button";
import { ToggleRow } from "../ui/toggleRow";
import { SettingsRule } from "./settingsParts";

/** Runs one request for a panel: the panel is busy meanwhile, and shows the refusal in its own words. */
export function useAttempt(onChanged: () => void) {
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
  return { attempt, busy, error };
}

export type Attempt = ReturnType<typeof useAttempt>["attempt"];

/** One titled block of a connector's panel, set off by a gold rule. */
export function PanelBlock({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={local.block}>
      <SettingsRule />
      <Text style={local.blockTitle}>{title}</Text>
      {children}
    </View>
  );
}

/** Installing a connector: the notice, the apps to offer, and the confirmation that installs it. */
export function InstallBlock({
  attempt,
  busy,
  card,
  client,
  isRemote,
}: {
  attempt: Attempt;
  busy: boolean;
  card: ConnectorCard;
  client: ServiceClient;
  isRemote: boolean;
}) {
  const [isInstalling, setInstalling] = useState(false);
  const [apps, setApps] = useState(() => chosenAppsOf(card));
  if (!isInstalling) return <Button label="Install" onPress={() => setInstalling(true)} />;
  return (
    <View style={local.stack}>
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
              if (card.apps.length > 0 && !isRemote) {
                await client.request({ _tag: "RequestApplePermission", connectorId: card.id });
              }
            },
            () => setInstalling(false),
          )
        }
      />
      <Button isDisabled={busy} isPrimary={false} label="Cancel" onPress={() => setInstalling(false)} />
    </View>
  );
}

/** The apps of a connector that has some (Apple apps): which are chosen, and where macOS permission stands. */
export function AppsBlock({
  attempt,
  busy,
  card,
  client,
  isRemote,
}: {
  attempt: Attempt;
  busy: boolean;
  card: ConnectorCard;
  client: ServiceClient;
  isRemote: boolean;
}) {
  return (
    <PanelBlock title="Apps">
      {card.apps.map((app) => (
        <View key={app.id} style={local.tight}>
          <ToggleRow
            isDisabled={busy}
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
          {app.isChosen && (
            <Text style={styles.muted}>{applePermissionLabelOf(app.id, app.permission ?? "NotAskedYet")}</Text>
          )}
        </View>
      ))}
      {isRemote ? (
        <Text style={styles.muted}>{remotePermissionNote}</Text>
      ) : (
        <Button
          isDisabled={busy}
          isPrimary={false}
          label="Request Apple permission"
          onPress={() => attempt(() => client.request({ _tag: "RequestApplePermission", connectorId: card.id }))}
        />
      )}
    </PanelBlock>
  );
}

/** A connector's tools, grouped by app when it has apps, each with its switch and whether it asks first. */
export function ToolsBlock({
  attempt,
  busy,
  card,
  client,
}: {
  attempt: Attempt;
  busy: boolean;
  card: ConnectorCard;
  client: ServiceClient;
}) {
  const groups = toolGroupsOf(card);
  return (
    <PanelBlock title="Tools">
      {groups.length === 0 && <Text style={styles.muted}>No tools to show yet.</Text>}
      {groups.map((group) => (
        <View key={group.heading ?? "tools"} style={local.stack}>
          {group.heading !== null && <Text style={styles.body}>{group.heading}</Text>}
          {group.tools.map((tool) => (
            <View key={tool.name} style={local.tight}>
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
                {tool.class === "Write" ? " · Always allow is offered when asked; manage grants in Permissions." : ""}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </PanelBlock>
  );
}

/** Removing a connector, behind a warning of what it forgets. */
export function RemoveBlock({
  attempt,
  busy,
  card,
  client,
}: {
  attempt: Attempt;
  busy: boolean;
  card: ConnectorCard;
  client: ServiceClient;
}) {
  const [isRemoving, setRemoving] = useState(false);
  return (
    <PanelBlock title="Danger zone">
      {isRemoving ? (
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
      ) : (
        <>
          <Text style={styles.muted}>
            Remove {card.name} and its switches from this computer. You can install it again later.
          </Text>
          <Button
            isDisabled={busy}
            isPrimary={false}
            label={card.state === "Removing" ? "Retry removal" : "Remove"}
            onPress={() => setRemoving(true)}
          />
        </>
      )}
    </PanelBlock>
  );
}

const local = StyleSheet.create({
  block: { gap: 10 },
  blockTitle: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "700" },
  stack: { gap: 8 },
  tight: { gap: 3 },
});

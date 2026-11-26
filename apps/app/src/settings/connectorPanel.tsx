import type { ConnectorCard } from "@outlore/contracts";
import { Text } from "react-native";
import { canInstallCard, connectorStateLabels, isInstalledCard, remoteOAuthNote } from "../connectors";
import type { ServiceClient } from "../foundation/client";
import { useIsRemoteHost } from "../foundation/hostContext";
import { styles } from "../foundation/styles";
import { Button } from "../ui/button";
import { ToggleRow } from "../ui/toggleRow";
import { AppsBlock, InstallBlock, PanelBlock, ToolsBlock, useAttempt } from "./connectorPanelBlocks";
import { RemoveBlock } from "./connectorRemoveBlock";
import { ConnectorSecrets } from "./connectorSecrets";
import { SettingsCard } from "./settingsParts";

/**
 * One connector's own panel in the Charter: where it stands, how it connects, where it is on, its apps and tools,
 * and its removal. A connector that is not installed shows only what it is and how to install it.
 */
export function ConnectorPanel({
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
  const isRemote = useIsRemoteHost();
  const { attempt, isBusy, error } = useAttempt(onChanged);
  const isInstalled = isInstalledCard(card);
  const isRemoving = card.state === "Removing";
  return (
    <SettingsCard icon="layers" summary={connectorStateLabels[card.state]} title={card.name}>
      <Text style={styles.muted}>{card.description}</Text>
      <PanelBlock title="Connection">
        {card.needs !== null && <Text style={styles.muted}>{card.needs}</Text>}
        {isInstalled &&
          !isRemoving &&
          card.usesOAuth === true &&
          (isRemote ? (
            <Text style={styles.muted}>{remoteOAuthNote}</Text>
          ) : (
            <Button
              isDisabled={isBusy}
              isPrimary={card.state !== "Ready"}
              label={card.state === "Ready" ? "Sign in again" : "Sign in in browser"}
              onPress={() => attempt(() => client.request({ _tag: "SignInConnector", connectorId: card.id }))}
            />
          ))}
        {isInstalled && !isRemoving && card.secretKinds.length > 0 && (
          <>
            {card.usesOAuth === true && <Text style={styles.muted}>Or connect with a key:</Text>}
            <ConnectorSecrets card={card} client={client} onChanged={onChanged} onOpenVault={onOpenVault} />
          </>
        )}
        {isInstalled && card.usesOAuth !== true && card.secretKinds.length === 0 && card.needs === null && (
          <Text style={styles.muted}>Nothing to connect.</Text>
        )}
        {canInstallCard(card) && (
          <InstallBlock attempt={attempt} card={card} client={client} isBusy={isBusy} isRemote={isRemote} />
        )}
      </PanelBlock>
      {isInstalled && !isRemoving && (
        <>
          <PanelBlock title="Availability">
            <ToggleRow
              isDisabled={isBusy}
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
            <Text style={styles.muted}>
              Quests and errands can still turn it off for themselves; see the Borderlands tab.
            </Text>
          </PanelBlock>
          {card.apps.length > 0 && (
            <AppsBlock attempt={attempt} card={card} client={client} isBusy={isBusy} isRemote={isRemote} />
          )}
          <ToolsBlock attempt={attempt} card={card} client={client} isBusy={isBusy} />
        </>
      )}
      {isInstalled && <RemoveBlock attempt={attempt} card={card} client={client} isBusy={isBusy} />}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </SettingsCard>
  );
}

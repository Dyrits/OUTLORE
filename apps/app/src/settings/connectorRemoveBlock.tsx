import type { ConnectorCard } from "@outlore/contracts";
import { useState } from "react";
import { Text } from "react-native";
import { removalWarning } from "../connectors";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { Button } from "../ui/button";
import { type Attempt, PanelBlock } from "./connectorPanelBlocks";

/** Removing a connector, behind a warning of what it forgets. */
export function RemoveBlock({
  attempt,
  isBusy,
  card,
  client,
}: {
  attempt: Attempt;
  isBusy: boolean;
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
            isDisabled={isBusy}
            label="Remove connector"
            onPress={() =>
              attempt(
                () => client.request({ _tag: "RemoveConnector", connectorId: card.id }),
                () => setRemoving(false),
              )
            }
          />
          <Button isDisabled={isBusy} isPrimary={false} label="Cancel" onPress={() => setRemoving(false)} />
        </>
      ) : (
        <>
          <Text style={styles.muted}>
            Remove {card.name} and its switches from this computer. You can install it again later.
          </Text>
          <Button
            isDisabled={isBusy}
            isPrimary={false}
            label={card.state === "Removing" ? "Retry removal" : "Remove"}
            onPress={() => setRemoving(true)}
          />
        </>
      )}
    </PanelBlock>
  );
}

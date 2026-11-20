import type { ThreadId, ThreadSummary, ThreadView } from "@outlore/contracts";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { OpenThreadForm } from "../conversation/threadTree";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { Menu } from "../ui/pickers";

/** Starts a new errand or switches the pane to an existing one. */
export function ErrandStarter({
  chrome,
  client,
  errands,
  onOpened,
  parent,
}: {
  chrome: ReactNode;
  client: ServiceClient;
  errands: ReadonlyArray<Pick<ThreadSummary, "id" | "title">>;
  onOpened: (threadId: ThreadId) => void;
  parent: ThreadView | null;
}) {
  return (
    <View style={local.pane}>
      <View style={local.header}>
        <View style={local.title}>
          {errands.length > 1 ? (
            <Menu<ThreadId | null>
              accessibilityLabel="New errand, switch errand"
              isTitle
              label={(id) => errands.find((errand) => errand.id === id)?.title ?? "New errand"}
              onChange={(id) => {
                if (id !== null) onOpened(id);
              }}
              options={errands.map((errand) => errand.id)}
              value={null}
            />
          ) : (
            <Text style={styles.label}>New errand</Text>
          )}
        </View>
        {chrome}
      </View>
      {parent !== null && (
        <View style={local.composer}>
          {parent.actions.canOpenBeneath ? (
            <OpenThreadForm client={client} onOpened={onOpened} parent={parent} />
          ) : (
            <Text style={styles.muted}>This quest cannot start an errand right now.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  composer: { marginTop: "auto" },
  header: { alignItems: "center", flexDirection: "row", gap: 4 },
  pane: { flex: 1, gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  title: { alignItems: "flex-start", flex: 1, minWidth: 0 },
});

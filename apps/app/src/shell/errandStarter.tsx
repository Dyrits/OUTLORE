import type { ThreadId, ThreadSummary, ThreadView } from "@outlore/contracts";
import { type ReactNode, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PaneTabs } from "../conversation/paneTabs";
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
  const [tab, setTab] = useState<"Missives" | "Companions">("Missives");
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
      {parent !== null &&
        (parent.actions.canOpenBeneath ? (
          <>
            <PaneTabs names={["Missives", "Companions"]} onSelect={setTab} selected={tab} />
            <OpenThreadForm
              client={client}
              companions={{
                isSelected: tab === "Companions",
                onOpen: () => setTab(tab === "Companions" ? "Missives" : "Companions"),
              }}
              onOpened={onOpened}
              parent={parent}
            />
          </>
        ) : (
          <Text style={[styles.muted, local.composer]}>This quest cannot start an errand right now.</Text>
        ))}
    </View>
  );
}

const local = StyleSheet.create({
  composer: { marginTop: "auto" },
  header: { alignItems: "center", flexDirection: "row", gap: 4 },
  pane: { flex: 1, gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  title: { alignItems: "flex-start", flex: 1, minWidth: 0 },
});

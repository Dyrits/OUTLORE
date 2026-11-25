import type { MessageId, ThreadId, ThreadSummary, ThreadView } from "@outlore/contracts";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { excerptOf } from "../conversation/comments";
import { PaneTabs } from "../conversation/paneTabs";
import { OpenThreadForm } from "../conversation/threadTree";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, fontSizes, radii } from "../foundation/theme";
import { ChipIcon } from "../ui/chips";
import { Menu } from "../ui/pickers";

/** Starts a new errand or switches the pane to an existing one. */
export function ErrandStarter({
  chrome,
  client,
  errands,
  onClearReply,
  onOpened,
  parent,
  replyTo = null,
}: {
  chrome: ReactNode;
  client: ServiceClient;
  errands: ReadonlyArray<Pick<ThreadSummary, "id" | "title" | "shownState">>;
  onClearReply?: (() => void) | undefined;
  onOpened: (threadId: ThreadId) => void;
  parent: ThreadView | null;
  replyTo?: { id: MessageId; text: string } | null;
}) {
  const [tab, setTab] = useState<"Missives" | "Companions">("Missives");
  return (
    <View style={local.pane}>
      <View style={local.header}>
        <View style={local.title}>
          <ChipIcon color={colors.textMuted} kind="errand" size={22} />
          {errands.length > 1 ? (
            <Menu<ThreadId | null>
              accessibilityLabel="New errand, switch errand"
              isTitle
              label={(id) => errands.find((errand) => errand.id === id)?.title ?? "New errand"}
              onChange={(id) => {
                if (id !== null) onOpened(id);
              }}
              options={errands.map((errand) => errand.id)}
              state={(id) => errands.find((errand) => errand.id === id)?.shownState}
              value={null}
            />
          ) : (
            <Text style={styles.paneTitle}>New errand</Text>
          )}
        </View>
        {chrome}
      </View>
      {parent !== null &&
        (parent.actions.canOpenBeneath ? (
          <>
            <PaneTabs names={["Missives", "Companions"]} onSelect={setTab} selected={tab} />
            {replyTo !== null && tab === "Missives" && (
              <View style={local.replyBanner}>
                <Text numberOfLines={2} style={local.replyQuote}>
                  Replying to “{excerptOf(replyTo.text)}”
                </Text>
                {onClearReply !== undefined && (
                  <Pressable
                    accessibilityLabel="Clear reply anchor"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={onClearReply}
                  >
                    <Text style={styles.error}>✕</Text>
                  </Pressable>
                )}
              </View>
            )}
            <OpenThreadForm
              anchorMessageId={replyTo?.id ?? null}
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
  replyBanner: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.edge,
    borderLeftColor: colors.accentText,
    borderLeftWidth: 3,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  replyQuote: { color: colors.textSecondary, flex: 1, fontSize: fontSizes.sm },
  title: { alignItems: "center", flex: 1, flexDirection: "row", gap: 6, minWidth: 0 },
});

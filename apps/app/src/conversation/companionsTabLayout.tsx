import type { ComponentProps, ReactNode } from "react";
import { View } from "react-native";
import { styles } from "../foundation/styles";
import { ConversationRunner } from "./conversationRunner";

/** The selection state and opener of a conversation's Companions tab. */
export type CompanionsTab = { isSelected: boolean; onOpen: () => void };

/** Switches between a conversation and its Companions controls while keeping the draft and feed mounted. */
export function CompanionsTabLayout({
  companions,
  composer,
  feed,
  ...runner
}: Pick<ComponentProps<typeof ConversationRunner>, "client" | "conversation" | "isChronicler" | "thread"> & {
  companions: CompanionsTab | undefined;
  composer: (accessory: ReactNode) => ReactNode;
  feed: ReactNode;
}) {
  const isSelected = companions?.isSelected === true;
  const accessory = <ConversationRunner {...runner} isTabOpen={isSelected} onOpenTab={companions?.onOpen} />;

  return (
    <>
      {isSelected && <ConversationRunner {...runner} isFullPanel />}
      <View style={isSelected ? { display: "none" } : styles.flex}>{feed}</View>
      {isSelected && (
        <View style={styles.composerAccessory}>
          <ConversationRunner {...runner} isTabOpen onOpenTab={companions.onOpen} />
        </View>
      )}
      <View style={isSelected && { display: "none" }}>{composer(accessory)}</View>
    </>
  );
}

import type { MissionState, WorkspaceId } from "@outlore/contracts";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "../foundation/styles";
import { colors, stateTones } from "../foundation/theme";
import { ChipIcon } from "../ui/chips";
import { NewQuestButton } from "../ui/questHeaderButtons";
import { chroniclerStyles as local } from "./chroniclerStyles";
import { headerIconTarget, MobileHeader } from "./mobileHeader";

/** The realm chosen for the next message, shown over the message box and cleared with its ×. */
export function RealmNote({ name, onClear }: { name: string; onClear: () => void }) {
  return (
    <View style={local.note}>
      <Text style={local.noteText}>
        The next quest opens in <Text style={local.noteName}>{name}</Text>
      </Text>
      <Pressable accessibilityLabel="Clear the realm" accessibilityRole="button" onPress={onClear}>
        <Text style={local.noteClear}>×</Text>
      </Pressable>
    </View>
  );
}

/** Narrow-window header for a realm channel or the Chronicle, with its back button and optional actions. */
export function ChannelHeader({
  actions = null,
  name,
  onBack,
}: {
  actions?: ReactNode;
  name?: string | undefined;
  onBack: () => void;
}) {
  return (
    <MobileHeader
      actions={actions}
      onBack={onBack}
      title={
        <Text numberOfLines={1} style={[styles.paneTitle, local.mobileTitle]}>
          {name}
        </Text>
      }
    />
  );
}

/** Header for the loaded Chronicle or realm-channel chat, switching between the narrow top bar and wide pane header. */
export function ChroniclerHeader({
  canResume,
  channel,
  chrome,
  mark,
  onBack,
  onNewQuest,
  onResume,
}: {
  canResume: boolean;
  channel?: { id: WorkspaceId | null; name: string } | undefined;
  chrome: ReactNode;
  mark: MissionState | null;
  onBack?: (() => void) | undefined;
  onNewQuest: () => void;
  onResume: () => void;
}) {
  if (onBack !== undefined) {
    return (
      <ChannelHeader
        actions={
          <>
            {channel !== undefined && (
              // A new quest starts empty in this realm, or in the Borderlands, and opens at once.
              <NewQuestButton onPress={onNewQuest} style={headerIconTarget} />
            )}
            {canResume && (
              <Pressable accessibilityRole="button" onPress={onResume}>
                <Text style={local.link}>Resume</Text>
              </Pressable>
            )}
          </>
        }
        name={channel?.name}
        onBack={onBack}
      />
    );
  }
  return (
    <View style={styles.header}>
      <View style={{ alignItems: "center", height: 26, justifyContent: "center", width: 26 }}>
        <ChipIcon
          color={mark === null ? colors.textMuted : stateTones[mark].color}
          kind={channel?.id === null ? "borderlands" : "realm"}
          size={22}
        />
      </View>
      <Text numberOfLines={1} style={[styles.paneTitle, styles.flex]}>
        {channel?.name ?? "Chronicle"}
      </Text>
      {chrome}
      {canResume && (
        <Pressable onPress={onResume}>
          <Text style={local.link}>Resume</Text>
        </Pressable>
      )}
    </View>
  );
}

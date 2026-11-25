import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "../foundation/styles";
import { chroniclerStyles as local } from "./chroniclerStyles";
import { MobileHeader } from "./mobileHeader";

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

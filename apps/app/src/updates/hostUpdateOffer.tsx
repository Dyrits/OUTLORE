import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { forceUpdateQuestionOf, hostUpdateQuestion, hostUpdateTextOf } from "../foundation/hostUpdate";
import { colors, fontSizes, fonts, outline, radii } from "../foundation/theme";
import { useHostUpdate } from "../foundation/useHostUpdate";

/**
 * What a device offers when the host runs an older release (app-updates, Updating a host from a paired device):
 * **Update host**, asked about first, then the host's progress. A host newer than the device says nothing here, because
 * the device updates itself, and a host from before this feature says it must be updated by hand once.
 */
export function HostUpdateOffer({
  onUpdated,
  openLink,
}: {
  onUpdated: () => void;
  openLink: () => Promise<ServiceClient>;
}) {
  const { canForce, canStart, force, start, state } = useHostUpdate({ isActive: true, onUpdated, openLink });
  const [isAsking, setIsAsking] = useState(false);
  const [isForcing, setIsForcing] = useState(false);
  const runningCount =
    state._tag === "Updating" && state.update?.status._tag === "WaitingForTurns" ? state.update.status.runningCount : 0;
  const text = hostUpdateTextOf(state);
  return (
    <>
      {text !== null && (
        <Text accessibilityRole="alert" style={local.text}>
          {text}
        </Text>
      )}
      {canStart && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setIsAsking(true)}
          style={({ pressed }) => [local.notice, pressed && local.pressed]}
        >
          <Text style={local.noticeText}>{state._tag === "Offered" ? "Update host" : "Try again"}</Text>
        </Pressable>
      )}
      {canForce && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setIsForcing(true)}
          style={({ pressed }) => [local.notice, pressed && local.pressed]}
        >
          <Text style={local.noticeText}>Force update</Text>
        </Pressable>
      )}
      {isForcing && (
        <Modal animationType="fade" onRequestClose={() => setIsForcing(false)} transparent visible>
          <View style={local.backdrop}>
            <Pressable
              accessibilityLabel="Cancel"
              onPress={() => setIsForcing(false)}
              style={StyleSheet.absoluteFill}
            />
            <View accessibilityRole="alert" style={local.menu}>
              <Text style={local.title}>Force the update?</Text>
              <Text style={local.body}>{forceUpdateQuestionOf(runningCount)}</Text>
              <View style={local.footer}>
                <Pressable accessibilityRole="button" onPress={() => setIsForcing(false)} style={local.button}>
                  <Text style={local.buttonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setIsForcing(false);
                    force();
                  }}
                  style={local.done}
                >
                  <Text style={local.doneText}>Force update</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
      {isAsking && (
        <Modal animationType="fade" onRequestClose={() => setIsAsking(false)} transparent visible>
          <View style={local.backdrop}>
            <Pressable accessibilityLabel="Later" onPress={() => setIsAsking(false)} style={StyleSheet.absoluteFill} />
            <View accessibilityRole="alert" style={local.menu}>
              <Text style={local.title}>Update the host?</Text>
              <Text style={local.body}>{hostUpdateQuestion}</Text>
              <View style={local.footer}>
                <Pressable accessibilityRole="button" onPress={() => setIsAsking(false)} style={local.button}>
                  <Text style={local.buttonText}>Later</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setIsAsking(false);
                    start();
                  }}
                  style={local.done}
                >
                  <Text style={local.doneText}>Update host</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const local = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(5,10,18,0.7)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  body: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.base, lineHeight: 20 },
  button: {
    ...outline,
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  buttonText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  done: { backgroundColor: colors.accent, borderRadius: radii.sm, paddingHorizontal: 18, paddingVertical: 8 },
  doneText: { color: colors.onAccent, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "700" },
  footer: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" },
  menu: {
    ...outline,
    backgroundColor: colors.page,
    borderRadius: radii.xl,
    gap: 12,
    maxWidth: 520,
    padding: 20,
    width: "100%",
  },
  notice: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  noticeText: { color: colors.accentText, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "600" },
  pressed: { opacity: 0.7 },
  text: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.xl, fontWeight: "700" },
});

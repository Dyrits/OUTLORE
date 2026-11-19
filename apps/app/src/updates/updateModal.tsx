import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { messageOf } from "../foundation/client";
import { colors, fontSizes, fonts, outline, radii } from "../foundation/theme";
import type { AppUpdatesBridge, UpdateStatus } from "../foundation/updateState";
import {
  androidInstallWarningOf,
  downloadSizeOf,
  installAllowanceText,
  restartWarningOf,
} from "../foundation/updateText";

/** An update the owner is asked about: one that is downloaded, or, on the phone's mobile data, one that waits. */
export type UpdateQuestion = Extract<UpdateStatus, { _tag: "Available" | "Ready" }>;

/**
 * The question before an update installs: the release's notes as written, what the install costs, and **Restart and
 * update** (desktop) or **Install update** (phone) or **Later**. Nothing installs without this answer (app-updates,
 * Download in the background). On the phone a release found on mobile data is asked about first: **Download anyway**.
 */
export function UpdateModal({
  bridge,
  onClose,
  update,
}: {
  bridge: AppUpdatesBridge;
  onClose: () => void;
  update: UpdateQuestion;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  // On the phone Android must first be allowed, once, to install an update of this app.
  const [isAskingAllowance, setIsAskingAllowance] = useState(false);
  const [hasOpenedSettings, setHasOpenedSettings] = useState(false);
  const { notes, version } = update;
  const fail = (reason: unknown) => {
    setError(messageOf(reason));
    setIsBusy(false);
  };
  const act = (request: () => Promise<unknown>, after?: () => void) => {
    setIsBusy(true);
    setError(null);
    request().then(() => {
      after?.();
      setIsBusy(false);
    }, fail);
  };
  const android = bridge.platform === "android" ? bridge : null;
  const install = () => {
    if (android === null) {
      // The desktop app quits once the install starts, so the button stays busy.
      setIsBusy(true);
      return void bridge.install().then(() => setError(null), fail);
    }
    act(async () => {
      if (!(await android.canInstall())) return setIsAskingAllowance(true);
      await android.install();
    });
  };
  const content = (() => {
    if (android !== null && update._tag === "Available")
      return {
        action: () => act(() => android.download(), onClose),
        actionLabel: "Download anyway",
        body: `You are on mobile data, so Outlore has not downloaded this update. It is ${downloadSizeOf(update.sizeBytes)}.`,
        busyLabel: "Downloading…",
        title: `Download ${version}?`,
      };
    if (android !== null)
      return {
        action: install,
        actionLabel: "Install update",
        body: androidInstallWarningOf(version),
        busyLabel: "Opening Android…",
        title: `Install ${version}?`,
      };
    return {
      action: install,
      actionLabel: "Restart and update",
      body: restartWarningOf(version),
      busyLabel: "Restarting…",
      title: `Update to ${version}?`,
    };
  })();
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={local.backdrop}>
        <Pressable accessibilityLabel="Later" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View accessibilityRole="alert" style={local.menu}>
          <Text style={local.title}>{isAskingAllowance ? "Allow Outlore to install updates" : content.title}</Text>
          {!isAskingAllowance && (
            <>
              <Text style={local.heading}>What's new</Text>
              <ScrollView style={local.notes}>
                <Text selectable style={local.notesText}>
                  {notes === "" ? "This release has no notes." : notes}
                </Text>
              </ScrollView>
            </>
          )}
          <Text style={local.body}>{isAskingAllowance ? installAllowanceText : content.body}</Text>
          {error !== null && <Text style={local.error}>{error}</Text>}
          <View style={local.footer}>
            {isAskingAllowance ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  disabled={isBusy}
                  onPress={() => android !== null && act(() => android.openReleasePage(update.pageUrl))}
                  style={local.button}
                >
                  <Text style={local.buttonText}>Open the release page</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isBusy}
                  onPress={() =>
                    android !== null &&
                    act(
                      () => android.allowInstalling(),
                      () => setHasOpenedSettings(true),
                    )
                  }
                  style={[local.done, isBusy && local.doneOff]}
                >
                  <Text style={local.doneText}>Open Android's setting</Text>
                </Pressable>
                {hasOpenedSettings && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isBusy}
                    onPress={install}
                    style={[local.done, isBusy && local.doneOff]}
                  >
                    <Text style={local.doneText}>Install update</Text>
                  </Pressable>
                )}
              </>
            ) : (
              <>
                <Pressable accessibilityRole="button" disabled={isBusy} onPress={onClose} style={local.button}>
                  <Text style={local.buttonText}>Later</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isBusy}
                  onPress={content.action}
                  style={[local.done, isBusy && local.doneOff]}
                >
                  <Text style={local.doneText}>{isBusy ? content.busyLabel : content.actionLabel}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
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
  doneOff: { opacity: 0.4 },
  doneText: { color: colors.onAccent, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "700" },
  error: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.md },
  footer: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" },
  heading: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "700" },
  menu: {
    ...outline,
    backgroundColor: colors.page,
    borderRadius: radii.xl,
    gap: 12,
    maxWidth: 520,
    padding: 20,
    width: "100%",
  },
  notes: { ...outline, backgroundColor: colors.canvas, borderRadius: radii.md, maxHeight: 240, padding: 10 },
  notesText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, lineHeight: 19 },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.xl, fontWeight: "700" },
});

import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { messageOf } from "../foundation/client";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useAppUpdates } from "../foundation/useAppUpdates";
import { UpdateModal } from "./updateModal";

/**
 * A quiet notice in the top bar once a newer release has downloaded, or on the phone's mobile data once one is found:
 * pressing it opens the question that installs (or downloads) it. Later closes the question and hides the notice until
 * the next release; the Workshop's Updates section keeps the way to install.
 */
export function UpdateNotice({ hasReleaseMismatch = false }: { hasReleaseMismatch?: boolean }) {
  const updates = useAppUpdates();
  const [isAsking, setIsAsking] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = updates?.state?.status;
  if (hasReleaseMismatch && updates?.bridge.platform === "android" && status?._tag === "Failed") {
    const pageUrl = status.pageUrl;
    return (
      <>
        <Text style={local.error}>{error ?? status.message}</Text>
        {pageUrl !== null && (
          <Pressable
            accessibilityRole="button"
            onPress={() => void updates.bridge.openReleasePage(pageUrl).catch((reason) => setError(messageOf(reason)))}
            style={local.notice}
          >
            <Text style={local.text}>Open the release page</Text>
          </Pressable>
        )}
      </>
    );
  }
  if (
    updates === null ||
    status === undefined ||
    (status._tag !== "Ready" && status._tag !== "Available") ||
    (status._tag === "Available" && updates.state?.isEnabled !== true) ||
    (!hasReleaseMismatch && dismissed === status.version) ||
    (hasReleaseMismatch && updates.bridge.platform !== "android")
  )
    return null;
  return (
    <>
      <Pressable
        accessibilityLabel={`Outlore ${status.version} is ${status._tag === "Ready" ? "ready to install" : "available"}`}
        accessibilityRole="button"
        onPress={() => setIsAsking(true)}
        style={({ pressed }) => [local.notice, pressed && local.pressed]}
      >
        <Text style={local.text}>
          {hasReleaseMismatch ? "Update this app" : status._tag === "Ready" ? "Update ready" : "Update available"}
          {/* The phone's top bar is narrow: the version is in the question the notice opens. */}
          {updates.bridge.platform === "android" ? "" : ` · ${status.version}`}
        </Text>
      </Pressable>
      {isAsking && (
        <UpdateModal
          bridge={updates.bridge}
          onClose={() => {
            setIsAsking(false);
            setDismissed(status.version);
          }}
          update={status}
        />
      )}
    </>
  );
}

const local = StyleSheet.create({
  error: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  notice: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pressed: { opacity: 0.7 },
  text: { color: colors.accentText, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "600" },
});

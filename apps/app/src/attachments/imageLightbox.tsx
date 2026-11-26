import { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { colors, fontSizes, fonts, outline, radii } from "../foundation/theme";
import { type LightboxImage, lightboxBoundsOf, lightboxIndexAfter, lightboxKeyActionOf } from "./imageLightboxLogic";
import { loadSentImage, type SentImage, sentImages } from "./sentImage";

/**
 * A modal panel that shows an attached image at full size, with keyboard and button navigation when the message carries
 * more than one image.
 */
export function ImageLightbox({
  client = null,
  initialIndex,
  items,
  onClose,
}: {
  client?: ServiceClient | null;
  initialIndex: number;
  items: ReadonlyArray<LightboxImage>;
  onClose: () => void;
}) {
  const { height, width } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const safeIndex = Math.max(0, Math.min(items.length - 1, index));
  const current = items[safeIndex] ?? null;
  const [loaded, setLoaded] = useState<SentImage | null>(() => {
    if (current === null) return null;
    if (current.kind === "preview") return { status: "ready", uri: current.uri };
    const cached = sentImages.peek(current.attachmentId);
    return cached === null ? null : { status: "ready", uri: cached };
  });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new attempt is the retry the owner asked for.
  useEffect(() => {
    if (current === null) return;
    if (current.kind === "preview") {
      setLoaded({ status: "ready", uri: current.uri });
      return;
    }
    const cached = sentImages.peek(current.attachmentId);
    if (cached !== null) {
      setLoaded({ status: "ready", uri: cached });
      return;
    }
    if (client === null) {
      setLoaded({ message: "Image is unavailable.", status: "failed" });
      return;
    }
    let isCurrent = true;
    setLoaded(null);
    loadSentImage(sentImages, current.attachmentId, () =>
      client.request({ _tag: "ReadAttachment", attachmentId: current.attachmentId }),
    ).then((result) => isCurrent && setLoaded(result));
    return () => {
      isCurrent = false;
    };
  }, [attempt, client, current]);

  const count = items.length;
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const action = lightboxKeyActionOf(event.key);
      if (action === null) return;
      event.preventDefault();
      if (action === "close") onClose();
      else if (count > 1) setIndex((position) => lightboxIndexAfter(position, count, action));
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [count, onClose]);

  const source = useMemo(() => (loaded?.status === "ready" ? { uri: loaded.uri } : null), [loaded]);
  if (current === null) return null;
  const bounds = lightboxBoundsOf(width, height);
  const canGoPrevious = safeIndex > 0;
  const canGoNext = safeIndex < count - 1;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={local.backdrop}>
        <Pressable accessibilityLabel="Close image preview" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View
          accessibilityViewIsModal
          style={[local.panel, { maxHeight: bounds.panelMaxHeight, maxWidth: bounds.panelMaxWidth }]}
        >
          <View style={local.header}>
            <Text numberOfLines={1} style={local.title}>
              {current.name}
            </Text>
            <View style={local.headerActions}>
              {count > 1 && (
                <Text style={local.counter}>
                  {safeIndex + 1} / {count}
                </Text>
              )}
              <Pressable
                accessibilityLabel="Close image preview"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [local.closeButton, pressed && local.buttonPressed]}
              >
                <Text style={local.closeMark}>×</Text>
              </Pressable>
            </View>
          </View>
          <View style={local.stage}>
            {source !== null ? (
              <Image
                accessibilityLabel={current.name}
                resizeMode="contain"
                source={source}
                style={{ height: bounds.imageHeight, width: bounds.imageWidth }}
              />
            ) : loaded?.status === "failed" ? (
              <View style={local.messageBox}>
                <Text accessibilityRole="alert" style={local.failureText}>
                  {loaded.message}
                </Text>
                <Pressable
                  accessibilityLabel={`Retry loading ${current.name}`}
                  accessibilityRole="button"
                  onPress={() => setAttempt((value) => value + 1)}
                >
                  <Text style={local.retry}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={local.loading}>Loading image…</Text>
            )}
          </View>
          {count > 1 && (
            <View style={local.footer}>
              <Pressable
                accessibilityLabel="Previous image"
                accessibilityRole="button"
                disabled={!canGoPrevious}
                onPress={() => setIndex((position) => lightboxIndexAfter(position, count, "previous"))}
                style={({ pressed }) => [
                  local.navButton,
                  !canGoPrevious && local.navDisabled,
                  pressed && canGoPrevious && local.buttonPressed,
                ]}
              >
                <Text style={local.navText}>‹ Previous</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Next image"
                accessibilityRole="button"
                disabled={!canGoNext}
                onPress={() => setIndex((position) => lightboxIndexAfter(position, count, "next"))}
                style={({ pressed }) => [
                  local.navButton,
                  !canGoNext && local.navDisabled,
                  pressed && canGoNext && local.buttonPressed,
                ]}
              >
                <Text style={local.navText}>Next ›</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const local = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(5,10,18,0.82)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  buttonPressed: { opacity: 0.75 },
  closeButton: {
    alignItems: "center",
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  closeMark: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, lineHeight: 20 },
  counter: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  failureText: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.base, textAlign: "center" },
  footer: {
    alignItems: "center",
    borderColor: colors.edge,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: colors.edge,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerActions: { alignItems: "center", flexDirection: "row", gap: 10 },
  loading: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.base },
  messageBox: { alignItems: "center", gap: 8, padding: 24 },
  navButton: {
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  navDisabled: { opacity: 0.4 },
  navText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "600" },
  panel: {
    ...outline,
    backgroundColor: colors.page,
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  retry: {
    color: colors.accentText,
    fontFamily: fonts.sans,
    fontSize: fontSizes.base,
    textDecorationLine: "underline",
  },
  stage: { alignItems: "center", justifyContent: "center", minHeight: 160, padding: 16 },
  title: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
});

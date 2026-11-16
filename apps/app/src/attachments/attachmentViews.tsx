import type { AttachmentCard } from "@outlore/contracts";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { imageCache } from "./imageCache";
import { loadSentImage, type SentImage } from "./sentImage";
import type { AttachedFile } from "./useAttachments";

// How attached images show (message-attachments): thumbnails above the message box with a × to remove them, and on the messages sent.

const thumbnail = 56;

/** The images of the message being written, each with a × to take it out before sending; one still being checked or uploaded shows a plain tile. */
export function AttachmentStrip({
  files,
  onRemove,
}: {
  files: ReadonlyArray<AttachedFile>;
  onRemove: (key: string) => void;
}) {
  if (files.length === 0) return null;
  return (
    <View style={local.strip}>
      {files.map((file) => (
        <View key={file.key} style={local.tile}>
          {file.previewUrl === null ? (
            <Text numberOfLines={2} style={local.tileName}>
              {file.name}
            </Text>
          ) : (
            <Image
              accessibilityLabel={file.name}
              resizeMode="cover"
              source={{ uri: file.previewUrl }}
              style={local.image}
            />
          )}
          {file.card === null && file.previewUrl !== null && <View style={local.uploading} />}
          <Pressable
            accessibilityLabel={`Remove ${file.name}`}
            accessibilityRole="button"
            onPress={() => onRemove(file.key)}
            style={local.remove}
          >
            <Text style={local.removeMark}>×</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/** The images already fetched, so a refresh or a scroll does not fetch a sent image again; bounded, as each one is held as base64. */
const fetched = imageCache(64 * 1024 * 1024);

function SentImageTile({ card, client }: { card: AttachmentCard; client: ServiceClient }) {
  const [image, setImage] = useState<SentImage | null>(null);
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new attempt is the retry the owner asked for.
  useEffect(() => {
    let isCurrent = true;
    setImage(null);
    loadSentImage(fetched, card.id, () => client.request({ _tag: "ReadAttachment", attachmentId: card.id })).then(
      (loaded) => isCurrent && setImage(loaded),
    );
    return () => {
      isCurrent = false;
    };
  }, [client, card, attempt]);
  return (
    <View style={local.sent}>
      {image?.status === "ready" ? (
        <Image accessibilityLabel={card.name} resizeMode="cover" source={{ uri: image.uri }} style={local.sentImage} />
      ) : (
        <Text numberOfLines={2} style={local.tileName}>
          {card.name}
        </Text>
      )}
      {image?.status === "failed" && (
        <View style={local.failure}>
          <Text accessibilityRole="alert" numberOfLines={3} style={local.failureText}>
            {image.message}
          </Text>
          <Pressable
            accessibilityLabel={`Retry loading ${card.name}`}
            accessibilityRole="button"
            onPress={() => setAttempt((current) => current + 1)}
          >
            <Text style={local.retry}>Retry</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** The images a sent message carries, as thumbnails under its text. */
export function MessageImages({ cards, client }: { cards: ReadonlyArray<AttachmentCard>; client: ServiceClient }) {
  if (cards.length === 0) return null;
  return (
    <View style={local.strip}>
      {cards.map((card) => (
        <SentImageTile card={card} client={client} key={card.id} />
      ))}
    </View>
  );
}

const local = StyleSheet.create({
  failure: { gap: 2, padding: 4 },
  failureText: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  image: { borderRadius: radii.md, height: thumbnail, width: thumbnail },
  remove: {
    alignItems: "center",
    backgroundColor: colors.sidebar,
    borderRadius: radii.pill,
    height: 18,
    justifyContent: "center",
    position: "absolute",
    right: -5,
    top: -5,
    width: 18,
  },
  removeMark: { color: colors.onGround, fontFamily: fonts.sans, fontSize: 13, lineHeight: 16 },
  retry: { color: colors.textDim, fontFamily: fonts.sans, fontSize: fontSizes.sm, textDecorationLine: "underline" },
  sent: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    height: 96,
    justifyContent: "center",
    overflow: "hidden",
    width: 96,
  },
  sentImage: { height: 96, width: 96 },
  strip: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 6 },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    height: thumbnail,
    justifyContent: "center",
    width: thumbnail,
  },
  tileName: { color: colors.textDim, fontFamily: fonts.sans, fontSize: fontSizes.sm, padding: 4 },
  uploading: { backgroundColor: colors.canvas, borderRadius: radii.md, inset: 0, opacity: 0.5, position: "absolute" },
});

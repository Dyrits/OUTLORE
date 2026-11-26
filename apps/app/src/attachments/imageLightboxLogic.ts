import type { AttachmentId } from "@outlore/contracts";

/** One image shown in the lightbox panel: either a sent attachment read through the cache or a local draft preview. */
export type LightboxImage =
  | { readonly attachmentId: AttachmentId; readonly kind: "sent"; readonly name: string }
  | { readonly key: string; readonly kind: "preview"; readonly name: string; readonly uri: string };

/** The keyboard actions the lightbox panel handles. */
export type LightboxKeyAction = "close" | "next" | "previous";

const keyActions: Record<string, LightboxKeyAction> = {
  ArrowLeft: "previous",
  ArrowRight: "next",
  Escape: "close",
};

/** Maps a keyboard event key to the lightbox action it triggers, or null when the key does nothing. */
export const lightboxKeyActionOf = (key: string): LightboxKeyAction | null =>
  Object.hasOwn(keyActions, key) ? (keyActions[key] ?? null) : null;

/** Steps the lightbox index forward or backward within the list of images without going out of bounds. */
export const lightboxIndexAfter = (current: number, count: number, direction: "next" | "previous"): number => {
  if (count <= 0) return 0;
  const delta = direction === "next" ? 1 : -1;
  return Math.max(0, Math.min(count - 1, current + delta));
};

/** Computes the bounded panel and image dimensions for the lightbox inside the current window. */
export const lightboxBoundsOf = (windowWidth: number, windowHeight: number) => {
  const panelMaxWidth = Math.max(240, Math.min(windowWidth - 40, 1200));
  const panelMaxHeight = Math.max(240, windowHeight - 40);
  const imageWidth = Math.max(200, panelMaxWidth - 32);
  const imageHeight = Math.max(160, panelMaxHeight - 116);
  return { imageHeight, imageWidth, panelMaxHeight, panelMaxWidth };
};

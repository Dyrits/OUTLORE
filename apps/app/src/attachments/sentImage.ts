import { messageOf } from "../foundation/client";
import { imageCache } from "./imageCache";

/** A sent image as the message shows it: the picture once read, or why it could not be read. */
export type SentImage = { status: "ready"; uri: string } | { message: string; status: "failed" };

/** The images already held, so a refresh or a scroll does not fetch a sent image again; bounded, as each one is held as base64. */
export const sentImages = imageCache(64 * 1024 * 1024);

/** An image's data as the address an image source takes. */
export const dataAddressOf = (mediaType: string, data: string) => `data:${mediaType};base64,${data}`;

/** Reads the image `id` through `cache` with `read`, giving its data address or the failure's words; the cache forgets a failure, so asking again reads again. */
export const loadSentImage = (
  cache: ReturnType<typeof imageCache>,
  id: string,
  read: () => Promise<{ data: string; mediaType: string }>,
): Promise<SentImage> =>
  cache
    .load(id, () => read().then((content) => dataAddressOf(content.mediaType, content.data)))
    .then(
      (uri): SentImage => ({ status: "ready", uri }),
      (reason): SentImage => ({ message: messageOf(reason), status: "failed" }),
    );

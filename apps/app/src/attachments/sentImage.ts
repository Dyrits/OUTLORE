import { messageOf } from "../foundation/client";
import type { imageCache } from "./imageCache";

/** A sent image as the message shows it: the picture once read, or why it could not be read. */
export type SentImage = { status: "ready"; uri: string } | { message: string; status: "failed" };

/** Reads the image `id` through `cache` with `read`, giving its data address or the failure's words; the cache forgets a failure, so asking again reads again. */
export const loadSentImage = (
  cache: ReturnType<typeof imageCache>,
  id: string,
  read: () => Promise<{ data: string; mediaType: string }>,
): Promise<SentImage> =>
  cache
    .load(id, () => read().then((content) => `data:${content.mediaType};base64,${content.data}`))
    .then(
      (uri): SentImage => ({ status: "ready", uri }),
      (reason): SentImage => ({ message: messageOf(reason), status: "failed" }),
    );

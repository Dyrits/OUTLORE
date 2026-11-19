import type { ThreadId } from "@outlore/contracts";
import { messageOf, type ServiceClient } from "../foundation/client";

/** Archives the errand and returns the error text its row should show, if any. */
export const archiveErrand = (client: Pick<ServiceClient, "request">, threadId: ThreadId) =>
  client.request({ _tag: "ArchiveThread", threadId }).then(() => null, messageOf);

import type { ThreadId } from "@outlore/contracts";
import { useEffect } from "react";
import type { ServiceClient } from "../foundation/client";

/** Marks the visible conversations read, again whenever the surface's conversation data changes. */
export function useShownThreadsRead(
  client: ServiceClient,
  threadIds: ReadonlyArray<ThreadId> | ReadonlySet<ThreadId>,
  isVisible: boolean,
  revision: unknown = null,
) {
  const shown = [...threadIds].join("\0");
  // biome-ignore lint/correctness/useExhaustiveDependencies: shown tracks the set; revision tracks updates within it.
  useEffect(() => {
    if (!isVisible) return;
    for (const id of threadIds) client.request({ _tag: "MarkThreadRead", threadId: id }).catch(() => {});
  }, [client, isVisible, shown, revision]);
}

import { type ReactElement, useEffect, useRef, useState } from "react";
import type { FlatList } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { type Entry, newestFirstOf } from "./entries";

/** The reply a thread is writing, while the service streams it. */
export function useDraft(client: ServiceClient, threadId: string | null) {
  const [draft, setDraft] = useState("");
  useEffect(() => {
    setDraft("");
    const unsubscribe = client.subscribeDrafts((id, text) => {
      if (id === threadId) setDraft(text);
    });
    return () => {
      unsubscribe();
    };
  }, [client, threadId]);
  return draft;
}

/** Opens the feed at its newest entry and lets the composer return there after a send. */
export function useFollowNewest(entries: ReadonlyArray<Entry>) {
  const list = useRef<FlatList<Entry>>(null);
  return {
    follow: () => list.current?.scrollToOffset({ animated: false, offset: 0 }),
    listPropsOf: (footer: ReactElement) => ({
      data: newestFirstOf(entries),
      inverted: true,
      // An inverted list draws its header below the newest entry.
      ListHeaderComponent: footer,
      ref: list,
    }),
  };
}

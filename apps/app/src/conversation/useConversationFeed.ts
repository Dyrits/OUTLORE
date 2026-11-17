import { useEffect, useRef, useState } from "react";
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

/**
 * Draws the feed inverted, so it opens on its newest entry at the bottom of the view and a reply or a question
 * lands there as it arrives. Reading up keeps the place the owner is at; sending brings the owner back down.
 * The feed no longer scrolls to its end after each content measurement.
 */
export function useFollowNewest(entries: ReadonlyArray<Entry>) {
  const list = useRef<FlatList<Entry>>(null);
  return {
    follow: () => list.current?.scrollToOffset({ animated: false, offset: 0 }),
    listProps: { data: newestFirstOf(entries), inverted: true, ref: list },
  };
}

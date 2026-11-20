import { type ReactElement, useEffect, useRef, useState } from "react";
import type { FlatList } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { type ChronicleTarget, targetIndexOf } from "./chronicleTarget";
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
export function useFollowNewest(entries: ReadonlyArray<Entry>, target: ChronicleTarget | null = null) {
  const list = useRef<FlatList<Entry>>(null);
  const handled = useRef<ChronicleTarget | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempts = useRef(0);
  const index = target === null ? -1 : targetIndexOf(entries, target);
  useEffect(() => {
    attempts.current = 0;
    if (target === null || handled.current === target || index < 0) return;
    retry.current = setTimeout(() => {
      if (list.current === null) return;
      handled.current = target;
      list.current.scrollToIndex({ animated: false, index, viewPosition: 0.5 });
    }, 100);
    return () => {
      if (retry.current !== null) clearTimeout(retry.current);
      retry.current = null;
    };
  }, [target, index]);
  return {
    follow: () => list.current?.scrollToOffset({ animated: false, offset: 0 }),
    listPropsOf: (footer: ReactElement) => ({
      data: newestFirstOf(entries),
      inverted: true,
      // An inverted list draws its header below the newest entry.
      ListHeaderComponent: footer,
      onScrollToIndexFailed: (info: { index: number; averageItemLength: number }) => {
        if (attempts.current >= 3 || list.current === null) return;
        attempts.current += 1;
        list.current.scrollToOffset({ animated: false, offset: info.averageItemLength * info.index });
        retry.current = setTimeout(
          () => list.current?.scrollToIndex({ animated: false, index: info.index, viewPosition: 0.5 }),
          100,
        );
      },
      ref: list,
    }),
  };
}

import { useEffect, useRef, useState } from "react";
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import type { ServiceClient } from "../foundation/client";
import type { Entry } from "./entries";

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
 * Keeps the newest entry in view, so a reply or a question is seen as it arrives,
 * unless the owner has scrolled up to read earlier entries. Sending follows again.
 */
export function useFollowNewest() {
  const list = useRef<FlatList<Entry>>(null);
  const isAtEnd = useRef(true);
  return {
    follow: () => {
      isAtEnd.current = true;
    },
    listProps: {
      onContentSizeChange: (_width: number, height: number) => {
        // scrollToEnd relies on item measurements the list may not have yet; the content height is known here.
        if (isAtEnd.current) list.current?.scrollToOffset({ animated: false, offset: height });
      },
      onScroll: ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
        isAtEnd.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;
      },
      ref: list,
      scrollEventThrottle: 100,
    },
  };
}

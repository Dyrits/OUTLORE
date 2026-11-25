import type { Request, ResultOf } from "@outlore/contracts";
import { useEffect, useState } from "react";
import { messageOf, type ServiceClient } from "./client";

type QueryEntry = {
  data: unknown | null;
  error: string | null;
  isLoading: boolean;
  listeners: Set<() => void>;
  needsRefresh: boolean;
  request: Request;
  serialized: string | null;
  unsubscribe: (() => void) | null;
};

const queryCaches = new WeakMap<ServiceClient, Map<string, QueryEntry>>();

const cacheFor = (client: ServiceClient) => {
  let cache = queryCaches.get(client);
  if (cache === undefined) {
    cache = new Map();
    queryCaches.set(client, cache);
  }
  return cache;
};

const serializedOf = (value: unknown): string | null => {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

const notify = (entry: QueryEntry) => {
  for (const listener of entry.listeners) listener();
};

const loadEntry = async (client: ServiceClient, entry: QueryEntry) => {
  if (entry.isLoading) {
    entry.needsRefresh = true;
    return;
  }
  entry.isLoading = true;
  do {
    entry.needsRefresh = false;
    try {
      const value = await client.request(entry.request);
      const nextSerialized = serializedOf(value);
      // Keep the previous object identity when the payload is unchanged so unaffected panels skip re-rendering.
      if (nextSerialized === null || entry.serialized !== nextSerialized || entry.error !== null) {
        entry.data = value;
        entry.serialized = nextSerialized;
        entry.error = null;
        notify(entry);
      }
    } catch (reason) {
      const nextError = messageOf(reason);
      if (entry.error !== nextError) {
        entry.error = nextError;
        notify(entry);
      }
    }
  } while (entry.listeners.size > 0 && entry.needsRefresh);
  entry.isLoading = false;
};

const entryFor = (client: ServiceClient, request: Request, key: string): QueryEntry => {
  const cache = cacheFor(client);
  let entry = cache.get(key);
  if (entry === undefined) {
    entry = {
      data: null,
      error: null,
      isLoading: false,
      listeners: new Set(),
      needsRefresh: false,
      request,
      serialized: null,
      unsubscribe: null,
    };
    cache.set(key, entry);
  } else {
    entry.request = request;
  }
  return entry;
};

/** Stops the shared subscription once no hook listens, after the commit's cleanups and remounts (Strict Mode's) have settled. */
const releaseWhenUnused = (entry: QueryEntry) => {
  queueMicrotask(() => {
    if (entry.listeners.size > 0 || entry.unsubscribe === null) return;
    entry.unsubscribe();
    entry.unsubscribe = null;
  });
};

const noSnapshot = { data: null, error: null };

/**
 * Runs a query now and again after every committed change, sharing one subscription and retaining unchanged results per client and key.
 * A null request reads nothing and shows no data, for a panel with nothing to ask yet.
 */
export function useServiceQuery<R extends Request>(client: ServiceClient, request: R | null, key: string) {
  const [snapshot, setSnapshot] = useState<{ data: ResultOf<R["_tag"]> | null; error: string | null }>(() => {
    const cached = request === null ? undefined : queryCaches.get(client)?.get(key);
    return {
      data: (cached?.data ?? null) as ResultOf<R["_tag"]> | null,
      error: cached?.error ?? null,
    };
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: the key identifies the request.
  useEffect(() => {
    if (request === null) {
      setSnapshot((previous) => (previous.data === null && previous.error === null ? previous : noSnapshot));
      return;
    }
    const current = entryFor(client, request, key);
    const sync = () => {
      const nextData = current.data as ResultOf<R["_tag"]> | null;
      const nextError = current.error;
      setSnapshot((previous) =>
        previous.data === nextData && previous.error === nextError ? previous : { data: nextData, error: nextError },
      );
    };
    sync();
    current.listeners.add(sync);
    if (current.unsubscribe === null) {
      current.unsubscribe = client.subscribe(() => {
        void loadEntry(client, current);
      });
      void loadEntry(client, current);
    } else if (current.data === null && !current.isLoading) {
      void loadEntry(client, current);
    }
    return () => {
      current.listeners.delete(sync);
      if (current.listeners.size === 0) releaseWhenUnused(current);
    };
  }, [client, key, request === null]);

  return snapshot;
}

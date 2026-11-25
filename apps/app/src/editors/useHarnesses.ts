import type { HarnessList } from "@outlore/contracts";
import { useCallback, useEffect, useState } from "react";
import { messageOf, type ServiceClient } from "../foundation/client";

/** What every screen of one host connection shows of the harnesses: one list, so a change made anywhere reaches all. */
type HarnessStore = {
  data: HarnessList | null;
  error: string | null;
  /** Counts the lists a request returned, so a read that began before one cannot put an older list back. */
  generation: number;
  /** The read being waited on, shared by every screen that asks while it runs. */
  inflight: Promise<void> | null;
  readonly listeners: Set<() => void>;
};

const harnessStores = new WeakMap<ServiceClient, HarnessStore>();

const storeOf = (client: ServiceClient) => {
  const existing = harnessStores.get(client);
  if (existing !== undefined) return existing;
  const made: HarnessStore = { data: null, error: null, generation: 0, inflight: null, listeners: new Set() };
  harnessStores.set(client, made);
  return made;
};

const publish = (store: HarnessStore, change: Partial<Pick<HarnessStore, "data" | "error">>) => {
  Object.assign(store, change);
  for (const listener of store.listeners) listener();
};

/**
 * The harnesses with their accounts and models, read when a screen shows them and again on `refresh`: reading them
 * asks each harness's own tool, too slow to repeat on every change. The list is shared by every screen of the host
 * connection, so renaming or adding an account in Settings shows in the pickers at once, and `setData` publishes a
 * list a request returned.
 */
export function useHarnesses(client: ServiceClient) {
  const store = storeOf(client);
  const [, setVersion] = useState(0);
  const refresh = useCallback(() => {
    const current = storeOf(client);
    if (current.inflight !== null) return current.inflight;
    const generation = current.generation;
    const read = client.request({ _tag: "ListHarnesses" }).then(
      (value) => {
        if (generation === current.generation) publish(current, { data: value, error: null });
      },
      (reason) => publish(current, { error: messageOf(reason) }),
    );
    current.inflight = read.finally(() => {
      current.inflight = null;
    });
    return current.inflight;
  }, [client]);
  const setData = useCallback(
    (value: HarnessList) => {
      const current = storeOf(client);
      current.generation += 1;
      publish(current, { data: value, error: null });
    },
    [client],
  );
  useEffect(() => {
    const current = storeOf(client);
    const listener = () => setVersion((version) => version + 1);
    current.listeners.add(listener);
    // Each screen asks again when it shows, as before; what is already known shows meanwhile.
    refresh();
    return () => void current.listeners.delete(listener);
  }, [client, refresh]);
  return { data: store.data, error: store.error, refresh, setData };
}

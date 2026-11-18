import { useCallback, useEffect, useReducer, useRef } from "react";
import { appRelease } from "./browser/page";
import { RequestFailed, type ServiceClient } from "./client";
import { canStartHostUpdate, type HostUpdateEvent, initialHostUpdate, nextHostUpdate } from "./hostUpdate";

/** How often the host is asked where its update stands. */
const pollMillis = 3_000;

/**
 * The device's side of updating its host (app-updates, Updating a host from a paired device), while the host runs
 * another release than this device. It opens an update link, a second link that keeps the host of another release, reads
 * the host's release and offers to update it when it is older. Once the owner confirms it sends `UpdateHost` and follows
 * the host's progress until the host answers on this device's release, and then calls `onUpdated` so that the device's
 * own link to the host starts again. The link keeps trying through the host's restart, as every host link does.
 */
export function useHostUpdate({
  isActive,
  onUpdated,
  openLink,
}: {
  /** Whether the host is of another release; nothing is opened otherwise. */
  isActive: boolean;
  onUpdated: () => void;
  /** Opens the update link to the host. */
  openLink: () => Promise<ServiceClient>;
}) {
  const [state, dispatch] = useReducer(
    (current: typeof initialHostUpdate, event: HostUpdateEvent) => nextHostUpdate(current, event, appRelease),
    initialHostUpdate,
  );
  // The owner's confirmation waits here until the update link is up to carry it.
  const hasToStart = useRef(false);
  const isLinked = isActive && (state._tag === "Probing" || state._tag === "Updating");
  useEffect(() => {
    if (!isLinked) return;
    let isCurrent = true;
    let client: ServiceClient | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      timer = null;
      if (!isCurrent || client === null) return;
      try {
        const isStarting = hasToStart.current;
        const update = await client.request({ _tag: isStarting ? "UpdateHost" : "ReadHostUpdate" });
        if (!isCurrent) return;
        if (isStarting) hasToStart.current = false;
        dispatch({ type: "read", update });
      } catch (reason) {
        if (!isCurrent) return;
        // A host from before this feature answers a request it cannot read with a failure; a dropped link is another matter.
        dispatch(
          reason instanceof RequestFailed && reason.error.kind === "InvalidInput"
            ? { type: "tooOld" }
            : { type: "disconnected" },
        );
      }
      if (isCurrent) timer = setTimeout(() => void poll(), pollMillis);
    };
    openLink().then(
      (opened) => {
        if (!isCurrent) return opened.close();
        client = opened;
        void poll();
      },
      () => {
        if (isCurrent) dispatch({ type: "disconnected" });
      },
    );
    return () => {
      isCurrent = false;
      if (timer !== null) clearTimeout(timer);
      client?.close();
    };
  }, [isLinked, openLink]);
  // The device's own link starts again once the host runs this device's release.
  useEffect(() => {
    if (state._tag === "Updated") onUpdated();
  }, [state._tag, onUpdated]);
  const start = useCallback(() => {
    hasToStart.current = true;
    dispatch({ type: "start" });
  }, []);
  return { canStart: canStartHostUpdate(state), start, state };
}

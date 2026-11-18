import { useEffect, useState } from "react";
import { androidUpdatesBridge } from "./androidUpdates/platform";
import { messageOf } from "./client";
import { useIsRemoteHost } from "./hostContext";
import type { AppUpdatesBridge, UpdateState } from "./updateState";

/** What a screen needs to show updates and act on them; the actions reject with the reason a request failed. */
type AppUpdates = {
  readonly bridge: AppUpdatesBridge;
  readonly error: string | null;
  readonly state: UpdateState | null;
};

/**
 * The updates of the app the screen runs in, kept current as they change: the desktop window's, on the computer it
 * runs on, or the phone's own app, whichever host it shows. Null where the app cannot update itself (a browser) or the
 * desktop window shows a paired host, whose app is not this one.
 */
export function useAppUpdates(): AppUpdates | null {
  const isRemote = useIsRemoteHost();
  const desktopBridge = typeof window === "undefined" || isRemote ? null : (window.outlore?.updates ?? null);
  const bridge: AppUpdatesBridge | null = desktopBridge ?? androidUpdatesBridge();
  const [state, setState] = useState<UpdateState | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (bridge === null) return;
    let isCurrent = true;
    bridge.state().then(
      (current) => isCurrent && setState(current),
      (reason) => isCurrent && setError(messageOf(reason)),
    );
    const stop = bridge.listen((next) => isCurrent && setState(next));
    return () => {
      isCurrent = false;
      stop();
    };
  }, [bridge]);
  return bridge === null ? null : { bridge, error, state };
}

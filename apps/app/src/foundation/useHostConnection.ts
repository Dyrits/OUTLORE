import type { KnownHost } from "@outlore/contracts";
import { createPairedHosts } from "@outlore/controller";
import { openBrowserTransport, pairFromBrowser } from "@outlore/controller/browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isMobileApp, isRemoteOnly, pageSettings } from "./browser/page";
import { ServiceClient } from "./client";
import { type HostLink, hostStatusOf } from "./hostStatus";
import { pairingStorage } from "./native/pairingStorage";
import type { PairingOffer } from "./pairingOffer";
import { pairingOfferOf } from "./pairingOffer";
import { usePairingLinks } from "./usePairingLinks";

/**
 * Owns the window's local service and its selected host connection. In a plain browser there is no local service: the
 * browser keeps its own pairings and opens the encrypted link to a host itself (browser access, 0019).
 */
export function useHostConnection() {
  const usesRemoteHost = useMemo(isRemoteOnly, []);
  const deviceNoun: "browser" | "computer" | "phone" = isMobileApp ? "phone" : usesRemoteHost ? "browser" : "computer";
  const pairedHosts = useMemo(() => (usesRemoteHost ? createPairedHosts(pairingStorage()) : null), [usesRemoteHost]);
  // The local service always stays connected: it lists the hosts and pairs with them. The window shows either its own
  // data or, through it, a paired host's (device-pairing).
  const [localClient, setLocalClient] = useState<ServiceClient | null>(null);
  const [hostId, setHostIdState] = useState<string | null>(
    () => pairedHosts?.activeId() ?? pairedHosts?.known()[0]?.id ?? null,
  );
  const [hostClient, setHostClient] = useState<ServiceClient | null>(null);
  const [hosts, setHosts] = useState<readonly KnownHost[]>(() => pairedHosts?.known() ?? []);
  const [computerName, setComputerName] = useState(`This ${deviceNoun}`);
  const setHostId = useCallback(
    (next: string | null) => {
      pairedHosts?.setActive(next);
      setHostIdState(next);
    },
    [pairedHosts],
  );
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setFailure(null);
    setAttempt((current) => current + 1);
  }, []);
  const [isAddingHost, setIsAddingHostState] = useState(false);
  // A pairing link that opened the app waits here, with its code, until the owner pairs or cancels (device-pairing).
  const [offer, setOffer] = useState<PairingOffer | null>(null);
  const setIsAddingHost = useCallback((isAdding: boolean) => {
    setIsAddingHostState(isAdding);
    if (!isAdding) setOffer(null);
  }, []);
  const [link, setLink] = useState<HostLink | null>(null);
  const client = hostId === null ? localClient : hostClient;
  const [failure, setFailure] = useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt explicitly restarts a failed connection.
  useEffect(() => {
    if (usesRemoteHost) return;
    let isCurrent = true;
    let opened: ServiceClient | null = null;
    ServiceClient.connect().then(
      (connected) => {
        if (!isCurrent) return connected.close();
        opened = connected;
        setLocalClient(connected);
      },
      (error: Error) => {
        if (isCurrent) setFailure(error.message);
      },
    );
    return () => {
      isCurrent = false;
      opened?.close();
      setLocalClient(null);
    };
  }, [usesRemoteHost, attempt]);
  // The hosts this installation is paired with, and its own computer's name, read from the local service.
  useEffect(() => {
    if (localClient === null) return;
    const loadHosts = () => void localClient.request({ _tag: "ListHosts" }).then(setHosts, () => {});
    const loadName = () => void localClient.request({ _tag: "ReadHostName" }).then(setComputerName, () => {});
    loadHosts();
    loadName();
    const unsubscribeHosts = localClient.subscribe(loadHosts, "ListHosts");
    const unsubscribeName = localClient.subscribe(loadName, "ReadHostName");
    return () => {
      unsubscribeHosts();
      unsubscribeName();
    };
  }, [localClient]);
  // The link to the chosen host opens when it is chosen and closes when another is.
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt explicitly restarts a failed connection.
  useEffect(() => {
    if (hostId === null) return;
    let isCurrent = true;
    let opened: ServiceClient | null = null;
    const connecting =
      pairedHosts === null
        ? ServiceClient.connect(hostId)
        : ServiceClient.connectThrough(openBrowserTransport(pairedHosts, hostId, pageSettings()), hostId);
    connecting.then(
      (connected) => {
        if (!isCurrent) return connected.close();
        opened = connected;
        setHostClient(connected);
      },
      (error: Error) => {
        if (isCurrent) setFailure(error.message);
      },
    );
    return () => {
      isCurrent = false;
      opened?.close();
      setHostClient(null);
    };
  }, [hostId, pairedHosts, attempt]);
  // The link that updates the selected host when it runs another release than this device: a second link that keeps it.
  const openUpdateLink = useCallback(
    () =>
      hostId === null
        ? Promise.reject(new Error("No host is selected."))
        : pairedHosts === null
          ? ServiceClient.connect(hostId, true)
          : ServiceClient.connectThrough(
              openBrowserTransport(pairedHosts, hostId, pageSettings(), { acceptOtherRelease: true }),
              hostId,
            ),
    [hostId, pairedHosts],
  );
  // The one way a pairing link reaches Add a host, from the address bar, the desktop's protocol handler, or a phone's.
  const hasHostsRef = useRef(hosts.length > 0);
  hasHostsRef.current = hosts.length > 0;
  const offerPairing = useCallback(
    (link: string) => {
      const next = pairingOfferOf(link, {
        hasHosts: hasHostsRef.current,
        isBrowser: usesRemoteHost,
        // The mobile app has no address bar and asks before pairing.
        isPhone: isMobileApp,
      });
      if (next === null) return;
      setOffer(next);
      setIsAddingHostState(true);
    },
    [usesRemoteHost],
  );
  // The phone app is opened with `outlore://pair#<code>` (or the web link, when the system hands it over).
  usePairingLinks(offerPairing);
  // A browser opened at `<web app>/#<code>` pairs by itself. The fragment leaves the address bar at once, so a reload
  // or a bookmark never offers a spent code again, and it never reaches the history entry that was written.
  useEffect(() => {
    if (!usesRemoteHost || isMobileApp) return;
    const takeFragment = () => {
      const link = window.location.hash;
      if (pairingOfferOf(link, { hasHosts: false, isBrowser: usesRemoteHost }) === null) return;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      offerPairing(link);
    };
    takeFragment();
    window.addEventListener("hashchange", takeFragment);
    return () => window.removeEventListener("hashchange", takeFragment);
  }, [usesRemoteHost, offerPairing]);
  // The desktop app is opened with `outlore://pair#<code>`; the window listens first, then asks for what came before.
  useEffect(() => {
    const bridge = window.outlore?.pairingLinks;
    if (bridge === undefined) return;
    const stop = bridge.listen(offerPairing);
    bridge.take().then(
      (link) => {
        if (link !== null) offerPairing(link);
      },
      () => {},
    );
    return stop;
  }, [offerPairing]);
  // A browser pairs on its own and keeps the host; a desktop window asks its local service to.
  const pair = useCallback(
    async (code: string, deviceName: string): Promise<KnownHost> => {
      if (pairedHosts !== null) {
        const host = await pairFromBrowser(code, deviceName, pairedHosts, pageSettings());
        setHosts(pairedHosts.known());
        return host;
      }
      if (localClient === null) throw new Error("Connecting to the local service…");
      return localClient.request({ _tag: "AddHost", code, deviceName });
    },
    [localClient, pairedHosts],
  );
  // Why the link to a host is down, when it is, for the banner over the window.
  useEffect(() => {
    if (client === null) {
      setLink(null);
      return;
    }
    const update = () =>
      setLink({
        failure: client.failure,
        hasConnected: client.hasConnected,
        hasGivenUp: client.hasGivenUp,
        hasReleaseMismatch: client.hasReleaseMismatch,
        needsPairing: client.needsPairing,
      });
    update();
    const unsubscribe = client.subscribeFailure(update);
    return () => void unsubscribe();
  }, [client]);
  const activeHost = useMemo(
    () => ({
      hostId,
      name: hostId === null ? computerName : (hosts.find((host) => host.id === hostId)?.name ?? "Host"),
    }),
    [computerName, hostId, hosts],
  );
  const status = hostStatusOf({
    failure,
    hasHosts: hosts.length > 0,
    hostId,
    isBrowser: usesRemoteHost,
    link,
    name: activeHost.name,
  });
  return {
    activeHost,
    client,
    computerName,
    deviceNoun,
    hostId,
    hosts,
    isAddingHost,
    isBrowser: usesRemoteHost,
    offer,
    offerPairing,
    openUpdateLink,
    pair,
    retry,
    setFailure,
    setHostId,
    setIsAddingHost,
    status,
  };
}

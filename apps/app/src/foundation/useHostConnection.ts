import type { KnownHost } from "@outlore/contracts";
import { createPairedHosts, openBrowserTransport, pairFromBrowser } from "@outlore/controller";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isBrowserPage, pageSettings } from "./browser/page";
import { ServiceClient } from "./client";

/**
 * Owns the window's local service and its selected host connection. In a plain browser there is no local service: the
 * browser keeps its own pairings and opens the encrypted link to a host itself (browser access, 0019).
 */
export function useHostConnection() {
  const isBrowser = useMemo(isBrowserPage, []);
  const pairedHosts = useMemo(() => (isBrowser ? createPairedHosts(window.localStorage) : null), [isBrowser]);
  // The local service always stays connected: it lists the hosts and pairs with them. The window shows either its own
  // data or, through it, a paired host's (device-pairing).
  const [localClient, setLocalClient] = useState<ServiceClient | null>(null);
  const [hostId, setHostIdState] = useState<string | null>(
    () => pairedHosts?.activeId() ?? pairedHosts?.known()[0]?.id ?? null,
  );
  const [hostClient, setHostClient] = useState<ServiceClient | null>(null);
  const [hosts, setHosts] = useState<readonly KnownHost[]>(() => pairedHosts?.known() ?? []);
  const [computerName, setComputerName] = useState(isBrowser ? "This browser" : "This computer");
  const setHostId = useCallback(
    (next: string | null) => {
      pairedHosts?.setActive(next);
      setHostIdState(next);
    },
    [pairedHosts],
  );
  const [isAddingHost, setIsAddingHost] = useState(false);
  const [linkFailure, setLinkFailure] = useState<string | null>(null);
  const client = hostId === null ? localClient : hostClient;
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    if (isBrowser) return;
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
    };
  }, [isBrowser]);
  // The hosts this installation is paired with, and its own computer's name, read from the local service.
  useEffect(() => {
    if (localClient === null) return;
    const load = () => {
      localClient.request({ _tag: "ListHosts" }).then(setHosts, () => {});
      localClient.request({ _tag: "ReadHostName" }).then(setComputerName, () => {});
    };
    load();
    const unsubscribe = localClient.subscribe(load);
    return () => void unsubscribe();
  }, [localClient]);
  // The link to the chosen host opens when it is chosen and closes when another is.
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
  }, [hostId, pairedHosts]);
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
    if (hostClient === null) {
      setLinkFailure(null);
      return;
    }
    setLinkFailure(hostClient.failure);
    const unsubscribe = hostClient.subscribeFailure(() => setLinkFailure(hostClient.failure));
    return () => void unsubscribe();
  }, [hostClient]);
  const activeHost = useMemo(
    () => ({
      hostId,
      name: hostId === null ? computerName : (hosts.find((host) => host.id === hostId)?.name ?? "Host"),
    }),
    [computerName, hostId, hosts],
  );
  return {
    activeHost,
    client,
    computerName,
    failure,
    hostClient,
    hostId,
    hosts,
    isAddingHost,
    isBrowser,
    linkFailure,
    localClient,
    pair,
    setFailure,
    setHostId,
    setIsAddingHost,
  };
}

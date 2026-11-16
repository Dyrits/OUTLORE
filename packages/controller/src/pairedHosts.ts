import type { HostId, KnownHost } from "@outlore/contracts";

// The hosts a browser is paired with, kept in the browser's own storage (browser access, 0019). A browser has no local
// service, so this is where the host's key, room and device token live; the page's code can read them, which is why
// 0019 names the trust the browser places in the site that serves it.

/** The part of `localStorage` this needs, so a test can use a map. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

/** A host this browser can reach, with what it needs to find it and prove itself. */
export interface StoredHost {
  readonly deviceId: string;
  readonly deviceToken: string;
  readonly hostName: string;
  /** The host's public key, base64url. */
  readonly hostPublicKey: string;
  readonly id: string;
  readonly lastSeenAt: number | null;
  readonly pairedAt: number;
  readonly relayOrigin: string;
  readonly room: string;
}

const hostsKey = "outlore.browserHosts";
const activeKey = "outlore.browserHost";

const isText = (value: unknown): value is string => typeof value === "string" && value !== "";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStoredHost = (value: unknown): value is StoredHost => {
  if (!isRecord(value)) return false;
  const host = value;
  return (
    isText(host.deviceId) &&
    isText(host.deviceToken) &&
    isText(host.hostName) &&
    isText(host.hostPublicKey) &&
    isText(host.id) &&
    (host.lastSeenAt === null || typeof host.lastSeenAt === "number") &&
    typeof host.pairedAt === "number" &&
    isText(host.relayOrigin) &&
    isText(host.room)
  );
};

/** What a browser keeps about its hosts. Reads go to storage each time, so a second tab sees the first one's pairing. */
export const createPairedHosts = (storage: KeyValueStorage) => {
  const read = (): StoredHost[] => {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(hostsKey) ?? "[]");
      return Array.isArray(parsed) ? parsed.filter(isStoredHost) : [];
    } catch {
      return [];
    }
  };
  const write = (hosts: readonly StoredHost[]) => storage.setItem(hostsKey, JSON.stringify(hosts));
  const known = (host: StoredHost): KnownHost => ({
    id: host.id as HostId,
    lastSeenAt: host.lastSeenAt,
    name: host.hostName,
    pairedAt: host.pairedAt,
  });
  return {
    /** The host this browser showed last; null when none, or when it was forgotten. */
    activeId: (): string | null => {
      const id = storage.getItem(activeKey);
      return id !== null && read().some((host) => host.id === id) ? id : null;
    },
    /** The hosts for the host menu. */
    known: (): KnownHost[] => read().map(known),
    /** What is needed to connect to one host, or null when this browser has no such host. */
    link: (hostId: string): StoredHost | null => read().find((host) => host.id === hostId) ?? null,
    /** Forgets a host here. */
    remove: (hostId: string) => {
      write(read().filter((host) => host.id !== hostId));
      if (storage.getItem(activeKey) === hostId) storage.removeItem(activeKey);
    },
    /**
     * Keeps a host this browser just paired with. Pairing again with a host it already has (after that host
     * disconnected it) replaces the old entry, which could only be refused.
     */
    save: (host: Omit<StoredHost, "id" | "lastSeenAt" | "pairedAt">, now: number): KnownHost => {
      const saved: StoredHost = { ...host, id: crypto.randomUUID(), lastSeenAt: now, pairedAt: now };
      write([...read().filter((old) => !(old.room === host.room && old.hostPublicKey === host.hostPublicKey)), saved]);
      return known(saved);
    },
    setActive: (hostId: string | null) => {
      if (hostId === null) storage.removeItem(activeKey);
      else storage.setItem(activeKey, hostId);
    },
    /** Notes that a host answered and what it is called now. */
    touch: (hostId: string, hostName: string, now: number) =>
      write(read().map((host) => (host.id === hostId ? { ...host, hostName, lastSeenAt: now } : host))),
  };
};

export type PairedHosts = ReturnType<typeof createPairedHosts>;

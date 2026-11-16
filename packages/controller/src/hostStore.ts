import type { KnownHost } from "@outlore/contracts";

// The seam between the host link and where a controller keeps its pairings: the desktop's service keeps them in its
// database (`service/src/remote/knownHosts.ts`), a browser in its own storage (`pairedHosts.ts`).

/** What a controller needs to reach one paired host and prove itself to it. */
export type HostLinkRecord = {
  readonly deviceId: string;
  readonly deviceToken: string;
  readonly hostName: string;
  readonly hostPublicKey: Uint8Array;
  readonly relayOrigin: string;
  readonly room: string;
};

/** Where a controller keeps the hosts it paired with. */
export interface PairedHostStore {
  /** What is needed to reach one host, or null when there is no such host here. */
  readonly link: (hostId: string) => Promise<HostLinkRecord | null>;
  /** Keeps a host just paired with; pairing again with a host already kept replaces it. */
  readonly save: (host: HostLinkRecord, now: number) => Promise<KnownHost>;
  /** Notes that a host answered, and what it is called now. */
  readonly touch: (hostId: string, hostName: string, now: number) => Promise<void>;
}

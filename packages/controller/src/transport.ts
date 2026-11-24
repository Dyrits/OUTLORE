// What a ServiceClient talks through: text frames both ways, and why it ended. The desktop window uses a WebSocket to
// its local service; a browser opens the encrypted channel to a host itself (hostLink.ts).

/** What a transport tells its owner. `onClose` carries an application close code and the words for the owner. */
export interface TransportHandlers {
  onClose(code: number, reason: string): void;
  /** The transport could not open. */
  onError(): void;
  onOpen(): void;
  /** The link moved to the relay or to a direct channel; only a link to a paired host reports it. */
  onPath?(path: "direct" | "relay"): void;
  onText(data: unknown): void;
}

/** One open or opening link. */
export interface Transport {
  close(): void;
  readonly isOpen: boolean;
  send(text: string): void;
}

/** Starts a transport and reports through the handlers; nothing is reported before this returns. */
export type OpenTransport = (handlers: TransportHandlers) => Transport;

/**
 * Application close codes of a link to a host: could not open it (try again later), the host ended it, the host
 * refused this installation (trying again cannot help; the owner pairs again), and the host runs another release
 * than this web app (trying again cannot help, and nor can pairing again; the owner opens the matching web app).
 */
export const hostLinkCodes = { couldNotOpen: 4000, ended: 4001, otherRelease: 4003, refused: 4002 } as const;

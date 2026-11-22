import type { Theme } from "./themeName";
import type { UpdatesBridge } from "./updateState";

/** How a window receives the pairing links the desktop app was opened with. */
export interface PairingLinksBridge {
  /** Calls `onLink` for each link that arrives from now on; returns what stops it. */
  listen(onLink: (link: string) => void): () => void;
  /** The link that arrived before the window listened, once, or null. Call it after `listen`. */
  take(): Promise<string | null>;
}

/** Capabilities exposed exclusively to the desktop window by its isolated preload. */
export interface DesktopBridge {
  endpoint(): Promise<string>;
  readonly hasOwnTitleBar: boolean;
  /** Pairing links (`outlore://pair#…`) the system handed to the desktop app; the window offers each in Add a host. */
  readonly pairingLinks: PairingLinksBridge;
  /** Bounces the Dock icon until the owner returns to the app; the desktop app does nothing while its window is in front. */
  requestAttention(): Promise<void>;
  /** Gives the Dock and the window the icon of the theme in use. */
  setTheme(theme: Theme): Promise<void>;
  /** Finding and installing a newer release of the installed app. */
  readonly updates: UpdatesBridge;
}

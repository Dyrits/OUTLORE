import { resolve } from "node:path";

// The `outlore://pair#<code>` links the system hands to the desktop app (device-pairing). A link is as secret as the
// code in it: nothing here logs it, and it goes to the window alone.

const linkPattern = /^outlore:\/\/pair(?:\/)?#/i;
/** A pairing link is about 170 characters; anything near this size is not one. */
const maxLinkLength = 1024;

const isPairingLink = (text: string) => text.length <= maxLinkLength && linkPattern.test(text);

/** The pairing link among a launch's arguments (Windows and Linux put it there), or null. */
export const pairingLinkIn = (argv: readonly string[]): string | null => argv.find(isPairingLink) ?? null;

/**
 * Holds pairing links until the window can take them. A link that arrives before the window listens is kept (only the
 * latest: a one-time code from earlier is most likely spent); after the window asks with `take`, links go to `deliver`.
 * `reset` returns to holding, for a window that reloads.
 */
export const createPairingLinkQueue = (deliver: (link: string) => void) => {
  let isReady = false;
  let pending: string | null = null;
  return {
    /** A link arrived from the system. */
    receive: (text: string) => {
      if (!isPairingLink(text)) return;
      if (isReady) deliver(text);
      else pending = text;
    },
    /** The window went away or reloaded; links wait again. */
    reset: () => {
      isReady = false;
    },
    /** The window is listening: marks it ready and gives what waited, once. */
    take: () => {
      isReady = true;
      const link = pending;
      pending = null;
      return link;
    },
  };
};

type ProtocolInput = {
  readonly argv1: string | undefined;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly execPath: string;
  /** Electron's `process.defaultApp`: started as `electron <entry>` rather than as an installed app. */
  readonly isDefaultApp: boolean;
  readonly isPackaged: boolean;
};

/**
 * How the app registers as the system's handler of `outlore://`, or null when it should not. Only the installed app does:
 * a development run or a check taking the scheme would steal links from the owner's installed app. A development run
 * that is asked to (`OUTLORE_HANDLE_LINKS=1`) registers with the executable and its entry, which the system needs to
 * start it again with the link.
 */
export const protocolClientOf = (input: ProtocolInput): { args: string[]; executable: string | null } | null => {
  if (input.environment.OUTLORE_DATA_DIR !== undefined && input.environment.OUTLORE_DATA_DIR !== "") return null;
  if (input.isPackaged) return { args: [], executable: null };
  if (input.environment.OUTLORE_HANDLE_LINKS !== "1" || !input.isDefaultApp || input.argv1 === undefined) return null;
  return { args: [resolve(input.argv1)], executable: input.execPath };
};

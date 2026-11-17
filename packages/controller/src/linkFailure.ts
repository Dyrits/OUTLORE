import { Schema } from "effect";
import { hostLinkCodes } from "./transport.ts";

// Why a link to a host could not be made, in the words the owner reads, the same in the desktop app and the web app
// except where each names itself.

/** Which controller this is: the desktop app through its service, the web app in a browser, or the mobile app. */
export type ControllerKind = "browser" | "desktop" | "phone";

/**
 * Why a link failed: the owner's input or code cannot be used, the host could not be reached (try again later), the
 * host refused this device or this device has no such host (pairing again is the remedy), or the host runs another
 * release (neither trying nor pairing again helps).
 */
export type LinkFailureKind = "couldNotOpen" | "invalid" | "noSuchHost" | "otherRelease" | "refused";

/** A link that could not be made or used, with the words the owner reads. */
export class LinkFailure extends Schema.TaggedError<LinkFailure>()("LinkFailure", {
  kind: Schema.Literals(["couldNotOpen", "invalid", "noSuchHost", "otherRelease", "refused"]),
  message: Schema.String,
}) {
  constructor(kind: LinkFailureKind, message: string) {
    super({ kind, message });
  }
}

/** The transport's close code for each failure, which tells the app whether trying again can help. */
export const linkCodeOf = {
  couldNotOpen: hostLinkCodes.couldNotOpen,
  invalid: hostLinkCodes.couldNotOpen,
  noSuchHost: hostLinkCodes.refused,
  otherRelease: hostLinkCodes.otherRelease,
  refused: hostLinkCodes.refused,
} as const satisfies Record<LinkFailureKind, number>;

/** How each controller names itself and its app, and what mends a host of another release. */
export const controllerWords = {
  browser: {
    app: "This web app",
    mend: "Open the web app of the host's release, or update the host.",
    self: "browser",
  },
  desktop: {
    app: "This app",
    mend: "Update this app or the host, so that both run the same release.",
    self: "computer",
  },
  phone: {
    app: "This app",
    mend: "Update this app or the host, so that both run the same release.",
    self: "phone",
  },
} as const satisfies Record<ControllerKind, { app: string; mend: string; self: string }>;

/** What the owner reads when the host could not be reached or did not answer. */
export const linkTexts = {
  busy: "The relay is busy. Try again in a moment.",
  hostOffline: "The host is not connected right now. Check that its Outlore is open and Allow paired devices is on.",
  localRelay: "This pairing code names a relay on this computer, which is not accepted.",
  newerCode: "This pairing code is from a newer Outlore. Update this app and try again.",
  roomFull:
    "The host already has as many devices connected as the relay allows. Close Outlore on one of them, then try again.",
  timedOut: "The host did not answer in time.",
  unreachable: "Could not reach the relay. Check your internet connection.",
  // An older host closes the channel on a pairing request it cannot read, such as one from a browser that says so.
  unreadablePairing:
    "The host could not read this pairing request; it may run an older release of Outlore. Update the host, then try again.",
} as const;

/** The words for a host of another release than this app, or null when they match. */
export const releaseProblemOf = (
  hostRelease: string | undefined,
  appRelease: string,
  kind: ControllerKind = "browser",
) =>
  hostRelease === appRelease
    ? null
    : `${controllerWords[kind].app} is release ${appRelease}, but the host runs ${hostRelease ?? "an older release"}. ${controllerWords[kind].mend}`;

// Updating a host from a device of a later release (app-updates, Updating a host from a paired device). The pure
// parts: whether the device offers it, what each answer of the host means for the screen, and the words shown.

import { compareVersions, type HostUpdate, parseVersion } from "@outlore/contracts";

/** The question before the host is told to update: a tap on **Update host** opens it, and nothing starts without it. */
export const hostUpdateQuestion =
  "The host downloads the new release and installs it once no turn is running, so running turns finish first. It then restarts, and this device reconnects by itself.";

const turnsOf = (count: number) => `${count} running turn${count === 1 ? "" : "s"}`;

/** The question before the host is told to install over running turns: what is lost, and what happens next. */
export const forceUpdateQuestionOf = (runningCount: number) =>
  `${turnsOf(runningCount)} will be stopped. The host then installs the new release and restarts, and this device reconnects by itself.`;

/** Shown when the host does not know the force request: it runs a release from before it. */
export const forceTooOldText =
  "This host is too old to force an update from here; stop its running turns on the host, or update it on the host once, then this works.";

/** What a device of a later release shows about updating its host. */
export type HostUpdateState =
  /** The host's release is not known yet: the update link reads it. */
  | { readonly _tag: "Probing" }
  /** Nothing to offer: the host is newer (this device updates itself), or it cannot update; the reason, if any. */
  | { readonly _tag: "NotOffered"; readonly reason: string | null }
  /** The host does not know the requests: it runs a release from before this feature. */
  | { readonly _tag: "TooOld" }
  | { readonly _tag: "Offered"; readonly hostRelease: string }
  /** The host was told to update; `update` is the last thing it said, null before it said anything. */
  | {
      readonly _tag: "Updating";
      readonly isReconnecting: boolean;
      readonly update: HostUpdate | null;
      /** The owner chose to install over running turns: the host was told, or it does not know the request. */
      readonly force?: "asked" | "refused";
    }
  | { readonly _tag: "Updated"; readonly release: string };

export const initialHostUpdate: HostUpdateState = { _tag: "Probing" };

export type HostUpdateEvent =
  /** The host answered, with its release and where its update stands. */
  | { readonly type: "read"; readonly update: HostUpdate }
  /** The host answered the request with a failure: an earlier release does not know it. */
  | { readonly type: "tooOld" }
  /** The link is down: the host is restarting, or cannot be reached; the client keeps trying. */
  | { readonly type: "disconnected" }
  /** The owner confirmed. */
  | { readonly type: "start" }
  /** The owner confirmed forcing the install over the running turns. */
  | { readonly type: "force" }
  /** The host answered the force request with a failure: a release from before it does not know it. */
  | { readonly type: "forceRefused" };

/** Whether the host's release is older than the device's; false when either is not a release that can be compared. */
export const isHostOlder = (hostRelease: string, deviceRelease: string) => {
  const host = parseVersion(hostRelease);
  const device = parseVersion(deviceRelease);
  return host !== null && device !== null && compareVersions(host, device) < 0;
};

/** Whether the owner may tell the host to update now: before it started, or after it stopped without installing. */
export const canStartHostUpdate = (state: HostUpdateState) =>
  state._tag === "Offered" ||
  (state._tag === "Updating" &&
    !state.isReconnecting &&
    (state.update?.status._tag === "Failed" || state.update?.status._tag === "Idle"));

/** Whether the owner may force the install: the host waits on running turns and knows the force request. */
export const canForceHostUpdate = (state: HostUpdateState) =>
  state._tag === "Updating" &&
  !state.isReconnecting &&
  state.force === undefined &&
  state.update?.status._tag === "WaitingForTurns";

/** Moves the device's view of the host's update on by one answer of the update link. */
export const nextHostUpdate = (
  state: HostUpdateState,
  event: HostUpdateEvent,
  deviceRelease: string,
): HostUpdateState => {
  if (event.type === "tooOld") return { _tag: "TooOld" };
  if (event.type === "disconnected") return state._tag === "Updating" ? { ...state, isReconnecting: true } : state;
  if (event.type === "start") {
    return canStartHostUpdate(state) ? { _tag: "Updating", isReconnecting: false, update: null } : state;
  }
  if (event.type === "force")
    return state._tag === "Updating" && canForceHostUpdate(state) ? { ...state, force: "asked" } : state;
  if (event.type === "forceRefused") return state._tag === "Updating" ? { ...state, force: "refused" } : state;
  const { release, status } = event.update;
  // The host runs this device's release: it was updated, by this link or on the host itself, and the link can resume.
  if (release === deviceRelease) return { _tag: "Updated", release };
  if (state._tag === "Updating") {
    // A refusal stays shown: the host went on waiting, but forcing is not on offer to it.
    return {
      _tag: "Updating",
      isReconnecting: false,
      update: event.update,
      ...(state.force === "refused" ? { force: "refused" as const } : {}),
    };
  }
  if (!isHostOlder(release, deviceRelease)) return { _tag: "NotOffered", reason: null };
  if (status._tag === "Unsupported") {
    return { _tag: "NotOffered", reason: `The host cannot update itself: ${status.reason}` };
  }
  return { _tag: "Offered", hostRelease: release };
};

const progressTextOf = (status: HostUpdate["status"]): string => {
  if (status._tag === "Checking") return "Looking for the new release…";
  if (status._tag === "Downloading") return `Downloading ${Math.round(status.percent)}%`;
  if (status._tag === "Ready") return "Downloaded. Starting the install…";
  if (status._tag === "WaitingForTurns") return `Waiting for ${turnsOf(status.runningCount)} to finish`;
  if (status._tag === "Installing") return "Installing";
  if (status._tag === "Failed") return status.message;
  if (status._tag === "Idle") return status.note ?? "The host found no newer release. Update it on the host.";
  return `The host cannot update itself: ${status.reason}`;
};

/** The words for what the device shows about updating its host; null when it shows nothing of it. */
export const hostUpdateTextOf = (state: HostUpdateState): string | null => {
  if (state._tag === "TooOld") {
    return "This host is too old to update from here; update it on the host once, then this works.";
  }
  if (state._tag === "NotOffered") return state.reason;
  if (state._tag === "Updated") return `The host runs release ${state.release}. Reconnecting…`;
  if (state._tag === "Updating") {
    if (state.isReconnecting) return "Reconnecting…";
    if (state.force === "refused") return forceTooOldText;
    if (state.force === "asked") return "Telling the host to install now…";
    return state.update === null ? "Telling the host to update…" : progressTextOf(state.update.status);
  }
  return null;
};

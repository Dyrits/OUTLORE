import type { UpdateState } from "./updateState";

/** The words for how long ago a check ended, in the coarsest unit that is not zero. */
export const lastCheckedTextOf = (lastCheckedAt: number | null, now: number): string => {
  if (lastCheckedAt === null) return "Not checked yet.";
  const minutes = Math.floor(Math.max(0, now - lastCheckedAt) / 60_000);
  if (minutes < 1) return "Last checked just now.";
  if (minutes < 60) return `Last checked ${minutes} minute${minutes === 1 ? "" : "s"} ago.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last checked ${hours} hour${hours === 1 ? "" : "s"} ago.`;
  const days = Math.floor(hours / 24);
  return `Last checked ${days} day${days === 1 ? "" : "s"} ago.`;
};

/** What the Updates section says about where an update stands, in one line. */
export const statusTextOf = (state: UpdateState): string => {
  const { status } = state;
  if (status._tag === "Unsupported") return status.reason;
  // An update already downloaded stays ready to install whether or not looking is still on.
  if (status._tag === "Ready") return `Outlore ${status.version} is downloaded and ready to install.`;
  if (!state.isEnabled) return "Looking for new releases is off. Outlore asks no one.";
  if (status._tag === "Checking") return "Looking for a newer release…";
  if (status._tag === "Available")
    return `Outlore ${status.version} is available. You are on mobile data, so it is not downloaded yet (${downloadSizeOf(status.sizeBytes)}).`;
  if (status._tag === "Downloading") return `Downloading ${status.version}: ${status.percent}%.`;
  if (status._tag === "Failed") return status.message;
  return status.note ?? "Outlore is up to date.";
};

/**
 * Whether Check now does anything: checking is on and nothing is under way or ready. A release that waits for Wi-Fi is
 * looked at again.
 */
export const canCheckNow = (state: UpdateState): boolean =>
  state.isEnabled &&
  (state.status._tag === "Idle" || state.status._tag === "Failed" || state.status._tag === "Available");

/** What the confirmation before restarting says, so the owner knows what the restart costs. */
export const restartWarningOf = (version: string): string =>
  `Outlore quits and starts again as ${version}. Turns still running stop when it quits. A release can make what an earlier one saved unreadable, so read the notes above first.`;

/** How big a download is, in words: whole megabytes, since the phone's data plan is counted that way. */
export const downloadSizeOf = (bytes: number): string => {
  if (bytes <= 0) return "of unknown size";
  const megabytes = Math.round(bytes / 1_000_000);
  return megabytes < 1 ? "under 1 MB" : `about ${megabytes} MB`;
};

/** What the question before an install on the phone says: Android closes the app, asks, and keeps the pairings. */
export const androidInstallWarningOf = (version: string): string =>
  `Android closes Outlore to install ${version} and asks you to confirm first. Open Outlore again afterwards: the phone stays paired. A release can make what an earlier one saved unreadable, so read the notes above first.`;

/** Why the app asks for Android's one-time allowance, shown before the setting opens. */
export const installAllowanceText =
  'Android lets an app install other apps, even itself, only after you allow it once. Android\'s setting for Outlore opens next: turn on "Install unknown apps" for Outlore, come back, and press Install update again. If you would rather not, install the release by hand from its page.';

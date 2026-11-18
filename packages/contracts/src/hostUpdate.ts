import { Schema } from "effect";

// Updating a host from a paired device (app-updates, Updating a host from a paired device): the device asks the host
// to update itself, and the host installs once no turn is running. The updater itself lives in the desktop app's main
// process; the service reaches it through the messages below.

/** The host's updater has nothing to offer here, with the reason in plain words (a development run, checking off). */
const Unsupported = Schema.TaggedStruct("Unsupported", { reason: Schema.String });
/** Nothing newer was found, or the reason a newer release could not be used; the note may be absent. */
const Idle = Schema.TaggedStruct("Idle", { note: Schema.NullOr(Schema.String) });
const Checking = Schema.TaggedStruct("Checking", {});
const Downloading = Schema.TaggedStruct("Downloading", { percent: Schema.Number, version: Schema.String });
/** The release is downloaded and waits: nothing installs until the host is told to. */
const Ready = Schema.TaggedStruct("Ready", { version: Schema.String });
const Failed = Schema.TaggedStruct("Failed", { message: Schema.String });

/** Where the desktop app's updater stands, as the service reads it from the main process. */
export const UpdaterStatus = Schema.Union([Unsupported, Idle, Checking, Downloading, Ready, Failed]);
export type UpdaterStatus = typeof UpdaterStatus.Type;

/** What the service asks of the desktop app's updater: its state, a check (and download), or the install. */
export const UpdaterCall = Schema.Struct({
  call: Schema.Literals(["state", "check", "install"]),
  id: Schema.String,
  type: Schema.Literal("updater"),
});
export type UpdaterCall = typeof UpdaterCall.Type;

/** The desktop app's answer to one call: the updater's state, or why the call failed. */
export const UpdaterReply = Schema.Struct({
  error: Schema.NullOr(Schema.String),
  id: Schema.String,
  status: Schema.NullOr(UpdaterStatus),
  type: Schema.Literal("updaterReply"),
});
export type UpdaterReply = typeof UpdaterReply.Type;

/** The host has an update downloaded and is waiting for its running turns to finish before it installs it. */
const WaitingForTurns = Schema.TaggedStruct("WaitingForTurns", {
  runningCount: Schema.Number,
  version: Schema.String,
});
/** The host is installing: it quits and starts the new release, and its devices reconnect by themselves. */
const Installing = Schema.TaggedStruct("Installing", { version: Schema.String });

/** Where updating the host stands: the updater's state, plus the two steps only the service takes. */
export const HostUpdateStatus = Schema.Union([
  Unsupported,
  Idle,
  Checking,
  Downloading,
  Ready,
  WaitingForTurns,
  Installing,
  Failed,
]);
export type HostUpdateStatus = typeof HostUpdateStatus.Type;

/** The host's release and where updating it stands. */
export const HostUpdate = Schema.Struct({ release: Schema.String, status: HostUpdateStatus });
export type HostUpdate = typeof HostUpdate.Type;

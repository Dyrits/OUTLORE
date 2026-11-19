import { isRecord } from "../../../packages/contracts/src/objects.ts";
import type { UpdateStatus } from "../../app/src/foundation/updateState.ts";

// The host's service runs in a utility process and cannot reach the updater, which lives here (app-updates, Updating a
// host from a paired device). It sends `{ type: "updater", id, call }` and this answers `{ type: "updaterReply", id,
// status, error }` on the same identifier. The shapes mirror `UpdaterCall` and `UpdaterReply` in `@outlore/contracts`,
// which the service decodes; the desktop's own build does not depend on that package.

/** Where the updater stands, in the words the service shows a paired device. */
export type ServiceUpdateStatus =
  | { readonly _tag: "Unsupported"; readonly reason: string }
  | { readonly _tag: "Idle"; readonly note: string | null }
  | { readonly _tag: "Checking" }
  | { readonly _tag: "Downloading"; readonly percent: number; readonly version: string }
  | { readonly _tag: "Ready"; readonly version: string }
  | { readonly _tag: "Failed"; readonly message: string };

/** What the main process offers the service: the controller's own methods, narrowed to what a host update needs. */
export interface ServiceUpdates {
  /** Looks for a newer release even while automatic checking is switched off: the owner asked for this one. */
  check(): Promise<{ readonly status: UpdateStatus }>;
  install(): Promise<void>;
  state(): { readonly status: UpdateStatus };
}

export const serviceStatusOf = (status: UpdateStatus): ServiceUpdateStatus => {
  if (status._tag === "Ready") return { _tag: "Ready", version: status.version };
  if (status._tag === "Failed") return { _tag: "Failed", message: status.message };
  // Only the phone's updater waits for a download choice; a host never sees it, and downloading is what it does.
  if (status._tag === "Available") return { _tag: "Idle", note: null };
  return status;
};

const callOf = (message: unknown): { call: string; id: string } | null => {
  if (!isRecord(message)) return null;
  const { call, id, type } = message;
  if (type !== "updater" || typeof id !== "string" || typeof call !== "string") return null;
  return { call, id };
};

/**
 * Answers the service's updater calls from `updates`, which may still be starting: a call waits for it, and the service
 * gives up on its own when it never comes. Returns the handler of one message from the service; other messages pass.
 */
export const answerServiceUpdates = (
  updates: Promise<ServiceUpdates>,
  reply: (message: unknown) => void,
): ((message: unknown) => void) => {
  return (message) => {
    const asked = callOf(message);
    if (asked === null) return;
    const { call, id } = asked;
    const answer = (status: ServiceUpdateStatus | null, error: string | null) =>
      reply({ error, id, status, type: "updaterReply" });
    void updates
      .then(async (current) => {
        if (call === "state") return answer(serviceStatusOf(current.state().status), null);
        if (call === "check") return answer(serviceStatusOf((await current.check()).status), null);
        if (call === "install") {
          await current.install();
          return answer(null, null);
        }
        return answer(null, `The updater does not know the call "${call}".`);
      })
      .catch((reason: unknown) => answer(null, reason instanceof Error ? reason.message : String(reason)));
  };
};

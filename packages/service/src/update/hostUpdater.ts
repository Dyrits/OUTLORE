import type { UpdaterStatus } from "@outlore/contracts";
import { Context, Effect, Layer } from "effect";

/** What the host's updater did when asked to install: nothing went wrong, or why it could not. */
export type InstallOutcome = { readonly failure: string | null };

/**
 * The updater of the app this host runs in. It lives in the desktop app's main process, which the service reaches
 * through its parent port; a service with no such parent has none. None of its effects fails: a problem becomes a
 * `Failed` status or an install failure the coordinator shows.
 */
export class HostUpdater extends Context.Service<
  HostUpdater,
  {
    /** Looks for a newer release and downloads it; ends with where the update then stands. */
    readonly check: Effect.Effect<UpdaterStatus>;
    /** Quits and starts the downloaded release. On success the host ends, so an answer may never arrive. */
    readonly install: Effect.Effect<InstallOutcome>;
    /** Where the update stands now. */
    readonly state: Effect.Effect<UpdaterStatus>;
  }
>()("outlore/HostUpdater") {}

/** A host with no updater (a development run, a service started on its own): it says why it cannot update. */
export const noHostUpdaterLayer = (reason = "This host does not update itself.") => {
  const status = { _tag: "Unsupported", reason } as const satisfies UpdaterStatus;
  return Layer.succeed(HostUpdater, {
    check: Effect.succeed(status),
    install: Effect.succeed({ failure: reason }),
    state: Effect.succeed(status),
  });
};

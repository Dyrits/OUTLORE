import type { Request, RequestTag } from "@outlore/contracts";
import type { Effect } from "effect";
import type { SqlClient, SqlError } from "effect/sql";
import type { Changes, ServiceFailure } from "../core/index.ts";
import type { HarnessTools } from "../harness/index.ts";
import type { makeHostControl, RemoteConfig } from "../remote/index.ts";
import type { AttachmentsRoot } from "./attachments.ts";
import type { CommandRunner, Commands } from "./commands.ts";
import type { PlanLimits } from "./planLimits.ts";
import type { AccountsRoot, Threads } from "./threads.ts";
import type { ScratchRoot } from "./workspaces.ts";

/** Services every owner request receives once at the router boundary. */
export type RequestServices =
  | SqlClient.SqlClient
  | HarnessTools
  | AccountsRoot
  | ScratchRoot
  | AttachmentsRoot
  | RemoteConfig
  | PlanLimits
  | Commands;

/** A typed request table whose environments are supplied by the router. */
export type OwnerHandlers<Tags extends RequestTag> = {
  readonly [Tag in Tags]: (
    request: Extract<Request, { _tag: Tag }>,
  ) => Effect.Effect<unknown, ServiceFailure | SqlError.SqlError, RequestServices>;
};

/** Runtime collaborators captured when the router builds its request tables. */
export interface HandlerDependencies {
  readonly change: <A, E, R>(
    work: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E | SqlError.SqlError, Exclude<R, SqlClient.SqlClient>>;
  readonly changes: Changes["Service"];
  readonly commands: CommandRunner;
  readonly hostControl: ReturnType<typeof makeHostControl>;
  readonly threads: Threads["Service"];
}

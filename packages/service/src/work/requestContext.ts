import type { Request, RequestTag, ResultOf } from "@outlore/contracts";
import type { Effect } from "effect";
import type { SqlClient, SqlError } from "effect/sql";
import type { Changes, Harness, ServiceFailure } from "../core/index.ts";
import type { HarnessTools } from "../harness/index.ts";
import type { makeHostControl, RemoteConfig } from "../remote/index.ts";
import type { VaultFolder } from "../vault/index.ts";
import type { AttachmentsRoot } from "./attachments.ts";
import type { CommandRunner, Commands } from "./commands.ts";
import type { PlanLimits } from "./planLimits.ts";
import type { AccountsRoot, Threads } from "./threads.ts";
import type { ScratchRoot } from "./workspaces.ts";

/** Services every owner request receives once at the router boundary. */
export type RequestServices =
  | SqlClient.SqlClient
  | Harness
  | HarnessTools
  | AccountsRoot
  | ScratchRoot
  | AttachmentsRoot
  | RemoteConfig
  | PlanLimits
  | VaultFolder
  | Commands;

/**
 * A typed request table whose environments are supplied by the router. Each handler answers exactly what its result
 * schema encodes, so an undefined answer for a Null result is a compile error instead of "The service failed
 * unexpectedly." after the work already ran (CHG-0677).
 */
export type OwnerHandlers<Tags extends RequestTag> = {
  readonly [Tag in Tags]: (
    request: Extract<Request, { _tag: Tag }>,
  ) => Effect.Effect<ResultOf<Tag>, ServiceFailure | SqlError.SqlError, RequestServices>;
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

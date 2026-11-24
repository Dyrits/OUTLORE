import type { Request, RequestSource, ResultOf } from "@outlore/contracts";
import { Context, type Effect } from "effect";
import type { ServiceFailure } from "./core/index.ts";

/** The entry point shared by app commands, paired devices, and, later, MCP calls. */
export class Service extends Context.Service<
  Service,
  {
    /** Answers a request with its own result; a paired device's folder requests are limited to the browsable roots (CHG-0253). */
    readonly handle: <R extends Request>(
      request: R,
      source?: RequestSource,
    ) => Effect.Effect<ResultOf<R["_tag"]>, ServiceFailure>;
  }
>()("outlore/Service") {}

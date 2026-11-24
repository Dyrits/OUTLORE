import type { HostUpdate } from "../update/index.ts";
import type { OwnerHandlers } from "./requestContext.ts";

/** Requests to update the host the service runs on, from its own window or a paired device (app-updates). */
export const hostUpdateHandlers = (hostUpdate: HostUpdate["Service"]) =>
  ({
    ForceUpdateHost: () => hostUpdate.force,
    ReadHostUpdate: () => hostUpdate.read,
    UpdateHost: () => hostUpdate.arm,
  }) satisfies OwnerHandlers<"ForceUpdateHost" | "ReadHostUpdate" | "UpdateHost">;

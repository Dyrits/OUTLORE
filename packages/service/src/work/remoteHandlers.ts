import { Effect } from "effect";
import { forgetHost, hostNameOf, listKnownHosts, pairWithHost, readHostRecord, renameHost } from "../remote/index.ts";
import type { HandlerDependencies, OwnerHandlers } from "./requestContext.ts";
/** Requests for remote share the service request context. */
export const remoteHandlers = ({
  change,
  hostControl,
  changes,
}: Pick<HandlerDependencies, "change" | "hostControl" | "changes">) =>
  ({
    AddHost: (add) => pairWithHost(add.code, add.deviceName).pipe(Effect.tap(() => changes.publish)),
    CreatePairingCode: () => hostControl.createPairingCode,
    DisconnectDevice: (given) => hostControl.disconnectDevice(given.deviceId),
    ListHosts: () => listKnownHosts,
    ReadHostName: () => Effect.flatMap(readHostRecord, hostNameOf),
    ReadRemoteAccess: () => hostControl.view,
    RemoveHost: (given) => change(forgetHost(given.hostId)).pipe(Effect.andThen(listKnownHosts)),
    RenameHost: (given) => change(renameHost(given.name)),
    SetRemoteAccess: (given) => hostControl.setAccess(given.isEnabled),
    // The deployment takes seconds and is not a command: only its result, the new address, is stored.
    UseOwnRelay: (given) => hostControl.useOwnRelay(given.token),
    UseSharedRelay: hostControl.useSharedRelay,
  }) satisfies OwnerHandlers<
    | "AddHost"
    | "CreatePairingCode"
    | "DisconnectDevice"
    | "ListHosts"
    | "ReadHostName"
    | "ReadRemoteAccess"
    | "RemoveHost"
    | "RenameHost"
    | "SetRemoteAccess"
    | "UseOwnRelay"
    | "UseSharedRelay"
  >;

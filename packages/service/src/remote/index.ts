export { computerNameOf, defaultRelayOrigin, RemoteConfig } from "./config.ts";
export { type HostChannel, openHostChannel, pairWithHost } from "./controller.ts";
export { answerText, encodeServerFrame } from "./frames.ts";
export { hostNameOf, ownAccountLabelOf, readHostRecord, renameHost } from "./hostAccess.ts";
export { makeHostControl } from "./hostControl.ts";
export { remoteHostLayer } from "./hostRuntime.ts";
export { forgetHost, listKnownHosts } from "./knownHosts.ts";
export { cloudflareApiFor, type DeployResult, deployRelayToCloudflare, ownRelayTag } from "./ownRelay.ts";
export {
  HostPresence,
  HostPresence as RemoteState,
  hostPresenceLayer,
  hostPresenceLayer as remoteStateLayer,
} from "./presence.ts";

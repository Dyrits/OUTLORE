/** What a person pastes to pair, or finds in an address bar or a launch argument: a code or a pairing link. */
export { pairingInputOf, readPairingInput } from "@outlore/channel";
export {
  type HostLink,
  isLocalOrigin,
  type LinkSettings,
  pairWithCode,
  type ResumeOptions,
  resumeHost,
} from "./hostLink.ts";
export type { HostLinkRecord, PairedHostStore } from "./hostStore.ts";
export { LinkFailure, linkCodeOf, releaseProblemOf } from "./linkFailure.ts";
export { createPairedHosts, type KeyValueStorage, type PairedHosts, type StoredHost } from "./pairedHosts.ts";
export { hostLinkCodes, type OpenTransport, type Transport, type TransportHandlers } from "./transport.ts";

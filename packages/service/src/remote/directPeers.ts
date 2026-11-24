import { type DirectSettings, defaultStunServers, type RtcConnectionClass, rtcPeers } from "@outlore/channel";

/**
 * Direct channels from this Node process, through werift (MIT, written in TypeScript, no native module; decision
 * record 0026). It loads on the first direct channel, so a host that never makes one does not carry it in memory.
 * werift names a public STUN server of its own when it is given none; the owner's list is the only one used here.
 */
export const weriftDirectSettings = (stunServers: readonly string[] = defaultStunServers): DirectSettings => ({
  peers: rtcPeers(
    async () => {
      const { RTCPeerConnection } = await import("werift");
      // werift follows the W3C names the adapter uses; its own types are wider than the structural ones.
      return RTCPeerConnection as unknown as RtcConnectionClass;
    },
    { iceUseDefaultStunServer: false },
  ),
  stunServers,
});

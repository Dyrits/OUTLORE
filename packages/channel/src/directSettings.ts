/**
 * The public STUN servers a peer asks for its own address. One server, Cloudflare's, because the relay already runs
 * there: a STUN server sees the address of whoever asks, and a second provider would learn it too (a decision to
 * confirm, device-pairing, Direct path). STUN carries none of the owner's data. A setting names others.
 */
export const defaultStunServers: readonly string[] = ["stun:stun.cloudflare.com:3478"];

/** How long each step of making a direct channel may take, in milliseconds. */
export type DirectTimings = {
  /** Waiting for the other side's answer to an offer. */
  readonly answerMillis: number;
  /** After a direct channel dropped, how long before the next try. */
  readonly afterDropMillis: number;
  /** The first wait after a failed try; each one after it doubles, up to `longestRetryMillis`. */
  readonly firstRetryMillis: number;
  /** Gathering the address candidates, which waits on the STUN server; what is found by then is used. */
  readonly gatherMillis: number;
  /** The Noise handshake inside the channel. */
  readonly handshakeMillis: number;
  /** The longest wait between tries. */
  readonly longestRetryMillis: number;
  /** From the answer until the channel is open: the connectivity checks between the two. */
  readonly openMillis: number;
};

export const defaultDirectTimings: DirectTimings = {
  afterDropMillis: 5_000,
  answerMillis: 10_000,
  firstRetryMillis: 30_000,
  gatherMillis: 4_000,
  handshakeMillis: 10_000,
  longestRetryMillis: 15 * 60_000,
  openMillis: 20_000,
};

import { Schema } from "effect";

// What the two sides say to each other, inside their secure channel over the relay, to set up a direct channel
// (device-pairing, Direct path). The relay carries these as it carries every message: unread.

/** What identifies one try: 16 random bytes in base64url, made by the device and part of both Noise prologues. */
const Attempt = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(64));
/** A session description with its candidates in it, as a browser or werift writes it. */
const Description = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(16_384));

/** The device's offer for a direct channel, made once its address candidates are gathered. */
export const DirectOffer = Schema.TaggedStruct("DirectOffer", { attempt: Attempt, sdp: Description });
/** The host's answer to an offer, made once its own candidates are gathered. */
export const DirectAnswer = Schema.TaggedStruct("DirectAnswer", { attempt: Attempt, sdp: Description });
/** The host turns an offer away: it is full ("busy") or does not make direct channels ("off"). */
export const DirectRefusal = Schema.TaggedStruct("DirectRefusal", {
  attempt: Attempt,
  reason: Schema.Literals(["busy", "off"]),
});

export const DirectControl = Schema.Union([DirectOffer, DirectAnswer, DirectRefusal]);
export type DirectControl = typeof DirectControl.Type;

/** A control message as the JSON text the link carries. */
export const DirectControlJson = Schema.fromJsonString(DirectControl);

export const encodeDirectControl = Schema.encodeSync(DirectControlJson);
/** Reads a control message; null for anything off-shape, which the caller ignores. */
export const parseDirectControl = (text: string): DirectControl | null => {
  try {
    return Schema.decodeUnknownSync(DirectControlJson)(text);
  } catch {
    return null;
  }
};

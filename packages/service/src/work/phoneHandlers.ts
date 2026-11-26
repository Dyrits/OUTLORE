import type { RequestSource } from "@outlore/contracts";
import { Effect } from "effect";
import { ServiceFailure } from "../core/index.ts";
import type { PhoneLink } from "./phoneLink.ts";
import type { OwnerHandlers } from "./requestContext.ts";

/** The device whose request this is: only a paired device has an identity, so the host window cannot speak for a phone. */
const deviceOf = (source: RequestSource) =>
  source.isPairedDevice && source.deviceId != null
    ? Effect.succeed(source.deviceId)
    : Effect.fail(new ServiceFailure({ kind: "AccessRefused", message: "Only a paired phone can do this." }));

/**
 * The requests a paired phone makes about itself (phone-control): which groups its owner has switched on, and its
 * answer to a call. Each is keyed on the authenticated source's device, never on anything the request says.
 */
export const phoneHandlers = (link: PhoneLink["Service"], source: RequestSource) =>
  ({
    AnswerPhoneCall: ({ callId, outcome }) =>
      Effect.flatMap(deviceOf(source), (deviceId) => link.answer(deviceId, callId, outcome)).pipe(Effect.as(null)),
    SetPhoneTools: ({ groups }) =>
      Effect.flatMap(deviceOf(source), (deviceId) => link.setGroups(deviceId, groups)).pipe(Effect.as(null)),
  }) satisfies OwnerHandlers<"AnswerPhoneCall" | "SetPhoneTools">;

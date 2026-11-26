import type { AnswerPhoneCall, PhoneCall, SetPhoneTools } from "@outlore/contracts";
import type { PhoneExecutor } from "./phoneExecutor";
import type { PhoneSwitches } from "./phoneSwitches";

/** The two requests a phone sends its host: the groups it allows, and the answer to a call. */
export type PhoneRequest = typeof SetPhoneTools.Type | typeof AnswerPhoneCall.Type;

/** What the phone's calls need from the app: its identity at the host, its executor and switches, and a way to send. */
export type PhoneCallsParts = {
  /** The paired-device identity the host knows this phone by; null before the app knows it. */
  readonly deviceId: string | null;
  readonly executor: PhoneExecutor;
  /** Sends a request to the host over the paired link (the service client's `request`). */
  readonly send: (request: PhoneRequest) => Promise<unknown>;
  readonly switches: PhoneSwitches;
};

/**
 * The phone's end of the phone tools: it answers each `PhoneCall` frame its host sends and tells the host which groups
 * the owner allows. A failed send is dropped: the host times a call out at 30 seconds, and the next connect announces
 * the groups again.
 */
export const createPhoneCalls = ({ deviceId, executor, send, switches }: PhoneCallsParts) => {
  const sendQuietly = (request: PhoneRequest) =>
    send(request).then(
      () => void 0,
      () => void 0,
    );
  return {
    /** Tells the host the groups that are on; call it on every (re)connect and after each change. */
    announce: () => sendQuietly({ _tag: "SetPhoneTools", groups: switches.groups() }),
    /** Runs a call the host sent and answers it; a call for another screen is ignored without an answer. */
    handle: async (call: PhoneCall) => {
      if (deviceId === null || call.deviceId !== deviceId) return;
      await sendQuietly({ _tag: "AnswerPhoneCall", callId: call.callId, outcome: await executor.execute(call) });
    },
  };
};

/** The phone's calls. */
export type PhoneCalls = ReturnType<typeof createPhoneCalls>;

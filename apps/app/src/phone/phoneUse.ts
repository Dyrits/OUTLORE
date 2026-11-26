import type { PhoneCall } from "@outlore/contracts";
import type { PhoneCalls } from "./phoneCalls";
import type { PhoneSwitches } from "./phoneSwitches";

/** What the phone needs from its connection to the host: to hear of every (re)connect and of the calls sent to it. */
export interface PhoneClient {
  /** Calls the listener each time the link opens, first time or again; returns how to stop. */
  readonly subscribeOpen: (listener: () => void) => () => void;
  /** Calls the listener with each `PhoneCall` frame the host sends; returns how to stop. */
  readonly subscribePhoneCalls: (listener: (call: PhoneCall) => void) => () => void;
}

/**
 * Starts the phone's use over one connection to a host: announces the allowed groups now, on each reconnect and after
 * each change of a switch, and answers the calls the host sends. Returns how to end it.
 */
export const startPhoneUse = ({
  calls,
  client,
  switches,
}: {
  calls: PhoneCalls;
  client: PhoneClient;
  switches: PhoneSwitches;
}) => {
  const announce = () => void calls.announce();
  announce();
  const stops = [
    client.subscribeOpen(announce),
    switches.subscribe(announce),
    client.subscribePhoneCalls((call) => void calls.handle(call)),
  ];
  return () => {
    for (const stop of stops) stop();
  };
};

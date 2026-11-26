import { useEffect } from "react";
import { createPhoneCalls, type PhoneRequest } from "./phoneCalls";
import { phoneDevice } from "./phoneDevice";
import { createPhoneExecutor } from "./phoneExecutor";
import { phoneSwitchesOfApp } from "./phoneSwitchesOfApp";
import { type PhoneClient, startPhoneUse } from "./phoneUse";

/** A connection to the host that serves the phone's calls: what `ServiceClient` offers, once it knows the phone requests. */
export type PhoneUseClient = PhoneClient & { readonly request: (request: PhoneRequest) => Promise<unknown> };

/**
 * Serves the host's `phone_*` calls over the connection while the phone app shows that host: announces the allowed
 * groups, answers calls, and stops when the connection or the identity changes. Only the phone app calls it with a
 * client; a browser and the desktop window pass null and never send the phone's requests.
 */
export function usePhoneUse(client: PhoneUseClient | null, deviceId: string | null) {
  useEffect(() => {
    if (client === null) return;
    const switches = phoneSwitchesOfApp();
    const calls = createPhoneCalls({
      deviceId,
      executor: createPhoneExecutor({ device: phoneDevice(), groups: switches.groups }),
      send: (request) => client.request(request),
      switches,
    });
    return startPhoneUse({ calls, client, switches });
  }, [client, deviceId]);
}

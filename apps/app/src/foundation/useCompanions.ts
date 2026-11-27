import type { CompanionChoice } from "@outlore/contracts";
import { useEffect, useState } from "react";
import type { ServiceClient } from "./client";

// The Companions a typed `@` can ask (thread-messaging, Mentioning a Companion with @; CHG-0781): the models of the
// signed-in accounts, asked again each time a message box or a message with a Companion chip needs them, since an account
// can sign in or out at any time, and the last answer shown meanwhile.

const known = new WeakMap<ServiceClient, ReadonlyArray<CompanionChoice>>();

/** The Companions to offer or to name as chips; null until first loaded, or while not needed. */
export function useCompanions(client: ServiceClient | undefined, isNeeded: boolean) {
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (client === undefined || !isNeeded) return;
    let isCurrent = true;
    client.request({ _tag: "ListCompanions" }).then(
      (companions) => {
        known.set(client, companions);
        if (isCurrent) setVersion((version) => version + 1);
      },
      // A failed read keeps the last list; the next need reads again.
      () => void 0,
    );
    return () => {
      isCurrent = false;
    };
  }, [client, isNeeded]);
  return client === undefined || !isNeeded ? null : (known.get(client) ?? null);
}

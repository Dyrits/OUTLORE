import type { PhoneGroup } from "@outlore/contracts";
import { useEffect, useState } from "react";
import { phoneSwitchesOfApp } from "./phoneSwitchesOfApp";

/** The groups the owner switched on, kept current while a card shows them, and how to turn one on or off. */
export function usePhoneGroups() {
  const switches = phoneSwitchesOfApp();
  const [groups, setGroups] = useState<ReadonlyArray<PhoneGroup>>(() => switches.groups());
  useEffect(() => {
    setGroups(switches.groups());
    return switches.subscribe(() => setGroups(switches.groups()));
  }, [switches]);
  return { groups, set: switches.set };
}

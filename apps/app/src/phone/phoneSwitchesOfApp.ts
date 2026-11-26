import { pairingStorage } from "../foundation/native/pairingStorage";
import { createPhoneSwitches, type PhoneSwitches } from "./phoneSwitches";

let switches: PhoneSwitches | null = null;

/**
 * The one set of switches this app holds, kept in the phone's secure store (the pairings' store, which only this app
 * reads). Made at first use, so a build that never asks for it never opens the store.
 */
export const phoneSwitchesOfApp = (): PhoneSwitches => {
  switches ??= createPhoneSwitches(pairingStorage());
  return switches;
};

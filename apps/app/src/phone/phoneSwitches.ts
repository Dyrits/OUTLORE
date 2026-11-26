import { PhoneGroup } from "@outlore/contracts";
import type { KeyValueStorage } from "@outlore/controller";

const key = "outlore.phoneGroups";

/**
 * The switches of Let threads use this phone: which groups of `phone_*` tools the owner allowed. They live in the
 * phone's own storage and nowhere else; a host, a thread or another device can never change them or read them back
 * (phone-control). Every group is off until the owner turns it on.
 */
export const createPhoneSwitches = (storage: KeyValueStorage) => {
  const listeners = new Set<() => void>();
  const read = (): ReadonlyArray<PhoneGroup> => {
    try {
      const stored: unknown = JSON.parse(storage.getItem(key) ?? "[]");
      return Array.isArray(stored) ? PhoneGroup.literals.filter((group) => stored.some((item) => item === group)) : [];
    } catch {
      return [];
    }
  };
  return {
    /** The groups that are on, in the card's order. */
    groups: read,
    /** Turns a group on or off, and tells the listeners when that changed something. */
    set: (group: PhoneGroup, isOn: boolean) => {
      const current = read();
      if (current.includes(group) === isOn) return;
      const next = PhoneGroup.literals.filter((candidate) =>
        candidate === group ? isOn : current.includes(candidate),
      );
      storage.setItem(key, JSON.stringify(next));
      for (const listener of listeners) listener();
    },
    /** Calls the listener after each change; returns how to stop. */
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
};

/** The phone's switches. */
export type PhoneSwitches = ReturnType<typeof createPhoneSwitches>;

import { PhoneGroup } from "@outlore/contracts";

/** What each switch of Let threads use this phone is called and allows, in the words the owner reads. */
export const phoneGroupTexts = {
  Clipboard: { description: "Read the text on the clipboard and replace it.", label: "Clipboard" },
  Information: {
    description: "The battery level and whether it charges, the kind of network, the phone's model and its time zone.",
    label: "Information",
  },
  Location: {
    description: "The phone's current position and how exact it is. Android asks you the first time.",
    label: "Location",
  },
  Notify: {
    description: "Show a notification with a title and text. Android asks you the first time.",
    label: "Notify",
  },
  Open: { description: "Open a link, or an installed app by name.", label: "Open" },
} as const satisfies Record<PhoneGroup, { description: string; label: string }>;

/** The switches in the card's order. */
export const phoneGroupOrder = PhoneGroup.literals;

/** What the card says before any switch is turned on: where results go, what Outlore keeps, and when it works. */
export const phoneUseNotice =
  "A thread that uses the phone sends what it reads, such as your position or the clipboard text, to its model provider, like any tool result. Outlore stores no location or clipboard text. It works only while Outlore is open on this phone, and each switch below is the only permission it needs: nothing asks again.";

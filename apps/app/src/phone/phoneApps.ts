/** How an app opens: through a link its scheme answers, or an Android intent action. */
export type PhoneAppOpening =
  | { readonly _tag: "Url"; readonly url: string }
  | { readonly _tag: "Intent"; readonly action: string };

/**
 * The apps `phone_open` knows by name. Android lets an app open another only through a link or an intent, never by the
 * name on its icon, so the names are a short list of the ones whose address is the same on every phone.
 */
export const phoneApps = {
  calendar: { _tag: "Url", url: "content://com.android.calendar/time/" },
  dialer: { _tag: "Url", url: "tel:" },
  email: { _tag: "Url", url: "mailto:" },
  maps: { _tag: "Url", url: "geo:0,0" },
  messages: { _tag: "Url", url: "sms:" },
  settings: { _tag: "Intent", action: "android.settings.SETTINGS" },
  spotify: { _tag: "Url", url: "spotify://" },
  telegram: { _tag: "Url", url: "tg://" },
  whatsapp: { _tag: "Url", url: "whatsapp://" },
  youtube: { _tag: "Url", url: "vnd.youtube://" },
} as const satisfies Record<string, PhoneAppOpening>;

/** The names of the apps `phone_open` knows, to tell a thread what to ask for. */
export const phoneAppNames = Object.keys(phoneApps).join(", ");

/** How to open an app by the name a thread gave (case and spaces ignored); null when the name is not known. */
export const phoneAppOpeningOf = (name: string): PhoneAppOpening | null => {
  const key = name.trim().toLowerCase();
  return Object.entries(phoneApps).find(([known]) => known === key)?.[1] ?? null;
};

/** The link schemes a thread may open; the rest (`intent:`, `content:`, `file:`, `javascript:`) are not links to show the owner. */
const openableSchemes = ["http:", "https:", "mailto:", "tel:", "sms:", "geo:"];

/** Whether a thread may ask the phone to open this address. */
export const isOpenableLink = (url: string): boolean => {
  const scheme = /^([a-z][a-z0-9+.-]*:)/i.exec(url.trim())?.[1]?.toLowerCase();
  return scheme !== undefined && openableSchemes.includes(scheme);
};

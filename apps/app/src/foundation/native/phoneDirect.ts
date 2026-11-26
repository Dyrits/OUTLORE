import type { PageSettings } from "@outlore/controller/browser";

// The web build and the desktop window use the browser's own WebRTC (`directSettingsOfPage`); only the native build
// gets direct channels from a native module, in `phoneDirect.native.ts`, which Metro picks on a phone.
/** How the phone app makes direct channels to a host: none outside the phone. */
export const directSettingsOfPhone = (): PageSettings["direct"] => void 0;

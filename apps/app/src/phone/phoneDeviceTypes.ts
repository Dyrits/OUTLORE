import type { PhoneOutcome } from "@outlore/contracts";

/** What `phone_open` opens: a link, or an installed app by the name the owner knows it by. */
export type PhoneOpenTarget =
  | { readonly _tag: "Link"; readonly url: string }
  | { readonly _tag: "App"; readonly name: string };

/**
 * What the phone itself can do for a thread: one call per `phone_*` tool. Each answers `Done` with the value, or
 * `Refused` with one plain sentence when Android or the platform will not. Adapters: Expo on the phone
 * (`phoneDevice.native.ts`), a refusal everywhere else (`phoneDevice.ts`), and a fake in tests.
 */
export interface PhoneDevice {
  readonly info: () => Promise<PhoneOutcome>;
  readonly location: () => Promise<PhoneOutcome>;
  readonly notify: (message: { readonly text: string; readonly title: string }) => Promise<PhoneOutcome>;
  readonly open: (target: PhoneOpenTarget) => Promise<PhoneOutcome>;
  readonly readClipboard: () => Promise<PhoneOutcome>;
  readonly writeClipboard: (text: string) => Promise<PhoneOutcome>;
}

/** A finished call, with the value the tool returns. */
export const phoneDone = (value: unknown): PhoneOutcome => ({ _tag: "Done", value });

/** A call the phone did not do, with the one sentence a thread can read and relay. */
export const phoneRefused = (reason: string): PhoneOutcome => ({ _tag: "Refused", reason });

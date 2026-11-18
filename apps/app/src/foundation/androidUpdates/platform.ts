import type { AndroidUpdatesBridge } from "../updateState";

/** The updates of the phone's app: none off the phone, where the browser or the desktop window updates itself. */
export const androidUpdatesBridge = (): AndroidUpdatesBridge | null => null;

/** Starts looking for a newer release, once; nothing off the phone. */
export const startAndroidUpdates = (): void => undefined;

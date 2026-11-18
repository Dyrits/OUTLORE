import {
  type Choice,
  checksumsOf,
  chooseReleaseFor,
  type FoundRelease,
  listingsOf,
  plainNotesOf,
  type ReleaseListing,
  sumsFileName,
} from "../../../../packages/contracts/src/releaseChoice.ts";

// This computer's installer is the DMG of its architecture.
export { type Choice, checksumsOf, type FoundRelease, listingsOf, plainNotesOf, type ReleaseListing, sumsFileName };

/** The newest release newer than the running version that carries this computer's installer and the checksums. */
export const chooseRelease = (
  listings: readonly ReleaseListing[],
  running: { readonly arch: string; readonly version: string },
): Choice => chooseReleaseFor(listings, running.version, (number) => `Outlore-${number}-mac-${running.arch}.dmg`);

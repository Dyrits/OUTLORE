/** Expanded Chronicler owns the Companions tab; a docked conversation shares it with the visible page. */
export const isCompanionInScope = (isChronicler: boolean, isChroniclerFull: boolean) =>
  !isChroniclerFull || isChronicler;

/**
 * Whether the Companions tab offers a Companion: it is in scope, and Chronicler's own only while Chronicler is open on the
 * right. With nothing offered and no quest panel, the right-hand column and its handle are not there.
 */
export const isCompanionOffered = (isChronicler: boolean, isChroniclerFull: boolean, isChroniclerOpen: boolean) =>
  isCompanionInScope(isChronicler, isChroniclerFull) && (!isChronicler || isChroniclerOpen);

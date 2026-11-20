/**
 * Whether the Companions tab offers a Companion: a page's own always, Chronicler's only while the Chronicle is open
 * (not folded to a strip). With nothing offered and no quest panel, the right-hand column and its handle are not there.
 */
export const isCompanionOffered = (isChronicler: boolean, isChroniclerOpen: boolean) =>
  !isChronicler || isChroniclerOpen;

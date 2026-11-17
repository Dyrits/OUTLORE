import { decodePairingCode, isLocalOrigin, type PairingCode, type PairingCodeErrorKind } from "./pairingCode.ts";
import { fail, type Result } from "./result.ts";

// A pairing link carries a pairing code in its fragment, which a browser never sends to a server and a relay or
// access log never sees. It is as secret as the code: it works once and expires with it (device-pairing).

/** Where the app link points: `outlore://pair#<code>`. */
const appLinkBase = "outlore://pair";
const codeLikePattern = /^outlore\d+-/;

/** The link that opens the web app and pairs: the web app's address with the code as its fragment. */
export function webPairingLinkOf(webAppUrl: string, code: string): string {
  return `${webAppUrl.replace(/\/+$/, "")}/#${code}`;
}

/** The link that opens the installed desktop or phone app and pairs: `outlore://pair#<code>`. */
export function appPairingLinkOf(code: string): string {
  return `${appLinkBase}#${code}`;
}

/** What comes before the fragment of `text`, and the fragment; null when `text` has no fragment. */
const splitFragment = (text: string) => {
  const index = text.indexOf("#");
  return index === -1 ? null : { base: text.slice(0, index), fragment: text.slice(index + 1) };
};

/** Whether the part of a link before its fragment is Outlore's: the app link, or the address of a web page. */
const isPairingBase = (base: string): boolean => {
  const withoutSlash = base.replace(/\/+$/, "");
  if (withoutSlash.toLowerCase() === appLinkBase) return true;
  if (!URL.canParse(base)) return false;
  const url = new URL(base);
  // A query has no place in a pairing link: the code would reach a server.
  if (url.search !== "") return false;
  return url.protocol === "https:" || (url.protocol === "http:" && isLocalOrigin(url.origin));
};

/**
 * Reads what a person pastes to pair: a raw pairing code, a web link with the code in its fragment, or an `outlore://`
 * link. Surrounding whitespace is ignored; the Result is that of {@link decodePairingCode}.
 */
export function readPairingInput(text: string): Result<PairingCode, PairingCodeErrorKind> {
  const trimmed = text.trim();
  const split = splitFragment(trimmed);
  if (split === null) return decodePairingCode(trimmed);
  if (!isPairingBase(split.base)) return fail("malformed");
  return decodePairingCode(split.fragment);
}

/**
 * The pairing text in a location hash (`#outlore1-…`) or a whole link, or null when there is none, so a page's own
 * fragment is left alone. The text may still be a bad code: {@link readPairingInput} says why.
 */
export function pairingInputOf(text: string): string | null {
  const trimmed = text.trim();
  const split = splitFragment(trimmed);
  if (split === null) return null;
  if (split.base !== "" && !isPairingBase(split.base)) return null;
  return codeLikePattern.test(split.fragment) ? split.fragment : null;
}

// Choosing a release to update to, shared by the desktop's updater and the phone's: versions, GitHub's release list, and
// which release a running version moves to. Pure and free of platform APIs, so both read it (app-updates).

import { isRecord } from "./objects.ts";

/** A version split into its semantic-version parts; `null` when the text is not a version. */
export type Version = { readonly core: readonly [number, number, number]; readonly prerelease: readonly string[] };

const versionPattern = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** Reads `1.2.3`, `v1.2.3-Prototype`, or `1.2.3-beta.1` as a version. */
export const parseVersion = (text: string): Version | null => {
  const match = versionPattern.exec(text.trim());
  if (match === null) return null;
  const [, major, minor, patch, prerelease] = match;
  return {
    core: [Number(major), Number(minor), Number(patch)],
    prerelease: prerelease === undefined ? [] : prerelease.split("."),
  };
};

const isNumeric = (identifier: string) => /^\d+$/.test(identifier);

const compareIdentifiers = (left: string, right: string) => {
  if (isNumeric(left) && isNumeric(right)) return Math.sign(Number(left) - Number(right));
  // A number ranks below a word, as in semantic versioning.
  if (isNumeric(left)) return -1;
  if (isNumeric(right)) return 1;
  return left < right ? -1 : left > right ? 1 : 0;
};

/** Orders two versions as semantic versioning does: a prerelease ranks below its release. Negative when `left` is older. */
export const compareVersions = (left: Version, right: Version) => {
  for (const index of [0, 1, 2] as const) {
    const difference = left.core[index] - right.core[index];
    if (difference !== 0) return Math.sign(difference);
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0)
    return Math.sign(right.prerelease.length - left.prerelease.length);
  const shared = Math.min(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < shared; index++) {
    const difference = compareIdentifiers(left.prerelease[index] ?? "", right.prerelease[index] ?? "");
    if (difference !== 0) return difference;
  }
  return Math.sign(left.prerelease.length - right.prerelease.length);
};

/** Whether a version names a prerelease: a build with one follows prereleases, a stable build only stable releases. */
export const isPrerelease = (version: Version) => version.prerelease.length > 0;

/** The repository's public release list, the one address a check asks; a development run may name another. */
export const defaultReleasesUrl = "https://api.github.com/repos/Dyrits/OUTLORE/releases?per_page=30";

/** The page owners can open when an update cannot install itself. */
export const releasesPageUrl = "https://github.com/Dyrits/OUTLORE/releases";

/** A GitHub release, reduced to what choosing an update reads. */
export type ReleaseListing = {
  readonly assets: readonly { readonly name: string; readonly size: number; readonly url: string }[];
  readonly isDraft: boolean;
  readonly isPrerelease: boolean;
  readonly notes: string;
  readonly pageUrl: string;
  readonly tag: string;
};

/** A newer release with the files this computer needs, ready to download. */
export type FoundRelease = {
  readonly installer: { readonly name: string; readonly size: number; readonly url: string };
  readonly notes: string;
  readonly pageUrl: string;
  readonly sumsUrl: string;
  readonly version: string;
};

/** The file of checksums the release workflow publishes beside the installers. */
export const sumsFileName = "SHA512SUMS.txt";

/** Reads GitHub's release list, leaving out anything that does not have the expected shape. */
export const listingsOf = (json: unknown): ReleaseListing[] => {
  if (!Array.isArray(json)) return [];
  return json.flatMap((entry: unknown): ReleaseListing[] => {
    if (!isRecord(entry) || typeof entry.tag_name !== "string" || typeof entry.html_url !== "string") return [];
    const assets = Array.isArray(entry.assets) ? entry.assets : [];
    return [
      {
        assets: assets.flatMap((asset: unknown) =>
          isRecord(asset) &&
          typeof asset.name === "string" &&
          typeof asset.browser_download_url === "string" &&
          typeof asset.size === "number"
            ? [{ name: asset.name, size: asset.size, url: asset.browser_download_url }]
            : [],
        ),
        isDraft: entry.draft === true,
        isPrerelease: entry.prerelease === true,
        notes: typeof entry.body === "string" ? entry.body : "",
        pageUrl: entry.html_url,
        tag: entry.tag_name,
      },
    ];
  });
};

/** What a check found: a release to install, or none, with why when a newer one cannot be used. */
export type Choice =
  | { readonly _tag: "Found"; readonly release: FoundRelease }
  | { readonly _tag: "None"; readonly reason: string | null };

/**
 * The newest release newer than the running version that carries the installer `installerNameOf` names (given the
 * release's number) and the checksums: a prerelease build follows prereleases and stable releases, a stable build
 * stable releases only.
 */
export const chooseReleaseFor = (
  listings: readonly ReleaseListing[],
  runningVersion: string,
  installerNameOf: (number: string) => string,
): Choice => {
  const current = parseVersion(runningVersion);
  if (current === null) return { _tag: "None", reason: `The running version ${runningVersion} cannot be compared.` };
  const newer = listings
    .flatMap((listing) => {
      const version = parseVersion(listing.tag);
      const isOfChannel = isPrerelease(current) || (!listing.isPrerelease && !isPrerelease(version ?? current));
      if (listing.isDraft || version === null || !isOfChannel || compareVersions(version, current) <= 0) return [];
      return [{ listing, number: listing.tag.replace(/^v/, ""), version }];
    })
    .sort((left, right) => compareVersions(right.version, left.version));
  let reason: string | null = null;
  for (const { listing, number } of newer) {
    const installerName = installerNameOf(number);
    const installer = listing.assets.find((asset) => asset.name === installerName);
    const sums = listing.assets.find((asset) => asset.name === sumsFileName);
    if (installer !== undefined && sums !== undefined)
      return {
        _tag: "Found",
        release: { installer, notes: listing.notes, pageUrl: listing.pageUrl, sumsUrl: sums.url, version: number },
      };
    reason ??= `Release ${number} has no ${installer === undefined ? installerName : sumsFileName}.`;
  }
  return { _tag: "None", reason };
};

/** Reads `sha512sum` or `shasum` output (`<hash>  <name>`) into the hash of each file. */
export const checksumsOf = (text: string): Map<string, string> => {
  const sums = new Map<string, string>();
  for (const line of text.split("\n")) {
    const match = /^([0-9a-fA-F]{128})\s+\*?(.+?)\s*$/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) sums.set(match[2], match[1].toLowerCase());
  }
  return sums;
};

/** The notes of a release as plain text: tags and entities of the HTML GitHub's feed carries are removed. */
export const plainNotesOf = (notes: string): string =>
  notes
    .replace(/<\/(p|li|h[1-6]|div|ul|ol)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

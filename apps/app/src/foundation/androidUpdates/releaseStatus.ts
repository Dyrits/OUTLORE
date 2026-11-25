import type { FoundRelease } from "@outlore/contracts";
import type { UpdateStatus } from "../updateState";

/** The host of a URL, for the words of a failed request. */
export const hostOf = (url: string) => /^https?:\/\/([^/]+)/.exec(url)?.[1] ?? url;

/** A request to GitHub that failed, in words for the Updates section. */
export class RequestFailure extends Error {}

/** The status of a release that is found and waits for the owner. */
export const availableOf = (release: FoundRelease): UpdateStatus => ({
  _tag: "Available",
  notes: release.notes,
  pageUrl: release.pageUrl,
  sizeBytes: release.installer.size,
  version: release.version,
});

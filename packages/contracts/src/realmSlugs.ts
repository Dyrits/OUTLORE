/** The longest a realm's name may be. */
const REALM_NAME_LIMIT = 80;

/**
 * A realm's name as it is kept, written like a Slack channel: lowercase words joined by single hyphens, letters and digits
 * only, accents dropped. Empty when nothing of the name is a letter or a digit. Applying it twice changes nothing.
 */
export const realmSlugOf = (name: string): string =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, REALM_NAME_LIMIT)
    .replace(/-+$/g, "");

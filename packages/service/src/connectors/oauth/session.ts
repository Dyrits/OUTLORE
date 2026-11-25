import { Schema } from "effect";
import { type CatalogEntry, isOAuthEntry } from "../catalog.ts";

// Versioned OAuth 2.1 session record stored as one encrypted Vault secret under `oauthSecretKind` (ADR 0027).
// Keeping the access token, refresh token and dynamic client metadata together avoids a parallel token store while
// letting the host refresh expired tokens and redact every sensitive field from tool outputs.

/** Refresh tokens this many milliseconds before their recorded expiry to avoid racing a boundary. */
const refreshSkewMillis = 60_000;

/** The OAuth 2.1 session persisted in the Vault for one connector. */
export const OAuthSession = Schema.Struct({
  accessToken: Schema.String,
  clientId: Schema.String,
  clientSecret: Schema.NullOr(Schema.String),
  expiresAt: Schema.NullOr(Schema.Number),
  refreshToken: Schema.NullOr(Schema.String),
  resource: Schema.NullOr(Schema.String),
  scope: Schema.NullOr(Schema.String),
  tokenEndpoint: Schema.String,
  version: Schema.Literal(1),
});
export type OAuthSession = typeof OAuthSession.Type;

const decodeUnknown = Schema.decodeUnknownOption(OAuthSession);

/** Encodes an OAuth session as JSON text for Vault storage. */
export const encodeOAuthSession = (session: OAuthSession): string => JSON.stringify(session);

/** Parses an OAuth session from a Vault secret string, or returns null when malformed. */
export const decodeOAuthSession = (raw: string): OAuthSession | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    const decoded = decodeUnknown(parsed);
    return decoded._tag === "Some" ? decoded.value : null;
  } catch {
    return null;
  }
};

/** Whether the session's access token is expired or within the refresh skew window at `nowMillis`. */
export const isSessionExpired = (session: OAuthSession, nowMillis: number): boolean =>
  session.expiresAt !== null && nowMillis + refreshSkewMillis >= session.expiresAt;

/** Every secret string inside an OAuth session that must be redacted from tool results and metadata. */
export const oauthSecretsOf = (session: OAuthSession): ReadonlyArray<string> => {
  const values: Array<string> = [session.accessToken];
  if (session.refreshToken !== null && session.refreshToken !== "") values.push(session.refreshToken);
  if (session.clientSecret !== null && session.clientSecret !== "") values.push(session.clientSecret);
  return values;
};

/** Every secret string to redact for a connector's Vault value, extracting inner tokens for OAuth sessions. */
export const redactionSecretsOf = (entry: CatalogEntry, rawSecret: string | null): ReadonlyArray<string> => {
  if (rawSecret === null || rawSecret === "") return [];
  if (!isOAuthEntry(entry)) return [rawSecret];
  const session = decodeOAuthSession(rawSecret);
  return session === null ? [rawSecret] : [rawSecret, ...oauthSecretsOf(session)];
};

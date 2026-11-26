import { Schema } from "effect";

// Shared OAuth 2.1 failure type, metadata shapes, URL safety checks, and header parsing.

/** A failure during MCP OAuth 2.1 discovery, registration, sign-in or token refresh. */
export class OAuthFailure extends Schema.TaggedError<OAuthFailure>()("OAuthFailure", {
  kind: Schema.Literals([
    "Discovery",
    "Registration",
    "Authorization",
    "TokenExchange",
    "Refresh",
    "Redirect",
    "StateMismatch",
    "Timeout",
    "Vault",
  ]),
  message: Schema.String,
}) {}

/** Parsed Bearer challenge fields from a `WWW-Authenticate` response header. */
export type BearerChallenge = {
  readonly resourceMetadata: string | null;
  readonly scope: string | null;
};

/** Discovered OAuth 2.1 endpoints and metadata for one remote MCP server. */
export type DiscoveredOAuth = {
  readonly authorizationEndpoint: string;
  readonly issuer: string;
  readonly registrationEndpoint: string | null;
  readonly resource: string;
  readonly scopesSupported: ReadonlyArray<string>;
  readonly tokenEndpoint: string;
};

/** Whether a URL uses HTTPS, or HTTP on a loopback address (for local test servers). */
export const isAllowedOAuthUrl = (rawUrl: string): boolean => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "https:") return true;
    return parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
  } catch {
    return false;
  }
};

/** Parses `resource_metadata` and `scope` parameters from a `WWW-Authenticate: Bearer ...` header. */
export const parseWwwAuthenticate = (header: string): BearerChallenge => {
  const extract = (name: string): string | null => {
    const quoted = new RegExp(`(?:^|[,\\s])${name}="([^"]*)"`, "i").exec(header);
    if (quoted?.[1] !== undefined) return quoted[1];
    const token = new RegExp(`(?:^|[,\\s])${name}=([^,\\s]+)`, "i").exec(header);
    return token?.[1] ?? null;
  };
  return {
    resourceMetadata: extract("resource_metadata"),
    scope: extract("scope"),
  };
};

import { Effect, Schema } from "effect";
import { fieldOf, isRecord, textFieldOf } from "../../core/index.ts";

// RFC 9728 Protected Resource Metadata and RFC 8414 / OIDC Authorization Server Metadata discovery for MCP OAuth 2.1.
// Redirects are never followed automatically, and non-HTTPS endpoints are refused outside loopback addresses.

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

/** Fetches a JSON metadata document without following redirects. */
const fetchJson = (url: string, timeoutMillis: number): Effect.Effect<Record<string, unknown>, OAuthFailure> =>
  Effect.gen(function* () {
    if (!isAllowedOAuthUrl(url)) {
      return yield* new OAuthFailure({
        kind: "Discovery",
        message: "The server advertised an OAuth address that is not HTTPS.",
      });
    }
    const response = yield* Effect.tryPromise({
      catch: () =>
        new OAuthFailure({
          kind: "Discovery",
          message: "Could not reach the server's OAuth metadata.",
        }),
      try: (signal) =>
        fetch(url, {
          headers: { accept: "application/json" },
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMillis)]),
        }),
    });
    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      return yield* new OAuthFailure({
        kind: "Redirect",
        message: "The server redirected an OAuth metadata request, which Outlore does not follow.",
      });
    }
    if (response.status < 200 || response.status >= 300) {
      return yield* new OAuthFailure({
        kind: "Discovery",
        message: `The server's OAuth metadata returned HTTP ${response.status}.`,
      });
    }
    const body = yield* Effect.tryPromise({
      catch: () => new OAuthFailure({ kind: "Discovery", message: "Could not read the server's OAuth metadata." }),
      try: () => response.text(),
    });
    try {
      const parsed: unknown = JSON.parse(body);
      if (isRecord(parsed)) return parsed;
    } catch {
      // Handled below as a Discovery failure.
    }
    return yield* new OAuthFailure({
      kind: "Discovery",
      message: "The server's OAuth metadata was not valid JSON.",
    });
  });

/** Probes the MCP endpoint without credentials to read its `WWW-Authenticate` challenge, if any. */
const probeChallenge = (resourceUrl: string, timeoutMillis: number): Effect.Effect<BearerChallenge, OAuthFailure> =>
  Effect.gen(function* () {
    if (!isAllowedOAuthUrl(resourceUrl)) {
      return yield* new OAuthFailure({ kind: "Discovery", message: "The connector's address is not HTTPS." });
    }
    const response = yield* Effect.tryPromise({
      catch: () => new OAuthFailure({ kind: "Discovery", message: "Could not reach the connector's server." }),
      try: (signal) =>
        fetch(resourceUrl, {
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "initialize",
            params: {
              capabilities: {},
              clientInfo: { name: "outlore", version: "0.2.7" },
              protocolVersion: "2025-06-18",
            },
          }),
          headers: {
            accept: "application/json, text/event-stream",
            "content-type": "application/json",
            "mcp-protocol-version": "2025-06-18",
          },
          method: "POST",
          redirect: "manual",
          signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMillis)]),
        }),
    });
    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      return yield* new OAuthFailure({
        kind: "Redirect",
        message: "The connector's server redirected the sign-in probe, which Outlore does not follow.",
      });
    }
    const header = response.headers.get("www-authenticate");
    return header === null ? { resourceMetadata: null, scope: null } : parseWwwAuthenticate(header);
  });

/** Candidate RFC 9728 protected-resource metadata URLs for a resource URL. */
const protectedResourceCandidatesOf = (resourceUrl: string, advertised: string | null): ReadonlyArray<string> => {
  const candidates: Array<string> = [];
  if (advertised !== null) candidates.push(advertised);
  const parsed = new URL(resourceUrl);
  const trimmedPath = parsed.pathname.replace(/\/+$/, "");
  if (trimmedPath !== "" && trimmedPath !== "/") {
    candidates.push(`${parsed.origin}/.well-known/oauth-protected-resource${trimmedPath}`);
  }
  candidates.push(`${parsed.origin}/.well-known/oauth-protected-resource`);
  return [...new Set(candidates)];
};

/** Candidate RFC 8414 and OIDC authorization-server metadata URLs for an issuer URL. */
const authServerCandidatesOf = (issuerUrl: string): ReadonlyArray<string> => {
  const parsed = new URL(issuerUrl);
  const trimmedPath = parsed.pathname.replace(/\/+$/, "");
  if (trimmedPath !== "" && trimmedPath !== "/") {
    return [
      `${parsed.origin}/.well-known/oauth-authorization-server${trimmedPath}`,
      `${parsed.origin}/.well-known/openid-configuration${trimmedPath}`,
      `${parsed.origin}${trimmedPath}/.well-known/openid-configuration`,
    ];
  }
  return [
    `${parsed.origin}/.well-known/oauth-authorization-server`,
    `${parsed.origin}/.well-known/openid-configuration`,
  ];
};

/** Tries each candidate metadata URL in order, stopping on the first valid JSON document or any redirect refusal. */
const fetchFirstMetadata = (
  urls: ReadonlyArray<string>,
  timeoutMillis: number,
): Effect.Effect<Record<string, unknown>, OAuthFailure> =>
  Effect.gen(function* () {
    let lastError: OAuthFailure = new OAuthFailure({
      kind: "Discovery",
      message: "Could not discover the server's OAuth metadata.",
    });
    for (const url of urls) {
      const result = yield* fetchJson(url, timeoutMillis).pipe(Effect.result);
      if (result._tag === "Success") return result.success;
      if (result.failure.kind === "Redirect") return yield* result.failure;
      lastError = result.failure;
    }
    return yield* lastError;
  });

/** Reads an array of strings from a JSON object field, ignoring non-string elements. */
const stringArrayFieldOf = (value: unknown, key: string): ReadonlyArray<string> => {
  const field = fieldOf(value, key);
  return Array.isArray(field) ? field.filter((item): item is string => typeof item === "string") : [];
};

/** Discovers RFC 9728 protected-resource and RFC 8414 / OIDC authorization-server metadata for an MCP endpoint. */
export const discoverOAuthMetadata = (
  resourceUrl: string,
  options: { readonly timeoutMillis?: number } = {},
): Effect.Effect<DiscoveredOAuth, OAuthFailure> =>
  Effect.gen(function* () {
    const timeoutMillis = options.timeoutMillis ?? 15_000;
    const challenge = yield* probeChallenge(resourceUrl, timeoutMillis);
    const prmCandidates = protectedResourceCandidatesOf(resourceUrl, challenge.resourceMetadata);
    const prmResult = yield* fetchFirstMetadata(prmCandidates, timeoutMillis).pipe(Effect.result);
    if (prmResult._tag === "Failure" && prmResult.failure.kind === "Redirect") return yield* prmResult.failure;
    const prm = prmResult._tag === "Success" ? prmResult.success : null;
    const authServers = prm === null ? [] : stringArrayFieldOf(prm, "authorization_servers");
    const issuerUrl = authServers[0] ?? new URL(resourceUrl).origin;
    const authMetadata = yield* fetchFirstMetadata(authServerCandidatesOf(issuerUrl), timeoutMillis);
    const authorizationEndpoint = textFieldOf(authMetadata, "authorization_endpoint");
    const tokenEndpoint = textFieldOf(authMetadata, "token_endpoint");
    if (
      authorizationEndpoint === null ||
      tokenEndpoint === null ||
      !isAllowedOAuthUrl(authorizationEndpoint) ||
      !isAllowedOAuthUrl(tokenEndpoint)
    ) {
      return yield* new OAuthFailure({
        kind: "Discovery",
        message: "The server's OAuth metadata is missing a valid authorization or token endpoint.",
      });
    }
    const methods = stringArrayFieldOf(authMetadata, "code_challenge_methods_supported");
    if (methods.length > 0 && !methods.includes("S256")) {
      return yield* new OAuthFailure({
        kind: "Discovery",
        message: "The server's OAuth metadata does not advertise PKCE S256 support.",
      });
    }
    const registrationEndpoint = textFieldOf(authMetadata, "registration_endpoint");
    if (registrationEndpoint !== null && !isAllowedOAuthUrl(registrationEndpoint)) {
      return yield* new OAuthFailure({
        kind: "Discovery",
        message: "The server advertised a dynamic registration endpoint that is not HTTPS.",
      });
    }
    const challengeScopes = challenge.scope === null ? [] : challenge.scope.split(/\s+/).filter((item) => item !== "");
    const prmScopes = prm === null ? [] : stringArrayFieldOf(prm, "scopes_supported");
    const authScopes = stringArrayFieldOf(authMetadata, "scopes_supported");
    const scopesSupported =
      challengeScopes.length > 0 ? challengeScopes : prmScopes.length > 0 ? prmScopes : authScopes;
    return {
      authorizationEndpoint,
      issuer: textFieldOf(authMetadata, "issuer") ?? issuerUrl,
      registrationEndpoint,
      resource: (prm === null ? null : textFieldOf(prm, "resource")) ?? resourceUrl,
      scopesSupported,
      tokenEndpoint,
    };
  });

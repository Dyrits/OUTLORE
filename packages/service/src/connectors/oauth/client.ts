import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { Clock, Deferred, Effect, Exit } from "effect";
import { isRecord, numberFieldOf, textFieldOf } from "../../core/index.ts";
import { isAllowedOAuthUrl, OAuthFailure } from "./discovery.ts";
import type { OAuthSession } from "./session.ts";

// OAuth 2.1 primitives: PKCE S256, state validation, ephemeral loopback callback, RFC 7591 dynamic client
// registration, authorization code exchange, and refresh token exchange. Every HTTP call refuses redirects.

/** A PKCE S256 verifier and its SHA-256 base64url challenge. */
export type PkcePair = {
  readonly challenge: string;
  readonly verifier: string;
};

/** Generates a cryptographically random PKCE S256 verifier and challenge pair. */
export const generatePkce = (): PkcePair => {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { challenge, verifier };
};

/** Generates a cryptographically random OAuth `state` parameter. */
export const generateState = (): string => randomBytes(32).toString("base64url");

/** Client credentials obtained from RFC 7591 dynamic client registration. */
export type RegisteredClient = {
  readonly clientId: string;
  readonly clientSecret: string | null;
};

/** Registers a public OAuth 2.1 client for the ephemeral loopback redirect URI via RFC 7591. */
export const registerDynamicClient = (
  registrationEndpoint: string,
  redirectUri: string,
  clientName: string,
  timeoutMillis: number = 15_000,
): Effect.Effect<RegisteredClient, OAuthFailure> =>
  Effect.gen(function* () {
    if (!isAllowedOAuthUrl(registrationEndpoint)) {
      return yield* new OAuthFailure({
        kind: "Registration",
        message: "The server's dynamic registration address is not HTTPS.",
      });
    }
    const response = yield* Effect.tryPromise({
      catch: () =>
        new OAuthFailure({
          kind: "Registration",
          message: "Could not reach the server's client registration endpoint.",
        }),
      try: (signal) =>
        fetch(registrationEndpoint, {
          body: JSON.stringify({
            client_name: clientName,
            grant_types: ["authorization_code", "refresh_token"],
            redirect_uris: [redirectUri],
            response_types: ["code"],
            token_endpoint_auth_method: "none",
          }),
          headers: { accept: "application/json", "content-type": "application/json" },
          method: "POST",
          redirect: "manual",
          signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMillis)]),
        }),
    });
    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      return yield* new OAuthFailure({
        kind: "Redirect",
        message: "The server redirected client registration, which Outlore does not follow.",
      });
    }
    if (response.status < 200 || response.status >= 300) {
      return yield* new OAuthFailure({
        kind: "Registration",
        message: `Dynamic client registration was refused with HTTP ${response.status}.`,
      });
    }
    const text = yield* Effect.tryPromise({
      catch: () => new OAuthFailure({ kind: "Registration", message: "Could not read client registration response." }),
      try: () => response.text(),
    });
    try {
      const parsed: unknown = JSON.parse(text);
      const clientId = isRecord(parsed) ? textFieldOf(parsed, "client_id") : null;
      if (clientId !== null && clientId !== "") {
        return {
          clientId,
          clientSecret: textFieldOf(parsed, "client_secret"),
        };
      }
    } catch {
      // Handled below as Registration failure.
    }
    return yield* new OAuthFailure({
      kind: "Registration",
      message: "The server's client registration response did not include a client identifier.",
    });
  });

/** Builds the OAuth 2.1 authorization URL with PKCE S256, state and RFC 8707 resource indicator. */
export const buildAuthorizationUrl = (params: {
  readonly authorizationEndpoint: string;
  readonly clientId: string;
  readonly codeChallenge: string;
  readonly redirectUri: string;
  readonly resource: string;
  readonly scope: string | null;
  readonly state: string;
}): string => {
  const url = new URL(params.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", params.state);
  url.searchParams.set("resource", params.resource);
  if (params.scope !== null && params.scope !== "") url.searchParams.set("scope", params.scope);
  return url.toString();
};

const callbackSuccessHtml =
  "<!doctype html><html><body><h1>Signed in to Outlore</h1><p>You can close this tab and return to Outlore.</p></body></html>";
const callbackFailureHtml =
  "<!doctype html><html><body><h1>Sign-in did not complete</h1><p>You can close this tab and return to Outlore.</p></body></html>";

/** An ephemeral loopback HTTP server waiting for one OAuth 2.1 callback on `http://127.0.0.1:<port>/callback`. */
export type LoopbackCallback = {
  readonly awaitCode: Effect.Effect<string, OAuthFailure>;
  readonly redirectUri: string;
};

/** Opens an ephemeral loopback listener that validates `state` and resolves with the authorization code. */
export const openLoopbackCallback = (expectedState: string, timeoutMillis: number = 300_000) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      const outcome = yield* Deferred.make<string, OAuthFailure>();
      const server = yield* Effect.callback<ReturnType<typeof createServer>, OAuthFailure>((resume) => {
        const listener = createServer((request, response) => {
          const parsed = new URL(request.url ?? "/", "http://127.0.0.1");
          if (parsed.pathname !== "/callback") {
            response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
            return;
          }
          const error = parsed.searchParams.get("error");
          if (error !== null) {
            response.writeHead(400, { "content-type": "text/html; charset=utf-8" }).end(callbackFailureHtml);
            Deferred.doneUnsafe(
              outcome,
              Exit.fail(
                new OAuthFailure({
                  kind: "Authorization",
                  message: "The service refused or cancelled the sign-in.",
                }),
              ),
            );
            return;
          }
          const receivedState = parsed.searchParams.get("state");
          const code = parsed.searchParams.get("code");
          if (receivedState !== expectedState) {
            response.writeHead(400, { "content-type": "text/html; charset=utf-8" }).end(callbackFailureHtml);
            Deferred.doneUnsafe(
              outcome,
              Exit.fail(
                new OAuthFailure({
                  kind: "StateMismatch",
                  message: "The sign-in callback did not match this request's state.",
                }),
              ),
            );
            return;
          }
          if (code === null || code === "") {
            response.writeHead(400, { "content-type": "text/html; charset=utf-8" }).end(callbackFailureHtml);
            Deferred.doneUnsafe(
              outcome,
              Exit.fail(
                new OAuthFailure({
                  kind: "Authorization",
                  message: "The sign-in callback did not include an authorization code.",
                }),
              ),
            );
            return;
          }
          response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(callbackSuccessHtml);
          Deferred.doneUnsafe(outcome, Exit.succeed(code));
        });
        listener.once("error", () =>
          resume(
            Effect.fail(
              new OAuthFailure({
                kind: "Authorization",
                message: "Could not start the local sign-in callback listener.",
              }),
            ),
          ),
        );
        listener.listen(0, "127.0.0.1", () => resume(Effect.succeed(listener)));
      });
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        return yield* new OAuthFailure({
          kind: "Authorization",
          message: "The local sign-in callback listener had no port.",
        });
      }
      const callback: LoopbackCallback & { readonly close: () => void } = {
        awaitCode: Deferred.await(outcome).pipe(
          Effect.timeoutOrElse({
            duration: `${timeoutMillis} millis`,
            orElse: () =>
              Effect.fail(
                new OAuthFailure({
                  kind: "Timeout",
                  message: "Sign-in timed out before the browser returned to Outlore.",
                }),
              ),
          }),
        ),
        close: () => {
          server.close();
          server.closeAllConnections();
        },
        redirectUri: `http://127.0.0.1:${address.port}/callback`,
      };
      return callback;
    }),
    (callback) => Effect.sync(callback.close),
  );

/** Sends a form-encoded POST to the token endpoint without following redirects. */
const postTokenEndpoint = (
  tokenEndpoint: string,
  form: URLSearchParams,
  failureKind: "TokenExchange" | "Refresh",
  timeoutMillis: number,
): Effect.Effect<Record<string, unknown>, OAuthFailure> =>
  Effect.gen(function* () {
    if (!isAllowedOAuthUrl(tokenEndpoint)) {
      return yield* new OAuthFailure({
        kind: failureKind,
        message: "The server's token endpoint address is not HTTPS.",
      });
    }
    const response = yield* Effect.tryPromise({
      catch: () => new OAuthFailure({ kind: failureKind, message: "Could not reach the server's token endpoint." }),
      try: (signal) =>
        fetch(tokenEndpoint, {
          body: form.toString(),
          headers: {
            accept: "application/json",
            "content-type": "application/x-www-form-urlencoded",
          },
          method: "POST",
          redirect: "manual",
          signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMillis)]),
        }),
    });
    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      return yield* new OAuthFailure({
        kind: "Redirect",
        message: "The server redirected a token request, which Outlore does not follow.",
      });
    }
    if (response.status < 200 || response.status >= 300) {
      return yield* new OAuthFailure({
        kind: failureKind,
        message: `The server's token endpoint refused the request with HTTP ${response.status}.`,
      });
    }
    const text = yield* Effect.tryPromise({
      catch: () => new OAuthFailure({ kind: failureKind, message: "Could not read the server's token response." }),
      try: () => response.text(),
    });
    try {
      const parsed: unknown = JSON.parse(text);
      if (isRecord(parsed)) return parsed;
    } catch {
      // Handled below.
    }
    return yield* new OAuthFailure({
      kind: failureKind,
      message: "The server's token response was not valid JSON.",
    });
  });

/** Exchanges an authorization code and PKCE verifier for an OAuth session. */
export const exchangeAuthorizationCode = (params: {
  readonly clientId: string;
  readonly clientSecret: string | null;
  readonly code: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
  readonly resource: string;
  readonly scope: string | null;
  readonly timeoutMillis?: number;
  readonly tokenEndpoint: string;
}): Effect.Effect<OAuthSession, OAuthFailure> =>
  Effect.gen(function* () {
    const form = new URLSearchParams();
    form.set("grant_type", "authorization_code");
    form.set("code", params.code);
    form.set("redirect_uri", params.redirectUri);
    form.set("client_id", params.clientId);
    form.set("code_verifier", params.codeVerifier);
    form.set("resource", params.resource);
    if (params.clientSecret !== null) form.set("client_secret", params.clientSecret);
    const body = yield* postTokenEndpoint(params.tokenEndpoint, form, "TokenExchange", params.timeoutMillis ?? 15_000);
    const accessToken = textFieldOf(body, "access_token");
    if (accessToken === null || accessToken === "") {
      return yield* new OAuthFailure({
        kind: "TokenExchange",
        message: "The server's token response did not include an access token.",
      });
    }
    const expiresIn = numberFieldOf(body, "expires_in");
    const nowMillis = yield* Clock.currentTimeMillis;
    return {
      accessToken,
      clientId: params.clientId,
      clientSecret: params.clientSecret,
      expiresAt: expiresIn !== null && expiresIn > 0 ? nowMillis + expiresIn * 1000 : null,
      refreshToken: textFieldOf(body, "refresh_token"),
      resource: params.resource,
      scope: textFieldOf(body, "scope") ?? params.scope,
      tokenEndpoint: params.tokenEndpoint,
      version: 1,
    };
  });

/** Refreshes an OAuth session using its refresh token, preserving the refresh token if the server does not rotate it. */
export const refreshOAuthToken = (
  session: OAuthSession,
  options: { readonly timeoutMillis?: number } = {},
): Effect.Effect<OAuthSession, OAuthFailure> =>
  Effect.gen(function* () {
    if (session.refreshToken === null || session.refreshToken === "") {
      return yield* new OAuthFailure({
        kind: "Refresh",
        message: "The stored OAuth session has no refresh token.",
      });
    }
    const form = new URLSearchParams();
    form.set("grant_type", "refresh_token");
    form.set("refresh_token", session.refreshToken);
    form.set("client_id", session.clientId);
    if (session.resource !== null) form.set("resource", session.resource);
    if (session.clientSecret !== null) form.set("client_secret", session.clientSecret);
    const body = yield* postTokenEndpoint(session.tokenEndpoint, form, "Refresh", options.timeoutMillis ?? 15_000);
    const accessToken = textFieldOf(body, "access_token");
    if (accessToken === null || accessToken === "") {
      return yield* new OAuthFailure({
        kind: "Refresh",
        message: "The server's token refresh response did not include an access token.",
      });
    }
    const expiresIn = numberFieldOf(body, "expires_in");
    const nowMillis = yield* Clock.currentTimeMillis;
    return {
      ...session,
      accessToken,
      expiresAt: expiresIn !== null && expiresIn > 0 ? nowMillis + expiresIn * 1000 : null,
      refreshToken: textFieldOf(body, "refresh_token") ?? session.refreshToken,
      scope: textFieldOf(body, "scope") ?? session.scope,
    };
  });

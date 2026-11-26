import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { Deferred, Effect, Exit } from "effect";
import { OAuthFailure } from "./types.ts";

// OAuth 2.1 browser authorization helpers: PKCE S256, state generation, authorization URL building, and loopback callback.

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

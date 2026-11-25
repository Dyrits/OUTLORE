import { execFile } from "node:child_process";
import { Effect } from "effect";
import type { CatalogBackend } from "../catalog.ts";
import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  generatePkce,
  generateState,
  openLoopbackCallback,
  registerDynamicClient,
} from "./client.ts";
import { discoverOAuthMetadata, OAuthFailure } from "./discovery.ts";
import type { OAuthSession } from "./session.ts";

// End-to-end host-side MCP OAuth 2.1 browser sign-in flow: discovery, ephemeral loopback callback, dynamic client
// registration, PKCE S256 browser redirect, state verification, and token exchange.

/** Opens a URL in the host's default web browser; replaceable in tests with a loopback browser stand-in. */
export type BrowserOpener = (url: string) => Effect.Effect<void, OAuthFailure>;

/** Opens a URL in the operating system's default browser without invoking a shell on macOS or Linux. */
export const defaultOpenBrowser: BrowserOpener = (url) =>
  Effect.callback<void, OAuthFailure>((resume) => {
    const command =
      process.platform === "darwin"
        ? { args: [url], file: "open" }
        : process.platform === "win32"
          ? { args: ["/c", "start", "", url], file: "cmd.exe" }
          : { args: [url], file: "xdg-open" };
    execFile(command.file, command.args, (error) => {
      if (error !== null) {
        resume(
          Effect.fail(
            new OAuthFailure({
              kind: "Authorization",
              message: "Could not open the sign-in page in your browser.",
            }),
          ),
        );
        return;
      }
      resume(Effect.void);
    });
  });

/** Runs the full MCP OAuth 2.1 browser sign-in flow for one HTTP connector and returns the obtained session. */
export const runOAuthSignIn = (
  transport: Extract<CatalogBackend, { readonly _tag: "Http" }>,
  options: {
    readonly callbackTimeoutMillis?: number;
    readonly openBrowser?: BrowserOpener;
    readonly requestTimeoutMillis?: number;
  } = {},
): Effect.Effect<OAuthSession, OAuthFailure> =>
  Effect.scoped(
    Effect.gen(function* () {
      const oauth = transport.oauth;
      if (oauth === undefined) {
        return yield* new OAuthFailure({
          kind: "Discovery",
          message: "This connector does not use OAuth browser sign-in.",
        });
      }
      const timeoutMillis = options.requestTimeoutMillis ?? 15_000;
      const discovered = yield* discoverOAuthMetadata(transport.url, { timeoutMillis });
      if (discovered.registrationEndpoint === null) {
        return yield* new OAuthFailure({
          kind: "Registration",
          message:
            "This service does not advertise dynamic client registration, so Outlore cannot sign in generically.",
        });
      }
      const pkce = generatePkce();
      const state = generateState();
      const callback = yield* openLoopbackCallback(state, options.callbackTimeoutMillis ?? 300_000);
      const client = yield* registerDynamicClient(
        discovered.registrationEndpoint,
        callback.redirectUri,
        oauth.clientName ?? "Outlore",
        timeoutMillis,
      );
      const requestedScopes =
        oauth.scopes !== undefined && oauth.scopes.length > 0 ? oauth.scopes : discovered.scopesSupported;
      const scope = requestedScopes.length > 0 ? requestedScopes.join(" ") : null;
      const authorizationUrl = buildAuthorizationUrl({
        authorizationEndpoint: discovered.authorizationEndpoint,
        clientId: client.clientId,
        codeChallenge: pkce.challenge,
        redirectUri: callback.redirectUri,
        resource: discovered.resource,
        scope,
        state,
      });
      yield* (options.openBrowser ?? defaultOpenBrowser)(authorizationUrl);
      const code = yield* callback.awaitCode;
      return yield* exchangeAuthorizationCode({
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        code,
        codeVerifier: pkce.verifier,
        redirectUri: callback.redirectUri,
        resource: discovered.resource,
        scope,
        timeoutMillis,
        tokenEndpoint: discovered.tokenEndpoint,
      });
    }),
  );

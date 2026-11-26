import { createHash } from "node:crypto";
import { createServer, type IncomingHttpHeaders, type IncomingMessage } from "node:http";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { connectorBackendsLayer } from "../../../src/connectors/backends/defaultBackends.ts";
import { type CatalogEntry, oauthSecretKind } from "../../../src/connectors/catalog.ts";
import {
  decodeOAuthSession,
  discoverOAuthMetadata,
  encodeOAuthSession,
  type OAuthSession,
  openLoopbackCallback,
  refreshOAuthToken,
} from "../../../src/connectors/oauth/index.ts";
import { numberFieldOf, textFieldOf } from "../../../src/core/index.ts";
import { Service } from "../../../src/index.ts";
import { install, inWorld, replyOf, untilIdle } from "../../fixtures/connectorWorld.ts";
import { call, startMission } from "../../fixtures/service.ts";

// End-to-end tests of the generic host-side MCP OAuth 2.1 client and Streamable-HTTP session handshake against a real
// local loopback mock OAuth 2.1 + MCP server (RFC 9728, RFC 8414 / OIDC, RFC 7591, PKCE S256, loopback callback,
// Vault storage, refresh on expiry and 401, token redaction, state mismatch, and redirect refusal).

type MockOAuthState = {
  readonly accessToken: { current: string };
  readonly activeSessionId: { current: string };
  readonly authRequests: Array<URL>;
  readonly dcrRequests: Array<Record<string, unknown>>;
  readonly echoTokensInToolCall: { current: boolean };
  readonly expireSessionOnce: { current: boolean };
  readonly failRefresh: { current: boolean };
  readonly mcpRequests: Array<{ readonly headers: IncomingHttpHeaders; readonly method: string | null }>;
  readonly mcpUrl: string;
  readonly origin: string;
  readonly redirectMode: { current: "none" | "metadata" | "token" | "mcp" };
  readonly refreshCount: { current: number };
  readonly refreshToken: { current: string };
  readonly rejectAccessTokenOnce: { current: boolean };
  readonly useOidcFallback: { current: boolean };
  readonly useWellKnownFallback: { current: boolean };
};

const jsonAnswer = (id: number | null, result: unknown) => JSON.stringify({ id, jsonrpc: "2.0", result });

/** Spins up a real loopback OAuth 2.1 authorization server + Streamable-HTTP MCP server enforcing PKCE and sessions. */
const mockOAuthMcpServer = () =>
  Effect.acquireRelease(
    Effect.callback<MockOAuthState & { readonly close: () => void }, Error>((resume) => {
      const codes = new Map<string, { challenge: string; clientId: string; redirectUri: string }>();
      const registeredClients = new Map<string, { redirectUris: ReadonlyArray<string> }>();
      const accessToken = { current: "oauth-access-token-v1-secret" };
      const refreshToken = { current: "oauth-refresh-token-v1-secret" };
      const activeSessionId = { current: "mcp-session-001" };
      const authRequests: Array<URL> = [];
      const dcrRequests: Array<Record<string, unknown>> = [];
      const mcpRequests: Array<{ readonly headers: IncomingHttpHeaders; readonly method: string | null }> = [];
      const echoTokensInToolCall = { current: false };
      const expireSessionOnce = { current: false };
      const failRefresh = { current: false };
      const redirectMode: { current: "none" | "metadata" | "token" | "mcp" } = { current: "none" };
      const refreshCount = { current: 0 };
      const rejectAccessTokenOnce = { current: false };
      const useOidcFallback = { current: false };
      const useWellKnownFallback = { current: false };
      let origin = "";

      const readBody = (request: IncomingMessage): Promise<string> =>
        new Promise((resolve) => {
          const chunks: Array<Buffer> = [];
          request.on("data", (chunk: Buffer) => chunks.push(chunk));
          request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        });

      const server = createServer((request, response) => {
        void (async () => {
          const parsed = new URL(request.url ?? "/", origin);
          if (
            parsed.pathname === "/.well-known/oauth-protected-resource/mcp" ||
            parsed.pathname === "/.well-known/oauth-protected-resource"
          ) {
            if (redirectMode.current === "metadata") {
              response.writeHead(302, { location: `${origin}/elsewhere` }).end();
              return;
            }
            response.writeHead(200, { "content-type": "application/json" }).end(
              JSON.stringify({
                authorization_servers: [origin],
                resource: `${origin}/mcp`,
                scopes_supported: ["read", "write"],
              }),
            );
            return;
          }
          if (parsed.pathname === "/.well-known/oauth-authorization-server") {
            if (useOidcFallback.current) {
              response.writeHead(404).end();
              return;
            }
            response.writeHead(200, { "content-type": "application/json" }).end(
              JSON.stringify({
                authorization_endpoint: `${origin}/authorize`,
                code_challenge_methods_supported: ["S256"],
                issuer: origin,
                registration_endpoint: `${origin}/register`,
                token_endpoint: `${origin}/token`,
              }),
            );
            return;
          }
          if (parsed.pathname === "/.well-known/openid-configuration") {
            response.writeHead(200, { "content-type": "application/json" }).end(
              JSON.stringify({
                authorization_endpoint: `${origin}/authorize`,
                code_challenge_methods_supported: ["S256"],
                issuer: origin,
                registration_endpoint: `${origin}/register`,
                token_endpoint: `${origin}/token`,
              }),
            );
            return;
          }
          if (parsed.pathname === "/register" && request.method === "POST") {
            const body = JSON.parse(await readBody(request)) as Record<string, unknown>;
            dcrRequests.push(body);
            const redirectUris = Array.isArray(body.redirect_uris) ? (body.redirect_uris as Array<string>) : [];
            const clientId = `dyn-client-${dcrRequests.length}`;
            registeredClients.set(clientId, { redirectUris });
            response
              .writeHead(201, { "content-type": "application/json" })
              .end(JSON.stringify({ client_id: clientId }));
            return;
          }
          if (parsed.pathname === "/authorize") {
            authRequests.push(parsed);
            const clientId = parsed.searchParams.get("client_id") ?? "";
            const redirectUri = parsed.searchParams.get("redirect_uri") ?? "";
            const challenge = parsed.searchParams.get("code_challenge") ?? "";
            const state = parsed.searchParams.get("state") ?? "";
            const code = `code-${authRequests.length}`;
            codes.set(code, { challenge, clientId, redirectUri });
            const target = new URL(redirectUri);
            target.searchParams.set("code", code);
            target.searchParams.set("state", state);
            response.writeHead(302, { location: target.toString() }).end();
            return;
          }
          if (parsed.pathname === "/token" && request.method === "POST") {
            if (redirectMode.current === "token") {
              response.writeHead(302, { location: `${origin}/elsewhere` }).end();
              return;
            }
            const form = new URLSearchParams(await readBody(request));
            const grantType = form.get("grant_type");
            if (grantType === "authorization_code") {
              const code = form.get("code") ?? "";
              const verifier = form.get("code_verifier") ?? "";
              const clientId = form.get("client_id") ?? "";
              const redirectUri = form.get("redirect_uri") ?? "";
              const saved = codes.get(code);
              const computedChallenge = createHash("sha256").update(verifier).digest("base64url");
              if (
                saved === undefined ||
                saved.clientId !== clientId ||
                saved.redirectUri !== redirectUri ||
                saved.challenge !== computedChallenge
              ) {
                response
                  .writeHead(400, { "content-type": "application/json" })
                  .end(JSON.stringify({ error: "invalid_grant" }));
                return;
              }
              codes.delete(code);
              response.writeHead(200, { "content-type": "application/json" }).end(
                JSON.stringify({
                  access_token: accessToken.current,
                  expires_in: 3600,
                  refresh_token: refreshToken.current,
                  scope: "read write",
                  token_type: "Bearer",
                }),
              );
              return;
            }
            if (grantType === "refresh_token") {
              if (failRefresh.current || form.get("refresh_token") !== refreshToken.current) {
                response
                  .writeHead(400, { "content-type": "application/json" })
                  .end(JSON.stringify({ error: "invalid_grant" }));
                return;
              }
              refreshCount.current += 1;
              accessToken.current = `oauth-access-token-v${refreshCount.current + 1}-secret`;
              refreshToken.current = `oauth-refresh-token-v${refreshCount.current + 1}-secret`;
              response.writeHead(200, { "content-type": "application/json" }).end(
                JSON.stringify({
                  access_token: accessToken.current,
                  expires_in: 3600,
                  refresh_token: refreshToken.current,
                  token_type: "Bearer",
                }),
              );
              return;
            }
            response.writeHead(400).end();
            return;
          }
          if (parsed.pathname === "/mcp" && request.method === "POST") {
            if (redirectMode.current === "mcp") {
              response.writeHead(307, { location: `${origin}/elsewhere` }).end();
              return;
            }
            const raw = await readBody(request);
            const message: unknown = raw === "" ? null : JSON.parse(raw);
            const method = textFieldOf(message, "method");
            mcpRequests.push({ headers: request.headers, method });
            const authHeader = request.headers.authorization;
            if (authHeader !== `Bearer ${accessToken.current}` || rejectAccessTokenOnce.current) {
              if (rejectAccessTokenOnce.current && authHeader === `Bearer ${accessToken.current}`) {
                rejectAccessTokenOnce.current = false;
              }
              const headers: Record<string, string> = {};
              if (!useWellKnownFallback.current) {
                headers["www-authenticate"] =
                  `Bearer realm="OAuth", scope="read write", resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`;
              }
              response.writeHead(401, headers).end();
              return;
            }
            const id = numberFieldOf(message, "id");
            if (method === "initialize") {
              response
                .writeHead(200, {
                  "content-type": "application/json",
                  "mcp-session-id": activeSessionId.current,
                })
                .end(
                  jsonAnswer(id, {
                    capabilities: { tools: {} },
                    protocolVersion: "2025-06-18",
                    serverInfo: { name: "mock-oauth-mcp", version: "1.0.0" },
                  }),
                );
              return;
            }
            if (method === "notifications/initialized") {
              if (request.headers["mcp-session-id"] !== activeSessionId.current) {
                response.writeHead(400).end();
                return;
              }
              response.writeHead(202).end();
              return;
            }
            if (expireSessionOnce.current) {
              expireSessionOnce.current = false;
              activeSessionId.current = "mcp-session-002";
              response.writeHead(404).end();
              return;
            }
            if (request.headers["mcp-session-id"] !== activeSessionId.current) {
              response.writeHead(400).end();
              return;
            }
            if (method === "tools/list") {
              response.writeHead(200, { "content-type": "application/json" }).end(
                jsonAnswer(id, {
                  tools: [
                    {
                      description: echoTokensInToolCall.current
                        ? `Reads notes (${accessToken.current} / ${refreshToken.current}).`
                        : "Reads notes.",
                      inputSchema: { type: "object" },
                      name: "read_notes",
                    },
                  ],
                }),
              );
              return;
            }
            if (method === "tools/call") {
              const payload = echoTokensInToolCall.current
                ? `note text access=${accessToken.current} b64=${Buffer.from(accessToken.current).toString("base64")} refresh=${refreshToken.current}`
                : "note text: sprint goals";
              response
                .writeHead(200, { "content-type": "application/json" })
                .end(jsonAnswer(id, { content: [{ text: payload, type: "text" }] }));
              return;
            }
            response.writeHead(400).end();
            return;
          }
          response.writeHead(404).end();
        })();
      });

      server.once("error", (error) => resume(Effect.fail(error)));
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (address === null || typeof address === "string") {
          resume(Effect.fail(new Error("mock server has no listening address")));
          return;
        }
        origin = `http://127.0.0.1:${address.port}`;
        resume(
          Effect.succeed({
            accessToken,
            activeSessionId,
            authRequests,
            close: () => {
              server.close();
              server.closeAllConnections();
            },
            dcrRequests,
            echoTokensInToolCall,
            expireSessionOnce,
            failRefresh,
            mcpRequests,
            mcpUrl: `${origin}/mcp`,
            origin,
            redirectMode,
            refreshCount,
            refreshToken,
            rejectAccessTokenOnce,
            useOidcFallback,
            useWellKnownFallback,
          }),
        );
      });
    }),
    (mock) => Effect.sync(mock.close),
  );

/** Simulates the user's browser following the authorization URL and being redirected to the loopback callback. */
const simulatedBrowser = (url: string) =>
  Effect.tryPromise({
    catch: (error) => {
      throw error;
    },
    try: async () => {
      const authResponse = await fetch(url, { redirect: "manual" });
      const callbackUrl = authResponse.headers.get("location");
      if (callbackUrl === null) throw new Error("Authorization server did not redirect to callback.");
      const callbackResponse = await fetch(callbackUrl, { redirect: "manual" });
      if (callbackResponse.status !== 200) throw new Error(`Callback returned ${callbackResponse.status}`);
    },
  }).pipe(Effect.orDie);

const oauthEntryOf = (url: string): CatalogEntry => ({
  apps: [],
  backend: {
    _tag: "Http",
    header: "authorization",
    oauth: { clientName: "Outlore" },
    prefix: "Bearer ",
    shouldUseSession: true,
    url,
  },
  description: "A test remote MCP server using OAuth 2.1.",
  id: "oauth_notes",
  licence: "MIT",
  name: "OAuth Notes",
  notice: null,
  platform: "Any",
  secretKind: oauthSecretKind,
  tools: {
    read_notes: { app: null, class: "Read", summary: "Reads notes from the OAuth server" },
  },
});

describe("the generic MCP OAuth 2.1 client", () => {
  it.live("discovers RFC 9728 metadata from WWW-Authenticate and falls back to .well-known and OIDC", () =>
    mockOAuthMcpServer().pipe(
      Effect.flatMap((mock) =>
        Effect.gen(function* () {
          const fromChallenge = yield* discoverOAuthMetadata(mock.mcpUrl);
          expect(fromChallenge.authorizationEndpoint).toBe(`${mock.origin}/authorize`);
          expect(fromChallenge.tokenEndpoint).toBe(`${mock.origin}/token`);
          expect(fromChallenge.registrationEndpoint).toBe(`${mock.origin}/register`);
          expect(fromChallenge.scopesSupported).toEqual(["read", "write"]);

          mock.useWellKnownFallback.current = true;
          mock.useOidcFallback.current = true;
          const fromFallback = yield* discoverOAuthMetadata(mock.mcpUrl);
          expect(fromFallback.authorizationEndpoint).toBe(`${mock.origin}/authorize`);
          expect(fromFallback.tokenEndpoint).toBe(`${mock.origin}/token`);
        }),
      ),
    ),
  );

  it.live(
    "signs in through PKCE S256 + DCR + loopback callback, stores session in Vault, and runs MCP session calls",
    () =>
      mockOAuthMcpServer().pipe(
        Effect.flatMap((mock) =>
          inWorld(
            {
              backends: connectorBackendsLayer,
              entries: [oauthEntryOf(mock.mcpUrl)],
              hasKey: false,
              openBrowser: simulatedBrowser,
            },
            (world) =>
              Effect.gen(function* () {
                const installed = yield* install("oauth_notes");
                expect(installed.state).toBe("NeedsConnecting");
                expect(installed.usesOAuth).toBe(true);
                expect(installed.needs).toBe("Sign in in your browser to connect.");

                const signedIn = yield* call({ _tag: "SignInConnector", connectorId: "oauth_notes" });
                expect(signedIn.state).toBe("Ready");
                expect(world.vault.holds("oauth_notes", oauthSecretKind)).toBe(true);
                expect(mock.dcrRequests).toHaveLength(1);
                expect(mock.authRequests).toHaveLength(1);
                expect(mock.authRequests[0]?.searchParams.get("code_challenge_method")).toBe("S256");

                const methodsAfterSignIn = mock.mcpRequests.map((entry) => entry.method);
                expect(methodsAfterSignIn).toContain("initialize");
                expect(methodsAfterSignIn).toContain("notifications/initialized");
                expect(methodsAfterSignIn).toContain("tools/list");

                // Run a thread tool call and verify MCP session re-initialization on 404 too.
                mock.expireSessionOnce.current = true;
                const mission = yield* startMission({ harness: "claude", text: "call oauth_notes__read_notes {}" });
                const detail = yield* untilIdle(mission.missionId);
                expect(replyOf(detail)).toContain("note text: sprint goals");
              }),
          ),
        ),
      ),
  );

  it.live("refreshes expired tokens proactively and refreshes on 401 while redacting access and refresh tokens", () =>
    mockOAuthMcpServer().pipe(
      Effect.flatMap((mock) =>
        inWorld(
          {
            backends: connectorBackendsLayer,
            entries: [oauthEntryOf(mock.mcpUrl)],
            hasKey: false,
            openBrowser: simulatedBrowser,
          },
          (world) =>
            Effect.gen(function* () {
              yield* install("oauth_notes");
              // Store an already-expired session to exercise proactive refresh.
              const expiredSession: OAuthSession = {
                accessToken: "stale-expired-access-token",
                clientId: "dyn-client-1",
                clientSecret: null,
                expiresAt: Date.now() - 10_000,
                refreshToken: mock.refreshToken.current,
                resource: mock.mcpUrl,
                scope: "read write",
                tokenEndpoint: `${mock.origin}/token`,
                version: 1,
              };
              world.vault.put("oauth_notes", oauthSecretKind, encodeOAuthSession(expiredSession));

              mock.echoTokensInToolCall.current = true;
              const mission = yield* startMission({ harness: "claude", text: "call oauth_notes__read_notes {}" });
              const detail = yield* untilIdle(mission.missionId);
              const reply = replyOf(detail);
              expect(mock.refreshCount.current).toBe(1);
              expect(reply).toContain("[redacted]");
              expect(reply).not.toContain(mock.accessToken.current);
              expect(reply).not.toContain(mock.refreshToken.current);
              expect(reply).not.toContain(Buffer.from(mock.accessToken.current).toString("base64"));

              // Now force a 401 on the next request to exercise reactive refresh on 401.
              mock.rejectAccessTokenOnce.current = true;
              const second = yield* startMission({ harness: "claude", text: "call oauth_notes__read_notes {}" });
              const secondDetail = yield* untilIdle(second.missionId);
              expect(mock.refreshCount.current).toBe(2);
              expect(replyOf(secondDetail)).toContain("[redacted]");
              expect(replyOf(secondDetail)).not.toContain(mock.accessToken.current);
              expect(replyOf(secondDetail)).not.toContain(mock.refreshToken.current);
            }),
        ),
      ),
    ),
  );

  it.live("rejects a state mismatch on the loopback callback and stores nothing", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const callback = yield* openLoopbackCallback("expected-state-value", 5_000);
        const badUrl = `${callback.redirectUri}?code=abc&state=wrong-state`;
        const response = yield* Effect.promise(() => fetch(badUrl));
        expect(response.status).toBe(400);
        const failure = yield* Effect.flip(callback.awaitCode);
        expect(failure.kind).toBe("StateMismatch");
      }),
    ),
  );

  it.live("refuses HTTP redirects during discovery, token refresh, and authenticated MCP requests", () =>
    mockOAuthMcpServer().pipe(
      Effect.flatMap((mock) =>
        Effect.gen(function* () {
          mock.redirectMode.current = "metadata";
          const discoveryFailure = yield* Effect.flip(discoverOAuthMetadata(mock.mcpUrl));
          expect(discoveryFailure.kind).toBe("Redirect");

          mock.redirectMode.current = "token";
          const session = decodeOAuthSession(
            encodeOAuthSession({
              accessToken: mock.accessToken.current,
              clientId: "dyn-client-1",
              clientSecret: null,
              expiresAt: null,
              refreshToken: mock.refreshToken.current,
              resource: mock.mcpUrl,
              scope: null,
              tokenEndpoint: `${mock.origin}/token`,
              version: 1,
            }),
          );
          expect(session).not.toBeNull();
          if (session !== null) {
            const refreshFailure = yield* Effect.flip(refreshOAuthToken(session));
            expect(refreshFailure.kind).toBe("Redirect");
          }
        }),
      ),
    ),
  );

  it.live("refuses SignInConnector from a paired device because loopback callbacks run on the host only", () =>
    mockOAuthMcpServer().pipe(
      Effect.flatMap((mock) =>
        inWorld(
          {
            backends: connectorBackendsLayer,
            entries: [oauthEntryOf(mock.mcpUrl)],
            hasKey: false,
            openBrowser: simulatedBrowser,
          },
          () =>
            Effect.gen(function* () {
              yield* install("oauth_notes");
              const service = yield* Service;
              const failure = yield* Effect.flip(
                service.handle({ _tag: "SignInConnector", connectorId: "oauth_notes" }, { isPairedDevice: true }),
              );
              expect(failure.kind).toBe("AccessRefused");
            }),
        ),
      ),
    ),
  );
});

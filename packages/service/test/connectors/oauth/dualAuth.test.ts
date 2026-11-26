import { createHash } from "node:crypto";
import { createServer, type IncomingHttpHeaders, type IncomingMessage } from "node:http";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { connectorBackendsLayer } from "../../../src/connectors/backends/defaultBackends.ts";
import { type CatalogEntry, oauthSecretKind } from "../../../src/connectors/catalog.ts";
import { numberFieldOf, textFieldOf } from "../../../src/core/index.ts";
import { install, inWorld, owner } from "../../fixtures/connectorWorld.ts";

// End-to-end tests of dual-auth connectors (static API key OR generic MCP OAuth 2.1 browser sign-in), including custom
// static headers (like Composio's `x-consumer-api-key`) switching to OAuth `Authorization: Bearer` with session handshake.

const jsonAnswer = (id: number | null, result: unknown) => JSON.stringify({ id, jsonrpc: "2.0", result });

const mockDualAuthServer = () =>
  Effect.acquireRelease(
    Effect.callback<
      {
        readonly close: () => void;
        readonly mcpUrl: string;
        readonly requests: Array<{ readonly headers: IncomingHttpHeaders; readonly method: string | null }>;
      },
      Error
    >((resume) => {
      const codes = new Map<string, { challenge: string; clientId: string; redirectUri: string }>();
      const requests: Array<{ readonly headers: IncomingHttpHeaders; readonly method: string | null }> = [];
      const staticKey = "static-api-key-12345";
      const oauthToken = "oauth-bearer-token-67890";
      const sessionId = "dual-session-1";
      let origin = "";

      const readBody = (request: IncomingMessage): Promise<string> =>
        new Promise((resolve) => {
          const chunks: Array<Buffer> = [];
          request.on("data", (chunk: Buffer) => chunks.push(chunk));
          request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        });

      const server = createServer(async (request, response) => {
        const parsed = new URL(request.url ?? "/", origin);
        if (parsed.pathname === "/.well-known/oauth-protected-resource") {
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ authorization_servers: [origin], resource: `${origin}/mcp` }));
          return;
        }
        if (parsed.pathname === "/.well-known/oauth-authorization-server") {
          response.writeHead(200, { "content-type": "application/json" });
          response.end(
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
          response.writeHead(201, { "content-type": "application/json" });
          response.end(JSON.stringify({ client_id: "dual-client-1" }));
          return;
        }
        if (parsed.pathname === "/authorize") {
          const redirectUri = parsed.searchParams.get("redirect_uri") ?? "";
          const state = parsed.searchParams.get("state") ?? "";
          const challenge = parsed.searchParams.get("code_challenge") ?? "";
          const clientId = parsed.searchParams.get("client_id") ?? "";
          codes.set("code-1", { challenge, clientId, redirectUri });
          const callback = new URL(redirectUri);
          callback.searchParams.set("code", "code-1");
          callback.searchParams.set("state", state);
          response.writeHead(302, { location: callback.toString() });
          response.end();
          return;
        }
        if (parsed.pathname === "/token" && request.method === "POST") {
          const params = new URLSearchParams(await readBody(request));
          const code = params.get("code") ?? "";
          const verifier = params.get("code_verifier") ?? "";
          const entry = codes.get(code);
          const expected = createHash("sha256").update(verifier).digest("base64url");
          if (entry === undefined || expected !== entry.challenge) {
            response.writeHead(400, { "content-type": "application/json" });
            response.end(JSON.stringify({ error: "invalid_grant" }));
            return;
          }
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ access_token: oauthToken, expires_in: 3600, token_type: "Bearer" }));
          return;
        }
        if (parsed.pathname === "/mcp" && request.method === "POST") {
          const body = await readBody(request);
          const parsedBody: unknown = JSON.parse(body);
          const id = numberFieldOf(parsedBody, "id");
          const method = textFieldOf(parsedBody, "method");
          requests.push({ headers: request.headers, method });

          const isApiKey = request.headers["x-consumer-api-key"] === staticKey;
          const isOAuth = request.headers.authorization === `Bearer ${oauthToken}`;
          if (!isApiKey && !isOAuth) {
            response.writeHead(401, {
              "www-authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
            });
            response.end();
            return;
          }
          if (method === "initialize") {
            response.writeHead(200, { "content-type": "application/json", "mcp-session-id": sessionId });
            response.end(
              jsonAnswer(id, {
                capabilities: { tools: {} },
                protocolVersion: "2025-06-18",
                serverInfo: { name: "dual-mock", version: "1.0.0" },
              }),
            );
            return;
          }
          if (method === "notifications/initialized") {
            response.writeHead(202);
            response.end();
            return;
          }
          if (method === "tools/list") {
            response.writeHead(200, { "content-type": "application/json" });
            response.end(
              jsonAnswer(id, {
                tools: [{ description: "Read status", inputSchema: { type: "object" }, name: "read_status" }],
              }),
            );
            return;
          }
          if (method === "tools/call") {
            const mode = isOAuth ? "oauth" : "apikey";
            response.writeHead(200, { "content-type": "application/json" });
            response.end(jsonAnswer(id, { content: [{ text: `ok via ${mode}`, type: "text" }] }));
            return;
          }
        }
        response.writeHead(404);
        response.end();
      });

      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (address === null || typeof address === "string") {
          resume(Effect.fail(new Error("Could not read server address")));
          return;
        }
        origin = `http://127.0.0.1:${address.port}`;
        resume(Effect.succeed({ close: () => void server.close(), mcpUrl: `${origin}/mcp`, requests }));
      });
    }),
    (mock) => Effect.sync(() => mock.close()),
  );

const dualEntryOf = (url: string): CatalogEntry => ({
  apps: [],
  backend: {
    _tag: "Http",
    header: "x-consumer-api-key",
    oauth: { clientName: "Outlore" },
    url,
  },
  description: "A dual-auth test connector.",
  id: "dual_test",
  licence: "MIT",
  name: "Dual Test",
  notice: null,
  platform: "Any",
  secretKind: "API key",
  tools: {
    read_status: { app: null, class: "Read", summary: "Reads the current status" },
  },
});

const followConsent = (url: string) =>
  Effect.tryPromise({
    catch: () => new Error("Consent follow failed"),
    try: async () => {
      const response = await fetch(url, { redirect: "manual" });
      const callback = response.headers.get("location");
      if (callback !== null) await fetch(callback);
    },
  }).pipe(Effect.ignore);

describe("dual-auth connectors (static API key or OAuth 2.1)", () => {
  it.live(
    "connects with a custom static header first, then switches to OAuth 2.1 Bearer + session and clears the static key",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const mock = yield* mockDualAuthServer();
          const entry = dualEntryOf(mock.mcpUrl);
          yield* inWorld(
            {
              backends: connectorBackendsLayer,
              entries: [entry],
              hasKey: false,
              openBrowser: followConsent,
            },
            (world) =>
              Effect.gen(function* () {
                const installed = yield* install(entry.id);
                expect(installed.usesOAuth).toBe(true);
                expect(installed.secretKinds).toEqual(["API key"]);
                expect(installed.state).toBe("NeedsConnecting");
                expect(installed.needs).toBe("Sign in in your browser or add your API key below.");

                // 1. Store a static API key and verify card becomes Ready.
                world.vault.put(entry.id, "API key", "static-api-key-12345");
                const withKeyCards = yield* owner({ _tag: "ListConnectors" });
                expect(withKeyCards[0]?.state).toBe("Ready");
                expect(world.vault.holds(entry.id, "API key")).toBe(true);
                expect(world.vault.holds(entry.id, oauthSecretKind)).toBe(false);

                // 2. Switch to OAuth 2.1 browser sign-in: stores OAuth session, removes static key, sends Bearer + initialize.
                const signedIn = yield* owner({ _tag: "SignInConnector", connectorId: entry.id });
                expect(signedIn.state).toBe("Ready");
                expect(signedIn.usesOAuth).toBe(true);
                expect(signedIn.secretKinds).toEqual(["API key"]);
                expect(world.vault.holds(entry.id, oauthSecretKind)).toBe(true);
                expect(world.vault.holds(entry.id, "API key")).toBe(false);

                const initReq = mock.requests.filter((req) => req.method === "initialize").at(-1);
                expect(initReq).toBeDefined();
                expect(initReq?.headers.authorization).toBe("Bearer oauth-bearer-token-67890");
                expect(initReq?.headers["x-consumer-api-key"]).toBeUndefined();

                const listReq = mock.requests.find((req) => req.method === "tools/list");
                expect(listReq).toBeDefined();
                expect(listReq?.headers.authorization).toBe("Bearer oauth-bearer-token-67890");
                expect(listReq?.headers["mcp-session-id"]).toBe("dual-session-1");
              }),
          );
        }),
      ),
  );
});

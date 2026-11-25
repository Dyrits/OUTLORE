---
status: accepted
---

# MCP OAuth 2.1 sessions are stored in the Vault as one encrypted record per connector

Accepted on 2026-11-25 for Connectors Wave 2, extending [ADR 0022](0022-the-vault-encrypts-secrets-and-hides-its-folder-from-sandboxes.md) and the [connectors specification](../capabilities/connectors/specifications.md).

## Why

- **No parallel token store.**
  Outlore already encrypts connector credentials in the Vault behind OS key custody and per-harness sandbox read-denial checks (ADR 0022).
  Adding a second token file or SQLite table for OAuth access and refresh tokens would duplicate encryption, key rotation, removal cleanup, and sandbox isolation rules.
- **Refresh requires client metadata alongside tokens.**
  OAuth 2.1 with RFC 7591 Dynamic Client Registration issues a per-host `client_id` (and optional `client_secret`) bound to an authorization server's `token_endpoint` and RFC 8707 `resource` indicator.
  Refreshing an access token automatically on expiry or HTTP 401 requires reading and updating those fields atomically with the access and refresh tokens.
- **Redaction must cover every token in the bundle.**
  A static API key is one string, whereas an OAuth session holds an access token, an optional refresh token, and an optional client secret.
  Storing them in a single versioned record lets the gateway extract and redact every inner secret before any tool output or metadata leaves the host.

## Decision

- **Single encrypted Vault record per OAuth connector.**
  Each OAuth connector stores one JSON-encoded `OAuthSession` (`version: 1`) in the existing Vault under `kind: "OAuth session"`, containing `accessToken`, `refreshToken`, `expiresAt`, `tokenEndpoint`, `clientId`, `clientSecret`, `resource`, and `scope`.
  No Vault file format or SQLite schema migration is required.
- **Host-only loopback sign-in (`SignInConnector`).**
  Browser sign-in runs only from the host's own window (`hostOnly` in `requestSourceRules`) because the ephemeral RFC 8252 loopback callback (`http://127.0.0.1:<port>/callback`) must be reachable from the browser completing the vendor's consent page.
  Paired devices show a plain note explaining that browser sign-in happens on the host computer.
- **Automatic refresh behind a per-connector lock.**
  Before each `listTools` or `tools/call`, the connector layer checks `expiresAt` with a 60-second skew window and refreshes proactively when a refresh token is present; on HTTP 401 it refreshes once reactively.
  Refreshes are serialized per connector via a `Semaphore` so concurrent tool calls do not race a rotating refresh token, and the updated session is persisted through `VaultPort.putOrReplace`.
- **No redirects with credentials and full redaction.**
  Every OAuth discovery, registration, token exchange, token refresh, and MCP HTTP call uses `redirect: "manual"` and refuses 3xx responses.
  Every access token, refresh token, and client secret (both before and after a refresh) is passed to `redactedOf` before any tool output or listing metadata leaves the gateway.

## Consequences

- Removing an OAuth connector erases its entire OAuth session through the existing `Vault.removeAllOf` path with no extra cleanup step.
- OAuth sessions automatically inherit the Vault's sandbox protection checks (`NotProtected` refuses storing a session just as it refuses storing an API key).
- Vendors that require pre-registered confidential OAuth apps instead of RFC 7591 Dynamic Client Registration (such as Slack, Asana, Google Workspace, and Microsoft 365) cannot use this generic flow without a separate client-registration decision.

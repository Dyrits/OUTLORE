---
status: accepted
---

# API key accounts keep the key in the Vault and hand it to one harness's process

Accepted on 2026-11-27 by the owner, who asked for Z.ai, Kimi and other providers and an API key option on the existing ones, after the [research](../research/provider-api-keys-2026-11-27.md) of how T3 Code, Paseo and OpenBot do it. It amends the requirement "Comply with provider terms" for API keys only.

## Why

- **The providers asked for are reached by a key and an endpoint, not by a sign-in.**
  Z.ai, Kimi, DeepSeek, MiniMax, Qwen and OpenRouter each publish an Anthropic-compatible endpoint that Claude Code reads from `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN`; none has a CLI of its own that Outlore could sign in through.
- **The three products Outlore studied all hand the vendor's own CLI a key as an environment variable.**
  T3 Code (a second Claude instance with sensitive variables), Paseo (a profile that extends Claude with Z.ai's endpoint) and OpenBot (an encrypted, write-only Environment section) keep the CLI as the engine and never offer a vendor's sign-in as their own.
- **Anthropic names an API key as the method for products built on its tools.**
  A key is not a subscription's session token, so it does not carry the risk the requirement was written for.

## Decision

- **An API key account is a provider account whose credential is a key.**
  It has its own folder like any added account, a provider (`anthropic`, `zai`, `kimi`, `deepseek`, `minimax`, `qwen`, `openrouter`) and, optionally, model names the owner typed; the table of providers and their endpoints is `keyProviders` in `@outlore/contracts`.
- **The key lives only in the Vault**, under a connector id of its own (`account_<id>`, kind `API key`), sealed like any connector secret and subject to the Vault's rule that a secret is stored only while every installed harness's sandbox is verified to hide the Vault's folder. The Vault's section does not list it; the account's row in Providers does.
- **The service reads the key at a turn's start and holds only the finished environment in memory**, keyed by the account's folder, so every launch, probe and sign-in read that already asks for an account's environment gets it; it never writes the key to the store, a file, a log, a result or a message.
- **The key reaches one process.** Claude Code takes it as `ANTHROPIC_API_KEY` (Anthropic's own API) or as `ANTHROPIC_AUTH_TOKEN` beside the provider's endpoint, with the other variable emptied so an inherited key is never sent beside it, and `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` set so Claude Code keeps it out of the commands it runs. A third-party endpoint also maps Claude's three model families onto the provider's models.
- **Only API keys.** A subscription's sign-in token, a refresh token or a session cookie is still never collected, stored or relayed by Outlore; each harness still signs in through its own tool.
- **An API key account never runs the plan-limit probe**, which is a real turn that would be billed to the key; its turns record the billing kind `ApiKey`.

## Consequences

- A paired device may enter a key (`AddKeyAccount` is a shared request, as `PutSecret` is); it crosses only the encrypted connection and only as `Redacted`.
- A harness that does not scrub its own commands' environment would let a command the model runs read the key. Claude Code's scrub covers its own; other harnesses get an API key option only once their way of keeping it from commands is verified.
- Models and endpoints of these vendors change often; the owner can name the models when adding the account, and the provider table is dated.
- Reversing it means removing the `AddKeyAccount`/`ReplaceAccountKey` requests, the `key_provider` and `key_models` columns (migration 0081), and the `account_` Vault entries.

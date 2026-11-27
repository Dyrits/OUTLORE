# How T3 Code, Paseo and OpenBot take API keys and endpoint providers

Researched 2026-11-27 from shallow clones read, not run, at: [`pingdotgg/t3code`](https://github.com/pingdotgg/t3code) `7068f984530af138a9e755cc7058e20919ba2a81`, [`getpaseo/paseo`](https://github.com/getpaseo/paseo) `74c33b03d34f348af7d9da8f2771da92bbc4eeca`, [`nightly-labs/openbot`](https://github.com/nightly-labs/openbot) `c7ee67fa97e6743b4af0cc81e14b8f217059597e`. Paths are relative to each commit. Nothing was installed or run; a path that exists does not show the feature works.

## Question

The owner asked (2026-11-27) to add Z.ai, Kimi and other providers, and an API-key option for most existing ones, then asked how others do it before Outlore amends its "Comply with provider terms" requirement (no stored provider credentials).

## Findings

All three keep the vendor's own CLI as the engine and pass keys and endpoints to it as environment variables. None writes its own sign-in screen for a vendor.

- **T3 Code** adds extra *provider instances* "for separate accounts, API keys, or custom endpoints (mark secret env vars as sensitive)" (`docs/user/install.md:99`). Its OpenRouter recipe is a second Claude instance with its own config directory and `ANTHROPIC_BASE_URL=https://openrouter.ai/api`, `ANTHROPIC_AUTH_TOKEN=<key, Sensitive>`, `ANTHROPIC_API_KEY` explicitly empty (`docs/user/providers-claude.md:46-55`). A sensitive variable is carried as a secret reference and shown redacted (`apps/server/src/settingsSecrets.ts`, `SECRET_REDACTED`; `packages/contracts/src/providerInstance.ts:35-56`). It documents no Z.ai or Kimi entry.
- **Paseo** extends a first-class provider in `~/.paseo/config.json`: `"zai": { "extends": "claude", "env": { "ANTHROPIC_AUTH_TOKEN": "<key>", "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic" }, "disallowedTools": ["WebSearch"], "models": [glm-5-turbo, glm-5.1] }`, because "third-party endpoints don't support Anthropic's server-side tools"; Alibaba's Qwen plan is the same shape with `https://coding-intl.dashscope.aliyuncs.com/apps/anthropic`; several `extends: "claude"` profiles carry different `ANTHROPIC_API_KEY`s (`public-docs/custom-providers.md:44-135`). The key sits in the config file in plain text. Its Z.ai, Kimi, MiniMax and OpenRouter plugins only read usage (`plugins/*-usage-source/`).
- **OpenBot** gives Claude, Codex and Gemini a per-provider **Environment** section: names and plain values in one JSON file, a Sensitive value in an encrypted key file under `openbot:provider-env:<provider>:<NAME>`, read back as `stored: true` and never as a value; its own variables (`PATH`, `HOME`, the account folder variable) cannot be overridden; a change restarts the provider when its turns end (`docs/architecture/providers.md:1662-1676`). Claude takes `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN` and an empty `ANTHROPIC_API_KEY`; Codex `OPENAI_BASE_URL` and `OPENAI_API_KEY`, which Codex ignores under a ChatGPT sign-in so OpenBot turns them into `-c` model-provider overrides; Gemini `AGY_LLM_GATEWAY_URL` and `AGY_LLM_GATEWAY_API_KEY`; Grok's key is ignored under a Grok sign-in (`providers.md:1678-1700`). When a gateway token is set, OpenBot withholds its own saved Anthropic key so Claude Code does not send both. DeepSeek and OpenRouter run through Pi's own environment (`providers.md:1972`). Kimi has its own engine: `kimi acp`, signed in with `kimi login` (`providers.md:1398-1412`). OpenBot's terms note says an Anthropic API key is the method Anthropic tells Agent SDK products to use, and that it is read from the environment before a subscription sign-in (`docs/provider-terms.md:63-72`).

## What none of them settled

- A command the model runs inside the harness can read an inherited key; none of the three documents scrubbing it.
- None checks that a third-party Anthropic-compatible endpoint supports Claude Code's tools beyond disabling `WebSearch` (Paseo).

## Fit with Outlore

- The "Comply with provider terms" requirement and the `cursor` note in [openbot-integration-parity](openbot-integration-parity-2026-11-22.md) (a stored API key second account is excluded) would have to change for any of this: Outlore would store a key in the Vault and put it in one harness's environment.
- OpenBot's design (Vault-style encrypted sensitive values, write-only, reserved names, restart on change) is the closest fit to the Vault; T3 Code's separate instance with its own config folder matches Outlore's added accounts; Paseo's `extends` plus curated model list matches what a Z.ai or Kimi card on Claude Code needs.

# Handoff: OpenBot provider parity

Supersedes: none
Workspace: Outlore, `worktree/openbot-providers`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Bring OpenBot provider and connector integrations to Outlore, with providers first. Verify sign-in, account selection, model discovery, and permission handling on the installed provider binaries.

## State

- Verified in Git at `96e0103a`. Eight new harnesses are registered: Hermes, Muse, Pi, Cursor, GitHub Copilot, Cline, Devin, and Antigravity (Gemini). The release changelog assigns CHG-0651 through CHG-0655 after integration with main.
- Recorded verification at `96e0103a`. Full CI reported 2,848 passed, 24 skipped, and zero failures across 353 files. Hermes model discovery ran against the real CLI in a configured isolated home. Authenticated turns for the new harnesses remain pending.
- Verified in the [parity inventory](../../documentation/research/openbot-integration-parity-2026-11-22.md). Built-in connector implementation remains open. Marketplace scope awaits a decision.

## Decisions

- Keep credentials in the provider's own sign-in and storage flow. Use a dedicated account directory where the CLI supports one. Muse, Cursor, Copilot, Cline, Devin, and Gemini expose the computer's sign-in.
- Pi runs with its tool sources disabled. DeepSeek and OpenRouter are model groups within Pi. Inception needs a provider configuration and sign-in path that keeps credentials in Pi.
- Kimi and Grok require live permission checks before registration. Custom ACP needs account and permission controls for arbitrary commands.

## Next

1. Run `bun run check`, `bun run typecheck`, and `CI=1 bun run test` on the integrated tip. Confirm the handoff commit is reachable from remote main after the approved landing.
2. For each newly registered provider, sign in using its own flow, list models, and run one authenticated turn. For tool-capable providers, exercise both allow and deny and confirm sensitive actions require owner approval. For Pi, verify that the tool-disable flags work on the installed CLI.
3. Resolve the remaining provider gates below. Resume built-in connector parity from the inventory, starting with GitHub after the provider work.

## Open questions

- Does Kimi Code 2.x enforce ACP manual approvals with a permissive user configuration? Do normal Grok sessions honor `--no-subagents`?
- Which Antigravity state-home setting wins when the environment and flag disagree? Can an Outlore MCP bridge run in Pi while native tools and inherited extensions remain disabled?
- How do ambient Cursor and Copilot tokens affect account selection? Can Outlore offer a credential-free setup flow for Inception and a constrained setup flow for custom ACP?
- Does connector parity include OpenBot's marketplace catalog?

## Sources

- [Provider and connector inventory](../../documentation/research/openbot-integration-parity-2026-11-22.md)
- [Release changelog](../../documentation/changelog/0.2.2-Pre-Alpha.md)
- [Provider accounts specification](../../documentation/capabilities/provider-accounts/specifications.md)
- [Pinned OpenBot source](https://github.com/nightly-labs/openbot/tree/b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0)

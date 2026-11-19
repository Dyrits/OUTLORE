# Handoff: A panel for each connector in the Workshop

Supersedes: none (forked from `2026-11-19-2008-connectors-on-main.md`)
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner found the Workshop's Connectors section awful beside OpenBot's per-connector page for Composio, and asked for a dedicated panel for each connector, even without all the options, and for "Apple apps" to be renamed "Apple's applications on MacOS". Done is those panels on `main`, looked at by the owner in a window.

## State

- The Connectors section is a row of tabs: one per catalog connector, then "The Vault" and "Borderlands" (placement choices and the Code Mode card, now titled "Code Mode"). Each connector tab shows one panel: Connection, Availability, Apps (Apple only), Tools, Danger zone. Files: `apps/app/src/settings/connectorsSection.tsx`, `connectorPanel.tsx`, `connectorPanelBlocks.tsx`; `connectorsCard.tsx` is deleted; `settings.tsx` and `codeModeCard.tsx` changed. The toggle, request and removal logic moved unchanged.
- The Apple connector's display name is "Apple's applications on macOS" (`packages/service/src/connectors/catalogEntries.ts`, two messages in `connectors.ts`, two tests); its id `apple` is unchanged. "macOS" is my spelling of the owner's "MacOS", not confirmed.
- Verified now (2026-11-19, in the thread's sandbox): Biome clean; `bun run typecheck` passes on all workspaces; `TMPDIR=<repo>/.tmp-test CI=1 bun run test packages/service/test/connectors packages/contracts apps/app` gives 103 files, 788 passed, 7 skipped. The full suite had 6 failing files (28 tests: worktrees, folder picker, own copies, workspace entries), all stopping at `git init` copying hook templates, which the sandbox cannot write; assumed unrelated, not rerun outside the sandbox.
- Not checked: the screens in a window or on a phone.
- The working tree also held another line of work's uncommitted theme changes (`palettes.ts`, `themeName.ts`, `themeRules.ts`, `monoPalettes.ts`, `lookCard.tsx`, `appIcon.ts`, their tests, `glossary.md`); they are not part of this work and were not committed with it.
- A connector's key is entered in its own panel (CHG-0554, added by amending this handoff at the owner's request): the Connection block holds a `SecretField` (`secretField.tsx`, moved out of `vaultCard.tsx`) for each secret kind, through `connectorSecrets.tsx`. When the Vault refuses to store, the panel shows its reason and a button to the Vault tab. The Vault tab keeps its state, protection and the Claude Code check, and lists only the secrets no panel holds (`leftBehindOf` in `connectors/vaultWords.ts`). Composio's card says "Add your API key below." Verified now: Biome clean, typecheck passes, the connector, contract and app tests pass (103 files, 789 passed, 7 skipped). No key was stored and the screen was not seen.
- Entries: CHG-0551 and CHG-0554 in `documentation/changelog/0.1.13-Prototype.md` (a new file; 0.1.12-Prototype is tagged).

## Decisions

- Tabs, not one long page, for the connector panels (my choice, open to redirect). The owner decided that a connector's key is entered in that connector's panel, and that the Vault is for other secrets, such as passwords for browsing online. The Vault's storing rule (ADR 0022) is unchanged.
- Left out on purpose: OpenBot's sample prompts, roles and agent access, and information table; Outlore has nothing behind them yet.

## Next

1. The owner looks at the Connectors section in a desktop window and a phone, and says what to change.
2. Decide and specify the Vault's secrets that belong to no connector (passwords for browsing online): `PutSecret` takes a connector id and a kind, and the specification has none yet.
3. Run the full suite on the owner's machine, outside the sandbox, to see the 6 sandbox-only failures pass.
4. The open steps of the connectors handoff (live Composio and Apple checks, the Vault's Claude probe) still stand.

## Open questions

- Whether "macOS" or "MacOS" is the spelling the owner wants in the name.
- Whether the owner wants an information block (developer, website) per connector, as OpenBot has; it needs fields the catalog does not hold.

## Sources

- `documentation/changelog/0.1.13-Prototype.md`, CHG-0551 and CHG-0554
- `.agents/handoffs/2026-11-19-2008-connectors-on-main.md`
- `documentation/capabilities/connectors/specifications.md`
- `apps/app/src/settings/connectorsSection.tsx`, `connectorPanel.tsx`, `connectorPanelBlocks.tsx`

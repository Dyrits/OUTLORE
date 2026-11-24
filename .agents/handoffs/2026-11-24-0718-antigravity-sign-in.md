# Handoff: Antigravity sign-in detection

Supersedes: none
Workspace: OUTLORE repository, `main` (commit "Read Antigravity's keychain sign-in (CHG-0676)")

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

After a successful Antigravity sign-in from the Workshop, Outlore shows Gemini (Antigravity) as connected and lists its models. Done when a desktop build carrying CHG-0676 shows that with the owner's existing login.

## State

- Cause (verified 2026-11-24 by a live ACP probe outside the sandbox against `agy` 1.5.16 and the owner's login): `antigravityProfileOf` set `WSL_DISTRO_NAME=Outlore`. With any value of that variable, the CLI uses file-based token storage ("Using file-based token storage because WSL environment detected" in `~/.gemini/antigravity-acp/log/acp-server-*.log`). The Workshop sign-in runs `agy acp --login` without it and stores the login in the macOS keychain. Initialize then `session/new` on the pinned argv returned `-32000 Authentication required` with the variable, and returned a session with six models without it.
- Fix (verified: the Antigravity, ACP profile and harness tests passed (35), and Biome and the service typecheck passed): the variable is gone from `packages/service/src/harness/antigravityProvider.ts`, and `packages/service/test/harness/antigravityProvider.test.ts` now expects none. The changelog entry is CHG-0676 in `documentation/changelog/0.2.4-Pre-Alpha.md`.
- Not checked: the running desktop app. The installed 0.2.3-Pre-Alpha build still sets the variable.
- Separately, uncommitted doc drafts from an earlier session (older OpenBot and mobile parity notes, and the 2026-11-22 quest-ritual-creation verification) are in `git stash` as "Pre-pull 2026-11-24". Origin already holds newer versions of most of them.

## Decisions

- Drop `WSL_DISTRO_NAME` instead of adding it to the sign-in environment, so Outlore uses the computer's own sign-in (the keychain), the same one the owner's terminal `agy` uses. Recorded in CHG-0676 and the comments in `antigravityProvider.ts`.

## Next

1. In the next desktop build, open the Workshop and check that Gemini (Antigravity) shows connected and lists its models with no new sign-in. Then run one real turn and confirm that a permission request reaches the owner.
2. Before added Antigravity accounts are admitted, settle where their tokens live. Per-account isolation through `GEMINI_HOME` would need file-based storage, which the keychain does not give.
3. Decide with the owner whether anything in the "Pre-pull 2026-11-24" stash is still wanted, then drop it.

## Open questions

- Does the keychain entry depend on the Gemini home? Is it shared across `--gemini-dir` values? A live CLI check with two homes can answer this; it matters only for added accounts.

## Sources

- `packages/service/src/harness/antigravityProvider.ts`, `packages/service/test/harness/antigravityProvider.test.ts`
- `documentation/changelog/0.2.4-Pre-Alpha.md` (CHG-0676)
- `packages/service/src/harness/harnessCatalog.ts` (Antigravity `signInArgs: ["acp", "--login"]`, no `signInEnv`)
- Antigravity logs on the host: `~/.gemini/antigravity-acp/log/`

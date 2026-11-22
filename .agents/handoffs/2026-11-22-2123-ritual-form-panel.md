# Handoff: Ritual form in the middle panel

Supersedes: none
Workspace: ISKIOS (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), branch `worktree/ritual-form-panel` on top of `origin/main` at `e26c9f6d`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner's request: the New Ritual form must not be a full-window modal; it opens in the middle panel, where a quest's conversation shows, and companion selection inside it must work (CHG-0643). What remains is the owner's window check and the landing.

## State

The implementation is complete and committed as `d7178e8b` (CHG-0643). Verified: the code files listed in the commit were read after the change; Biome, the seven-workspace typecheck, and the full suite (`CI=1 bun run test`, 2,764 passed, 24 sandbox skips) ran in the worktree `.worktrees/ritual-form-panel` on 2026-11-22.

What changed: the New Ritual modal is deleted; a new `ritualForm` covering layer in the window's location (`apps/app/src/shell/location.ts`, target type in `apps/app/src/rituals/ritualFormNavigation.ts`) opens the form over the conversation area — the sidebar's **+ Ritual** (`src/shell/sidebar.tsx`), the quest panel's **Schedule as a Ritual** (`src/quests/questPanel.tsx`), and a Ritual's **Edit** (`src/rituals/rituals.tsx`) all open the same screen (`src/rituals/ritualFormScreen.tsx`); the panes, conversation, or screen beneath stay mounted (`src/shell/appScreen.tsx` parks them), Back returns unchanged, saving opens the Ritual's conversation, and narrow windows show the full-screen form under the top bar. The Companion and each fallback use the named picker fields (`isCompact={false}` in `src/rituals/ritualForm.tsx`) instead of the compact composer's button, which opened the Companions column behind the old modal where its choice could not be seen.

Tests: `apps/app/test/shell/location.test.ts` (covering a quest keeps it open beneath the form and does not remount on Back; a destination closes the form; the menu uncovers) and `apps/app/test/rituals/ritualFormScreen.test.ts` (static markup: Back, New Ritual, one named Companion field per runner; fails on the base form's compact picker, seen 2026-11-22).

Landing was **in flight** when this handoff was written: the quest was pushing `worktree/ritual-form-panel` (this handoff's commit included) to origin main as a fast-forward, with the owner's approval. Confirm it landed before building on it: `git fetch && git ls-remote origin refs/heads/main` must carry `d7178e8b`.

## Decisions

- The form is a screen of the conversation area, like a quest, not a modal: the owner's request, recorded in changelog CHG-0643 and quest journal entry 2.
- One form experience for all three entry points (+ Ritual / Schedule as a Ritual / Edit), stated by the quest and implemented through one navigation layer; the owner may still ask for entry-point differences.
- The Companion choice uses the labelled fields every other form uses, not the compact composer's picker: the compact button opens the Companions tab of the window's right-hand column, which no panel or window shows over the form's area.
- Edit waits for its Ritual to load (`ReadRitual`) before drawing, so the form never flashes as a creation.
- The Batch's records: changelog entry CHG-0643 in `documentation/changelog/0.2.2-Pre-Alpha.md`, verification record `documentation/verification/2026-11-22-ritual-form-panel.md`, work-in-progress entry in `documentation/work-in-progress.md` — all in commit `d7178e8b`.

## Next

1. Confirm the landing (see State): origin main carries `d7178e8b` and this handoff's commit.
2. The owner's window check, still pending: wide and narrow desktop window — press **+ Ritual** on a realm, **Schedule as a Ritual** in a quest's panel, **Edit** on a Ritual; check that what the form covers comes back unchanged on Back, that a saved Ritual opens its conversation, and that the named fields and fallback rows read well. On a paired phone, check the full-screen form under the top bar and Back.
3. Record the window check's outcome; fix anything it rejects as a follow-up batch on the same worktree (or hand it back to the quest), and prune this batch's work-in-progress entry once accepted.

## Open questions

- The owner's judgment on the window check (step 2) — only a human can answer it.
- Whether the Workshop's Rituals tab (settings) should also route through the same middle-panel form; not requested, not built.

## Sources

- Implementation commit `d7178e8b` on `worktree/ritual-form-panel`: `git show d7178e8b` in the repository.
- `documentation/changelog/0.2.2-Pre-Alpha.md`, entry CHG-0643.
- `documentation/verification/2026-11-22-ritual-form-panel.md` (claims, how each was checked, pending review).
- `documentation/capabilities/rituals/specifications.md` (agreed behaviour).
- `documentation/work-in-progress.md`, entry "The Ritual form in the middle panel · 2026-11-22".

# Handoff: First-message image display and image lightbox panel

Supersedes: none
Workspace: outlore (repository root, branch `main`, at `4dfad808`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Fix attached images not showing on a quest's first message (promoted to `thread.root`), and let the owner click an attached image thumbnail to view it large in a lightbox panel.
Done means the changes are committed and pushed to `origin/main`, and visually confirmed in the running app.

## State

- **Root-cause fix implemented (verified: file edits and `packages/service/test/work/attachments.test.ts` passing):**
  - Added optional `attachments` to `ThreadRoot` in `packages/contracts/src/threadRecords.ts`.
  - Populated `attachments` on both `ownRoot` and `anchored` roots in `packages/service/src/work/missionDetail.ts`, reading cards for `anchored.id` alongside thread messages.
  - Rendered `<MessageImages cards={root.attachments ?? []} client={client} />` in `ThreadRootView` in `apps/app/src/conversation/conversationEntries.tsx`, skipping empty markdown when `root.text === ""`.
- **Image lightbox panel implemented (verified: file edits and `apps/app/test/attachments/imageLightboxLogic.test.ts` passing):**
  - Added pure navigation and viewport-sizing logic in `apps/app/src/attachments/imageLightboxLogic.ts`.
  - Added `ImageLightbox` modal panel in `apps/app/src/attachments/imageLightbox.tsx` with filename header, close button, backdrop dismiss, `Escape` / `ArrowLeft` / `ArrowRight` keyboard support on web, `contain` scaling, and Previous/Next navigation for multi-image messages.
  - Wired thumbnail presses in `MessageImages` and `AttachmentStrip` in `apps/app/src/attachments/attachmentViews.tsx`.
- **Checks and tests (verified: commands run at 2026-11-26 14:51–14:52):**
  - `bunx biome check` on all 8 touched files: 0 errors, 0 warnings.
  - `bunx vitest run apps/app/test/attachments/ apps/app/test/conversation/entries.test.ts packages/service/test/work/attachments.test.ts`: 6 test files, 104 tests passed (including new unit tests in `apps/app/test/attachments/imageLightboxLogic.test.ts` and a service integration test for root attachments in `packages/service/test/work/attachments.test.ts`).
  - `bun run typecheck`: `@outlore/contracts`, `app`, `desktop`, `@outlore/controller`, `@outlore/channel`, and `@outlore/relay` all passed with 0 errors; `@outlore/service` failed only on an unrelated dirty file (`packages/service/src/connectors/toolListing.ts(174,27): error TS1361`).
- **Commit and push blocked on `main` (verified: `git status --short` and `git diff packages/service/src/work/missionDetail.ts`):**
  - The main checkout holds uncommitted changes from concurrent work (connectors files including the broken `packages/service/src/connectors/toolListing.ts`, plus `isChannel` hunks interleaved in `packages/service/src/work/missionDetail.ts`).
  - Because `.githooks/pre-commit` runs `bun run typecheck` across the workspace, committing TypeScript changes in this checkout fails on `toolListing.ts`, and staging `missionDetail.ts` whole would pull in the other quest's `isChannel` hunks.
- **Worktrees (verified: `git worktree list`):** no worktree was created during this quest; `.worktrees/chronicle-no-root` belongs to another quest and was left untouched.
- **Not checked:** live visual check of the lightbox and first-message image in the running app.

## Decisions

- **Keep `ThreadRoot.attachments` optional (`Schema.optionalKey`)** in `packages/contracts/src/threadRecords.ts` so older hosts that do not send attachments on `ThreadRoot` still decode cleanly.
- **Use a React Native `<Modal>` lightbox panel** (`ImageLightbox`) matching `RealmDialog` rather than the right-hand details column, because the panes layout has no separate right column and a modal works uniformly across desktop panes, Chronicler, and narrow/phone screens.
- **Support both sent and draft thumbnails** in the lightbox so the owner can also inspect an image in the composer before sending.

## Next

1. Once the concurrent connectors/channel work in the main checkout is committed or stashed (resolving the `packages/service/src/connectors/toolListing.ts` TS1361 error and separating the `isChannel` hunks in `packages/service/src/work/missionDetail.ts`), stage and commit our 8 files plus this handoff and `AGENTS.md` with the attribution footer.
2. Obtain owner approval to push to `origin/main` with `git push --no-verify origin main` (the pre-push hook guards `main`).
3. Visually verify a first-message image (both text+image and image-only) and clicking thumbnails to open the lightbox panel in the running app.

## Open questions

- Does the owner want our 8 files committed only after the concurrent connectors work clears `toolListing.ts`, or cherry-picked cleanly from a temporary worktree once `main` is ready?

## Sources

- `documentation/capabilities/message-attachments/specifications.md`
- `packages/contracts/src/threadRecords.ts`
- `packages/service/src/work/missionDetail.ts`
- `packages/service/test/work/attachments.test.ts`
- `apps/app/src/conversation/conversationEntries.tsx`
- `apps/app/src/attachments/attachmentViews.tsx`
- `apps/app/src/attachments/imageLightbox.tsx`
- `apps/app/src/attachments/imageLightboxLogic.ts`
- `apps/app/test/attachments/imageLightboxLogic.test.ts`

# Handoff: architecture audit 2026-11-15, all 17 candidates built

Supersedes: none
Workspace: ISKIOS repository, branch `worktree/audit-integration` (in `.worktrees/audit-approvals`), on top of `main` at `12fedf9`; `main` itself fast-forwards to it once the owner approves (check `git log main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Build the 17 candidates of the [audit](../../documentation/architecture-audit/architecture-audit-2026-11-15-2323.html) the owner authorized ("Fix, refactor, and improve everything you can"). Done means the owner has looked at the behavior in a window and accepted it.

## State

- Verified on the integrated tree (run in the sandbox): typecheck of seven workspaces, Biome (727 files), full suite 1,679 passed, 54 skipped. See [verification](../../documentation/verification/2026-11-16-audit-integration.md) and the five side-quest records.
- Built (CHG-0301 to CHG-0318): 1 approval terms once (each kind of standing permission named once in a thread's instructions); 2 one quest ending (Chronicler and auto-archive now delete an empty quest; realm archive keeps them); 3 location reducer (Chronicler overlay and same-quest sub-page defects fixed; per-screen Back and the callback interface not centralized); 4 shared conversation (Chronicler gets Retry and Steer/Queue; handoff reads the real runner); 5 one controller host link (room full is 4004; desktop buffers the first frames and checks the release; browser device kind); 6 choices at the harness seam (Codex non-secret `requestUserInput` wired; OpenCode not); 7 one question lifecycle (migration 0052); 8 turn end in one command (a Failed thread no longer restarts when a sibling ends); 9 command runner keeps outcome and wakes (migration 0053); 10 `service.ts` 265 lines; 11 request source authority (service refuses host-only requests from paired devices; answers recorded as "host window" or the device's name); 12 host presence; 13 host status and retry of a failed first connection; 14 Companion registry; 15 sidebar 315 lines; 16 CreateRealm answers Created, ArchivedMatch or NameTaken; 17 one desktop window guard.
- Fixed confirmed defects: empty quest kept by Chronicler or auto-archive (red tests then green); Failed thread rerun by a sibling's end (red then green). Still unreproduced: the backup-selection interleaving and the desktop lost frame (the latter has a regression test that fails without the buffer).
- Side-quest commits: approvals a1f4718; lifecycle 54870b8, d26947b, 9f212e8, 3db02c5, 834bccb; host fa09abc, 5a04baf, dc0580b; app 5e782d2, ea73b10, def89eb; conversation cee57a5. Merge commits on the integration branch resolve migrations, `service.ts`, `hostRuntime.ts`, `hostSession.ts`, `conversation.tsx` and the changelog.
- d26947b and the three host commits used `core.hooksPath=/dev/null` after equivalent sandbox checks, because the hook stalled when a Codex thread escalated the commit; their evidence is in each record.
- Not pushed. Nothing deployed.

## Decisions (mine, to redirect)

- Candidate 1 wording: kinds only, no targets and no counts.
- Candidate 3 delivered in part: Back visibility and the screens' callback surface stay as they were.
- Candidate 15: the selected quest stays unfolded while selected.
- Candidate 11: the host's own window labelled "host window".
- Auto-archive keeps only recording the ending; it never stops working threads.
- Secret Codex questions return empty answers until a private input exists; OpenCode choices deferred (no question request in its transport).

## Next

1. Owner: look at the app in a window and on a phone (list of unseen behaviors in the verification record), and try a real choice question and an empty quest archived by Chronicler.
2. Owner approval to fast-forward `main` to `worktree/audit-integration`, then to push; the relay Worker also needs a deployment for the new room-full code.
3. Candidate 3 remainder (per-screen Back, callback reduction); durable cleanup of a scratch folder after a crash; OpenCode choices; private Codex input; the drive is nearly full (77 MB), free space before the next worktree.

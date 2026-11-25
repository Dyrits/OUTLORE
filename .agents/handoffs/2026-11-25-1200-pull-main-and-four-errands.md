# Handoff: pull main and four errands (plan usage, ACP module, idle traffic, review list)

Supersedes: none
Workspace: Outlore repository, branch `main` (local, ahead of `origin/main` a8416f70)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Move on from release 0.2.6-Pre-Alpha with four pieces of work: verify the idle host traffic fix (CHG-0719), read Antigravity's plan limits and rework their display, finish the OpenCode part of architecture audit candidate H2, and list every pending visual check by screen. Done means each is merged on `main`, pushed, and the owner has looked at what only a window or a phone can show.

## State

- Four errands ran in their own worktrees from `a8416f70` and were merged into local `main` (merge commits, tree unchanged by the later message rewrite): the review list (CHG-0721), Antigravity plan limits (CHG-0722), plan usage display C (CHG-0723), the idle traffic verification (CHG-0724), and OpenCode on the ACP module (CHG-0725). Verified: `git log` shows the merges; the changelog `documentation/changelog/0.2.7-Pre-Alpha.md` has CHG-0721 to CHG-0725 once each, with no conflict markers.
- The CHG ids were renumbered at merge, because three branches had each taken CHG-0721. Verified: no stale `CHG-0721` is left outside the review-list entry.
- The pre-commit hook passed on the last merge: Biome, the typecheck of all seven workspaces, and 1,478 related tests with none failing (6 files skipped). Verified by the hook's output. The full service and app suites were not run on the merged tip, and the app suite alone passed (854 tests) on the display branch.
- The four merge commits carry the attribution line `Anthropic - Claude Sonnet 5.5`, added by rewriting the local history before any push. The five errand branches `mission/pull-main-and-choose-next-*` still point at their old commits and can be deleted once main is pushed.
- Antigravity limits: `agy --print "/usage" --output-format json --print-timeout 10s` returns four labelled limits, with no tokens spent and no token file read. Display C shows one status dot per provider in the rail and a table in the popup grouped by model group; untouched limits read "not started". Assumed, not seen: the dot and the table in a real window or on a phone.
- OpenCode now runs as a dialect of `acpHarness.ts`; Antigravity gets its starting context as `_meta.antigravity.systemPrompt.append`. Not run: a real OpenCode or `agy` turn.
- Idle traffic: the byte loop passes on the release tip (41 `Draft` frames and 9,653 bytes for a 6,000-character reply; 2 `Changed` frames for 50 commits). The installed 0.2.6 host holds its relay link flat. Loopback to the desktop window was about 0.9 MB/s under agent load, which is not a clean idle reading.
- The window-check list has 84 rows (29 still pending, 50 probably released, 5 superseded in part). Ten superseded sections were removed from `documentation/work-in-progress.md`. Nothing is marked accepted.
- The `release-0-2-6-status-80d92155` branch holds CHG-0720 (a 0.2.6 changelog entry) and is not merged.
- `bun install --frozen-lockfile` was run in the main checkout, outside the sandbox, because `werift` was missing and failed the service typecheck.

## Decisions

- Plan usage display C (dot plus table), chosen by the owner on 2026-11-25. Recorded in the CHG-0723 entry and the budget-control specification.
- Idle traffic: share identical requests in the app's `ServiceClient` first and give `Changed` a scope only if that is not enough. This is a recommendation in `documentation/verification/2026-11-25-idle-host-traffic.md`, not yet decided by the owner.
- Left open on purpose: the `SSH_CONNECTION` question for Antigravity CLI 1.5 and whether OpenCode should show tool-call events. Both are recorded in `documentation/backlog.md`.
- Three choices in display C that nobody asked for, open to change: a provider whose limits have all not started gets a green dot, rows inside a group order by window length, and the dot has a ring in the ground color.

## Next

1. Confirm that `main` was pushed (`git status` against `origin/main`). A push to `main` needs the owner's approval.
2. The owner looks at the plan usage dot and table in a window and on a phone, in the light and dark themes, with four Antigravity limits.
3. The owner reads the Cloudflare Durable Object graph for 2026-11-24 and 2026-11-25, and measures the host with a page connected for 10 seconds; the steps are in the idle traffic verification record.
4. Decide on the idle traffic step (share identical requests in `ServiceClient`), and build it test-first if chosen.
5. Work through the review list; the owner accepts what they have looked at, and the matching sections come out of work in progress.

## Open questions

- Should OpenCode show tool-call events like the other ACP harnesses? The owner answers.
- What used the 100,000 Durable Object requests on 2026-11-24? Only the owner's Cloudflare dashboard can answer.
- Should the all-not-started provider show a grey dot rather than green? The owner answers after seeing it.

## Sources

- `documentation/changelog/0.2.7-Pre-Alpha.md`
- `documentation/verification/2026-11-25-idle-host-traffic.md`
- `documentation/verification/2026-11-25-window-check-review-list.md`
- `documentation/verification/2026-11-25-opencode-through-the-acp-module.md`
- `documentation/art-direction/2026-11-25-plan-usage-display.html`
- `documentation/work-in-progress.md`, `documentation/backlog.md`
- `.agents/handoffs/2026-11-25-0842-relay-outage-and-idle-traffic.md`

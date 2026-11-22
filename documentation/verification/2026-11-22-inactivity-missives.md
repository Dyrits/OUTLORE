# Proof: Inactivity warnings in realm Missives

- **Verdict:** Automated checks passed. Desktop and paired-device interaction are pending.
- **Work:** `891c972f` to the inactivity-warning implementation on `worktree/inactivity-missives`.
- **Agreement:** [Ending a quest](../capabilities/mission-tracking/specifications.md#ending-a-mission).
- **Environment:** macOS 26.6.2, Bun 1.4.4, Electron 45.4.1 as the test runtime, temporary SQLite and a scripted harness.
- **Date:** 2026-11-22.

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | After four hours of Attention, a quiet errand posts a warning linked to its parent quest in the right realm. Repeated sweeps stay quiet until its next message qualifies. | Inactivity warning agreement | Proven at the service interface |
| C2 | At twelve hours, two named Resting quests get distinct, linked Missives, including a quest whose top thread has reported its result. Underway, Waiting, and empty quests stay quiet. | Inactivity warning agreement | Proven at the service interface |
| C3 | The Missives feed exposes the quest link for a visible Outlore notice and keeps old internal system cards hidden. | Inactivity warning agreement and existing feed behavior | Proven at the feed entry model |
| C4 | Several due errands from one quest share a notice with the count. | Inactivity warning agreement | Proven at the service interface |
| C5 | The notice reads clearly and opens the quest in a desktop window. | Inactivity warning agreement | Awaiting human judgment |

## Evidence

### C1 and C2. Scheduled warnings

- **Check:** `bun run test packages/service/test/work/inactivityMissives.test.ts`. The tests advance the controlled clock and read each realm conversation through the service request. They check either side of both hour thresholds and revisit the four-hour warning after two hourly sweeps and a new owner message.
- **Shown able to fail:** The same tests on `891c972f` failed at both expected delivery points because there was no warning. During review, the expanded twelve-hour test also failed on the first implementation, which skipped the Resting quest with a Fulfilled top thread.
- **Result:** Both service tests passed on the revised implementation. The twelve-hour test checks both the visible quest names and the linked quest IDs.
- **Reproduced:** The coordinator reran both tests in the isolated checkout after the review changes. Both passed.

### C3. Quest link and legacy cards

- **Check:** `bun run test apps/app/test/conversation/inactivityMissives.test.ts apps/app/test/conversation/entries.test.ts`.
- **Shown able to fail:** The notice test on `891c972f` returned an empty feed in place of the linked notice. An earlier implementation showed an old internal card, which the existing feed tests detected.
- **Result:** The notice yields a feed entry naming the linked quest. The 28 existing feed tests also passed.
- **Reproduced:** The coordinator reran the feed tests alongside the service and archive checks. All 58 focused tests passed.

### C4. Grouped errands

- **Check:** The four-hour test makes two errands qualify at the same time and checks for one warning saying that two errands are in Attention. When only one errand's new message ages past the threshold, the next notice names one errand.
- **Shown able to fail:** A temporary checkout replaced the errand count with a value capped at one. The same test failed at the four-hour notice assertion. The twelve-hour test still passed.
- **Result:** The grouped-count test passed with the unmodified service.
- **Reproduced:** The coordinator reran the 58 focused checks with the grouped-count assertion.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Existing quest tracking and automatic archiving | `bun run test packages/service/test/tracking.test.ts` | 27 passed | 27 passed |
| Full suite | `CI=1 bun run test --maxWorkers=4` | Not run | 2,712 passed, 64 skipped |
| Typecheck and lint | `bun run typecheck` and `bun run check` | Not run | Passed |
| Build and web export | `bun run --filter desktop build` and `bun run --filter @outlore/relay site` | Not run | Passed |

## Not proven

- **C5.** The service response and feed entry were checked. The notice has yet to be opened in a desktop window or on a paired device.

## Reproduce

```sh
bun run test packages/service/test/work/inactivityMissives.test.ts packages/service/test/tracking.test.ts apps/app/test/conversation/inactivityMissives.test.ts apps/app/test/conversation/entries.test.ts
CI=1 bun run test --maxWorkers=4
bun run typecheck
bun run check
bun run --filter desktop build
bun run --filter @outlore/relay site
```

To reproduce the baseline failures, use a temporary worktree at `891c972f` and copy in the two `inactivityMissives.test.ts` files and `apps/app/test/fixtures/conversation.ts`. Run the two new test files. Each of the three cases fails where it expects a warning or feed entry. The existing tracking suite passes at both revisions. To reproduce the count failure, use a temporary worktree with the implementation and replace the `errands` calculation in `postDueMissives` with `Number(warnings.length > Number(hasQuest))`, then run the service test file.

## New files

The two inactivity test files and the shared conversation fixture are in the implementation. The temporary verification worktrees were removed.

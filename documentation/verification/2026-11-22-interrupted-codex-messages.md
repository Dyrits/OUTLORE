# Interrupted Codex messages

## Incident

On base `7026ce87`, a read-only query of the opening quest's Outlore database showed that message 1 held the original realm request and one image. Its assigned Codex turn was interrupted. Message 2 held the two skill invocations and completed in the same Codex session.

The matching local Codex rollout recorded the first task start and, 1.797 seconds later, a `turn_aborted` event with the same turn ID. The first turn and its continuation lacked both the original owner text and its image. The original text first appeared in the rollout when the owner repeated it. The first task start confirms Codex began the turn. The exact outbound payload and whether the original input reached the model before cancellation remain unverified.

## Regression

```sh
CI=1 bun run test packages/service/test/harness/codex.test.ts packages/service/test/work/steering.test.ts packages/service/test/work/replayAndHistory.test.ts
```

The test uses the real Outlore service and Codex adapter with a stand-in app server. The stand-in delays its first `turn/start` answer. The test queues a follow-up and interrupts before that answer. Before the fix, the test confirmed that Outlore stored the first message and sent it on the opening request, then failed on all three attempts because the second request omitted it. After the fix, the follow-up carries the earlier text and a `localImage` item. The next turn after a successful follow-up carries only its new input.

The three focused suites passed all 39 tests. The regression also passed on its own using the service's default queue behavior.

Full-session handovers still use the existing bounded history with earlier image names. The repeated local images apply when continuing the same Codex session. Desktop verification against a new live Codex turn is pending.

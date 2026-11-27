# Diagnosis: connector access — why a thread receives no connector tools

Date: 2026-11-27
Scope: the host's running app (Outlore 0.2.12-Pre-Alpha, launched 13:57 local), its database and Vault, and `packages/service/src/connectors`, `packages/service/src/vault`, `packages/service/src/work`, `apps/app/src/connectors`
Debug only: nothing in the app, the database, the Vault or the repository was changed; every check ran read-only between 14:15 and 14:30 local.
Times below are the host's local time (UTC+1); the Vault's `addedAt` strings are UTC.

## The symptom

The owner installed four connectors (Composio, GitLab, GitHub, Atlassian), turned them on for the quest, and connected what they could, yet the quest's threads receive no connector tools and `run_code`'s `connectors` object is empty.
The quest panel shows a bare `Needs connecting` under every row and carries no reason: the panel's `state` is only Ready or NeedsConnecting (`connectorChoiceCards.ts`), and the Charter's card is where a reason shows.

## Claims and verdicts

| # | Claim | Verdict | Evidence |
| --- | --- | --- | --- |
| D1 | In the quest's thread, `run_code` binds an empty `connectors` object, and the tool's listing declares only `outlore`. | Proven (live) | A `run_code` call on 2026-11-27 14:15 local returned `{ keys: [] }`, and the tool's own description declares `declare const outlore` and no `connectors`. |
| D2 | The Vault is Ready and holds exactly two sealed records: gitlab and github, both of kind `Personal access token`, added 2026-11-26 14:28:18 and 14:30:31 local; there is no record for composio or atlassian. | Proven (live) | The service's own `inspect` (`packages/service/src/vault/inspection.ts`) run against the live folder returned `Ready` with both records authenticating; the record metadata (connector, kind, date — cleartext by design, the values sealed) was read from `records-1ba0d9a98c4df02844427be579b09739.json`. |
| D3 | The Vault's key is present and readable the way the service reads it. | Proven (live) | The same `/usr/bin/security find-generic-password` call `macKeychain.ts` makes exited 0 with a 64-hex value, which was never printed. |
| D4 | The `connectors` table carries a stored refusal mark only for gitlab ("GitLab refused its sign-in or permission. Connect it again."); composio, github and atlassian have `needs = null`; `connector_choices` is empty, so every level inherits and the toggles read from the global switch, which is on. | Proven (live) | Read-only query of the running app's `outlore.sqlite`. |
| D5 | The running app includes CHG-0785 and the warm-session restart-key fix. | Proven (live) | `/Applications/Outlore.app` is 0.2.12-Pre-Alpha, built 13:12 local and launched 13:57; `git merge-base --is-ancestor 69723d9b 0.2.12-Pre-Alpha` succeeds; the tag's `turnRunner.ts` carries the "always carries the snapshot" comment. |
| D6 | Composio is installed but was never given its API key, so its `Needs connecting` is correct: install is not connect (connectors specification, Install, connect, enable). | Proven (live) | D2 (no record) and D4 (`needs` null). |
| D7 | GitLab's stored PAT was refused by the server, which set the stored mark; the connector reaches `https://gitlab.com/api/v4/mcp` only, while the owner's GitLab is self-hosted (`gitlab.hipay.org`), so this token can never work. | Verified (recorded) | The 2026-11-26 diagnosis recorded in the Outlore database (quest `e9d7883c-9e38-453f-bbf1-8e4fb51c88a5`, message 14:53 local): a turn's `beginTurn` refresh of gitlab met HTTP 401/403 (`Disconnected`) at 14:31 local and set `needs`; `entries/gitlab.ts` hardcodes the URL and its notice says "It works with GitLab.com only." |
| D8 | GitHub's PAT is stored and its live panel state computes Ready, yet the connector offers a thread no tools: at each turn start its `tools/list` fails in a class `warningOf` stays silent about, so no thread warning and no Needs connecting mark is written and the listing cache is left empty. The mechanism: a static-key HTTP entry sends no MCP session handshake (`shouldUseSessionFor` in `backends/httpMcp.ts`), GitHub's remote MCP rejects the sessionless `tools/list` (HTTP 400, class `Failed`), and `warningOf` returns null for `Failed`. | Proven (mechanism and absence) | GitHub is the only usable connector for this quest's threads (D2, D4), so `beginTurn` refreshes it at every turn start (`connectors.ts`); a `Disconnected` or `Unreachable` failure would have left the warning line `warningOf` writes, and no such line exists in `messages` or `thread_activities` for any of 2026-11-27's turns. This is open item 3 of the 2026-11-26 diagnosis. |
| D9 | Atlassian's browser sign-in stored no OAuth session: the Vault's last write is 2026-11-26 14:30 local (the github PAT), atlassian holds no record, and its `needs` is null. | Proven (state) | D2 and D4; the sign-in ran under the pre-CHG-0785 app, whose failure paths swallowed the reason (the CHG-0785 handoff's open question). |
| D10 | The exact failure of that Atlassian sign-in is unknown; the 10:28 local touch of the Vault folder was the protection probe's marker during the failed store, which points at a refused store but proves nothing. | Unproven | The probe's marker touches only the folder's mtime and leaves no record; a retry in the current app surfaces the exact error (CHG-0785). |
| D11 | The warm-session restart-key fix cannot change this: the per-turn snapshot never becomes non-empty, so a warm harness process has nothing to re-list. | Proven (reasoning over D1–D9) | The snapshot is `readOfferedTools` over the listing cache (`connectors.ts`, `toolListing.ts`), and no connector holds cached tools. |
| D12 | The owner's screenshot shows github as `Needs connecting`, while the live computation says Ready. | Unresolved | The live computation was run with the service's own code (D2, D4 and the `readConnectionState` rules); the panel row is likely a stale client read (`useServiceQuery`'s cache), which re-opening the Quest tab would settle. |

## What this means

A connector reaches a thread only through two gates in series: a credential the Vault holds (what the panel's state reads), and a successful `tools/list` at the turn start (what fills the tool snapshot).
GitHub passes the first gate and fails the second silently; the other three fail the first, each for its own reason.
So "several connectors missing together" is not one shared fault: the shared path only hides four independent causes, and the one code defect in it is the silent `Failed` listing (D8), which is also the only cause that can make a connector look Ready yet give a thread nothing.

## Reproduction

```bash
# The quest's live symptom, from the thread itself: call run_code with
#   async () => ({ keys: Object.keys(connectors) })
DB="$HOME/Library/Application Support/Outlore/outlore.sqlite"
# The stored marks and choices (read-only):
sqlite3 "file:$DB?mode=ro" "SELECT id, is_enabled, is_removing, needs FROM connectors"
sqlite3 "file:$DB?mode=ro" "SELECT connector_id, kind, workspace_id, mission_id, choice FROM connector_choices"
# The Vault's records, metadata only (the values stay sealed):
python3 -c "import json; print([(r['connectorId'], r['kind'], r['addedAt']) for r in json.load(open('$HOME/Library/Application Support/Outlore/vault/records-1ba0d9a98c4df02844427be579b09739.json'))['records']])"
# The key the service reads, checked without printing it:
KEYID=$(python3 -c "import json; print(json.load(open('$HOME/Library/Application Support/Outlore/vault/header.json'))['keyId'])")
out=$(/usr/bin/security find-generic-password -a outlore -s "outlore-vault-$KEYID" -w); code=$?; echo "exit $code"; [ "$code" -eq 0 ] && printf '%s' "$out" | grep -qE '^[0-9a-f]{64}$' && echo "the key reads (never printed)"
# No warning line anywhere today (a refused or unreachable listing writes one):
sqlite3 "file:$DB?mode=ro" "SELECT datetime(sent_at/1000,'unixepoch'), thread_id FROM messages WHERE text LIKE '%goes on without it%' ORDER BY sent_at DESC"
```

The panel-state and Vault computations (D2, D12) were reproduced by running the service's own `inspect` from `packages/service/src/vault/inspection.ts` with `custodiesOf("darwin", folder, run)` against the live folder, and the `readConnectionState` rules from `connectorState.ts` over the record metadata; a throwaway script did this during the session and was deleted after.

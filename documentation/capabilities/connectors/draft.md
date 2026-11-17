# Connectors: draft

Open items only. The agreed behavior is in the [specifications](specifications.md) (CHG-0321, 2026-11-16); research is in [code-mode-autonomy-connectors-2026-11-16.md](../../research/code-mode-autonomy-connectors-2026-11-16.md).

## Readings of the owner's answers, to confirm

- **The global switch is a master switch**: off, the connector is unavailable everywhere, even where a quest says On. Taken from "global, enabled once installed" and "Chronicler gets the global ones if enabled".
- **The Vault sits in the Charter** beside Connectors, and a secret may be typed from a paired device through the encrypted connection. The owner said "We'll create The Vault, yes"; the earlier proposal had no Vault page.
- **Removing a connector removes its Vault secrets, standing permissions and choices.**

## Open decisions

- **Placements**: settled (CHG-0326): the tools line and the Borderlands' choice are in the right sidebar; the Charter holds the connectors, like a marketplace, and The Vault. Still open: which group of the thread panel holds the tools line.
- **The Vault's reach**: whether it holds anything but connector secrets later.
- **Apple server**: chosen under the owner's delegation, `mcp-icloud` pinned (CHG-0322, technical notes in the specification). What remains is checking it on the owner's Mac: speed on a real inbox, reading Messages, a headless host, the permission request.
- **Code Mode**: agreed (CHG-0324; placed in the Charter by CHG-0325) as one global setting, off by default, experimental, after the native connectors. Its core is built (CHG-0441; executor in [ADR 0023](../../architecture-decision-record/0023-code-mode-runs-in-quickjs-inside-the-host.md)). Still open: measuring its gains, and a per-quest or per-connector option later.
- **Tools list**: agreed (CHG-0325) with a global switch per tool; open: where the tools line sits in the thread panel, and whether the owner may later reclassify a tool. Adapters reporting a harness's own built-in tools: Claude Code can (init `tools`); Codex has no listing for built-ins; OpenCode only through an experimental HTTP endpoint, not confirmed over `acp` (technical notes in the specification).
- **Composio**: whether its single "execute any tool" call can be narrowed to classified actions by restricting a session's toolkits; if so, some calls could run unasked.
- **Vault storage**: direction agreed (CHG-0327): encrypted records, key in the OS secret store where reachable, else an owner-only key file, shown plainly. Proposed (CHG-0328) in the [blueprint](blueprint.md) and [ADR 0022](../../architecture-decision-record/0022-the-vault-encrypts-secrets-and-hides-its-folder-from-sandboxes.md): the platform tools, the key file on a host with no store, and the read denial per harness. Awaiting the owner's review; the probes that settle the sandbox claims come first in the build.

## Technical notes (not agreed behavior)

- A connector gateway inside the service, serving each connector's tools through the per-thread MCP endpoint with approval through `askOwner`, is the recommended design (a harness's own MCP configuration would give three paths; `codex.ts:216` declines other servers; Claude Code runs `--strict-mcp-config`).

## Proposed behavior not in the specification (CHG-0330, awaiting the owner)

A second opinion on the blueprint found behavior the design needs that the specification does not state. These are proposals, not agreements:

- **Vault states.** The Vault shows **Locked** (its key holder cannot be reached now; it retries and changes nothing), **Lost** (the key is gone: connectors needing a secret show Needs connecting and the owner enters the secrets again), **Corrupt** (a record fails to check; nothing is overwritten), and **Not protected from <harness>** (a secret is refused while the key is a file and a harness's sandbox is not verified to hide the Vault's folder).
- **A failed call.** Only rejected credentials or a refused permission mark a connector Needs connecting; a thread's own malformed call or an unreachable service does not. A thread sees a fixed sentence, never the service's own error text.
- **A cancelled write.** Switching a connector off during a write says the action may already have happened, and an uncertain write is never retried by Outlore.
- **Removal that cannot finish.** A connector whose secret could not be wiped stays unusable, shown as Removing with Retry.


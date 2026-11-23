import { HarnessFailure } from "../core/index.ts";

// Grok: xAI's coding agent, launched by its own ACP surface (`grok agent stdio`), the transport the ACP
// provider work owns. Its PROFILE is settled here; its RUNTIME stays blocked until native subagents can be
// switched off: Grok spawns subagents that act with the session's own privileges, and no switch disabling
// them in a normal session has been proven. Until one is (or ADR 0007's mirrored mediation covers them),
// no Grok runtime may be registered or run — fail closed, with the evidence a registration attempt reads.

/** How the Grok CLI starts a runtime session of its agent, as the ACP transport launches it. */
export const grokRuntimeArgs = ["agent", "stdio"] as const;

/** The permissions mode a Grok session runs with: it asks before a tool that needs approval, and Outlore answers each ask. */
export const grokPermissionMode = "default" as const;

/**
 * Why no Grok runtime may run yet, with its evidence. `--no-subagents` passes only on upstream's two
 * profile-generation branches; a normal session launches ["--permission-mode", "default", "agent",
 * "stdio"] with native subagents left on, and they inherit the session's privileges.
 */
export const grokBlockEvidence =
  "Grok stays blocked: upstream nightly-labs/openbot b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0, " +
  "src/backend/grok-client.ts, passes --no-subagents to the grok ACP CLI only on its profile-generation " +
  'branches, and a normal session runs ["--permission-mode", "default", "agent", "stdio"] with native ' +
  "subagents left on, acting with the session's own privileges. No environment or config switch disabling " +
  "them in a normal session has been verified (OpenBot only switches off feedback, workflows, the turn " +
  "summary and Claude skills by environment). The pinned inventory agrees: documentation/research/" +
  "openbot-integration-parity-2026-11-22.md keeps 'Grok stays out until --no-subagents is proven effective " +
  "in normal sessions, not just profile generation.' ADR 0007 allows mirroring only an enforceable " +
  "boundary; until the proof, modes, or mediation exist, Outlore refuses the runtime.";

/** Whether a Grok runtime may be turned on; false until the evidence above is replaced by proof. */
export const grokRuntimeEnabled = false;

/** The refusal a Grok registration or run reads: the block, its reason, and nothing else. */
export const grokRuntimeRefusal = (): HarnessFailure => new HarnessFailure({ reason: grokBlockEvidence });

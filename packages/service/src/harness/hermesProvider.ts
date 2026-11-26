import { singleVarIsolation } from "./accountIsolation.ts";
import type { AcpProviderDefinition } from "./acpProviderDefinition.ts";

// Only Hermes is live-verified so far (v0.22.6, 2026-11-22): initialize and session/new work over stdio
// pipes, with logs on stderr so stdout stays clean JSON-RPC. Its home must be a configured account home
// first - `HERMES_HOME=<dir> hermes pm repair`, then a config.yaml default model: an empty home fails
// session/new with a misleading -32603 "storage_unavailable", because the session receipt's empty model
// is refused by the gateway's restore_policy. So Hermes declares isConfiguredHomeRequired: the probe and the turn
// adapter take only the account's folder, and run nothing without one, never the computer's own directory. Also: stdout must stay a pipe (a regular file crashes the acp
// client's connect_write_pipe), and each home grows a detached `--idle-exit` gateway that survives the
// killed RPC process tree (keep per-account HERMES_HOME paths short enough for its gateway.sock; the
// longer-path /tmp fallback for the socket can be EPERM-denied in a sandbox).

/** The audited provider: an account's prepared folder is its `HERMES_HOME`, and a turn or a probe without one is refused. */
export const hermes: AcpProviderDefinition = {
  argv: () => ["acp"],
  executable: "hermes",
  // The account's folder is HERMES_HOME, and it must be repaired, signed in and given a default model before it serves anything.
  isolation: singleVarIsolation("HERMES_HOME", true),
  label: "Hermes",
  signedOutCode: null,
  // A fresh Hermes home runs nothing until its dependency environment is committed (`hermes pm repair`, refused even by `hermes setup`), so sign-in chains both.
  // The terminal script runs the line as a shell line, and the plain non-darwin instruction repeats the executable the same way.
  signIn: { argv: () => ["pm", "repair", "&&", "hermes", "--setup"], extraEnv: {} },
  spawnEnv: {},
  version: null,
};

// The command line that starts one process inside the host's OS sandbox, shared by the harness sandbox
// (openCodeSandbox.ts) and the conversation terminals a paired device opens (work/terminals.ts): everything allowed
// but writing, which only the given folders and the terminal devices may, and reads denied in the hidden folders.

/** A sandbox to start a process inside: its tool, its kind, and the folders no process inside may read. */
export type FencedSandbox = {
  /** The sandbox tool: `/usr/bin/sandbox-exec` or `bwrap`. */
  readonly command: string;
  readonly kind: "seatbelt" | "bwrap";
  /** Folders no process inside may read, by real path: the Vault's (ADR 0022). */
  readonly hidden: ReadonlyArray<string>;
};

/**
 * The Seatbelt profile: everything allowed but writing, which only the given folders and the terminal devices may, and
 * signalling, which only the processes of the sandbox itself may receive. Bubblewrap's own PID namespace already hides
 * outside processes. `(target others)` blocks nothing on macOS, and `(target self)` also stops the sandbox's children,
 * so the rule names the sandbox.
 *
 * Outside processes are hidden too (audit SA-11, SA-13): the service holds the owner token in its environment and each
 * thread's harness its tool server address in its arguments or environment, which a command here could otherwise read.
 * The process rules hide the process list and what `lsof` maps a port to, and the `kern.procargs` rule the arguments and
 * environment of a process named by its pid, which the process rules alone let through (probe of 2026-11-14,
 * documentation/verification/2026-11-14-token-isolation.md). Claude Code's and Codex's own sandboxes already allow
 * process information only within themselves.
 */
export const seatbeltProfileOf = (count: number, hiddenCount: number) =>
  [
    "(version 1)",
    "(allow default)",
    "(deny process-info*)",
    "(allow process-info* (target same-sandbox))",
    '(deny sysctl-read (sysctl-name-prefix "kern.procargs"))',
    "(deny signal)",
    "(allow signal (target same-sandbox))",
    "(deny file-write*)",
    `(allow file-write* ${Array.from({ length: count }, (_, index) => `(subpath (param "W${index}"))`).join(" ")} (literal "/dev/null") (literal "/dev/tty") (regex #"^/dev/(fd|ttys)"))`,
    // Last, so no allow above reaches it: a hidden folder (the Vault's) can be neither read nor listed from inside.
    ...Array.from({ length: hiddenCount }, (_, index) => `(deny file-read* (subpath (param "H${index}")))`),
  ].join("\n");

/** The command line that starts `command` inside the sandbox, writing only to the given folders. */
export const wrappedFencedCommandOf = (
  sandbox: FencedSandbox,
  writable: ReadonlyArray<string>,
  command: string,
  args: ReadonlyArray<string>,
) =>
  sandbox.kind === "seatbelt"
    ? {
        args: [
          // Paths go in as parameters, so no path needs quoting inside the profile.
          ...writable.flatMap((path, index) => ["-D", `W${index}=${path}`]),
          ...sandbox.hidden.flatMap((path, index) => ["-D", `H${index}=${path}`]),
          "-p",
          seatbeltProfileOf(writable.length, sandbox.hidden.length),
          command,
          ...args,
        ],
        command: sandbox.command,
      }
    : {
        args: [
          "--ro-bind",
          "/",
          "/",
          "--dev",
          "/dev",
          "--proc",
          "/proc",
          "--tmpfs",
          "/tmp",
          ...writable.flatMap((path) => ["--bind", path, path]),
          // An empty folder over each hidden one, after the binds, so a writable folder inside it cannot reopen it.
          ...sandbox.hidden.flatMap((path) => ["--tmpfs", path]),
          "--share-net",
          "--unshare-pid",
          "--die-with-parent",
          "--",
          command,
          ...args,
        ],
        command: sandbox.command,
      };

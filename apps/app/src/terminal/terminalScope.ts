import type { Settings } from "@outlore/contracts";

/** The scope a screen opens terminals in: the host's own window runs them plainly, every paired device fenced. */
export type TerminalScope = "host" | "remote";

/** The bare id of one conversation's shell, as its requests carry it: the thread and its starting folder. */
export const bareTerminalIdOf = (threadId: string, cwd: string | null) => `${threadId}:${cwd ?? "home"}`;

/** The full session key the shell's frames carry everywhere: its bare id with the asking screen's scope. */
export const terminalKeyOf = (scope: TerminalScope, bareId: string) => `${scope}:${bareId}`;

/**
 * Whether `!` opens a shell on the screen the owner writes on. Only the native app has no shell surface yet; a paired
 * device's screens may open one only while the host's "Allow terminals from paired devices" switch is on
 * (conversation-terminal, ADR 0020).
 */
export const isTerminalAvailable = (
  screen: { readonly isNativeApp: boolean; readonly isRemoteHost: boolean },
  settings: Pick<Settings, "shouldAllowRemoteTerminals"> | null,
) => !screen.isNativeApp && (!screen.isRemoteHost || settings?.shouldAllowRemoteTerminals === true);

/** Default, minimum, and maximum heights (in pixels) for a manually resizable inline terminal. */
export const defaultShellHeight = 160;
export const defaultCommandHeight = 240;
export const minTerminalHeight = 140;
export const maxTerminalHeight = 720;

/** Clamps a dragged inline terminal height to a readable range. */
export const clampTerminalHeight = (height: number) =>
  Math.round(Math.min(maxTerminalHeight, Math.max(minTerminalHeight, height)));

/** Status text shown in the header of an inline terminal running a launched interactive command. */
export const commandTerminalStatusOf = (
  status: { readonly _tag: "Running" } | { readonly _tag: "Exited"; readonly exitCode: number | null },
) => {
  if (status._tag === "Running") return "Running…";
  if (status.exitCode === 0) return "Finished";
  return status.exitCode === null ? "Ended" : `Did not finish (exit ${status.exitCode})`;
};

/** Formats a runnable shell block for direct PTY submission using carriage returns. */
export const terminalCommandInputOf = (command: string) => `${command.replace(/\r?\n/g, "\r")}\r`;

/** Decides whether a command sent to the conversation terminal writes now, restarts an exited shell, retries a failed open, or waits for open. */
export const nextTerminalRunActionOf = (state: {
  readonly hasOpenFailed?: boolean;
  readonly isReady: boolean;
  readonly isRestarting?: boolean;
  readonly isRunning: boolean;
}): "queue" | "reopen" | "restart" | "write" => {
  if (state.isRestarting) return "queue";
  if (state.hasOpenFailed) return "reopen";
  if (!state.isReady) return "queue";
  return state.isRunning ? "write" : "restart";
};

/** Whether an exited shell with queued commands should auto-restart once instead of writing to a dead PTY or looping. */
export const shouldAutoRestartTerminalOf = (state: {
  readonly hasAutoRestarted: boolean;
  readonly hasPendingCommands: boolean;
  readonly isRunning: boolean;
}) => !state.isRunning && state.hasPendingCommands && !state.hasAutoRestarted;

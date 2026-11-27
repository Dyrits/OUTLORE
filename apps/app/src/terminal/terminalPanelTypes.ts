import type { Ref } from "react";
import type { ServiceClient } from "../foundation/client";
import type { TerminalScope } from "./terminalScope";

/** The visible shell's rendered output, flushed before the owner sends it. */
export interface TerminalPanelHandle {
  focus(): void;
  /** Sends a command directly to the shell, restarting it first if it has already exited. */
  run(input: string): void;
  snapshot(): Promise<{ cwd: string; text: string }>;
}

/** The host's conversation shell, retained while hidden so its next snapshot includes ongoing output. */
export type TerminalPanelProps = {
  /** The host whose shells open: the shell runs where the host runs, whichever screen asked (ADR 0020). */
  readonly client: ServiceClient;
  readonly cwd: string | null;
  /** Surface height in pixels; defaults to 160 for conversation shells. */
  readonly height?: number;
  /** When true, hides the default "Shell exited / New shell" bar so the caller renders its own command status. */
  readonly shouldHideExitBar?: boolean;
  readonly id: string;
  /** Called once when the terminal's process exits, with its exit code when known. */
  readonly onExit?: (exitCode: number | null) => void;
  readonly onReady: () => void;
  readonly ref?: Ref<TerminalPanelHandle>;
  /** The fence the asking screen's shells run under: plain for the host's own window, sandboxed for a paired device. */
  readonly scope: TerminalScope;
};

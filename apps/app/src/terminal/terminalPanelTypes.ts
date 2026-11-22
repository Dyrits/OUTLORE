import type { Ref } from "react";
import type { ServiceClient } from "../foundation/client";
import type { TerminalScope } from "./terminalScope";

/** The visible shell's rendered output, flushed before the owner sends it. */
export interface TerminalPanelHandle {
  focus(): void;
  snapshot(): Promise<{ cwd: string; text: string }>;
}

/** The host's conversation shell, retained while hidden so its next snapshot includes ongoing output. */
export type TerminalPanelProps = {
  /** The host whose shells open: the shell runs where the host runs, whichever screen asked (ADR 0020). */
  readonly client: ServiceClient;
  readonly cwd: string | null;
  readonly id: string;
  readonly onReady: () => void;
  readonly ref?: Ref<TerminalPanelHandle>;
  /** The fence the asking screen's shells run under: plain for the host's own window, sandboxed for a paired device. */
  readonly scope: TerminalScope;
};

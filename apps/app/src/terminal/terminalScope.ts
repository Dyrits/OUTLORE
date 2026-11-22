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

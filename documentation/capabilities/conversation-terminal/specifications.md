# Conversation terminal

Authorized by the owner on 2026-11-10, with Delta's inline terminal as the reference.
The owner confirmed that shell output belongs in the Companion's context and clarified that the live terminal appears as a message bubble in the conversation, rather than inside the composer.
Amended on 2026-11-22 (CHG-0644): the shells run in the host service and reach every screen through its requests, so a paired device may open and steer one too, fenced ([0020](../../architecture-decision-record/0020-terminals-run-in-the-host.md)).

## Behavior

- In a desktop conversation, typing `!` on an empty composer line opens the owner's default login shell as an interactive owner-message bubble in the conversation, without triggering the Companion.
- On Windows, which has no login shell, `!` opens the command shell named by `ComSpec` (the Windows system shell), and the app keeps the launcher's `;`-separated `PATH` instead of reading a login shell's (CHG-0356).
- An exclamation mark in ordinary text stays text; paste and input composition do not trigger a shell.
- With a workspace-backed Realm, the starting folder is that Realm's root, including the Realm selected in the Guild Hall.
- A thread that works in its own copy (a git worktree, [workspace attachment](../workspace-attachment/specifications.md#own-copy)) starts the terminal in that worktree, where the agent works, not in the workspace's checkout (CHG-0455). Threads sharing a copy share its folder. A thread keeps its working folder for its whole life; work somewhere else is an errand with its own copy.
- For a quest in a Realm without a workspace or in the Borderlands, the terminal starts in the owner's home folder.
  Agents without a workspace still use the quest's [scratch folder](../workspace-attachment/specifications.md#no-workspace).
- The terminal accepts interactive input, control keys, and resizing through a pseudo-terminal.
- Hide keeps the shell running; Show or `!` brings it back.
- Send freezes the recent rendered output as a terminal block in the owner's message and includes that same output in the persisted text supplied to the harness.
- The owner can add text beneath the terminal or send the terminal alone.
- The shell continues after sending; another `!` brings that same shell back into an interactive bubble for the next snapshot.
- Close shell ends the process and removes it from the draft; an exited shell keeps its output and offers New shell.
- From the host's own window, the full shell as the owner, as today.
- From a paired device, only while the host's **Allow terminals from paired devices** switch is on (off by default, in the Workshop's Remote access card, changeable only on the host itself), and inside the operating system's sandbox the harnesses run in: Seatbelt on macOS, bubblewrap on Linux. The fenced shell writes only inside the conversation's folder and the terminals' own temporary folder, keeps its temporary files in that folder, learns nothing of the service's loopback token, cannot read the Vault's folder, and no login-shell history it might write leaves the fence. Where no such sandbox can run (Windows for now), terminals from paired devices stay off.
- Every paired device shares one fenced shell per conversation and starting folder; it and the host window's shell of the same name stay separate, and a screen never sees a shell its fence does not cover.
- The host service owns these temporary processes; they end when it stops.
- The native phone app has no terminal surface yet; a phone reaches the host's terminal through the browser web app until the mobile terminal batch is built ([backlog](../../backlog.md)).

The home-folder fallback was agreed on 2026-11-10 (CHG-0131).

## Bounds

One terminal per conversation and starting folder in each scope (the host's window, and the paired devices together), with at most 32 retained sessions in each.
The replay buffer holds at most 200,000 characters; the emulator holds 3,000 scrollback lines and a sent snapshot includes at most the latest 20,000 rendered characters, with an omission marker when trimmed.
Snapshots show visible output rather than hidden password keystrokes or a complete shell audit log.
Sessions do not survive stopping the host; sent snapshots remain in the conversation.
Multiple terminal blocks, background-terminal selection, and Delta's shell-code prefill are outside this increment.

## Verification

`packages/service/test/work/terminals.test.ts` checks real shells in home and realm folders, session isolation, continued shell state, exit output, explicit restart, the host and paired scopes kept separate, the fenced command line, and the paired-device requests: the switch's admission, the host-only change of it, the sandbox requirement, and folder reach.
`apps/app/test/terminal/terminalScope.test.ts` checks the screen availability and session keys, and `apps/app/test/foundation/client.test.ts` the shell's frames through the client.
`apps/app/test/terminal/terminalSnapshot.test.ts` checks context serialization, safe Markdown fences, wrapped lines, limits, and the sent block's display data.
The packaged app's launch gate (`apps/desktop/scripts/check-package.ts`) opens a shell through the packaged service.
A paired browser or second computer against a live host is not yet checked by hand.

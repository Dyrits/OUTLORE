# Action approval

## Problem and outcome

Threads run on their own, many at once, and some of their actions cannot be undone or reach other people: deleting files, sending a message, pushing code, paying. The user decides each of these from any device, in plain language, and can grant standing permissions so that threads run autonomously on what the user already trusts them with.

## Agreed behavior

Version 1 serves the installation's owner. In future hosted missions, only the host approves risky actions and grants standing permissions (CHG-0017). A guest's request to trigger work carries no approval. See the [hosted agreements](../../architecture.md#future-multiplayer-open-architecture-questions).

### Asking

- **Sandbox-first autonomy** (CHG-0208, replacing CHG-0035's sensitive-command list). Each harness runs its commands inside a sandbox: Claude Code and Codex their own, OpenCode inside the host's (Seatbelt on macOS, bubblewrap on Linux), started by Outlore. The sandbox contains damage to this computer's files and processes; it does **not** contain data: its network reaches many hosts (Codex and OpenCode any host, Claude Code a broad allowlist of registries, code hosts, release hosts, and CDNs, plus any other host it asks about while sandboxed, which Outlore allows: that one ask only, never a sandbox escape), so whatever a command sends can leave the computer, a push to an allowed host included. Outlore judges no command by its words. Before OpenCode runs anything unasked, Outlore confirms in the process table that its executor (`serve --stdio`) runs below the wrapped process; if it cannot, every action asks as for an escape. A wrapped OpenCode never writes a folder that OpenCode runs outside the sandbox read: its data folder is the service's own copy per account, which holds the account's sign-ins, copied one way from the account's real data folder at each start (a changed or revoked sign-in follows; nothing flows back, and no file of the real folder is copied), and its configuration folder holds a read-only copy of the owner's OpenCode settings (`opencode.json`, `opencode.jsonc`, `config.json`), the top-level `AGENTS.md`, and the Markdown agents, commands and modes, made at each start, never its plugins or tools. Settings that point at paths on this computer, or plugins the settings name, may behave differently inside the sandbox. A thread's earlier OpenCode session kept in the real data folder cannot be loaded inside the sandbox: OpenCode then starts a new session for the thread, which replaces the earlier one for later starts; its first message carries the thread's handover notes (its conversation so far, as after a change of harness, thread-handover), and the thread shows a line saying OpenCode could not pick up its earlier conversation and that the new one was given those notes; the messages stay. Outside the sandbox, a session that cannot load still fails the turn. A sign-in OpenCode exports without an integration id is not copied, so the providers behind such sign-ins are unavailable to sandboxed OpenCode; OpenCode's own `auth list`, run outside Outlore, shows which they are, and signing in to that provider again gives the sign-in an integration id. If a provider makes refresh tokens single-use, a refresh inside the sandbox's copy can invalidate the real folder's sign-in; signing in again outside Outlore restores it. This is accepted as an annoyance, not a boundary failure: the copy stays, OpenCode never falls back to the real folder, and sign-ins are not restricted. Every sandboxed OpenCode process carries the service's marker in its environment; one left running after its `acp` ended, or by an earlier run of the service, is ended when the service starts and whenever a wrapped OpenCode starts or ends, and only a process carrying that exact marker is ever ended this way. A sandboxed command sees no process outside its sandbox (CHG-0277; audit SA-11 and SA-13). It cannot list them, map a port to one, or read the arguments or environment of one, even by its pid. Those hold the owner token (in the service's environment) and the other threads' tool server addresses. Under Seatbelt, Outlore's profile hides them. Bubblewrap's own process namespace does so on Linux, and Claude Code's and Codex's sandboxes allow process information only within themselves. A sandboxed command still sees its own children, and still sees that a local port listens. Threads learn about each other through the thread tools, never through the process table.
- **A thread's folder that points elsewhere** (CHG-0208). Before starting any harness, Outlore checks the thread's folder by its real path: the folder must not be a link and must lie in its root (the workspace's own folder, or the scratch folder for a thread without a workspace), and that root must not be a link, nor, for a workspace, resolve anywhere other than the folder added as the workspace. Otherwise a sandbox would write where the link points, outside the workspace, so the harness is not started there: the owner is asked one question naming the folder, where it really points, and what the sandbox could then write. The question is a one-time confirmation of that start: it offers **Allow** and **Deny** only, never **Always allow**; the service refuses an Always allow answer to it and never saves a standing permission for it, and no standing permission answers it. A later start in a folder that is still, or again, a link asks again. **Deny** fails the turn with the reason. **Allow** differs by harness. OpenCode, whose sandbox Outlore provides, runs without a sandbox for that thread, every command asking as "Run without a sandbox" and every file change as "Change a file outside the workspace"; its sandbox is never widened to the link's target. Claude Code and Codex keep their own sandbox and are started in the folder's real path (as their process folder, and as Codex's thread folder), so the folder their sandbox writes is where the link really points, and the thread shows a line saying its folder is a link and where it points. A changed link restarts their process, so the next start checks it again. The shared edit check counts a file in a link's target as outside the thread's folder, unless the owner allowed a start there and the folder still points there.
- **A workspace's own git worktrees count as its folder** (CHG-0273; a widening of the sandbox's writable area). A thread works on a branch in a git worktree beside the checkout, which would otherwise be outside the folder a sandbox writes: every command there would be an escape, and every edit there a file outside the workspace. For a thread in a git workspace whose folder is its repository's top folder, the linked worktrees that `git worktree list` gives for that repository count as the thread's folder: Claude Code's sandbox writes them as well as the folder, and the shared edit check counts a file in them as inside. Narrow by construction: only what git lists for this repository, never a sibling folder by its name, a worktree of another repository, or the checkout and siblings of a thread's own copy (a thread whose folder is itself a linked worktree, or only a subfolder of a repository, gets none); a listed worktree that is missing, prunable, a link, or where the real path differs from the listed one is left out and still asks, as a thread folder that is a link does; and none for a thread whose folder is a link or resolves outside its workspace. Claude Code reads the list at each start and it is part of what restarts its process (a new worktree restarts it, resuming the conversation, at the next message), so a command in a worktree made during the same turn still asks until then; the edit check reads the list at each edit. Codex and OpenCode keep writing only the folder (their commands in a worktree still ask), though the edit check is shared. A thread is told to make a worktree inside its folder as `.worktrees/<name>` (git-ignored) or in `$TMPDIR`, never as a sibling folder, and not to run a command outside the sandbox for work in its folder or its worktrees. Still asking by design: another project's folder, signalling processes the sandbox cannot reach, and git over SSH, which the sandbox's HTTP proxy cannot carry.
- At the default level a thread works on its own. It judges for itself which actions are consequential, those that reach people or systems outside the computer or cannot be undone, and asks before them through `request_approval`, as a question in its own conversation; its instructions name examples, not a rule Outlore enforces.
- When a harness itself asks for permission, Outlore decides from where the action runs, never from its words: inside an active sandbox it runs without a question and leaves a line; an escape from the sandbox (Claude Code's `dangerouslyDisableSandbox`, any escalation Codex asks for), a file change the harness makes outside the thread's folder, and any command of a harness with no sandbox on this computer (the host's sandbox cannot start, or OpenCode's sandbox tool is missing) ask, with the exact command or target and the capability it needs ("Run outside the sandbox", "Change a file outside the workspace", "Widen the sandbox", "Run without a sandbox"), and nothing broader. A prompt matching the escape just allowed in that turn, or a standing permission for that exact action and capability, runs. A file change inside the thread's own folder (or its listed worktrees) by a harness with no sandbox is the one exception to "any action asks": the shared edit check contains it by the exact path of each file it changes, so it runs without a question and leaves a line, as inside a sandbox; a file outside the folder, a thread folder that is a link (above), a command, and a multi-file change with any file outside still ask (SP-A-02, owner decision 2026-11-16: no new question for anything sandbox-related, so the code stays as it is).
- Each question covers exactly one action. A thread that needs three actions asks three questions. A choice question (below) is not an action and is the exception: it carries up to four choices in one dialog.
- Words never approve a command (CHG-0208): neither the owner's message quoted by a thread, nor a Ritual's instruction, nor anything a thread writes. A command question is spared only by a standing permission for that exact action. Structural actions on the app (acting on quests, settings, realms, Rituals) follow their own provenance rule in [mission-coordination](../mission-coordination/specifications.md).
- A thread message never carries an approval, and no thread can answer another thread's question.

### The question

- A question is written for someone who does not read code. It leads with what the thread wants to do and what that affects, in plain words, for example "Push today's 3 commits to GitHub. This sends your changes off this computer, where everyone with access to the repository sees them." **Show details** reveals the exact command, file changes, or recipient and text.
- Outside its thread, a question also shows its mission and thread.
- The buttons are **Allow**, **Always allow**, and **Deny**. An optional message beside Deny tells the thread why or what to do instead (CHG-0035). A question with no permission to save (a one-time confirmation: a structural action, or a thread folder that is a link) shows only Allow and Deny (CHG-0208).
- On a denial, the thread carries on with the refusal.

### Choice questions

- **A thread can ask the owner to choose** (CHG-0299). Claude Code's `AskUserQuestion` reaches Outlore through its permission prompt tool, like any tool call. It used to run unasked at the default level (the sandbox contains it) and came back with no answers, so the owner saw no dialog and the thread guessed. It is now a question: it always waits for the owner, at every approval level, whatever the sandbox or the "outside the sandbox" setting says, since there is nothing to contain and only the owner can answer.
- **The dialog.** One dialog carries every choice of the call (Claude Code allows one to four). Each choice shows its short header, its question and its options (a label and a description); a **multiple** choice (`multiSelect`) lets the owner pick any number, a single one exactly one. A field to type **Other**, an answer of the owner's own, is offered when the choice allows it (Claude Code always allows it; the contract carries `allowsOther` for harnesses that do not). **Send** is available once every choice has an answer, and an Other with no text counts as none. **Skip** leaves the question unanswered. There is no Always allow and no standing permission, and no Allow or Deny: answering is not approving.
- **What the thread receives.** Send hands the answers back through the permission prompt tool's `updatedInput.answers`, which maps each question's text to the chosen labels or typed text, joined by `, ` for a multiple choice. Skip answers a denial saying the owner skipped the question and chose not to answer, so the thread carries on without it or asks again in plain text. The thread's turn stays open, in Attention, until the owner sends or skips.
- **Ending without an answer.** Stopping or interrupting the thread, and a restart, withdraw the dialog, as for any question; the record says **Withdrawn**. **Skip** is the owner's own act and is recorded as **Skipped**, apart from a withdrawal.
- **The record.** The line in the thread, and the Permissions history, say **Answered** with each question and its answer ("Which build? B · Which targets? Mac, Phone"), or **Skipped**. Answers are kept with the thread and deleted with its quest.
- **Not Claude-specific.** The question's shape (a header, a question, options with descriptions, multiple, own answer) is the one Codex's `request_user_input` and OpenCode's `question` tool share, so the contract is theirs too. Claude Code and non-secret Codex questions are wired (CHG-0302). Codex maps each question id to a list of answer texts; it supports single choice or free text, with Other only when allowed. Skip or withdrawal returns an empty answers map. Secret Codex questions still receive no answers because the dialog has no private input; OpenCode's question events are not handled yet (see the [backlog](../../backlog.md)).

### Waiting

- A thread with an open question is in the **Attention** state, shown prominently and sent as a phone notification with no content.
- On the Mac desktop app, a new question also bounces the Dock icon until the user returns to the app; with the window in front it does not bounce.
- A question waits with no time limit while the rest of the mission keeps running. In practice the limit is the longest wait each harness accepts for a tool call, 2,147,483,647 milliseconds (about 24.8 days; Codex takes seconds, 2,147,483), set for Claude Code, Codex and OpenCode, and pinned by a test for each (CHG-TBD-B-2).
- A question is withdrawn when the user interrupts or stops its thread.

### Where to answer

- In the question's thread, and from the list of open questions at the top of the dashboard, on the desktop and on the phone. The phone notification opens that list. A choice question is answered in the same places, in the same app (desktop, browser, and phone), and in Chronicler as in any thread.

### Standing permissions

- **Always allow** approves the action and grants a standing permission for that exact command or target (CHG-0208: never a pattern the thread proposed), under the capability its question named. A permission for an ordinary action never covers the same command's escape from the sandbox.
- A standing permission applies in the thread's workspace, or in its mission when the thread has no workspace, to every thread there. The user can widen it to everywhere from the Permissions page.
- Every thread knows the standing permissions that apply to it and does not ask for an action they cover.

### Working outside the sandbox

- **The owner may let commands leave the sandbox without a question** (CHG-0295). One setting on the Permissions page, **Let threads run commands outside the sandbox without asking**, off by default and global (every realm and quest). It exists because exact-command permissions almost never repeat: in three days about 120 escapes were asked and 6 were answered by a saved permission (CHG-0294).
- **What it changes, at the default level.** An escape from the sandbox (Claude Code's `dangerouslyDisableSandbox`, any escalation Codex asks for, and OpenCode's prompt when its containment cannot be confirmed) runs without a question and leaves a line in the thread and in the Permissions history, like a sandboxed command. The sandbox then holds nothing for such a command, which runs with the owner's full access to the computer and its network.
- **What it does not change.** A thread still asks, through `request_approval`, before what it judges consequential (pushing code, publishing, deploying, posting, sending, paying, deleting outside its folder, anything that cannot be undone); its instructions say so, and that judgment is the thread's own, not enforced by Iskios, as at the default level. A harness with no sandbox at all here still asks for every command ("Run without a sandbox"); a request to widen a sandbox, and a file change made by the harness's own tool outside the thread's folder and its worktrees, still ask; the one-time confirmation for a thread folder that is a link still asks. At **Also commands and edits** every prompt still asks, as that level is for.
- **Only the owner sets it.** A thread cannot change it, including Iskios (`change_setting` refuses it, as it refuses the approval level). A thread that Iskios started reads the setting at each turn, and Claude Code's process restarts when it changes, since its instructions change.

### Approval level

- One approval setting has two levels: **Sensitive actions only** (the default; since CHG-0208 it means escapes from the sandbox and unprotected actions) and **Also commands and edits**, which turns the harnesses' own permission prompts back on, each one answered with the same buttons.
- At **Also commands and edits**, Outlore follows the allow and deny rules the user set in each harness's own settings.

### Permissions page

- Settings has a **Permissions** row showing the current level, for example "Permissions · Sensitive actions only". It opens a page with:
  - the approval level;
  - the standing permissions, each with its scope, widenable to everywhere and removable;
  - the history of every answer across threads, filterable by mission.
- Each answered question also stays in its thread as a short line with the action, the answer, the time, and the device, for example "Allowed `git push` · 14:02 · phone". Withdrawn questions, and harness prompts run without a question, are recorded the same way.

### What a working thread is doing

- **Steps show the other tool calls too** (CHG-0276; a thread that only shows "Working…" says nothing of what it does). Besides the actions above, the Steps group of a turn lists the rest of what the thread's harness reports as each call starts: reading, searching, listing, editing, running a command the harness ran without asking, fetching, and the thread's own Outlore tools. Each is one line of the same group, as plain words, a short target and the time, such as "Ran · Read a file · /work/entries.ts · 10:41 AM" or "Ran · Search files · workingLabelOf · 10:41 AM". The group grows while the thread works, so the owner sees what it did last and can count the steps.
- A call that also asked or ran as an action above shows once, as that action. A line is a record, not a question: it has no buttons and no standing permission, and it does not appear in the Permissions page history. The harness's approval tool, which has its own question line, and its own permission prompt tool are no step.
- A line carries the kind of call in plain words and a short target (a file, a pattern, an address, or a command's first line; a command with a reason from the harness says the reason), never a tool's output or a file's content. A target is cut to one short line. Lines are kept with the thread and deleted with its quest.
- Claude Code reports these calls. Codex and OpenCode keep action lines only until their events are probed.
- Not yet: the line of the call in progress is not marked as running, and the working indicator still reads "Working…".

## External contract

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `request_approval` | Ask the user before one action the thread judges consequential, or before one exact command outside the sandbox | A plain sentence saying what and what it affects, the exact details, and `outsideSandbox` when asking to leave the sandbox | Allowed; Allowed, with the standing permission granted; or Denied, with the user's message if any |

| `AnswerChoices` (owner request) | Answer or skip a choice question | The question's id; one list per choice of the labels or typed text, exactly one entry unless the choice is multiple, or null to skip | The question, `Answered` with its answers, or `Skipped`; refused when an answer does not fit its choice, and for an approval question (as `AnswerQuestion` is for a choice question) |

A withdrawn question gets no answer, since its turn has ended.

## Acceptance and validation

- **Automated, with a fake harness**:
  - a sandboxed command run without a question whatever it does, leaving a line; an escape from the sandbox, a file change outside the thread's folder, and any prompt of a harness with no sandbox asked about once, with the exact command and capability;
  - a file change in a worktree of the thread's workspace run without a question, and one in an unrelated sibling folder, in a worktree of another repository, or in a worktree replaced by a link still asked; Claude Code's sandbox writing the listed worktrees and no other folder, and its process restarting when one is added;
  - one question per action, never bundled;
  - each answer reaching the thread: Allow, Always allow, Deny, and Deny with a message;
  - an action named in the user's message and quoted by the thread, or in a Ritual's instruction, still asked;
  - a standing permission sparing the question in its workspace or mission, still asking in another, and asking again once removed;
  - a thread message claiming an approval, and another thread trying to answer, both having no effect;
  - the thread in Attention until the question is answered, with no time limit, and the question withdrawn on interrupt or stop;
  - answering from the dashboard's list and from the thread, on both the desktop and the phone web app;
  - the notification carrying no content;
  - at **Also commands and edits**, harness permission prompts shown with the same buttons, and the harness's own allow and deny rules followed;
  - every answer recorded in its thread and in the Permissions page history.
  - with working outside the sandbox allowed: an escape run without a question and recorded as run automatically; a thread's own `request_approval` for a push, a harness with no sandbox, a widening request and a file outside the folder still asked; and a thread's `change_setting` of it refused.
  - a choice question (CHG-0299): `AskUserQuestion` held open in Attention instead of run unasked, with its choices listed on the dashboard; the answers returned in `updatedInput.answers`, a multiple choice joined and a typed Other carried; Skip answered as a denial and recorded apart from a withdrawal; Stop withdrawing it; answers that do not fit refused with the question left open; and neither kind of question answerable by the other's request. The dialog's own logic (what is picked, when Send is ready, the line it leaves) is tested in the app; its appearance and use on the desktop, in a browser and on a phone are the owner's to accept.
- **Human acceptance**: on the phone web app, the user gets a notification, reads a question in plain language, opens its details, and allows it; chooses Always allow for a push, then sees a later push in the same workspace run without asking and removes that permission from the Permissions page.

## Requirements

- [Approval per action](../../requirements.md): a single approval covers one action in one thread; standing permissions are the user's own and visible on the Permissions page.
- [End-to-end encrypted phone traffic](../../requirements.md): notifications carry no content.

## Dependencies

- [thread-tree](../thread-tree/specifications.md): the Attention state, and the thread's instructions.
- [thread-messaging](../thread-messaging/specifications.md): interruptions, and messages carrying no approval.
- [mission-tracking](../mission-tracking/specifications.md): the dashboard where open questions are listed.
- [scoped-intel](../scoped-intel/specifications.md): approvals for global intel.
- [mission-coordination](../mission-coordination/specifications.md): Control's global intel saves.
- **routine-running**: routine instructions that name actions.
- [workspace-attachment](../workspace-attachment/specifications.md): the workspace a standing permission applies to.
- **device-pairing**: answering from the phone.

## Exclusions

- Approving by time limit or by default.
- One answer covering several actions.
- A thread approving on the user's behalf.
- Judging commands by their words; the sandbox, and the thread's own judgment, take that place (CHG-0208).
- Containing data: with the network open, the sandbox cannot keep data on this computer.

## Technical notes

- At **Also commands and edits**, a standing permission could also be written as a harness allow rule where the harness supports one.

# Computer use

## Implementation status · 2026-11-16

**Drafted for the owner's review, not agreed in full, not built.** The owner wants Chronicler and its threads to operate the host's own computer (CHG-0320) and decided on 2026-11-16 that Outlore's own `computer_*` tools in the host are the way, that a paired phone may look and approve but not control, that nothing is blocked outright, that approval is per application and, inside an application, only for a really sensitive action, and that a specification and an ADR come next, with no spike first. Everything under **Agreed** below rests on those decisions. Everything marked **Proposal** is this draft's own reading and is collected in **Open for the owner**. The design is in [0021](../../architecture-decision-record/0021-computer-use-in-the-host-behind-computer-tools.md); the evidence is in two research notes: [Cua and computer use](../../research/cua-computer-use.md) and [alternatives](../../research/computer-use-alternatives.md). Nothing was run: no backend was installed, and no locked-screen behavior was tested.

## Problem and outcome

An owner away from a host such as a Mac mini cannot ask a thread to do what needs a screen: open an app, read what it shows, click through it, report back. Threads act only through files, commands and Outlore's own tools. The outcome: from the desktop or a paired phone, the owner asks a thread to use the host's computer; the thread looks at an app, acts in it, and reports; every use of an app was approved by the owner, from the host or the phone, seeing what the thread sees; and the owner can look at the host's screen from a paired device at any time, with no thread involved.

## Agreed behavior

### What it is

- **Computer use** is a thread, Chronicler included, seeing and operating the host's own desktop through Outlore's `computer_*` tools. The host runs them; the thread's harness only calls them. They work the same on Claude Code, Codex and OpenCode, because they come from Outlore's own tool server, not from the harness ([0021](../../architecture-decision-record/0021-computer-use-in-the-host-behind-computer-tools.md)).
- It runs on the host's real desktop, as the owner's logged-in user, with that user's apps and sign-ins. **No sandbox contains it**: an agent that clicks in a Terminal, Finder or System Settings window acts outside every sandbox that [action approval](../action-approval/specifications.md) relies on. The question and the settings page say so in plain words (Approval, below).
- Nothing is blocked by Outlore: Terminal, Finder, System Settings and browsers are allowed, and every app asks once, with a further question for a really sensitive action (the owner, 2026-11-16). The backend may still refuse some inputs on its own (Backend, below); Outlore does not override that.

### Enabling it

- Off by default. It is switched on in the Workshop on the host, with a card that says before the switch what it does: threads can look at and operate apps on this computer once the owner allows each one; no sandbox contains it; what a thread sees goes to its model provider (Privacy, below).
- **Only the host's own window changes the switch and the settings of this capability.** A paired device shows them and cannot change them, and a thread cannot change them, Chronicler included: `change_setting` refuses them, as it refuses the approval level. A guest of a hosted quest never can.
- The tools exist for a thread only while the switch is on and the backend is ready; otherwise a thread is not told of them and has no tool to call.
- A change of harness keeps the same tools; they do not belong to a harness.

### The tools

The tools are named and described here by behavior. Schemas, argument names and limits belong to the blueprint, and each tool is defined once in the thread tool catalogue like the others ([0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)).

| Tool | Behavior |
| --- | --- |
| `computer_screenshot` | Returns an image of an app's window. |
| `computer_read_screen` | Returns the app window's accessibility tree: its elements, their roles, names and values, each with a token a later call can name. The model reads it as text; it is the main way to find what to click. |
| `computer_click` | Clicks an element by its token, or a point in the window the last screenshot showed. |
| `computer_type` | Types text into the focused element of the app. |
| `computer_key` | Presses a key or a key combination in the app. |
| `computer_scroll` | Scrolls an element or the window. |
| `computer_open_app` | Opens or brings forward an app by name. |

- **Proposal**: `computer_list_apps` lists the running apps by name only (not their window titles), so a thread can name the app it wants. It asks nothing, as it shows nothing about content.
- The tools act on **one app at a time**, the app the owner approved. A call naming an app that has not been approved for this thread starts the question below, and the call waits for it.
- Not in the first set: dragging and double clicking (if the backend does them, they are options of the click), menu invocation, window moving and resizing, closing or killing apps, and the clipboard (it can carry secrets). A later amendment adds them one by one.
- A tool's result carries an image where the tool returns one. Whether Outlore's tool server and each harness's adapter carry image content is **not yet checked** and decides slice 2's first task (see the phases).

### Approval

**Agreed** (the owner, 2026-11-16): approval is **per application**, and **inside an application only when an action is really sensitive**. Nothing is blocked outright. The rest of this section is this draft's own working-out of those two rules; what is a **Proposal** says so.

**First tier: the application.**

- **One question per app and per thread: "Control the app *X*".** The first `computer_*` call by a thread that names an app not yet approved for that thread asks, and the call waits, with the thread in Attention. It reads, for example: "Look at and control Safari on the Mac mini. This thread will see Safari's window and can click and type in it. No sandbox contains this, and what it sees goes to its model provider." **Show details** names the app, the tools it may use, and the thread.
- **The screenshot is attached to the question**: a current image of the app's window, taken by the host and shown to the owner only, never sent to the model before the owner allows. It travels to a paired device over the encrypted connection and is kept only while the question is open; the question's record afterwards holds the text, not the image.
- **Proposal: Allow** covers that app for that thread until its turn ends. It never carries to another app, another thread, or a thread beneath it. The next turn asks again. This reads "one action" in [Approval per action](../../requirements.md#safety) as "using one app for one turn", which the owner's per-app rule implies (a question for every click could not be used) but which stretches the requirement's wording; see Open, 1.
- **Proposal: Always allow** grants a standing permission, under the capability named **Control the app *X***, for that app, scoped as any standing permission is: the thread's workspace, or its quest when it has none, widenable to everywhere from the Permissions page and removable there. It covers that app only, and never the second tier below.
- **Deny** carries the owner's optional message to the thread, which goes on with the refusal.
- Every app gets this question, Terminal, Finder, System Settings and browsers included; none is blocked.

**Second tier: a really sensitive action inside an approved app.** An app the owner has allowed is not a blanket for everything in it. A really sensitive action asks again, one question for that one action, however the app was approved, Always allow included.

- **What counts as sensitive is not defined by the owner. Proposal for the owner to correct**, a short list:
  1. **Running something in a terminal**: typing into, or pressing Return or a key combination in, a terminal app (Terminal, iTerm and the like), since that runs any command with the owner's full access and outside every sandbox. The host knows the app, so it can enforce this.
  2. **Entering a password or other secret**: a `computer_type` into a field the platform marks as secure. The host knows the field's role, so it can enforce this. (The backend may also refuse such inputs itself, see The backend.)
  3. **Changing system settings**: any action in System Settings (or the system's preferences panes) that is not only reading. The host knows the app, so it can enforce this; reading a pane is not sensitive.
  4. **Sending, deleting, paying, posting or publishing**: clicking the button that sends a message or mail, deletes an item, buys, pays, posts or publishes. The host cannot know this reliably: it would have to judge a button by its label, and Outlore judges no action by its words ([action approval](../action-approval/specifications.md)). So this one rests on the thread's own judgment, as at the default level elsewhere: the thread's instructions tell it to call `request_approval` before such an action, and that judgment is not enforced by Outlore. The question is the ordinary one of that tool.
  5. **Closing or quitting an app with unsaved work, and installing or uninstalling software**: left to the thread's judgment as in 4.
- **How a sensitive action asks (Proposal).** The call waits and the thread is in Attention, as above. The question says in plain words what is about to happen in which app ("Press Return in Terminal. This runs what is typed there, with your full access to this computer"), with the screenshot attached and **Show details**. Its buttons are **Allow** and **Deny** only, with no Always allow and no standing permission: it is a one-time answer for that one action, and the next sensitive action asks again.
- **What is enforced and what is not (Proposal).** Items 1 to 3 are enforced by the host from what it can know without reading words (the app, the field's role), so a thread cannot skip them. Items 4 and 5 depend on the thread asking, so they hold only as far as its judgment does, which is the same limit action approval already accepts. If the owner wants 4 to be enforced, Outlore would need a classification of buttons, which is unreliable and is the thing action approval avoids; Open, 2.

**Seeing the whole screen (Proposal).** The tools see only the approved app's window. A capture of the whole display (every app, the menu bar, notifications) is a separate question, "See the whole screen", offered as a tool option and asked once per thread per turn with Allow and Deny only. It is not in the first set of tools unless the owner wants it (Open, 3).

- Answered from the host's window and from any paired device, in the thread, from the dashboard's list of open questions, and from the phone notification, which carries no content, exactly as in [action approval](../action-approval/specifications.md). Nothing a thread or a message says approves a use: a thread's own claim, the owner's message quoted by a thread and a Ritual's instruction never do; a thread's question never answers another's.
- A Ritual's quest that uses the computer waits in Attention at the question like any thread, with no time limit.
- Stopping or interrupting the thread withdraws an open question and releases the computer lock (below).

### One thread at a time

- A real desktop has one pointer and one focus. The host keeps **one computer lock**, host-wide. A thread takes it with its first `computer_*` call after approval and keeps it until its turn ends, it stops, or it makes no `computer_*` call for an idle time (**Proposal**: 2 minutes).
- A thread that calls a tool while another holds the lock gets an answer saying so (which thread holds it, since when) and no action is taken. It decides itself whether to wait and try again. There is no queue, so nothing waits unseen. The answer is plain enough for the thread to tell the owner.
- The thread holding the lock shows **Using the computer** beside its state, on the host and on every paired device, with a **Stop** that ends its turn as stopping any thread does and releases the lock at once.
- The lock is lost if the host stops; a restarted host starts with it free.

### A locked or sleeping screen

- **Before each `computer_*` call**, the host checks that the display is awake and the login session unlocked. If not, the call is refused and nothing is attempted. The thread's answer and the line on the owner's devices say it plainly: "The computer's screen is locked. Unlock it at the computer, then ask again." (or "…the display is asleep…", or "…nobody is signed in on the foreground session…"). The thread is not put in Attention for it; it reports to the owner and carries on.
- **Outlore never unlocks the computer** and never types a password. It does not install an unlock plug-in (Codex's locked use does; Outlore would not copy it without its own decision). Whether the host may wake a sleeping display is **not decided** (Open, 6); the draft's behavior is to refuse.
- **Keep the display awake while threads use the computer** is a host setting. **Proposal**: on by default once computer use is on. While a thread holds the computer lock, and for an idle time after its last `computer_*` call (**Proposal**: 5 minutes; Cua's own default is 10 minutes), the host holds the system's assertion against idle display sleep, which stops the screen saver or display sleep from putting the session behind the lock screen. It releases it when the lock is released and the idle time passes. It is separate from [Keep this computer awake while threads work](../../architecture-decision-record/0018-host-service-runs-on-its-own.md), which holds off system sleep only: the display can sleep and lock with the system awake.
- It cannot prevent a lock the owner makes by hand, a closed laptop lid, fast user switching, or a screen lock that "require password" settings cause when the display wakes. In these cases the pre-call refusal is the behavior.
- **How the host reads the state** is not settled and is a first task of the blueprint. Electron's `powerMonitor` reports `locked` but needs the Electron main process, and the host runs as plain Node ([0018](../../architecture-decision-record/0018-host-service-runs-on-its-own.md)); the macOS call that gives the session's lock state was not read. The behavior above holds whichever means is used.

### macOS permissions and what the app shows

- Computer use needs **Accessibility** and **Screen Recording** (read for Cua Driver in the research). On macOS 15, a one-time direct screen-capture consent may also show; the research read how Cua Driver handles it, not how `screencapture` behaves.
- The grants belong to the identity that does the work: for the backend, its own app; for the view-only screenshot, the host's own program (inferred). The host runs from a login service with no window, so it cannot show the system's prompt itself.
- The Workshop's card shows each requirement as **Granted**, **Missing** or **Not yet asked**, and for a missing one what to do ("Open System Settings, Privacy & Security, Screen Recording, and allow *name*") with a button in the host's own window that opens it. On a paired device the card shows the same status and says **Needs the computer: allow it at the host**; the button does not appear there. A missing permission also refuses a `computer_*` call with the same sentence, and a thread that called it tells the owner.
- Whether permissions survive an Outlore update is **not checked**: if the grant attaches to Outlore's own signing identity, an update could lose it. The card shows the loss as Missing; there is no silent failure.

### Privacy

- **What leaves the computer.** An image or accessibility tree returned by a `computer_*` tool goes to the thread's model provider through its harness, and may show other content on screen (messages, notifications, private data). This is within [Local data](../../requirements.md#privacy-and-data) only because the work needs it, so the card says it before the switch, and the question says it each time.
- **What Outlore keeps.** The Steps line for a call (Audit, below) and the question's record hold text, never an image or a tree. Images taken for a question are dropped when the question closes; Outlore keeps no screenshot of a thread's steps. The harness's own conversation file may hold the images the thread received; **this is not verified** and Outlore does not control it.
- **Size.** An image is bounded before it is sent (**Proposal**: its long edge to a limit the blueprint sets, so a thread's cost is bounded); computer-use threads will cost more than coding threads, since an image is a large input. The budget module needs no change (inferred).
- The accessibility tree of a password field is not read by the backend as value (inferred from how the platform marks secure fields; **not verified**). Outlore adds no filtering.

### Looking at the screen from a paired device

- **Screen view** is a screenshot of the host's display, shown on demand to a paired device, with no thread and no agent action. It is the first slice.
- **Proposal**: its own host switch, **Let paired devices see this computer's screen**, off by default, host's own window only. The host's own window needs no switch to see its own screen. The paired device's owner asks for a screen view with a button; the host takes one image of the main display (or each display, an open point), sends it over the encrypted connection and keeps nothing; the relay carries ciphertext only ([0003](../../architecture-decision-record/0003-per-user-relay-carrying-all-traffic.md)). No stream: an image per request.
- The same refusals apply: a locked or sleeping screen answers "locked" or "asleep" with the same sentence; a missing Screen Recording answers with the permission message. The paired device sees what the owner sees at the host, or the refusal; never a black image presented as the screen (**Proposal**: if what `screencapture` returns on a locked screen is a lock-screen image, the host treats the locked state as a refusal, since the image reveals nothing the owner needs and the sentence is clearer; to settle after the first test).
- A guest never sees it (Guests, below).

### Audit

- Every `computer_*` call leaves a line in the thread's Steps like any call ([action approval](../action-approval/specifications.md#what-a-working-thread-is-doing)), as plain words and a short target, with the app: "Ran · Clicked · Safari · the Send button · 10:41 AM", "Ran · Read the screen · Safari". A line holds no image and no tree, and no typed text: **Proposal**: a typed call says "Typed 24 characters", since typed text could be a password; the question's details show the owner what the tool may do, not the text of each call (Open, 7).
- Each answered question is recorded like any other: in the thread, and in the Permissions page's history, with the app, the answer, the time and the device ("Allowed Control Safari · 14:02 · phone"). A refusal for a locked screen, a missing permission or a held lock leaves a line too.
- Lines are kept with the thread and deleted with its quest.

### Guests

- **Guests can neither start nor approve a use.** Only the host's owner (from the host or a paired device, which carries the owner's authority) answers the questions and sets the switches. A guest's permission to trigger agents ([future multiplayer](../../architecture.md#future-multiplayer-open-architecture-questions)) never grants a computer-use approval, and in a quest with guests the `computer_*` tools are not offered to its threads (**Proposal**: confirm when hosted quests are designed).

### The backend

- Outlore's tools sit on a replaceable **computer backend**: one interface, owned by Outlore, behind which the first macOS backend is **Cua Driver** (MIT), a separate program the host starts and talks to; a different backend (mac-cua, Windows-MCP, a browser, a VM) can replace it without changing the tools, the questions, or this specification ([0021](../../architecture-decision-record/0021-computer-use-in-the-host-behind-computer-tools.md)).
- Cua Driver's interface is marked experimental (contract 0.8.0 at the researched commit), so the host pins one tested version and refuses a different one with a message, and the card shows the version in use.
- **Not installed or not ready**: the card says **Needs the computer-use driver**, how to install it (how the host installs or the owner installs is open, Open, 8), and which permission is missing; no `computer_*` tool is offered to a thread. The slice 1 Screen view needs no backend.
- **The backend fails or stops** during a call: the call returns an error naming the app and the cause in plain words, the lock is released, the line says it failed, and the thread's turn carries on without it; the host restarts the backend at the next call, and after repeated failures the card shows **Not working** with the reason and stops offering the tools until the owner presses **Try again**. A backend that hangs is cut off after a time limit the blueprint sets.
- The backend refuses on its own some inputs: keychain and administrator-password sheets, the Touch ID panel, and macOS privacy or local-network consent alerts. These refusals reach the thread as errors, and Outlore does not work around them. Read from Cua Driver's source in the research; other backends differ.

### Platform scope

- **macOS first.** On a Windows or Linux host the capability shows **Needs a Mac** and cannot be switched on. Cua Driver also covers Windows and Linux unevenly (Windows background keyboard in Electron is refused; Linux varies by compositor), so those backends come later and need their own testing and their own amendment of this specification. A Windows host's Screen view in slice 1 is also later.
- Hosts and devices: any paired device, the web app included, answers questions and asks for a Screen view; the tools run only in the host, never in the Electron main process, so no feature is Electron-only ([Same features in every app](../../requirements.md#access), [0020](../../architecture-decision-record/0020-terminals-run-in-the-host.md)).

## Phases

- **Slice 1: Screen view.** The switch, the Screen Recording status, the pre-call check of the screen state, the keep-awake setting's wiring (the assertion can wait for slice 2), and one image of the host's display, on demand, to a paired device through the relay, via the built-in `screencapture`. No thread, no tool, no third-party program. Settles the first unknown: what `screencapture` returns when the screen is locked or asleep, and the right check for it.
- **Slice 2: the `computer_*` tools.** Starts by checking that the tool server and each harness's adapter carry image results. Then: the tools with Cua Driver as the backend, the question with its attached screenshot, Allow and Always allow per app, the computer lock, the keep-awake hold, the Steps lines and history, the Workshop card with the permissions and the driver version, the failure handling, and the host-only rules. Needs a blueprint (the backend seam, the app catalogue, the lock, the display-state check) before code.
- **Slice 3: more places to work.** A browser backend (Playwright MCP, Node and Apache-2.0) for web tasks, which needs no unlocked physical display (inferred, not tested), and a VM backend (Lume on a Mac, a container elsewhere) for risky or untrusted work, behind the same tools. Windows and Linux backends are separate, later steps.

## External contract

- The tools above are added to Outlore's thread tools, listed only while computer use is on and the backend ready; they run through the host's own asking path ([action approval](../action-approval/specifications.md)). Names are fixed here; schemas are for the blueprint.
- **A Screen view request** (paired device): a request that returns one image or a refusal (locked, asleep, permission missing, off). Added to the host's interface with the same encrypted channel as every request.
- **Settings**: the switch, the Screen view switch, the keep-awake setting; refused through `change_setting` and from a paired device.

## Acceptance and validation

- **Automated, with a fake backend and fake harnesses** (slice 2; slice 1 with a fake capture):
  - tools absent while the switch is off or the backend is missing, present when on and ready, on all three harnesses;
  - the first call naming an app asks once, with the screenshot attached and the call waiting, the thread in Attention; Allow covers that app and thread for the turn only; the next turn, another app, another thread and a thread beneath it ask again; Always allow covers that app in its scope only and not another app;
  - a sensitive action inside an approved app (typing or pressing Return in a terminal, typing into a secure field, changing a System Settings pane) asks one question for that one action with Allow and Deny only, even under a standing permission for the app, and asks again for the next; reading a System Settings pane does not ask; a thread's `request_approval` for a send or delete remains the ordinary question;
  - a message, a Ritual's instruction or another thread claiming approval has no effect; the switches refused from a paired device, from a thread and from Chronicler's `change_setting`;
  - two threads: the second gets the "in use" answer and no action; the lock released on stop, on turn end, on idle time and on a host restart;
  - a locked, asleep or no-session state refuses before any action with the sentence, leaves a line, and does not put the thread in Attention; Outlore never sends an unlock;
  - a missing Accessibility or Screen Recording refuses with the sentence and the card shows Missing; the button absent on a paired device;
  - the backend crashing or hanging returns an error, releases the lock and recovers at the next call; a wrong version refused;
  - Steps lines hold no image, tree or typed text; the question's image dropped when it closes; the Permissions history records each answer with its device;
  - a guest's request refused and the tools absent in a quest with guests (when hosted quests exist);
  - Screen view refused while its switch is off, from a guest and with the screen locked; the image reaching only the asking device, nothing stored, the relay seeing only ciphertext.
- **On the owner's Mac (human acceptance and probes not yet run)**: `screencapture` and the backend on a locked screen and an asleep display, with a real Mac mini; whether the display-awake hold keeps the session unlocked through the screen saver; the macOS permission prompts for the host (running from its login service) and the backend, and after an Outlore update; the quality, speed and background behavior of Cua Driver driving a real app; an end-to-end ask from the phone: "open Safari on the Mac mini and tell me what the page says", allowed from the phone with the screenshot seen on it; Stop from the phone while a thread holds the lock.

## Requirements

- [Approval per action](../../requirements.md#safety): see Approval; the reading of one action is for the owner to confirm.
- [Local data](../../requirements.md#privacy-and-data): what a thread sees goes to its provider and is told; Outlore stores no image of a step.
- [End-to-end encrypted phone traffic](../../requirements.md#privacy-and-data): screenshots reach a paired device only over the encrypted connection; notifications carry no content.
- [Fully open source](../../requirements.md#licensing): the backend and anything Outlore offers must be under an OSI licence (Cua Driver's MIT; not its FSL parts, `cua-spacesd` and the streaming crates, nor its AGPL `cua-perception` model).
- [Nearly free to run](../../requirements.md#budget): an image per request, not a stream; the relay's free limits have not been measured for it.
- [Same features in every app](../../requirements.md#access): the tools live in the host, not the Electron main process.

## Dependencies

- [action-approval](../action-approval/specifications.md): questions, standing permissions, Attention, the Permissions page, the Steps lines.
- [device-pairing](../device-pairing/specifications.md): answering from a phone, the relay, the encrypted connection, the host-only switches.
- [thread-tree](../thread-tree/specifications.md): thread states, Stop, errands.
- [tool-and-skill-loading](../tool-and-skill-loading/specifications.md): the tools reach every harness through Outlore's own tool server.
- [mission-coordination](../mission-coordination/specifications.md): Chronicler uses the tools; `change_setting` refuses these settings.
- [rituals](../rituals/specifications.md): a Ritual's quest waits at the question.
- [connectors](../connectors/specifications.md): a separate capability; computer use is not a connector, since it acts on this computer's own screen and its approval is per app, not per tool.

## Exclusions

- A live stream, remote control of the pointer or keyboard from a paired device, VNC, RustDesk, Apple Screen Sharing and Chrome Remote Desktop: they put control outside Outlore's approvals and relay.
- A phone taking the pointer or keyboard itself (the owner, 2026-11-16: it may look and approve, not control).
- Blocking any app (the owner, 2026-11-16).
- Unlocking or waking the computer, an unlock plug-in, a password typed by Outlore.
- Passing a third-party computer-use server straight through to the harnesses, and Claude Code's built-in computer use (it needs an interactive session and does not work in `-p` mode, which Outlore uses).
- Cua's Spaces apps, `cua-spacesd`, its streaming crates and `cua-perception` (source-available or AGPL).
- A hosted desktop (E2B), the clipboard, closing apps, window moving, and drag and menu tools in the first set.
- Windows and Linux hosts, until their own steps.
- Hosted multiplayer: only the host's owner uses and approves it.

## Open for the owner

Each is a guess this draft made, with its reason; correct any.

1. **Approval grain: decided at the app level; the rest is mine.** The owner decided per app, and a second question only for a really sensitive action. Still my proposal: the Allow lasts for one thread's turn, and Always allow per app exists, so one approval covers many clicks. That stretches "one approval, one action" in [Approval per action](../../requirements.md#safety); should the requirement's wording be amended to name it? Alternatives: an Allow that lasts until the thread ends, or Always allow only.
2. **What is sensitive.** The list in Approval is mine: typing or pressing Return in a terminal, typing into a secure field, changing System Settings (all enforced by the host from the app and the field's role), and sending, deleting, paying, publishing, closing an app with unsaved work, and installing software (left to the thread's judgment, since Outlore would have to read button labels to enforce them). Add, drop, or ask for enforcement of the thread-judged ones? A sensitive action offers Allow and Deny only, with no Always allow: right? Related: approving "Control Terminal" or a sensitive terminal action on a phone gives a thread the real Terminal with the owner's full access, a second way past [0020](../../architecture-decision-record/0020-terminals-run-in-the-host.md)'s sandbox for paired devices' terminals (a paired device already answers "Run outside the sandbox"). Should those questions be answerable only from the host's own window?
3. **Seeing the whole screen**: only the approved app's window by default, and a separate question for the whole display. Is that right, or is the whole screen the normal view?
4. **Who may switch it on, and how many switches.** Host's own window only, never a paired device or a thread. One switch for the tools and a separate one for the Screen view; is one enough?
5. **Retention.** Outlore keeps no image; the question's screenshot is dropped when it closes; typed text is not recorded, only its length. Right for you? (The harness's own transcript may still hold images; unverified.)
6. **Waking a sleeping display.** The draft only refuses. Should the host be allowed to wake the display (never unlock it)? With "require password after sleep" it would show the lock screen anyway, so the draft leaves it out.
7. **How much the audit says of typing.** Length only, or the text (a password could appear)?
8. **Installing the backend.** Does the Workshop offer an Install button that runs Cua's own installer (a download and a third-party installer, which asks first), or only say how the owner installs it?
9. **Idle times.** 2 minutes for the lock and 5 for the display hold are guesses.
10. **Per-quest and per-realm switches** like [connectors](../connectors/specifications.md), or one host switch with the per-app question alone?
11. **Order of the backends**: desktop first (this draft) or a browser backend first. Most phone requests may be web tasks, which a browser backend does with no unlocked display (inferred).
12. **A local key or mouse movement by the owner at the host**: pause the agent, as Codex does? Not designed.
13. **Windows**: when, and which backend (Cua Driver or Windows-MCP, compared by running both).
14. **Codex's own computer use** and Gemini: not investigated (unknown whether Codex's app-server has it).

## Technical notes (not agreed behavior)

- **Verified in the research**: Outlore passes harnesses only its own tool server (`--strict-mcp-config`, external MCP unbuilt), and Claude Code's built-in computer use does not work with `-p`, so the tools must come from Outlore's tool server. Cua Driver (MIT; Rust; stdio MCP, a CLI and a TypeScript SDK; background input; refuses keychain, authentication and consent prompts; its own display-idle assertion) at commit `5ee5974`; its contract is experimental. The research did not run any of it.
- **Inferred**: a thread's computer tool, like `request_approval`, asks inside the tool call through the host's own attention path, since Claude Code's sandbox does not contain it and its approval path would not show the screenshot; the tool is then listed as run without asking in the harness's own prompt. How an unsandboxed MCP tool call is asked by each harness was not checked.
- **Display state**: the check is the host's own; the call and the means (a small command, or a native call) are to be proven on the Mac, since Electron's `powerMonitor` is not available in the plain-Node host.
- The backend interface is Outlore's own and small (look, read, act, state, permissions); a Cua-specific contract must not leak into the tools or the records. A thin adapter to `cua-driver mcp` (stdio) keeps Outlore's code in TypeScript; the TypeScript SDK is a native addon and is not preferred.

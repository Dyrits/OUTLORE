# Computer-use alternatives to Cua Driver: primary-source notes

Researched 2026-11-16. This is a companion to [Cua and computer use](cua-computer-use.md), which recommends Outlore's own `computer_*` tools in the host with Cua Driver as a replaceable macOS backend. The owner asked whether a better alternative exists, for the real-desktop backend and for the agent-facing tool layer, and asked that the locked or sleeping display be handled. Research only: nothing was built, installed, cloned or run.

## Method, and what "primary source" means here

- **Repositories**: read through WebFetch on `raw.githubusercontent.com` and `api.github.com` (repository metadata and the newest commit on the default branch). The G-DRIVE has about 62 MB free (confirmed with `df` on 2026-11-16), so nothing was cloned. WebFetch runs a small model over each page, so quoted phrases are the page's words as that tool returned them, **line numbers are not available**, and "the page does not say" means "not in the part returned", not "absent from the repository".
- **Rate limit**: partway through, `api.github.com` and some raw files began to answer 403 or 404. Where that blocked a fact, the table says **not read**. This hit: the newest commit SHA of nut.js, robotjs, Hammerspoon and RustDesk (only the `pushed_at` date from the repository metadata is given), the licence file of nut.js, the licence of `e2b-dev/infra`, the repository metadata of noVNC, ydotool and xdotool (their READMEs were read), Apple's `CGSessionCopyCurrentDictionary` page, and Hammerspoon's `hs.accessibility` page.
- **Vendor pages**: fetched 2026-11-16 (Claude Code, Codex, Electron, xdg-desktop-portal, Apple, Google). No dated commit exists for these; each claim is as of that day.
- **Search results are not sources.** Where a candidate was found only through WebSearch (secondary listings), it is marked **found by search, README not read**, and no claim about it is relied on.
- **Outlore**: working tree at `main` (`0a7b8c5`), unchanged from the earlier note.
- **Verified** means I read it in the source named. **Inferred** means my own conclusion from verified facts. **Not read** names what I looked up but could not open.

## Question

Is there a better real-desktop backend than Cua Driver, or a better agent-facing layer, for Outlore's goal: Chronicler and its threads operating the host that a paired phone steers, in a TypeScript and Effect host with no Rust of Outlore's own ([0017](../architecture-decision-record/0017-typescript-and-effect-no-rust.md)), open-source only, with harnesses that receive only Outlore's own tool server (`claudeArgs.ts`, `codex.ts`, `opencode.ts`; see the [Cua note, §2.1](cua-computer-use.md))? And what does each option do when the display is asleep or the screen is locked?

## 1. What a candidate has to satisfy

From the [Cua note](cua-computer-use.md) and Outlore's documents (the criteria, not new findings):

1. **Open source** for anything in the release path ([requirements](../requirements.md#licensing)); source-available (FSL, "subscription for builds") and AGPL parts are out or need a separate-process boundary and a decision.
2. **Fits a TypeScript host**: a child process speaking stdio MCP or a CLI, or a Node library. A second language runtime (Python, Swift toolchain) is a new thing to install and update.
3. **Reaches the three harnesses**: since Outlore passes harnesses only its own tool server, every candidate would be used *behind* Outlore's own `computer_*` tools, so the question is "which backend", and "does it speak to a harness" does not decide anything. Passing a third-party server straight through needs the unbuilt external-MCP capability.
4. **Approvals are Outlore's**: no candidate below has an approval that a phone can answer; the host must own per-app approval, a lock, and the screenshot shown to the owner.
5. **Locked or asleep display**: needs a check before each call and a refusal message, or a keep-awake setting.

## 2. Findings by layer

### 2.1 Model and harness vendors (the agent-facing contract)

Re-read today; the earlier note's conclusions hold, with two additions.

- **Claude Code CLI** (`https://code.claude.com/docs/en/computer-use.md`): built-in MCP server `computer-use`, enabled through `/mcp` in an interactive session; macOS only; "It requires an interactive session, so it is not available in non-interactive mode with the `-p` flag." Per-app approval each session ("Allow for this session"), warnings for apps with shell, file or settings reach, browsers and trading platforms view-only, terminals and IDEs click-only, one session at a time through a lock, Esc stops it, "computer use runs on your actual desktop". **Added today**: the page says nothing at all about locked screens, display sleep or an unattended Mac. Unusable by Outlore as built (`-p`).
- **Codex** (`https://learn.chatgpt.com/docs/computer-use`): the page names only "the ChatGPT desktop app" on macOS and Windows; Codex CLI, `codex exec`, app-server and the IDE extension do not appear in its body. Asks per app, "Always allow" per app. **Added today**: "Locked use is for macOS", it lets Computer Use run after a Mac locks, with automatic unlock "restricted to short, task-scoped windows"; local keyboard or pointer input relocks the Mac and pauses automatic unlock. Display sleep is not addressed. A search for Codex CLI use found only third-party material (OpenClaw's docs, a blog); I do **not** rely on it. Whether Codex's CLI or app-server can use it stays **unknown**.
- **Anthropic, OpenAI and Gemini APIs**: unchanged from the earlier note (§2.2 there): each is a model tool whose actions "your application" executes. Not reachable from Outlore, which drives Claude Code, Codex and OpenCode rather than the APIs ([0008](../architecture-decision-record/0008-drive-harness-tools-directly.md)).
- **Anthropic's reference implementation** (`anthropics/claude-quickstarts`, `computer-use-demo/`, commit **`4a4224bdf0e9cfb3332167b69c90457403813625`**, 2026-11-06; MIT, "Copyright (c) 2023 Anthropic"): "the essential agent loop running against a Linux desktop in Docker with X11 + VNC". It is a Python app with a `Dockerfile`, `computer_use_demo/`, `setup.sh`. The README says the components are "weakly separated", the loop "can only be used by one session at a time", and the beta API "is subject to change". It recommends a dedicated VM or container, no sensitive data, an allowlist, and human confirmation, and warns that "Claude will follow commands found in content even if it conflicts with the user's instructions." It says nothing about xdotool (not stated in the part returned). It is a Linux, throwaway-desktop design, not a way to drive the owner's Mac. Useful as a pattern for a container backend (§2.7).

### 2.2 macOS real-desktop backends

The reference is Cua Driver (MIT, Rust, stdio MCP, Accessibility and Screen Recording, background input through `SLEventPostToPid`, display-idle assertion, refuses keychain and consent prompts; details and licence traps in the [Cua note §1](cua-computer-use.md)). Alternatives:

| Candidate | What it is (verified) | Licence | Shape for the host | Activity |
| --- | --- | --- | --- | --- |
| **mac-cua** (`hyprcat/mac-cua`) | Python MCP server over stdio. Reads the Accessibility tree, screenshots through ScreenCaptureKit and `CGWindowListCreateImage`, sends input with `CGEventPostToPid` ("never `CGEventPost`"), so the real cursor does not move. 9 tools (`list_apps`, `get_app_state`, `click`, `type_text`, `press_key`, `set_value`, `scroll`, `drag`, `perform_secondary_action`). Has an app blocklist (Keychain, login), URL blocklist, "Session and persistent app approval gates", interruption detection ("you win"). Needs Accessibility and Screen Recording. "no API keys, no accounts, no network calls". | Apache-2.0 (LICENSE file read) | Needs macOS 13+, Python 3.13+, `uv`; started with `uv sync` then `uv run python main.py` from a clone. A second runtime to install and ship. | 35 stars. Latest commit on `main` `362393e312de500597146b13b6f5a428462f6ce2`, 2026-04-20 ("docs: use YouTube link for demo video"); the repository `pushed_at` is 2026-08-28, so something later exists off `main` or the two disagree. No release process seen. |
| **CursorTouch macOS-MCP** (`CursorTouch/MacOS-MCP`) | Python MCP server. "Interacts natively with macOS UI elements using the Accessibility API"; tools Click, Type, Scroll, Move, Shortcut, App, Desktop, Shell, Scrape, Wait, Snapshot (screenshots), Notification. Transports stdio, SSE, streamable-http, with bearer auth, IP allowlist, TLS, OAuth. `macos-mcp install` writes a launchd agent. | MIT | `uvx macos-mcp serve`; Python 3.11+, `uv`. Anonymous telemetry on by default (`ANONYMIZED_TELEMETRY=false` turns it off). Warns: runs "without sandboxing", "Use only in virtual machines or isolated environments with valueless data", "Cannot interact with system authentication dialogs". It has a `Shell` tool. | 244 stars; commit `43af521b282ebaa9f7a5acb4206ccb260d68273e`, 2026-11-02. Whether it uses background or global input is **not stated** in the part returned. |
| **Ghost OS** (`ghostwright/ghost-os`) | Swift MCP server, stdio. "Accessibility tree first. Vision fallback when needed": 29 tools including `ghost_screenshot`, click, type, hotkey, recipes, a "learning mode" (CGEvent tap). Vision uses ShowUI-2B through a Python sidecar. Needs Accessibility and Screen Recording (Input Monitoring for learning mode). | MIT | `brew install ghostwright/ghost-os/ghost-os`, then `ghost setup`; macOS 14+, Swift 6.2+ only to build. | 1,685 stars; but the latest commit is `991aa4831295aaff6beef04cc809d0f0b53dc024`, 2026-03-23 (a README edit), version 2.2.1: **no change in eight months.** |
| **mcp-server-macos-use** (`mediar-ai/...`) | Swift MCP server, stdio. 5 tools (open and traverse, click, type, press key, refresh), each returning a traversed accessibility tree. The README does not mention screenshots, permissions or the input mechanism. | **Not stated** (GitHub reports `NOASSERTION`) | Build with `swift build` from a clone; depends on `MacosUseSDK`, "Assumed local or external Swift package". | 358 stars; `205c8880e8c06fa96a3e3a859e6edca728eb6c47`, 2026-09-30. **Excluded**: no licence is granted. |
| **mac-use-mcp** (`antbotlab/mac-use-mcp`) | **Found by search only, README not read.** Listing says TypeScript on npm (`npx mac-use-mcp`), MIT, 18 tools, a Swift helper using CGEvent, `CGWindowListCreateImage` and Accessibility. | MIT (repository metadata) | Would be the nearest fit for a Node host (an npm package) if its claims hold. | 7 stars; last push 2026-05-01. Very small; **not evaluated**. |
| **Other search hits** (`passerby2049/macpilot-mcp`, `wende/macbeth`, `johnexzy/macos-computer-use`, `1amageek/app-mcp`, `sh3ll3x3c/native-devtools-mcp`) | Found by search only; none read. | Not read | Not read | Not evaluated. |

**Native building blocks** (not agents; Outlore would write the layer on top):

- **`screencapture`** (macOS built-in): `-x` silent, `-l <windowid>` a window, `-D <display>` a display, `-t <format>`, `-C` cursor (the `ss64.com` mirror of the manual page; third-party, secondary). The same page notes that over SSH it must run "in the same bootstrap hierarchy as loginwindow" (`sudo launchctl bsexec $PID screencapture ...`), which says a capture needs a logged-in GUI session (**inferred**; I did not run it, and whether a *locked* session yields a lock-screen image or an error is **not verified**). A view-only screenshot needs no third-party dependency. Cua Driver also uses `screencapture -l` for window capture ([Cua note §1.4](cua-computer-use.md)).
- **robotjs** (`octalmage/robotjs`, MIT, C, 12,786 stars, `pushed_at` 2026-10-24; commit SHA **not read**): Node-API prebuilds for Linux, macOS and Windows on x64 and arm64; `robot.screen.capture()`, mouse and keyboard, permission helpers `getAccessibilityPermission()` and `getScreenCapturePermission()`. Global input only (no per-process delivery, no accessibility tree). "This is a work in progress so the exported functions could change at any time before the first stable release (1.0.0)." Linux assumes X11 (needs `libxtst-dev`). In-process in Node, so it would hold the macOS grants for Outlore's host binary and move the real pointer.
- **nut.js** (`nut-tree/nut.js`, TypeScript, 2,857 stars, `pushed_at` 2024-05-01): Windows, macOS, Linux; "At the moment nut.js only supports X11" (no Wayland). The README says it is "still open source" and "still free to use, you'll just have to build it from sources", while "Pre-built packages are available for subscription plans", and the author "removed public packages from npm" (`i-give-up`). GitHub reports **no licence** (null) and the LICENSE file was **not read** (404 on the path I tried). **Treat as not fully open source for Outlore's purposes until the licence is read.** The executing app needs Accessibility and Screen Recording.
- **Hammerspoon** (MIT, Objective-C, 16,433 stars, `pushed_at` 2026-07-08; SHA **not read**): "Staggeringly powerful macOS desktop automation with Lua". `hs.screen:snapshot([rect])` "Captures an image of the screen" (`hs.screen` page). It is a running application with a Lua configuration, not a library; its `hs.accessibility`, `hs.caffeinate` and screen-lock watcher pages were **not read** (one 404, one silent), so I make no claim about them. Adds a second long-running macOS app to ship.
- **AppleScript and JXA** (`osascript`): **not read**. Scripting another app needs Automation consent per target app, and UI scripting needs Accessibility (**inferred** from general macOS knowledge, no source read). Not a click-and-screenshot layer.

### 2.3 Windows backends

| Candidate | What it is (verified) | Licence | Shape for the host | Activity |
| --- | --- | --- | --- | --- |
| **Windows-MCP** (`CursorTouch/Windows-MCP`) | Python MCP server on the real Windows desktop, using UI Automation and accessibility data ("rather than computer vision or fine-tuned models"; vision optional). 21 tools: Click, Type, Scroll, Move, Shortcut, Wait, WaitFor, ControlStatus, DisplayInventory, Screenshot, Snapshot, App, PowerShell, FileSystem, Scrape, MultiSelect, MultiEdit, Clipboard, Process, Notification, Registry. Screenshot backends dxcam, mss, pillow. Transports stdio, SSE, streamable-http (auth key, IP allowlist, TLS, OAuth). "operates with full system access and can perform irreversible operations". Direct input is gated by user consent with a countdown; takeover is "best-effort, not a security boundary". Anonymous telemetry on by default. | MIT | `uvx windows-mcp serve`; **Python 3.14+**, Windows 10 or 11; `windows-mcp install` registers a per-user Scheduled Task starting at login. | 11,734 stars; `02950fa1331f5b9e112259f0be5cd442a4bb0ba9`, 2026-11-16: the most active of the candidates. |
| **UFO** (`microsoft/UFO`, "UFO³") | A Python agent framework: UFO² is a Windows device agent ("Windows UIA, Win32, WinCOM native control", hybrid UIA and vision detection); Galaxy orchestrates several devices (Windows, Linux, Android) over a WebSocket "AIP" layer. | MIT | It brings its own agent loop and LLM configuration (OpenAI, Azure OpenAI; Qwen, Gemini and Claude mentioned); the README does not say it is an MCP server. Python 3.10 or 3.11. | 10,215 stars; `eae3c0a8d168c47cb10df0652e293e092eda1078`, 2026-10-14. **Not a backend**: it replaces the model and the harness, which Outlore does not do ([0008](../architecture-decision-record/0008-drive-harness-tools-directly.md)). |

Cua Driver also supports Windows (Windows background keyboard in Electron is refused, [Cua note §1.4](cua-computer-use.md)), so a Windows backend need not be a second product.

### 2.4 Linux backends

- **xdotool** (`jordansissel/xdotool`; README read, licence **not stated** in it): simulates input and manages windows through "X11's XTEST extension and other Xlib functions". "This software will not work correctly" on Wayland; typing and window search fail, and it is "unclear if they could ever work." It points to ydotool and dotool for Wayland.
- **ydotool** (`ReimuNotMoe/ydotool`): "uses the uinput framework of Linux kernel to emulate an input device"; since v1.0.0 the `ydotoold` daemon must run, and it needs access to `/dev/uinput`, which "usually requires root permissions". Works on X11, Wayland and text consoles. **The README says the project "changed the license to AGPLv3".** Input only; the README does not describe screen reading.
- **xdg-desktop-portal RemoteDesktop** (`https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.RemoteDesktop.html`): the Wayland-sanctioned way. An app creates a session; `Start()` shows the user a consent dialog; input goes through libei (`ConnectToEIS()`) or `Notify*` D-Bus calls; paired with `ScreenCast` for capture over PipeWire. `persist_mode` 2 plus a single-use `restore_token` lets permission persist "until revoked". Compositor and desktop dependent (**not tested**); needs a D-Bus-speaking client, which is not a one-liner in Node.
- **AT-SPI** (Linux accessibility tree): **not read**. Cua Driver's Linux support is per compositor ("X11, Sway, niri, GNOME, KDE", [Cua note §1.3](cua-computer-use.md)); OpenAdapt names AT-SPI as one of its structure sources (OpenAdapt README).
- **robotjs and nut.js** on Linux are X11 only (§2.2).
- **Inferred**: a headless or unattended Linux box is better served by a virtual X display in a container (§2.7) than by driving a physical Wayland session. A Linux host is outside Outlore's first slice anyway.

### 2.5 Browser-only

- **Playwright MCP** (`microsoft/playwright-mcp`, Apache-2.0 per GitHub metadata; README did not state a licence; 39,702 stars; commit `78eca85361efb545a4c0f59b6140aef0721c5412`, 2026-11-11): Node 18+, `npx @playwright/mcp@latest` (stdio) or `--port` for HTTP. Works from the accessibility tree ("Use browser_snapshot for actions by default"), screenshots through `browser_take_screenshot`, `--caps=vision` for coordinates. Headed by default, `--headless`, `--isolated` (profile in memory), and `--extension` mode to drive a running Edge or Chrome with the owner's logins. "is **not** a security boundary". **It is TypeScript and Node, so it is the best language fit of anything in this note**, and a headless browser needs no unlocked desktop (**inferred**: headless Chromium has no display session; not tested).
- **browser-use** (`browser-use/browser-use`, MIT, Python 3.11+, 121,148 stars; commit `4b5b1b0aa0ab45a1d6a2a31984d37d3e748c0134`, 2026-11-16, "1.0.6"): the agent writes Python in a REPL over "raw Chrome DevTools Protocol (CDP)". `Browser()` uses a **Browser Use Cloud** browser by default; `Browser('chrome')` drives the Chrome you already have open; "local modes open a debugging port with no authentication on 127.0.0.1". It brings its own agent loop and model key, and has a cloud service. A library for building agents, not a backend for Outlore.
- Anthropic's own page recommends the browser tool for web-only work ([Cua note §2.2](cua-computer-use.md)).

### 2.6 Computer-use agent frameworks

| Candidate | What it is (verified) | Licence | Fit | Activity |
| --- | --- | --- | --- | --- |
| **Agent S** (`simular-ai/Agent-S`) | The `gui-agents` Python library; Agent S3 "first to surpass human performance on OSWorld (72.60%)". Its grounding code turns model output into `pyautogui` calls (`pyautogui.click(...)`, `write`, `hotkey`, `vscroll`) returned as code strings to be run elsewhere; also LibreOffice UNO scripts. macOS, Windows, Linux. The README does not mention MCP. | Apache-2.0 (GitHub metadata) | A whole agent with its own model loop; global input through `pyautogui` (the real pointer). Not a backend; it would replace the harness. | 12,980 stars; `0fff0e634869dab72027435b4586e62300185d41`, 2026-10-21 (README edit). |
| **UI-TARS-desktop** (`bytedance/UI-TARS-desktop`) | A desktop app for a "native GUI agent" driven by the UI-TARS model family, and Agent TARS (CLI and Web UI, connects to MCP tools). Local and remote operators; Windows, macOS, browser. | Apache-2.0 | Its own agent and its own models (Volcengine and Anthropic examples). | **Archived** on GitHub (`archived: true`); last commit `3ac2cb8d946d78d5ff92ad17b318eaafa18c178c`, 2026-10-09 "release 0.3.1". The README returned no archive notice and no reason. **Do not build on it.** |
| **OpenAdapt** (`OpenAdaptAI/OpenAdapt`) | Records a task once and compiles it into a program that replays it "without model calls" and checks each save; web, Windows, macOS, Linux (X11), RDP and Citrix; uses DOM, UI Automation, macOS Accessibility or AT-SPI where available, pixels on remote desktops. CLI, Python library and an MCP server (`openadapt-agent serve`) exposing each compiled workflow as one tool. "It isn't a computer-use agent": it works alongside Claude or OpenAI computer use. | MIT | Not a backend: a layer *above* an agent for repeated workflows. Interesting later for routine tasks (a Ritual that replays a recorded run); out of scope now. Qualified end to end only on macOS native, per its own README. | 1,884 stars; `2e98be86a802b0867b9513491c5f368ba98811d0`, 2026-11-14 (release 3.1.0 of the flow package). |
| **Open Interpreter** (`openinterpreter/openinterpreter`) | Now a Rust coding agent forked from Codex ("A coding agent optimized for low-cost models"); the Python original continues as a community fork. The README returned **no OS mode**; its "Computer Use" section is a bundled QA skill: web apps through `agent-browser`, native apps "through trycua". | Apache-2.0 | **A data point, not a backend**: a comparable tool chose Cua's driver for native apps. A single third-party blog post (`codenote.net`, a static code reading of tag rust-v0.0.42, secondary) says the skill drives the `cua-driver` CLI and installs it from Cua's moving `main` branch; I did not verify that against the repository. | 68,894 stars; `382f615b907279be1b6518156ac2754d3c235ff4`, 2026-11-15. |

### 2.7 Sandboxes and virtual computers

| Candidate | What it is (verified) | Licence | Fit | Notes |
| --- | --- | --- | --- | --- |
| **Lume** (Cua) | macOS and Linux VMs on Apple Virtualization.framework; Apple silicon; two macOS guests at a time; 50 GB free per macOS guest ([Cua note §1.7](cua-computer-use.md)). | MIT | Local, offline, Apple-native, no new language. | In-guest screenshot and click route not read. |
| **Docker plus X11 and VNC** (Anthropic's `computer-use-demo`) | "a Linux desktop in Docker with X11 + VNC" (§2.1). | MIT | Cheapest throwaway desktop on any host with Docker. Python app, weakly separated components. | Linux guests only. |
| **E2B Desktop** (`e2b-dev/desktop`) | "open source secure virtual desktop ready for Computer Use"; Python `e2b-desktop` and JavaScript `@e2b/desktop` SDKs with `screenshot()`, click, scroll, drag, `write()`, `press()`, app launch, shell; streams the desktop or one window with optional password and view-only URLs; Linux and Xfce; "built on top of E2B Sandbox" and needs `E2B_API_KEY`. | Apache-2.0 (GitHub metadata) | A hosted cloud service. Conflicts with "Nearly free to run" and "Local data" if screens go to a third party ([inferred](../requirements.md#budget); not priced). The README does not say it can be self-hosted. `e2b-dev/infra` README: Terraform for GCP, AWS and Azure and a Kubernetes manifest, runtime "needs a Linux host with KVM", a single-machine "Embed"; the infra licence was **not read** (403). | `91f23acaab7312e847596acc44e6f7763f56917f`, 2026-11-02 ("Update dependency python to v3.15.2"): a dependency bump. Not useful for operating the owner's own Mac. |
| **Firecracker** | Apache-2.0; "uses the Linux Kernel Virtual Machine (KVM)"; all tested hosts are Linux (Amazon Linux 2 and 2023); guest Ubuntu 24.04. | Apache-2.0 | **No macOS host.** Not available on the owner's Mac mini. | Only relevant to a future cloud or Linux host. |

### 2.8 Remote-desktop streaming (a view-and-control route for a phone)

| Option | What it is (verified) | Licence | Phone | Locked or asleep |
| --- | --- | --- | --- | --- |
| **Apple Screen Sharing** | Built into macOS: "turned on screen sharing or remote management and set up sharing permissions"; only listed accounts can view; "Neither Mac should be asleep" (Apple, `support.apple.com/guide/mac-help/mh14070/mac`). | Proprietary, built in | The page covers Macs; a phone client is **not covered** | The page does not address the login window or locked screens. Third-party notes (Edovia, Apple Community threads, secondary) say a sleeping Mac is unavailable and FileVault blocks connection after a restart; I do not rely on them. |
| **RustDesk** | "An open-source remote desktop application designed for self-hosting" (`rustdesk/rustdesk`); Flutter on desktop and mobile; self-host a rendezvous and relay server. | **AGPL-3.0** (GitHub metadata) | A mobile app exists (Flutter code for "desktop and mobile"; the README does not describe the iOS or Android controller) | The README does not address locked or login screens or headless use. 129,647 stars; `pushed_at` 2026-11-16; SHA **not read**. |
| **noVNC** | "both a HTML VNC client JavaScript library and an application"; runs "in any modern browser including mobile browsers (iOS and Android)"; touch gestures; needs a WebSocket proxy (`websockify`) unless the server speaks WebSockets. | "mainly under the MPL 2.0" (README) | A real browser route to a VNC server | Depends on the server. View-only mode **not mentioned** in the README. |
| **Chrome Remote Desktop** | Host for "Mac, Windows, or Linux"; a dedicated mobile app; may prompt for security settings (Google support page). | The page does not say; **treated as proprietary** (inferred) | Yes, an app | The page does not address locked or login screens. |

**What this route does and does not give Outlore (inferred from verified facts):**

- It is a *person-driven* route: the phone owner sees and clicks the screen. It does not let an *agent* act and does not put anything through Outlore's per-app approval or its audit trail.
- It travels outside Outlore's relay ([0003](../architecture-decision-record/0003-per-user-relay-carrying-all-traffic.md), [0016](../architecture-decision-record/0016-shared-relay-on-the-owners-free-cloudflare-account.md)): a second network path, a second set of credentials and a second thing to keep secure, which the architecture's "one relay, end-to-end encrypted" does not cover.
- A live stream is a different cost and security class than "a screenshot on demand". The free Cloudflare tier was not measured for a stream (as in the Cua note §3).
- RustDesk and ydotool are AGPL; using them as separately installed programs the owner runs (not linked into Outlore) is a different question from depending on them, and is not decided here.

## 3. Locked screen and display asleep

| Candidate | What its own source says |
| --- | --- |
| **Cua Driver** | Holds an IOKit `PreventUserIdleDisplaySleep` assertion while tools run (idle window 600 seconds by default): "the screen saver and display sleep put the login session behind the lock screen" and "keeping the machine awake is not enough". It never wakes a display or unlocks ([Cua note §1.5](cua-computer-use.md); `platform-macos/src/display_awake.rs`). **The only open-source backend read that handles this itself.** |
| **Codex desktop app** | "Locked use" (macOS): temporarily unlocks the Mac in task-scoped windows; relocks on local input; display sleep not addressed. Needs an Apple authorization plug-in (earlier note). |
| **Claude Code CLI** | Silent on locked screens and display sleep. |
| **Windows-MCP** | No documented locked-screen behaviour. It notes cursor positioning can fail "if the server cannot access the active input desktop", and that an optional watchdog could crash after "a sleep/resume or session change". |
| **macOS-MCP (CursorTouch), mac-cua, Ghost OS, mcp-server-macos-use** | Silent (each README); macOS-MCP only says it "Cannot interact with system authentication dialogs". |
| **robotjs, nut.js, Playwright MCP, browser-use, Agent S, UI-TARS, OpenAdapt, UFO, E2B** | Silent on locked screens. (A headless Playwright or a container desktop has no physical session to lock; **inferred**, not tested.) |
| **Apple Screen Sharing** | Neither Mac asleep (Apple); login window not addressed. |
| **Chrome Remote Desktop, RustDesk** | Silent. |

**Detection Outlore could build on, from primary sources (verified, then inferred):**

- Electron `powerMonitor` (`https://www.electronjs.org/docs/latest/api/power-monitor`): events `lock-screen` ("about to lock the screen") and `unlock-screen` on macOS and Windows; `suspend` and `resume`; `getSystemIdleState(idleThreshold)` returns `active`, `idle`, `locked` or `unknown` ("`locked` is only available on supported systems"). **Inferred**: it needs the Electron main process, but ADR 0018 lets the host run as Node (`ELECTRON_RUN_AS_NODE`), where this module is not available; the host would need its own check (for example a small command), as the earlier conversation said.
- Apple's `CGSessionCopyCurrentDictionary` page was **not read** (404 on the path I tried); the key name from the earlier conversation is **unverified**.
- The conclusion holds regardless of backend: **nothing else in the field handles the locked or sleeping case; Outlore has to own the pre-call check, the refusal message, and the keep-display-awake setting.** The choice of backend does not change that, except that Cua Driver's own assertion is one thing fewer to write.

## 4. Comparison

Columns: **Drives** (D real desktop, B browser, V VM or container, A agent framework); **Plat.** (M macOS, W Windows, L Linux); **Lic.** (OK = OSI licence stated, `?` = not stated or not read, `!` = AGPL, FSL or paid); **Fit** is how it sits in a TypeScript and Effect host.

| Candidate | Drives | Plat. | Lic. | Fit in host | Exposed | Last commit | Locked or asleep | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Cua Driver** (reference) | D | M W L | OK (MIT), but not Spaces or `cua-perception` | Rust binary as a child process; TS SDK is a native addon | stdio MCP, CLI, SDK | 2026-11-16 | display-idle assertion; never unlocks | **Keep** |
| mac-cua | D | M | OK (Apache-2.0) | Python 3.13 + `uv` runtime | stdio MCP | 2026-04-20 on `main` | silent | Same design as Cua Driver, smaller, stale; second fallback |
| CursorTouch macOS-MCP | D | M | OK (MIT) | Python 3.11 + `uv`; telemetry on; has a `Shell` tool | stdio, SSE, HTTP | 2026-11-02 | silent | Not recommended |
| Ghost OS | D | M | OK (MIT) | Swift binary via brew; optional Python vision sidecar | stdio MCP | 2026-03-23 | silent | Stale; not recommended |
| mcp-server-macos-use | D | M | `?` none stated | Swift from a clone | stdio MCP | 2026-09-30 | silent | **Excluded** (no licence) |
| mac-use-mcp | D | M | OK (MIT, metadata) | npm, Swift helper | stdio MCP | 2026-05-01 push | not read | Found by search; not evaluated |
| robotjs | D | M W L(X11) | OK (MIT) | Node native addon, in-process | library | `pushed_at` 2026-10-24 | silent | Global pointer, no accessibility tree; pre-1.0; fallback for raw input |
| nut.js | D | M W L(X11) | `?` null licence, paid builds | TypeScript, Node native | library | `pushed_at` 2024-05-01 | silent | **Excluded** until the licence is read |
| Hammerspoon | D | M | OK (MIT) | Separate Lua app | Lua, `hs` CLI | `pushed_at` 2026-07-08 | not read | Not a fit |
| `screencapture` | D (view) | M | OS built-in | `execFile` from Node | CLI | n/a | needs a GUI session (inferred) | **Right tool for a view-only screenshot** |
| Windows-MCP | D | W | OK (MIT) | Python 3.14+ + `uv` | stdio, SSE, HTTP | 2026-11-16 | silent | Best Windows-only candidate; compare with Cua Driver on Windows |
| UFO | D, A | W (+L, Android) | OK (MIT) | Python agent with its own loop | its own CLI | 2026-10-14 | silent | Not a backend |
| xdotool | D | L(X11) | `?` not stated in README | CLI | CLI | not read | n/a | X11 only |
| ydotool | D (input) | L | `!` AGPLv3 | root daemon on `/dev/uinput` | CLI | not read | n/a | Avoid in the release path |
| RemoteDesktop portal | D | L(Wayland) | n/a (OS API) | D-Bus client; libei | D-Bus | n/a | consent dialog | Right route for Wayland later |
| Playwright MCP | B | M W L | OK (Apache-2.0, metadata) | **Node, `npx`** | stdio or HTTP MCP | 2026-11-11 | headless has no session (inferred) | **Best browser option** |
| browser-use | B | any | OK (MIT) | Python; brings its own loop; cloud by default | library, CLI, MCP | 2026-11-16 | n/a | Not a backend |
| Agent S | A | M W L | OK (Apache-2.0, metadata) | Python; `pyautogui` global input | library | 2026-10-21 | silent | Not a backend |
| UI-TARS-desktop | A | M W | OK (Apache-2.0) | Electron app and its own models | app, CLI | 2026-10-09, **archived** | silent | **Do not use** |
| OpenAdapt | A (replay layer) | M W L | OK (MIT) | Python, MCP server | CLI, library, MCP | 2026-11-14 | silent | Later, for recorded workflows |
| Open Interpreter | A | any | OK (Apache-2.0) | Rust coding agent | CLI | 2026-11-15 | n/a | Uses Cua (README) |
| Anthropic quickstart | V | L guest | OK (MIT) | Python in Docker | web app | 2026-11-06 | n/a | Container pattern |
| Lume | V | M host (Apple silicon) | OK (MIT) | Swift CLI and HTTP | CLI, HTTP, MCP | see Cua note | unattended preset disables sleep and lock | **Later VM backend** |
| E2B Desktop | V | cloud Linux | OK (Apache-2.0, metadata) | JS SDK; needs E2B key | SDK | 2026-11-02 | n/a | Hosted; mismatch with local and free |
| Firecracker | V | Linux host only | OK (Apache-2.0) | n/a | n/a | not read | n/a | Not on a Mac |
| Apple Screen Sharing | D (human) | M | built in | outside Outlore | VNC | n/a | not addressed | A person's tool, not Outlore's |
| RustDesk | D (human) | all | `!` AGPL-3.0 | separate app | app | `pushed_at` 2026-11-16 | not addressed | Not in the release path |
| noVNC | D (human) | web | MPL-2.0 | JS | web | not read | server-dependent | Phone view of a VM, later |
| Chrome Remote Desktop | D (human) | M W L | proprietary (inferred) | separate app | app | n/a | not addressed | Not open source |

## 5. Recommendation

**Cua Driver is still the best real-desktop backend, with a caveat, and a view-only remote screen is worth shipping first.**

1. **Keep Cua Driver as the macOS (and later Windows) backend.** It is the only candidate that (a) is MIT and actively released (the newest commit in the Cua repository was a release on 2026-11-16), (b) sends input to a process rather than the global cursor, (c) is a ready stdio MCP server plus a CLI plus an in-process TypeScript SDK, (d) handles the display-idle case itself, (e) refuses keychain and consent prompts, and (f) covers Windows and Linux with one contract. The closest rivals either do the same with less maturity and a Python runtime (mac-cua: Apache-2.0, 35 stars, no activity on `main` since April), or are stale (Ghost OS, last commit March), or ship telemetry and a `Shell` tool (CursorTouch macOS-MCP), or have no licence (mcp-server-macos-use), or are global-pointer libraries with no accessibility tree (robotjs, nut.js). Open Interpreter's README, a different product, also chose Cua for native apps. **The caveat** is the one in the earlier note: the contract is `experimental` at 0.8.0, so pin the version and keep Outlore's `computer_*` interface as the stable seam. If Cua Driver were dropped, **mac-cua** is the nearest drop-in by design, and **Windows-MCP** the strongest Windows-only alternative.
2. **No alternative is a better agent-facing layer than Outlore's own `computer_*` tools.** Every external option is either a third-party MCP server Outlore cannot pass through today, a whole agent that would replace the harness (UFO, Agent S, UI-TARS, browser-use), or a person's remote-desktop tool outside Outlore's approvals (Screen Sharing, RustDesk, Chrome Remote Desktop). The vendor tools (Claude Code's server, Codex's plugin) are closed to `-p` or to the desktop app.
3. **Add Playwright MCP as a separate, cheaper backend for web tasks** behind the same `computer_*` interface, or as a second tool family: it is Node, Apache-2.0 per its metadata, accessibility-tree based, headless-capable, and does not need an unlocked physical display (**inferred**). Most phone requests ("check this page", "fill this form") are web tasks, so this may cover more than the desktop does. It needs the external-MCP capability or a thin Outlore tool wrapper around it.
4. **Ship a view-only screenshot first, with no third-party dependency.** `screencapture` (built in) from the host, sent on demand over Outlore's relay, behind the same lock-and-awake check. This needs Screen Recording for the host binary and nothing else, and carries the privacy and relay questions without the safety ones. It also becomes the "see what the agent sees" image on the approval prompt. **Not recommended first**: a live stream, VNC, RustDesk, or Apple Screen Sharing, which put a second network path and a human-driven remote control outside Outlore's approval model.
5. **The locked and asleep case is Outlore's to build whatever the backend** (§3): a pre-call check (Electron `powerMonitor` exists only in the Electron main process; the host needs its own), a clear refusal ("the host's screen is locked"), and a separate "keep the display awake while threads use the computer" setting. Cua Driver's assertion covers the idle part while a tool is running; manual locking, lid close and fast user switching still need the check.
6. **Containers and VMs stay a later backend** (Lume on a Mac, Docker with Anthropic's pattern on Linux, with noVNC if a phone needs to watch). E2B Desktop is a hosted service and Firecracker has no macOS host, so neither fits a local-first, nearly-free product.

## 6. Open questions for the owner

1. **Web or desktop first?** If most phone requests are web tasks, a browser backend (Playwright MCP) may deliver most of the value before any desktop control. Which tasks do you actually want to start from the phone?
2. **View-only first, agreed?** A screenshot of the host on demand, with no agent action, is the proposed first slice. Should it also appear on every approval prompt?
3. **Second backend as insurance?** Accept Cua Driver as a pinned, separately installed dependency (experimental contract), or require that a fallback (mac-cua) be proven first?
4. **Windows.** Is a Windows host in scope soon? If so, Cua Driver's Windows backend and Windows-MCP should be compared by running both, not by reading.
5. **Remote-desktop tools.** Do you want a person-driven fallback (Apple Screen Sharing, RustDesk) documented as an alternative, knowing it sits outside Outlore's approvals and relay?
6. **nut.js.** Its licence needs reading before any decision; only relevant if a Node-native input library is ever wanted.
7. **Hosted sandboxes.** Is a hosted desktop (E2B) ever acceptable, given the local-data and free-to-run requirements, or is local-only a rule?
8. The earlier note's questions (real desktop or VM, what a phone may do, approval grain, blocked apps, locked-screen policy, platforms, screenshots leaving the computer, who may switch it on) are still open.

## What I did not verify

- Anything by running it: no candidate was installed, built, cloned or executed. No locked-screen behaviour was tested on any backend, and nothing was run on this Mac.
- Whether `screencapture` returns a lock-screen image, a black frame or an error while the Mac is locked or the display is asleep.
- Apple's `CGSessionCopyCurrentDictionary` documentation, Hammerspoon's `hs.accessibility` and `hs.caffeinate` pages, AT-SPI, AppleScript and JXA.
- The licence of nut.js, xdotool and `e2b-dev/infra`; the newest commit SHA of nut.js, robotjs, Hammerspoon, RustDesk, noVNC, ydotool and xdotool; the star count of noVNC, ydotool and xdotool.
- The input mechanism of macOS-MCP (CursorTouch), and whether mac-cua's later `pushed_at` (2026-08-28) holds work that is not on `main`.
- mac-use-mcp, macpilot-mcp, macbeth, macos-computer-use, app-mcp, native-devtools-mcp: found by search only.
- Why UI-TARS-desktop was archived.
- Whether Codex's CLI or app-server has Computer Use; whether Outlore's tool server and adapters carry MCP image content (both carried over from the earlier note).
- Claims about Open Interpreter's use of `cua-driver` beyond its README line "through trycua" (the detail is from one secondary blog post).
- Whether a headless Playwright or container desktop avoids the locked-display problem in practice (inferred only).

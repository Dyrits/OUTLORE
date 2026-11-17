# Cua and computer use: primary-source notes

Researched 2026-11-16. The owner wants computer use as a product capability: Chronicler and its threads operating the remote computer, meaning the host a paired device steers. Cua (`trycua/cua`) is the first candidate. This note is research only; nothing was built, installed, cloned or run.

## Method, and what "primary source" means here

- **Cua**: `https://github.com/trycua/cua` at **commit `5ee5974492839bb3b5a3db8919e3cf517e23ffe3`** (2026-11-16 06:01 UTC, "chore(main): release cua-driver-rs 0.52.4 (#7894)"). Paths below are relative to that repository root at that commit.
- **How I read it**: the G-DRIVE had about 62 MB free, so nothing was cloned. `gh` failed TLS in the sandbox. Every file was read through the WebFetch tool on `raw.githubusercontent.com` and `api.github.com` at that commit. WebFetch runs a small model over the page, so quoted phrases are the file's own words as that tool returned them, **line numbers are not available**, and anything it reported as "not stated" means "not in the part returned", not "absent from the repository". Where a file was long (the tool manifest, 149,603 characters) I read only the first 100,000 characters.
- **Providers**: the vendors' own documentation pages, fetched 2026-11-16 (URLs in each section). No dated commit exists for these, so each claim is as of that day.
- **Outlore**: the working tree at `0a7b8c5fc9b7cb640d421ef8eb88e404b835e985` (`main`, 2026-11-16).
- **Verified** means I read it in the source named. **Inferred** means my own conclusion from verified facts. **Not read** names what I looked up but did not open.

## Question

What is Cua today, how would Outlore's harnesses reach it, what do the model vendors already offer, where would computer use touch Outlore's architecture and requirements, and which of the options (pass an MCP server through, Outlore's own tool, a VM sandbox, something else) fits?

## 1. What Cua is today

### 1.1 Names: the older and newer names disagree

The repository root has no single product; it holds a monorepo with `apps/` (5 Cua Spaces apps) and `libs/` (21 folders: `cua`, `cua-driver`, `cua-spacesd`, `lume`, `lumier`, `cuabot`, `python`, `typescript`, `kasm`, `xfce`, `xfce-cua`, `qemu-docker`, `cua-bench`, `cua-s1`, and others) (`api.github.com/.../contents/apps`, `.../contents/libs`).

`README.md` lists these as current, with language where it is stated: Cua Spaces (macOS app; a Tauri app for Linux and Windows); `cua-driver` (background computer-use agent for macOS, Windows and Linux); the `cua` SDK and CLI (Rust core); `cua` on PyPI (Python); **`@trycua/cua`** (TypeScript, "for Node and the browser"); a Swift SDK ("not yet released"); `cua-sandbox` (Python); `cua-spacesd` (in-sandbox daemon on port 3211); `lume` (macOS and Linux VMs on Apple Silicon); CUA-S1 (small decision models); `cua-bench`.

`README.md` lists these as **deprecated, "no updates or fixes"**: `cuabot` (npm; "the page says not to run it because of known security issues"), the PyPI packages `cua-computer`, `cua-computer-server`, `cua-agent`, `cua-som`, `cua-core`, `cua-bench-ui`, `cua-sandbox-apps`, the npm packages `@trycua/core` and `@trycua/playground`, and `lumier` with several Docker Hub images. Older articles and the `libs/python/` folder (still holding `agent`, `core`, `cua-sandbox`, `som`) describe that deprecated generation, which is why sources disagree.

**The current computer-use driver is Rust.** `libs/cua-driver/rust/` is a Rust workspace (crates `cua-driver`, `cua-driver-core`, `cua-driver-sdk`, `platform-macos`, `platform-windows`, `platform-linux`, `cua-perception`, and others). The repository's most recent commit is a release of `cua-driver-rs` 0.52.4.

### 1.2 Licences (verified: `LICENSE.md`, `legal/LICENSING.md`, `README.md`)

- Root `LICENSE.md` is MIT (Cua AI, Inc., 2025). `README.md`: "Everything outside Cua Spaces and Cua Driver Bench is MIT-licensed."
- **MIT**: Cua Driver (other than the paths below), Lume (including `libs/lume`), the `cua` SDK and CLI, `@trycua/cua`, `@trycua/cua-driver`, `cua-sandbox`.
- **FSL-1.1-MIT (source-available, not OSI-approved)**: the Cua Spaces apps (`apps/*`), **`libs/cua-spacesd`** (the in-sandbox daemon and `cua-relay`), and the Spaces and streaming crates under `libs/cua/crates/` (`cua-media-*`, `cua-viewer`, `cua-keyvault`, `cua-push`, `cua-spaces-*` and others), `libs/cua-driver-bench`. Each release turns MIT after two years. The licensing note says hosted or managed offerings of Spaces need a commercial licence (`COMMERCIAL.md`, not read).
- **AGPL**: `libs/python/som` is AGPL-3.0-or-later; the optional Cua Driver extension `cua-perception` ships an AGPL-3.0-only model artifact (`libs/cua-driver/rust/crates/cua-perception/models/licenses/AGPL-3.0-only.txt`; `libs/cua-driver/README.md` says it "is not MIT licensed").
- **Fit with Outlore (inferred)**: [Fully open source](../requirements.md#licensing) requires an OSI-approved licence for Outlore's own code. Depending on Cua Driver, Lume or `@trycua/cua` (MIT) is allowed. Depending on `cua-spacesd` or Spaces' streaming crates (FSL) would put a source-available component in the release path; avoid them, and avoid `cua-perception`.

### 1.3 Cua Driver: the real-desktop driver

`libs/cua-driver/README.md`:

- "speaks MCP over stdio" and "drives native macOS apps without stealing focus"; runs on macOS, Windows and Linux (X11, Sway, niri, GNOME, KDE, and others; Linux support varies by compositor, `docs/action-support.md`).
- **Entry points**: `cua-driver mcp` (stdio MCP, "used for direct agent connections"), `cua-driver call` (CLI), `cua-driver serve` (daemon), `cua-driver doctor`, `cua-driver permissions grant`. `docs/why-cua-driver-uses-mcp-instead-of-uniffi.md`: the agent's MCP client connects to `cua-driver mcp`, which forwards to a native **daemon**, "the single owner of execution"; MCP "remains the language-neutral agent boundary".
- **SDKs**: Python `cua_driver`; TypeScript **`@trycua/cua-driver`** 0.52.4, MIT (`libs/cua-driver/typescript/package.json`). The TS SDK is "Rust-backed": an in-process native library (`CuaDriver.create(undefined)`, "same process; no daemon"), a `connect(socketPath)` to an installed daemon, and an `EmbeddedCuaDriverHost` that starts a bundled `cua-driver` child process. It has no TypeScript MCP implementation: "Agents should run the executable directly with `cua-driver mcp`" (`libs/cua-driver/typescript/README.md`). Its npm package installs one optional native package per OS and CPU, and does not bundle the executable. macOS 13 or newer; an Electron entry point exists (`@trycua/cua-driver/electron`). The npm packages depend on `@ubjs/core` and `@ubjs/node` (uniffi-bindgen-react-native), 0.31.0-3.
- **Contract status**: `libs/cua-driver/contract/manifest.json` has `contract_version` 0.8.0 and `"experimental": true`, `mcp_protocol_version` `2025-06-18`, `transport` `mcp_stdio`. Treat the interface as unstable. `docs/mcp-protocol-and-skills.md` also says modern MCP revision `2026-07-28` is supported over stdio and the HTTP endpoint supports only the legacy revision.

### 1.4 How it drives a screen (verified)

- **Sees**: `get_window_state` returns a window's **accessibility tree** and an optional **screenshot**; `get_desktop_state` captures the full primary display; `zoom` crops. A PNG is attached as image content in the MCP result; "the harness interprets the image, since Cua Driver does not OCR it"; the tree rows are addressed as `element_token: "<snapshot_id>:N"` (`docs/tool-output-format.md`). On macOS the AX walk "bounds the default walk at 2,000 nodes and depth 25" and window capture is a one-shot `screencapture -l` (`docs/macos-background-input-v1-plan.md`, which is a plan; its status table marks capture and AX scoping "Shipped").
- **Acts**: the manifest lists `click`, `drag`, `hotkey`, `press_key`, `scroll`, `move_cursor`, `invoke_menu`, `clipboard_read`, `clipboard_write`, `list_apps`, `list_windows`, `get_screen_size`, session tools, and more (I read the first 100,000 characters only). The macOS source folder `platform-macos/src/tools/` also has `type_text`, `double_click`, `right_click`, `set_value`, `launch_app`, `kill_app`, `set_window_frame`, `bring_to_front`.
- **Background input, not the foreground cursor**: keyboard goes through `SLEventPostToPid` with a `CGEvent` `post_to_pid` fallback ("process-scoped"); a routed pointer event "does not move the real pointer"; AX actions (`AXPress` and others) are preferred; browsers use CDP; "Background mode never silently crosses to global HID" (`docs/macos-background-input-v1-plan.md`). What works in the background differs per app toolkit and per OS (`docs/action-support.md`: on macOS, Electron background scroll is refused with `background_unavailable`; Windows keyboard in Electron background is refused).
- **Reads the real desktop.** Cua Driver acts on native apps on the logged-in desktop. It is not a VM driver on its own.

### 1.5 macOS permissions and who owns them (verified)

- **Accessibility and Screen Recording** are required (`libs/cua-driver/README.md`; `platform-macos/src/permissions/mod.rs`: "low-level booleans for Accessibility / Screen Recording"). The README names only these two for ordinary use. An existing logged-in Chromium profile additionally needs an explicit `--grant existing-profile`.
- macOS 15's one-time direct screen-capture consent ("<App> is requesting to bypass the system private window picker...") is handled in `platform-macos/src/capture_consent.rs`: implicit captures are skipped, and the error tells the user to run `cua-driver permissions grant` and choose Allow once.
- **The grants belong to the driver's identity, not to the calling agent**: "permission prompts and grants attach to the running driver identity" (`docs/why-cua-driver-uses-mcp-instead-of-uniffi.md`). `cua-driver permissions grant` "opens the installed app, so the system prompts show 'Cua Driver' rather than your terminal" (`scripts/post-install-hints.txt`). The installer puts **`/Applications/CuaDriver.app`** and links `~/.local/bin/cua-driver` into it (`scripts/_install-rust.sh`); it creates **no LaunchAgent** on macOS (autostart exists only for Linux). "Raw `cua-driver serve` outside the bundle is unsupported" (README). Embedding apps must start the daemon from "the process that holds the Accessibility and Screen Recording grants"; launching through "a gateway, terminal, `open`, or `NSWorkspace` changes that responsibility chain" (TS README).
- **It refuses some inputs by design**: input to keychain and administrator-password sheets and the Touch ID panel (`SecurityAgent`, `coreautha`) is always refused; privacy and local-network consent alerts with Allow/Don't Allow buttons are refused; it "only detects prompts and refuses input. It does not answer, dismiss, or type into them" (`platform-macos/src/security_prompt.rs`).
- **Locked or idle displays**: `platform-macos/src/display_awake.rs` holds an IOKit `PreventUserIdleDisplaySleep` assertion while tools run (idle window 600 seconds by default) because "the screen saver and display sleep put the login session behind the lock screen" and "It is not a system-sleep assertion: keeping the machine awake is not enough". It never wakes a display or unlocks.

### 1.6 Cua's own approval design (a plan, not shipped)

`docs/driver-permission-modes-and-consent-plan.md` describes itself as a "Reviewed draft... not yet a plan of record". Modes: `standard` (default; the human is asked at defined boundaries: a logged-in browser profile, first access to sensitive resources, consequential actions such as sending messages or purchases, scope changes), `autonomous`/`bounded` (one approval of a session manifest of apps, profiles, origins and tools), `unrestricted` (launch-time flag the agent cannot set). Approvals go through a daemon-owned broker to "a protected approval UI rendered by a recognized host client, outside the model's tool stream"; "Generic MCP elicitation is not trusted for consent". Its stated limit: the daemon protects only against agents limited to its protocol; "An agent with arbitrary code execution as the same OS user can bypass it unless an external boundary, such as a separate service identity, sandbox, or VM, separates them." The TS README says today's `standard` mode "is promptless" (only the logged-in browser profile needs a `DriverAuthorizationHost`). So **today Cua Driver asks nothing about clicks; the host (Outlore) would own approval**.

### 1.7 The VM side: Lume and the `cua` SDK

- **Lume** (`libs/lume`, MIT, Swift 6, minimum macOS 14 in `Package.swift`): "CLI and framework for macOS and Linux VMs using Apple Virtualization Framework." `docs/content/docs/lume/index.mdx`: host "Apple silicon, macOS 13 or later"; "Up to two macOS guests at a time (Apple's limit)"; "50 GB free per macOS guest plus its restore image"; control options are the `lume` CLI, a local HTTP API, "An MCP server for AI clients". Unattended presets (`sequoia`, `tahoe`) "create a `lume` user, enable SSH, configure autologin, and disable sleep and screen locking" (`libs/lume/README.md`). The Lume README says nothing about screenshots or clicks; what drives a Lume guest's screen is not stated there (the `cua` SDK and Cua Driver inside a guest are the likely route; **not read**).
- **`cua` SDK** (`libs/cua`, MIT, Rust core with UniFFI bindings; `@trycua/cua` 0.27.7 for Node and the browser): `cua-vmm` "starts `lume serve` on macOS, fetches QEMU when it's missing, and runs container images with Docker/Podman and gVisor `runsc`". A sandbox can be created from images such as `linux`, `windows:2022`, `macos:26`. Its in-sandbox services (shell, files, desktop, streams) "need cua-spacesd", which is FSL (§1.2). Its MCP client helpers (`sb.mcp`, `sb.mcp_config`) need no `cua-spacesd`. I did not find the screenshot and click methods in the README excerpt I read.
- **Not read**: `libs/xfce`, `libs/xfce-cua`, `libs/kasm`, `libs/qemu-docker`, the Python `cua-sandbox` API, the `cua` docs site.

## 2. How agents reach computer use

### 2.1 Cua Driver and Outlore's three harnesses

- Cua Driver offers three agent surfaces: stdio MCP (`cua-driver mcp`), CLI (`cua-driver call`), and an in-process SDK (§1.3). `scripts/post-install-hints.txt` names the supported MCP clients: "`connect` to link Claude Code and Codex (and Cursor...). For OpenCode, run `{{BINARY}} mcp-config --client opencode` and apply the output." The README gives `claude mcp add --transport stdio cua-driver -- cua-driver mcp`.
- **But Outlore does not pass such a server today (verified in code).**
  - Claude Code: started with `-p --input-format stream-json --output-format stream-json`, `--strict-mcp-config`, `--setting-sources ""`, and `--mcp-config` holding only Outlore's own tool server (`packages/service/src/harness/claudeArgs.ts`: the arguments at lines 24-48 and `mcpConfig` at line 202; the comment at line 20 says "built-in tools only, none of the owner's MCP servers, skills, or settings").
  - Codex: only `mcp_servers.<tool server>.url` is set (`codex.ts:75-79`).
  - OpenCode: `mcpServers: []` in `session/new` and `session/load` (`opencode.ts:367-379`) and one `mcp.servers` entry for Outlore's tool server (`opencode.ts:152-165`).
  - The specification states "Outlore-managed external MCP configuration... not built" (`documentation/capabilities/tool-and-skill-loading/specifications.md:9`). So option (a) below depends on a capability that does not exist yet.
- **Not verified**: how an external MCP tool call is asked of the owner at the default approval level. `claudeArgs.ts:177` lists "an MCP tool" among the asks a `can_use_tool` request can carry, and `action-approval/specifications.md` says a harness's own permission request is decided "from where the action runs"; it has no rule for an MCP tool that acts on the real desktop, which no sandbox contains.

### 2.2 What each harness and provider already offers

| Source | What it is | Reach for Outlore |
| --- | --- | --- |
| Claude Code CLI (`https://code.claude.com/docs/en/computer-use.md`) | Built-in MCP server `computer-use`, off until enabled in `/mcp`. macOS only; Pro, Max or Ultra plan; claude.ai sign-in (not Bedrock, Vertex or Foundry). "It requires an interactive session, so it is not available in non-interactive mode with the `-p` flag." Accessibility and Screen Recording. Per-app approval each session ("Allow for this session"); warnings for apps with shell or file reach; browsers view-only, terminals and IDEs click-only; hides other apps while it works; **one session at a time holds a lock**; Esc stops it. "computer use runs on your actual desktop". | **Not usable by Outlore as built**: Outlore starts Claude Code with `-p` (§2.1). |
| Codex desktop app (`https://learn.chatgpt.com/docs/computer-use`, redirected from developers.openai.com) | Computer Use in the ChatGPT desktop app, macOS and Windows. Screen Recording and Accessibility. Asks per app; "Always allow" per app. On macOS it can run a scoped task in the background; on Windows it runs in the foreground. Optional **locked use** installs an Apple authorization plug-in and temporarily unlocks the Mac during trusted turns. "can't automate terminal apps or ChatGPT itself", cannot approve security prompts. | The page does not say whether it exists in Codex's CLI or app-server, which Outlore drives (`codex.ts`). **Unknown; not verified.** |
| Anthropic API (`https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool.md`) | Client toolset `computer_toolset_20260801` (17 member tools such as `screenshot`, `zoom`, `left_click`, `type`, `key`, `scroll`, `wait`; no beta header) on Fable 5.2, Mythos 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5. Earlier `computer_20251124` (beta header `computer-use-2025-11-24`) on Opus 4.7, 4.6, Sonnet 4.6, Opus 4.5. "Your application runs the blocks in order on your own environment"; screenshots come back as images (up to 2,576 px on the long edge for the newer models). The page recommends a dedicated VM or container, no sensitive data, an allowlist, and "A human confirming consequential actions"; its reference environment is Xvfb plus Mutter in Docker. For web-only tasks it recommends the browser use tool. Not in Claude Managed Agents. | A model tool whose actions the caller executes. Outlore drives the Claude Code CLI, not the API, so Outlore cannot send this tool itself without bypassing Claude Code ([0008](../architecture-decision-record/0008-drive-harness-tools-directly.md)). Useful only as the model contract behind Claude Code's own server. |
| OpenAI API (`https://developers.openai.com/api/docs/guides/tools-computer-use`) | `tools: [{ type: "computer" }]`; the model returns a `computer_call` with an ordered `actions` array (click, double_click, drag, move, scroll, keypress, type, wait, screenshot); the caller returns a `computer_screenshot` via `computer_call_output`. Environments: your own browser or desktop, OpenAI-hosted browsers, partner environments (Browserbase, Browser Use, Daytona, E2B Desktop). A "Migration from computer-use-preview" section exists; no explicit deprecation statement. Safety guidance: isolated VM or browser, confirm consequential actions, bound steps, time and cost. | Same: an API contract; Codex's own use is the app feature above. |
| Gemini API (`https://aistudio.google.com/docs/computer-use`, redirected from ai.google.dev) | Tool `"type": "computer_use"` with `"environment"` of `"browser"`, `"mobile"` or `"desktop"`; normalised 0-999 coordinates; a `safety_decision` whose `require_confirmation` outcome means "prompt the end user" and is answered with `safety_acknowledgement`. Supported models listed today: `gemini-4-carbon`, `gemini-4-argon`, `gemini-4-hydrogen`, `gemini-3.8-flash`, `gemini-3.5-flash-lite`, `gemini-3-flash-preview`. | Outlore's price table lists `gemini-2.5-computer-use-preview-10-2025` at input 1.25 and output 10 (`packages/service/src/core/priceSnapshot.ts:62-67`). That model is **not** in the list the Gemini page returned today (the page also says Gemini 3.x and 4 have the tool built in, per the earlier model page; **inferred** that the price row is for a model now superseded). Outlore has no Gemini harness. |

**The pattern, verified across all five pages**: the vendors' own products ask the user per app, run on the real desktop with Accessibility and Screen Recording, and recommend a VM or container for anything risky.

### 2.3 Anthropic, OpenAI and Google all assume the caller executes the actions

In every API above, the vendor's model emits actions and "your application" performs them and returns screenshots. An agent harness that wants this either ships the executor itself (Claude Code's built-in server, Codex's plugin) or consumes an MCP server that does (Cua Driver). Outlore ships neither executor.

## 3. Fit with Outlore

All of these are about Outlore as documented in `documentation/architecture.md`, `requirements.md`, ADRs 0005, 0008, 0012, 0017, 0018, 0020, and the action-approval specification, at `main` of 2026-11-16.

| Topic | What exists (verified) | What computer use touches (inferred unless marked) |
| --- | --- | --- |
| **Harness access** | Claude Code, Codex and OpenCode receive only Outlore's tool server (§2.1). Thread tools are one catalogue, "each tool is defined once... whether a thread uses it without asking the owner" derived from it (`work/threadTools.ts:7-11, 22`; [0005](../architecture-decision-record/0005-thread-tools-over-mcp.md)). | Computer-use tools could be added to that same catalogue and reach all three harnesses with no new MCP plumbing. A pass-through of a third-party server needs the unbuilt external-MCP capability. Screenshots must cross as MCP image content; I did not check that the tool server and each harness's adapter pass images (Cua's results carry PNGs, `docs/tool-output-format.md`). |
| **Approval per action** ([requirements](../requirements.md#safety)) | "A risky action runs only after the user's approval or under a standing permission... A single approval never carries over to another action or another thread." The default level is sandbox-first: "Outlore judges no command by its words" (`action-approval/specifications.md:13`). Capabilities are named ("Run outside the sandbox", "Change a file outside the workspace"); Always allow is per exact action (spec lines 17 and 51). | A click on the real desktop is not contained by any sandbox, so it needs its own capability, for example "Control the app *X*" with Always allow per app, as Claude Code and Codex both do (§2.2). A per-click question would be unusable; a per-app, per-turn grant fits the existing "capability" wording. Outlore's own rule that an approval never carries over to another thread would mean each thread asks again for the same app unless the owner chooses Always allow. The approval needs the screen content (a screenshot) to be answerable from a phone. |
| **Sandbox model** | Claude Code and Codex run commands in their own sandboxes, OpenCode in Outlore's Seatbelt profile; the sandbox "contains damage to this computer's files and processes; it does not contain data"; sandboxed commands cannot see processes outside it (spec line 13). | Computer use runs *outside* every one of these (Claude Code's docs say so in as many words, §2.2). An agent that can click on a real Terminal, Finder or System Settings window can leave the sandbox without any escape request. Claude Code and Codex both mark terminals and IDEs as click-only or off-limits for this reason. The owner should know that turning on real-desktop computer use removes the sandbox's value for that thread. Cua's own consent plan reaches the same conclusion (§1.6). |
| **Host runs on its own** ([0018](../architecture-decision-record/0018-host-service-runs-on-its-own.md)) | A login service runs the host as the owner; "while nobody is logged in the host does not run, which the owner accepted"; the sleep setting holds an idle-sleep assertion ("what `caffeinate -i` does"). | Computer use needs a logged-in, unlocked, awake *display*. Cua says a system-sleep assertion "is not enough" and ships a separate display-idle assertion; Codex's locked use installs an Apple authorization plug-in to unlock the Mac, which is a larger step than anything in 0018. A Mac mini host with a locked screen could run threads but not computer use. A "keep the display awake" setting, and a clear refusal when the screen is locked, would be needed. |
| **Who holds the macOS grants** | The host runs "on the desktop app's own binary as Node (`ELECTRON_RUN_AS_NODE`)" ([0018](../architecture-decision-record/0018-host-service-runs-on-its-own.md)); harnesses are children of the host. | Grants attach to the driver's identity and its responsible process (§1.5). Two choices: the owner grants `CuaDriver.app` once (`cua-driver permissions grant`) and the host talks to its daemon, or Outlore's own app holds Accessibility and Screen Recording and spawns the driver. The first needs nothing from Outlore but a second app; the second ties the grants to Outlore's signing identity, which this repository's updater replaces on each release (grant loss on update is a risk I did not check). A host started by a login service has no window to show a permission prompt. |
| **No Rust** ([0017](../architecture-decision-record/0017-typescript-and-effect-no-rust.md)) | "Iskios's own code stays TypeScript with Effect"; the Rust option was rejected for Outlore's host. | Cua Driver is a Rust binary used as a separate program, so Outlore's own code stays TypeScript. 0017 speaks of Outlore's code, not its dependencies (inferred). Shipping, signing and updating a third-party Rust binary is a new release concern. The TS SDK is a native addon, a precedent being `node-pty` in [0020](../architecture-decision-record/0020-terminals-run-in-the-host.md). |
| **Paired devices see the screen** | Paired devices reach the host through one shared Cloudflare relay on the owner's free account, end-to-end encrypted ([0003](../architecture-decision-record/0003-per-user-relay-carrying-all-traffic.md), [0016](../architecture-decision-record/0016-shared-relay-on-the-owners-free-cloudflare-account.md)); [Nearly free to run](../requirements.md#budget) must hold for one user. | Screenshots on demand fit; a live stream would not be shown to fit the free tier (not measured). Cua's streaming (`cua-media-*`, `cua-spacesd-html5`) is FSL; do not adopt it. Viewing the screen is a separate capability from letting an agent act, and could ship first (§5). |
| **Local data** ([requirements](../requirements.md#privacy-and-data)) | Nothing leaves the computer "except what a harness, provider, or connected service needs for the work". | A screenshot of the owner's desktop goes to the model provider on every step and may show other apps, notifications and private data. Claude Code hides other apps and excludes its terminal for this reason (§2.2). The privacy text and the approval prompt should say so. Screenshots stored in a thread's turns also grow the database. |
| **Budget** | The host totals spending per quest, realm and period from the harness's reports. | Screenshots are large inputs: Anthropic's newer models accept up to 4,784 visual tokens per image (§2.2). Computer-use threads will spend far more per turn than coding threads. No change needed in the budget module (inferred), but the owner should expect it. |
| **One desktop, many threads** | Outlore runs threads in parallel. | A real desktop has one pointer and one focus. Claude Code takes a computer-use lock per session; Codex runs several agents "in parallel" through background input. Cua's background routes help for some apps only (§1.4). Outlore needs a host-level lock or queue so two threads do not click at once. |
| **Guests** ([future multiplayer](../architecture.md#future-multiplayer-open-architecture-questions)) | "Only the host approves risky actions... Guest permission to trigger agents does not grant approval." | A guest must never be able to start real-desktop computer use or answer its approval. Keep it host-only and off for shared quests. |
| **No feature only in Electron** ([Same features in every app](../requirements.md#access)) | Terminals moved to the host for this reason ([0020](../architecture-decision-record/0020-terminals-run-in-the-host.md)). | Computer use belongs in the host service, not the Electron main process, so the web app and paired devices have it. |
| **Windows and Linux hosts** | Terminals from paired devices stay off where no sandbox exists (Windows) ([0020](../architecture-decision-record/0020-terminals-run-in-the-host.md)). | Cua Driver supports them unevenly (Windows background input is largely refused for Electron; Linux per compositor, §1.4). A first version should be macOS only. |

## 4. Options and recommendation

### (a) Pass an existing MCP computer-use server through to the harnesses

Add Cua Driver (or any MCP computer-use server) as an external MCP server to every thread.

- **Cost**: needs the unbuilt external-MCP capability (§2.1). Claude Code's built-in server is unusable (needs interactive mode). Approval depends on each harness's own prompt and on how an unsandboxed MCP tool call is asked, which is **unverified** (§2.1). Each harness would see a different tool set. Cua's interface is marked experimental (§1.3).
- **From a phone**: the owner sees only the harness's question text, with no screenshot unless added.
- **Verdict**: cheapest to demonstrate, hardest to make safe.

### (b) Outlore's own computer-use tools in the host

Add `computer_*` tools (screenshot, click, type, key, scroll, list apps) to Outlore's tool catalogue, so all three harnesses get them from the tool server they already use. The host executes them. The backend can be Cua Driver (MIT) as a separate program the host drives through `cua-driver mcp` or its TS SDK, so Outlore writes no native input code.

- **Cost**: a tool definition set and a host module (lock, approval, screenshot handling, display-awake, permission check); a dependency on `CuaDriver.app` being installed and granted; later a Windows or Linux backend. Approvals are Outlore's own: a per-app capability, answerable from any device with the screenshot attached. No Rust code in Outlore (§3).
- **From a phone**: ask a thread to open an app on the Mac mini, click through it, and report; the phone shows each approval with what the agent sees and can stop the thread.
- **Verdict**: **recommended.**

### (c) Cua's VM sandbox as the place the agent works

Run the agent's desktop inside a Lume macOS or Linux guest (or a Docker/Xvfb container as Anthropic's reference does), not on the owner's desktop.

- **Cost**: Apple silicon host; "50 GB free per macOS guest plus its restore image", at most two macOS guests (`docs/content/docs/lume/index.mdx`); guest setup and updates; no access to the owner's own apps and logins, which is both the point and the limit. The G-DRIVE cannot hold a guest image (62 MB free); the images would live in a different volume. The in-guest control parts of the `cua` SDK lean on `cua-spacesd` (FSL), so Outlore would need its own route into the guest (SSH is preset in Lume's unattended mode; **not verified** as sufficient to click).
- **From a phone**: work in a throwaway computer: browse, test apps, try risky things, with no sandbox escape and no privacy leak. It does not let the owner operate the Mac mini they own.
- **Verdict**: the right place for untrusted or risky work and a natural later backend for (b). It is not the stated goal.

### (d) Other

- **Browser-only** (Playwright, Claude in Chrome, a browser use tool): Anthropic itself recommends the browser tool for web-only work (§2.2). Much safer and cheaper than a desktop. It covers a lot of what an owner wants from a phone.
- **View-only remote screen**: a screenshot of the host's display, on demand, over the relay, with no agent action. Separate from agent computer use; useful alone and a prerequisite for phone approval.
- **Wait for Claude Code's `-p` support** or Codex's app-server support. Unknown dates; not dependable.

### Recommendation

Build (b), macOS only, in steps, and keep the backend replaceable:

1. **Spike, outside Outlore, before any specification**: on the owner's Mac, install Cua Driver by hand and drive it from an interactive Claude Code or Codex session. Check quality, speed and how often permission prompts and locked screens get in the way. This costs nothing in the repository.
2. **View-only host screenshot** to a paired device (the privacy and relay questions without the safety ones).
3. **Outlore's `computer_*` tools** with the host as executor and Cua Driver as the backend: off by default, a per-app capability with Always allow per app, a host-wide lock, a "keep the display awake while threads use the computer" setting, host-only (no guests), disclosed in the privacy text.
4. **A VM or container backend** for risky work behind the same tools, once the owner has used step 3.

Write a specification and an [ADR](../architecture-decision-record/) before step 3, because the sandbox-first model changes (§3).

## 5. Open questions for the owner

1. **Real desktop or a throwaway computer?** The stated goal is the host's own desktop, which the sandbox cannot contain; the safe version is a VM or container. Which first, or both?
2. **What should a phone be able to do?** Only look at the screen, approve what an agent does, or take the mouse and keyboard itself? Only the second is a remote-desktop product.
3. **Which approvals?** A grant per app per thread, per app for good (Always allow), or per action? Should Terminal, Finder, System Settings and browsers be blocked, view-only or click-only as Claude Code does?
4. **Locked or sleeping Mac mini?** Is a host with a locked screen acceptable to refuse, or should Outlore keep the display awake (and never unlock it)? Codex's unlock plug-in is a larger step that I would not copy without a decision.
5. **Which platforms?** macOS only first? Windows and Linux backends are uneven (§1.4).
6. **How much to depend on Cua?** The driver is MIT but experimental and moving fast (0.52.4; `contract_version` 0.8.0). Accept a pinned external dependency installed separately, or require a path that Outlore owns?
7. **Screenshots leave the computer to the provider.** Is that acceptable in the privacy text, and should a thread's screenshots be kept or dropped after each step?
8. **Who may switch it on?** Host only, as the terminals switch is ("Allow terminals from paired devices")?
9. **Codex and Gemini.** Do you want Codex's own computer use investigated for its app-server (the page was silent), and is a Gemini harness planned (the price row for `gemini-2.5-computer-use-preview-10-2025` looks superseded)?

## What I did not verify

- The tool manifest beyond its first 100,000 characters, `platform-macos/src/terminal.rs`, `libs/xfce*`, `libs/kasm`, `cua-sandbox`, and the Cua docs site.
- Anything by running it: no permission prompt, tool call, install or VM was run.
- Whether Outlore's tool server and each adapter can carry MCP image content, how an external MCP tool call is asked at the default approval level, and whether macOS grants survive an Outlore app update.
- Codex's computer use outside the desktop app.

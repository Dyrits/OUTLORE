# Outlore

A local-first desktop workspace for working with AI agents across twelve harnesses: Claude Code, Codex, OpenCode, Mistral Vibe, Hermes, Muse, Pi, Cursor, GitHub Copilot, Cline, Devin, and Gemini (Antigravity).

Keep a piece of work in one quest, delegate parts of it into errands, and choose the harness, model, account, and effort for each thread.
Follow quests and errands side by side in conversation panes, answer approval requests from one Chronicle, and hand a thread over to another harness with its history intact.

Outlore is in **alpha** (currently 0.2.3-Pre-Alpha) and serves one user.
Until the first stable release, what you save (settings, quests, accounts) is not guaranteed to carry over from one release to the next; each release's notes list its breaking changes.
Open **Workshop → Remote access → Pair a device** on the host to use it from another desktop app, a web browser, or the Android app through an end-to-end encrypted relay.
Push notifications, multiplayer, daily background check-ins, computer use, and Craft workflow automation remain planned work.
See the [work in progress](documentation/work-in-progress.md) for current verification and unfinished acceptance checks.

[Download installers](https://github.com/Dyrits/OUTLORE/releases) · [Report an issue](https://github.com/Dyrits/OUTLORE/issues) · [Documentation](#documentation)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="documentation/readme/quest-dark.png">
  <img alt="A quest in Outlore: the realm and quest tree on the left, a conversation handed over from Claude Code to Codex in the middle, and the quest's context, journal, and lore on the right." src="documentation/readme/quest-light.png">
</picture>

## A task, not a bot

Moving from one project to another, you rarely need the same context, the same memory, or the same model.
Outlore starts from the task instead of from an agent with a role.

Each piece of work is a **quest**, with its goal, its journal, its lore, and its tree of conversations.
A thread can open errands, each with the model and effort that suits it.
The model is a choice, not an identity.

Lore has a scope: one quest, one realm, or the whole application, and each thread receives the context that matches it.
A **realm** is a workspace, tied to a local folder or repository or to none, and has its own conversation, its channel, where its quests unfold.
Quests in no realm live in the **Borderlands**.

## See it work

The recordings below, and the screenshot at the top of this page, come from the real application at version 0.1.1-Prototype.
The window has changed since: quests and errands now open side by side in conversation panes, and the default Islands layout floats each pane as a card.
The behavior they show is still how Outlore works.
The agents' replies are scripted, so the demonstration runs without a provider account.

### A terminal in the conversation

Type `!` in the message box to open a shell in the quest's folder.
Its output goes with your next message as context.
The shell runs in the host's service, so a paired device can open one too, inside the host's sandbox, once the host allows it.

![Typing ! opens a shell; bun test fails by one cent, and the output is sent to the agent with the message.](documentation/readme/terminal.gif)

### Errands with their own Companion

Open an errand beneath any quest and give it another model and effort.
It reports back to its parent when it is done, and its reply line in the quest shows its state and latest exchange.

![An errand opened on Sonnet 5.5 at medium effort writes the tests and reports back to the quest running on Opus 5.5.](documentation/readme/side-quest.gif)

### Switch agents mid-conversation

Change the harness, model, or effort between turns.
The conversation goes with it, and each reply keeps the name of the model that wrote it.

![The quest moves from Claude Code to Codex; the next reply comes from GPT-5.5 with the whole conversation.](documentation/readme/switch-companion.gif)

### Backup Companions

List the Companions a thread falls back to when a turn fails, on any harness.
The next one takes over with the conversation so far.
Save a Companion and its backups as a preset to pick them together next time.

![A Codex backup is added; Claude Code hits its usage limit, and the thread falls back to Codex, which writes the release notes.](documentation/readme/backup-companion.gif)

### Quests that reference and call each other

Mention a quest, an errand, a realm, or a file with `@` so that a thread can read its journal or write to it.
The other quest answers back when it has news.

![Release 2.4 mentions Fix checkout rounding, reads its journal, and asks to be told once the fix is merged; the other quest replies.](documentation/readme/mentions.gif)

### Chronicler

Chronicler is the assistant you tell what you need, in a realm's channel or in the Borderlands.
It finds the quest that already covers the request and offers to continue there, or proposes a new one.

![Chronicler suggests continuing in Fix checkout rounding, forwards the request, and the quest answers.](documentation/readme/iskios.gif)

## New since these recordings

These features arrived after the recordings above; they have no recording yet.

### Conversation panes

A realm, its quest, and the quest's errand open side by side, up to three panes at once.
Fold a pane into a notch on its neighbour's edge, expand one to the full width, or drag the edges between them; the sidebar floats over the panes or stays pinned, on either side.
Each pane has its own tabs: **Missives** (the conversation), **Quests** or **Errands**, the quest's details, and **Companions**.
On a phone, one pane shows at a time, with Back returning to the channel, tab, or Chronicle you came from.

### Reply to start work

Reply to a message in a realm's channel to start a quest from it, or to a message in a quest to start an errand with that message as context.
The new conversation hangs beneath the message as a reply line, the way a thread does in a chat app.
Comment on a message, or on a passage of it, to hold a note for your next message instead.

### The Chronicle

One feed, with an unread badge, gathers replies, results, failures, and the requests waiting for you across every realm and the Borderlands.
**Needs attention** keeps an approval or a question until you answer it, and **History** records quest openings and moves.
Opening an entry takes you to the message or request in its pane.
A quest left in Attention for four hours, or Resting for twelve, gets a linked reminder in its realm's Missives.

### Permission modes

Choose how much a thread may do on its own: **Supervised**, **Auto-accept edits**, **Auto**, or **Full access**.
Set a default in the Workshop and change any thread's mode from its composer, even during a turn.
Outlore's own approvals, such as publishing or sending, still ask in every mode.

### Rituals in the realm

A Ritual is a scheduled instruction that lives in its realm beside the quests.
Each run is an errand beneath it, so its conversation is the run history; **Run now** starts one on the spot.
Create one with **+ Ritual**, with **Schedule as a Ritual** from an open quest, or by asking a thread.

### Connectors

Install a connector once from the Workshop, connect it, and enable it for a realm, the Borderlands, or a quest.
Composio and Apple's Calendar, Reminders, Notes, Contacts, Mail, Messages, and Safari are offered.
Their keys stay in the Vault, encrypted and hidden from the harnesses' sandboxes.

## What you can do

### Quests and conversations

- Start or continue quests through Chronicler, which routes your requests to the right quest and asks before opening one.
- Open errands beneath a quest, give them different models, and exchange messages along the tree.
- Follow a realm, a quest, and an errand side by side, and switch to another quest or errand from its title.
- Find text in a conversation's history and jump between matches.
- Keep a shared briefing and journal for each quest, and save lore at quest, realm, or global scope.
- Mark a quest or errand done, reopen it, or archive it from its header or its list.
- Paste, drop, or choose images for a message, dictate a message offline with the microphone on desktop, and use `!` to open a shell and send its output as context.
- Use skills from existing skill folders by typing `/` in a message, and complete a skill's name with Tab.
- Steer a running turn with a new message, or queue it for the next turn and revise it while it waits.

### Companions and harnesses

- Work with twelve harnesses in the same application, using your own subscriptions or API keys through their command-line tools.
- Install a missing harness from **Workshop → Providers** and sign in to it there; the list shows only the harnesses you have, with **Install another provider** for the rest.
- Change a thread's harness, account, model, or effort between turns without discarding its conversation.
- Pick a Companion by its provider account (two subscriptions of one harness appear as two options), or apply a preset, which sets a Companion and its backups together.
- Use the Light, Balanced, and Heavy presets or make your own, and save a thread's current Companions as a new preset.
- See file changes as diffs, whatever harness made them.

### Realms and folders

- Visit a new realm from a local folder, a new Git project, a Git URL, or a GitHub repository, or make an empty realm with no folder.
- Choose folders with one folder picker, on this computer or on a paired host.
- Let a thread work in its own Git worktree that Outlore makes (own copy); a merge button for an own copy is agreed but not built yet.

### Control and spending

- Review action approvals, answer a thread's choice questions, and grant removable standing permissions.
- Set quest, global, and account budgets, and follow usage and reported plan limits in Reserves.
- Schedule Rituals with fallback Companions and a manual Run now.
- Turn on Code Mode (experimental) to let threads call connector and thread tools by running short pieces of code.

### Look and devices

- Choose a theme (One, Iskios, Black & white, or Slate), each in a dark and a light look, and the Islands or Flat layout, with Islands' canvas, gap, radius, and lift.
- Pair another desktop app, a web browser, or the Android app with a host, and keep the installed app up to date from the Workshop.

The interface uses guild names for familiar concepts:

| In Outlore | Meaning |
| --- | --- |
| Quest | A piece of work and its tree of threads |
| Errand | A thread opened beneath another thread |
| Companion | The model selected for a thread |
| Preset | A named Companion with its backups, chosen as a whole (Light, Balanced, Heavy, or your own) |
| Realm | A workspace folder or repository, or none, with its own channel and lore |
| Borderlands | The place for quests in no realm |
| Chronicler | The assistant that opens and coordinates quests |
| Chronicle | The feed of updates and requests across every realm |
| Missive | A message in a conversation, as a pane's Missives tab lists them |
| Ritual | A recurring instruction on a schedule, kept in its realm |
| Workshop | Application settings, opened from the gear in the desktop top bar or the Workshop row on a narrow screen |
| Attention | A thread needs your attention |
| Resting, Underway, Fulfilled | A thread waiting for your turn, at work, or done |

The [glossary](documentation/glossary.md) explains the full vocabulary and the technical names used in the code.

## Install and start

Download an installer from [GitHub Releases](https://github.com/Dyrits/OUTLORE/releases); every release so far is a prerelease.
Manual builds are also available from the **Artifacts** section of the [desktop workflow](https://github.com/Dyrits/OUTLORE/actions/workflows/package.yml); these expire after 14 days.

| Platform | Build | Installer |
| --- | --- | --- |
| Android | Phones with a 64-bit ARM processor (arm64-v8a) | `.apk` |
| macOS | Apple Silicon (arm64) or Intel (x64) | `.dmg` |
| Windows | x64 | `.exe` (NSIS) |
| Linux | x64 | `.AppImage` |

From 0.1.2-Prototype on, the installed app finds new releases and updates itself (earlier releases cannot): it looks at start and every 6 hours, downloads in the background, and installs only when you press **Restart and update** in the notice or in the Workshop's **Updates** section, where you can also turn checking off.
The macOS updater checks GitHub's public release list and identifies itself by app name and version.
On macOS, a prerelease build can find prereleases and a stable build follows stable releases.
On macOS Outlore replaces its own app after checking the download against the release's `SHA512SUMS.txt`; on Windows and Linux it uses `electron-updater`, which has not been run on those systems yet.
Since 0.1.9-Prototype, the Android app checks the same release list and downloads the APK in the background.
On mobile data it waits for **Download anyway**.
It checks the download against `SHA512SUMS.txt` before offering **Install update**.
Android then asks you to confirm and accepts the update only when it is signed with the same key as the installed app.
A development run (`bun run dev`) never updates.

Before uploading a macOS installer, the workflow verifies and mounts its DMG, copies the app to a fresh location, and checks the rendered sidebar, service bridge, and native terminal on temporary data.
Run that same application check locally with `bun apps/desktop/scripts/check-package.ts /Applications/Outlore.app`.
This check proves packaged startup; Apple trust checks on other computers still require Developer ID signing and notarization.

If the Dock icon keeps bouncing without a window, a stale macOS launch-block decision can survive Open Anyway and re-signing.
Outlore's observed case was resolved with a fresh byte-identical copy, preserving its new file identity when moving it into Applications; see the [diagnosis and verified recovery procedure](documentation/verification/2026-11-10-dmg-launch.md).
Cross-platform builds still need smoke-testing on their target systems.

### macOS

Outlore does not yet have an Apple Developer ID signing certificate or Apple notarization.
The macOS build has an ad hoc signature, which does not identify a trusted developer to Gatekeeper, so macOS may block the first launch.
This is separate from the source-code [license](#license).

1. Download the `.dmg` for your Mac: `arm64` for Apple Silicon or `x64` for Intel.
2. Open the DMG and drag Outlore into Applications.
3. In Finder, open Applications, Control-click Outlore, and choose **Open**; confirm if offered.
4. If macOS blocks it, open **System Settings → Privacy & Security**, find the message about Outlore, and click **Open Anyway**.
5. Confirm **Open** in the next dialog, authenticating if asked.

If the app remains blocked and you trust the copy downloaded from this repository's releases or workflow artifacts, open Terminal and remove its quarantine attribute:

```sh
xattr -dr com.apple.quarantine /Applications/Outlore.app
```

Then open Outlore from Applications again.
This command removes the download quarantine flag from Outlore only; it does not sign, notarize, or verify the app.
If macOS reports damage, download a fresh copy first; a damaged-app warning can also indicate a corrupted or modified download.
See [Apple's Gatekeeper guidance](https://support.apple.com/en-us/102445) for details.

### Windows

Run the `.exe` installer.
Windows builds are unsigned, so SmartScreen may show **Windows protected your PC**.
If you trust the downloaded installer, choose **More info → Run anyway**.
If the file remains blocked, right-click it, open **Properties**, select **Unblock** if available, apply the change, and try again.

### Linux

From the folder containing the downloaded AppImage, make it executable and launch it:

```sh
chmod +x Outlore-*.AppImage
./Outlore-*.AppImage
```

### First launch

The desktop installer includes the interface and local service.
**Workshop → Providers** lists the harnesses already installed; choose **Install another provider**, then **Install** beside the one you want, and sign in to it.
Install runs the provider's own installer on the host and checks that its executable is there afterwards:

| Installed with | Harnesses | Needs |
| --- | --- | --- |
| npm | Claude Code, Codex, OpenCode, Pi, GitHub Copilot, Cline | Node.js and npm with a writable global installation folder |
| uv | Mistral Vibe | `uv` |
| The provider's install script | Hermes, Muse, Cursor, Devin, Gemini (Antigravity) | Bash and curl |

Outlore looks for `claude`, `codex`, `opencode`, `vibe-acp`, `hermes`, `muse`, `pi`, `cursor-agent`, `copilot`, `cline`, `devin`, and `agy` (or `antigravity`) on your `PATH`, so you can also install them yourself.
You only need the harnesses you intend to use.
Harnesses other than Claude Code, Codex, OpenCode, and Mistral Vibe use the computer's own sign-in only, and their live checks against installed tools are still pending.

1. Open Outlore and visit the Workshop to check harness availability and accounts.
2. Visit a new realm if you want agents to work in a local folder or repository.
3. Tell Chronicler what you want to do in the realm's channel or the Borderlands, then open the quest it creates or continues.
4. Choose a Companion or a preset, send a message, and open errands as needed.

Rituals run through the local service, so leave Outlore running for scheduled work.
When the service comes back, it skips runs that are more than five minutes overdue.

## Data and provider use

Outlore stores its application data locally, with a `outlore.sqlite` database in Electron's user-data folder and supporting files alongside it.
Workspaces remain in their chosen locations.
Connectors' keys are kept encrypted in the Vault, whose folder the harnesses' sandboxes cannot read.
The desktop interface communicates with the local service over an authenticated loopback connection.
Traffic between a paired device and its host passes through a relay Worker as ciphertext, with the pairing keys carried in the pairing code.

Use **Workshop → Updates** to turn off automatic update checks.
Agent requests still send the context needed for the work to your chosen harness, provider, and connected tools.
You use your own provider accounts and pay for their use directly; Outlore does not resell model access.
Each harness handles its own sign-in, including accounts added through Outlore.

## Develop locally

Use Bun **1.4.4**, the version pinned in CI, and Git.
Building the native terminal dependency (`node-pty`) requires Xcode command-line tools on macOS, Visual Studio C++ tools on Windows, or Python, make, and a C++ compiler on Linux.

```sh
git clone https://github.com/Dyrits/OUTLORE.git
cd OUTLORE
bun install
bun run dev
```

The development command starts the Expo web server on port 8081 and opens Electron as **Outlore Dev**, with its own profile and data separate from the installed app.
The interface hot-reloads; changes to the service, contracts, or desktop process rebuild and restart Electron, stopping running turns.

To try the interface without a provider account or model spending, use the echo harness:

```sh
OUTLORE_HARNESS=fake bun run dev
```

These environment-variable examples use a POSIX shell.
In PowerShell, set a variable with `$env:OUTLORE_HARNESS = "fake"` before running the command.

| Variable | Purpose |
| --- | --- |
| `OUTLORE_DATA_DIR` | Override the application data folder; use an absolute path for an isolated development session. |
| `OUTLORE_<HARNESS>_PATH` | Override a harness's executable, such as `OUTLORE_CLAUDE_PATH`, `OUTLORE_CODEX_PATH`, `OUTLORE_OPENCODE_PATH`, or `OUTLORE_VIBE_PATH`; also `HERMES`, `MUSE`, `PI`, `CURSOR`, `COPILOT`, `CLINE`, `DEVIN`, and `ANTIGRAVITY`. |
| `OUTLORE_HARNESS=fake` | Replace real harnesses with the echo harness. |
| `OUTLORE_UPDATE_URL` | With `OUTLORE_DATA_DIR` set, the packaged macOS app reads this release list instead of GitHub's; for [checking updates](documentation/verification/2026-11-13-app-updates.md). |
| `OUTLORE_UPDATE_OPENER` | With `OUTLORE_DATA_DIR` set, the program that starts the new app after an update, in place of `open`. |

### Checks

```sh
bun run check
bun run typecheck
bun run test
```

Biome checks formatting and lint rules; TypeScript checks all workspaces.
Tests run on Electron's bundled Node runtime and use fakes and stand-in executables by default.
A failing test is retried twice, because the tests that run real processes fail when the machine is busy; the tests that needed a retry are listed at the end of the run, and as warnings in CI.
A test that needs what the environment withholds, such as a thread's sandbox refusing a Seatbelt profile of its own, a terminal, a disk image, or the process table, is skipped there and named as skipped; run the suite outside such a sandbox to run them.
Live checks are opt-in, require installed and signed-in harnesses, and consume model usage:

```sh
OUTLORE_LIVE_CLAUDE=1 bun run test
OUTLORE_LIVE_HARNESSES=1 bun run test
```

Set `OUTLORE_LIVE_OPENCODE_MODEL` if the live OpenCode checks need a specific model identifier.
Use `bun run format` to apply Biome fixes.
Commits run Biome on staged files; staged code or configuration also triggers the workspace typecheck, and staged TypeScript triggers related tests.

### Repository layout

| Path | Contents |
| --- | --- |
| [`apps/desktop`](apps/desktop/) | Electron shell, development launcher, and installer packaging |
| [`apps/app`](apps/app/) | Shared Expo / React Native interface for Electron, browsers, and Android |
| [`packages/service`](packages/service/) | Local Node service, SQLite storage, harness adapters, conversation terminals, connectors and the Vault, scheduling, and MCP thread tools, built with Effect |
| [`packages/contracts`](packages/contracts/) | Shared records and requests defined with Effect Schema |
| [`packages/channel`](packages/channel/) | The end-to-end encrypted channel and pairing code used between paired devices |
| [`packages/relay`](packages/relay/) | The Cloudflare Worker that forwards paired devices' encrypted traffic and serves the web app (`bun run deploy` builds the site and deploys it; after changing the Worker's sources, `bun run bundle` there rebuilds the committed Worker bundle, and a test fails until you do) |
| [`packages/controller`](packages/controller/) | A browser as a paired device: its pairings in browser storage, pairing with a code, and the encrypted link to a host |
| [`documentation`](documentation/) | Product specifications, architecture, decisions, and verification evidence |

## Build and release

```sh
bun run package
```

This builds an installer for the current platform in `apps/desktop/release`.
It bundles the interface and service, so the installed app needs no development server.
Packaging requires Git, CMake, and the platform's C and C++ compiler to build the bundled whisper.cpp executable.
In the installed desktop app, the first press of the composer microphone downloads the multilingual Whisper model (141 MiB), verifies it, and starts recording.
Later dictations reuse the model and work offline.
Development runs and custom engines can set `OUTLORE_WHISPER_CLI` and `OUTLORE_WHISPER_MODEL` before starting Outlore.

Pushes to `main` and pull requests targeting it run lint, typechecking, tests, and the web app's build through the [desktop workflow](.github/workflows/package.yml).
Push a version tag such as `0.1.0-Prototype` (no `v` prefix) to build macOS arm64 and x64, Windows x64, and Linux x64 installers and publish them on [GitHub Releases](https://github.com/Dyrits/OUTLORE/releases).
The tag sets the packaged app version (a leading `v`, if present, is dropped); tags containing a hyphen produce prereleases.
The release is published only after all four installers and the Android app are built and uploaded.
Installers download directly as `.dmg`, `.exe`, and `.AppImage` files without an extra ZIP wrapper.
The same tag builds the Android app, the one Expo app built natively (`apps/app`): an `android` job stamps the tag into the app's release, makes the `android/` project with `expo prebuild` (it is generated, not committed), builds the APK with Gradle, and attaches `Outlore-<version>-android.apk`, listed in `SHA512SUMS.txt`, to the release. The app has no local service: it pairs with a running host from a pairing code and keeps the pairing in the phone's secure store. It needs four repository secrets, since an update installs over the previous app only when both carry the same key and a release is never signed with a throwaway one: `ANDROID_KEYSTORE_BASE64` (the keystore file, base64), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. A tag without them fails the `android` job and so the release. Make the keystore once and keep a copy: `keytool -genkeypair -v -keystore outlore-release.jks -alias outlore -keyalg RSA -keysize 2048 -validity 10000`, then `base64 -i outlore-release.jks | pbcopy` for the first secret. A manual run (**Run workflow**) without the secrets builds an APK signed with the debug key, named `...-android-debug-signed.apk`, to check the build. The Android app is a prerelease like the rest and is installed from the file (Android asks to allow installing from the browser or file manager).
A release also carries `SHA512SUMS.txt` (what the macOS app checks its download against) and the `latest*.yml` files that `electron-updater` reads on Windows and Linux; the release is not published without them.
After the release is published, the same tag also puts the relay Worker and the web app online: a `relay` job stamps the tag into the web app's release, builds the site, deploys `packages/relay` with Wrangler, and checks the live address (`https://outlore.dyrits.workers.dev`). It needs the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; `bun run deploy` in `packages/relay` does the same by hand.
Run `bun apps/desktop/scripts/check-update.ts <older Outlore.app> <newer Outlore-…-mac-…dmg>` to watch a packaged app update itself from a local stand-in for GitHub.
The workflow also supports **Run workflow** manually for test builds, which upload direct installer files to the run's **Artifacts** section without publishing a release.
Actions artifacts expire after 14 days; release assets remain until removed.
The release workflow asks GitHub to generate release notes.
After publication, update the GitHub release notes from the corresponding [changelog](documentation/changelog/), including any breaking changes.

## License

Outlore's source code is licensed under the [Apache License 2.0](LICENSE).
Third-party code that keeps its own notice, such as in [`packages/channel`](packages/channel/NOTICE), is attributed there.
Source-code licensing is separate from the signing certificates used to distribute desktop installers.

## Contribute

Report bugs and propose changes through [GitHub Issues](https://github.com/Dyrits/OUTLORE/issues).
For a bug, include your operating system, Outlore version, harness, steps to reproduce, and relevant logs with private information removed.

Before changing code, read the [conventions](documentation/conventions.md), the relevant [capability specification](documentation/capabilities/), and any directory-specific `AGENTS.md` instructions.
Check the [work in progress](documentation/work-in-progress.md) for ongoing work and run the checks above before opening a pull request.

## Documentation

- [Outline](documentation/outline.md): purpose, actors, and capabilities.
- [Requirements](documentation/requirements.md): privacy, access, licensing, and other system-wide obligations.
- [Glossary](documentation/glossary.md): domain terms and interface names.
- [Architecture](documentation/architecture.md) and [decision records](documentation/architecture-decision-record/): system structure and the reasons behind it.
- [Capability specifications](documentation/capabilities/): agreed behavior and acceptance criteria.
- [First slice design and capability blueprints](documentation/first-slice-design.md): implementation designs.
- [Backlog](documentation/backlog.md) and [work in progress](documentation/work-in-progress.md): deferred work and current batches.
- [Conventions](documentation/conventions.md): code and test conventions.
- [Changelog](documentation/changelog/): agreements and deliveries, one file per release.
- [Verification](documentation/verification/): reproducible checks and screenshots.

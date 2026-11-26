# Headless phone control on stock Android: primary-source notes

Researched 2026-11-26. The owner wants step 2 of [phone control](../capabilities/phone-control/specifications.md) to be headless: an agent works in the background and does not take over the screen while the owner uses the phone. Step 2 was imagined as an accessibility service on the real screen, which takes the screen over. This note asks what a stock, non-rooted phone (Android 13 to 16) lets an owner-installed, sideloaded app do, with no PC and no ADB tether at run time. Research only; nothing was built, installed or run on a phone.

## Method, and what "primary source" means here

- **AOSP source**: `android.googlesource.com/platform/frameworks/base` (and `packages/modules/Permission`, `platform/frameworks/base/packages/Shell`) at the tags **`android-16.0.0_r1`**, **`android-15.0.0_r1`**, **`android-14.0.0_r1`**, **`android-13.0.0_r1`**, each file fetched whole (`?format=TEXT`) and read with line numbers. **Line numbers are those of `android-16.0.0_r1`** unless another tag is named. Paths are relative to `frameworks/base/` unless stated.
- **Projects**: `Genymobile/scrcpy` at `c939183a7cdca4599cee337e60bc0e147b6c9828` (2026-11-19; `NewDisplayCapture.java` last changed in `4954415c`), `RikkaApps/Shizuku` at `b844bc491f1790c72328e1a8e5b2349f8978f0ea` (2025-06-18, the newest commit on its default branch), `kilolonion/agent-vscreen` at `90c329aa1a53732926a7afbd310c5ffdf8ccdd58` (2026-11-26, version 1.4.2-beta3). Project READMEs for DroidRun/Mobilerun Portal, Open-AutoGLM and AppAgent were read at their default branch on 2026-11-26 through the WebFetch tool, which runs a small model over the page, so those quotations are as that tool returned them and **have no line numbers**.
- **Google's product pages**: fetched 2026-11-26; no commit exists, so each claim is as of that day.
- **Verified** means I read it in the source named. **Inferred** means my conclusion from verified facts. **Not verified** collects what I could not check; it matters for the spike.
- **Outlore**: working tree `main` at the start of the session (`875e5138`); the installer module and the phone-control specifications were read.

## Short answer

1. **A normal app cannot run another app on its own virtual display.** It can create a virtual display with no permission (`PUBLIC | OWN_CONTENT_ONLY`), but the system refuses to launch another app's activity on it, because the display is untrusted and the target activity does not set `android:allowEmbedded`. The permissions that lift this (`ADD_TRUSTED_DISPLAY`, `ACTIVITY_EMBEDDING`, `INTERNAL_SYSTEM_WINDOW`) are held by the ADB **shell** identity and by system-only roles, never by a sideloaded app (§1).
2. **The shell identity is the key, and Shizuku-style wireless debugging gives an app that identity with no PC after setup** (§2). That is what open-source background-screen tools use today (Agent-VScreen, scrcpy's `--new-display`, Virtual Display for Shizuku). The setup repeats after every reboot.
3. **Accessibility alone cannot be headless.** It can only act on windows the system lists, and that means windows on a display; on the default display those are the ones the owner sees (§3). It can, however, **read and act on a non-private virtual display** (source says so; not tried on a phone).
4. **Google's own background Gemini automation runs apps in a "secure, virtual window"**, but it is a privileged system feature on Pixel 10 and Galaxy S26, and the cross-app AppFunctions API needs a permission "granted only to authorized system assistants". Neither is open to Outlore (§4).
5. **Recommendation: Shizuku route for a "background screen", on top of step 1's app and an accessibility service that is optional.** Details and a spike in §5.

## 1. A virtual display, without a privileged identity

### 1.1 What a normal app can create (verified)

`DisplayManager.createVirtualDisplay` takes flags (`core/java/android/hardware/display/DisplayManager.java`): `VIRTUAL_DISPLAY_FLAG_PUBLIC` (line 255), `OWN_CONTENT_ONLY` (334), and `VIRTUAL_DISPLAY_FLAG_TRUSTED` (457, annotated `@SystemApi`, so not in the public SDK).

`services/core/java/com/android/server/display/DisplayManagerService.java`, `createVirtualDisplayInternal` (same logic at the tags 13 to 16):
- A `PUBLIC` display without `OWN_CONTENT_ONLY` becomes an **auto-mirror** display (lines 1841 to 1846); an auto-mirror display needs a valid MediaProjection, `ADD_MIRROR_DISPLAY` or `CAPTURE_VIDEO_OUTPUT` (lines 1905 to 1917); the error message says to use `OWN_CONTENT_ONLY` for a display that does not mirror.
- So **`PUBLIC | OWN_CONTENT_ONLY` needs no permission**. `SECURE` needs `CAPTURE_SECURE_VIDEO_OUTPUT` or a projection (1919 to 1925). **`TRUSTED` needs `ADD_TRUSTED_DISPLAY`** (1928 to 1936, with a logged security event), and so does `OWN_DISPLAY_GROUP` (1946 to 1951).
- A **MediaProjection** display cannot be an own-content display: `MediaProjectionManagerService.applyVirtualDisplayFlags` for `TYPE_SCREEN_CAPTURE` clears `OWN_CONTENT_ONLY` and sets `AUTO_MIRROR | PRESENTATION` (`services/core/java/com/android/server/media/projection/MediaProjectionManagerService.java:1149` to `1153`). It only mirrors the owner's screen, so it cannot host a second app.

### 1.2 What it cannot host (verified)

`ActivityTaskSupervisor.isCallerAllowedToLaunchOnDisplay` (`services/core/java/com/android/server/wm/ActivityTaskSupervisor.java:1242` to `1320`) decides whether `setLaunchDisplayId` or any launch onto a display is allowed:

1. A caller holding **`INTERNAL_SYSTEM_WINDOW`** may launch anything anywhere (1266 to 1270).
2. If the display is **not trusted** (`!display.isTrusted()`, 1277), the activity must have **`FLAG_ALLOW_EMBEDDED`** (1280), and the caller must hold **`ACTIVITY_EMBEDDING`** or already have an activity on that display (1286 to 1288).
3. Otherwise a public display admits the caller's user (1294), and a private display admits its owner or an app already on it (1306 to 1316).

`FLAG_ALLOW_EMBEDDED` is set from the manifest attribute `android:allowEmbedded` (`core/java/com/android/internal/pm/pkg/component/ParsedActivityUtils.java:149`; `core/java/android/content/pm/ActivityInfo.java:714` to `725`, whose comment calls it deprecated yet the check remains). The same three conditions are in `android-13.0.0_r1` (1172 to 1178), `android-14.0.0_r1` (1205 to 1211) and `android-15.0.0_r1` (1239 to 1245) of that file. The comment at 1278 gives the reason: an untrusted display's content "can be read from Surface by apps that created them".

**Consequence (inferred from the above)**: an app on a display it created without `TRUSTED` can only launch its own activities or the few third-party activities that set `allowEmbedded` (I know of no list; it is a rarely used attribute). Launching Chrome, a banking app or any ordinary app there is refused. The owner's own comment that ADB can do it is correct, see §2.

### 1.3 Which permissions an app could ever hold (verified)

`core/res/AndroidManifest.xml` and `packages/modules/Permission/PermissionController/res/xml/roles.xml` (tag 16):

| Permission | Protection level | Held by |
| --- | --- | --- |
| `ADD_TRUSTED_DISPLAY` | `signature\|role` (manifest line 8316) | roles `COMPANION_DEVICE_APP_STREAMING` and `COMPANION_DEVICE_NEARBY_DEVICE_STREAMING` (`virtual_device` permission set, roles.xml 95 to 97, 1245, 1319; both `systemOnly="true"`, 1241 and 1315), `SYSTEM_AUTOMOTIVE_PROJECTION` (617), `SYSTEM_SHELL` (659) |
| `ACTIVITY_EMBEDDING` | `signature\|privileged` (4331) | privileged system apps |
| `INTERNAL_SYSTEM_WINDOW` | `signature\|module\|recents` (5522) | system, modules, the Recents app |
| `ADD_MIRROR_DISPLAY`, `CREATE_VIRTUAL_DEVICE` | `internal\|role` (8326, 8522) | virtual-device roles |

The **Shell** package (`packages/Shell/AndroidManifest.xml`) declares **`ADD_TRUSTED_DISPLAY` (975), `ACTIVITY_EMBEDDING` (276), `INTERNAL_SYSTEM_WINDOW` (175), `ADD_MIRROR_DISPLAY` (977), `CAPTURE_VIDEO_OUTPUT` (200) and `CREATE_VIRTUAL_DEVICE` (974)**. No role in the list above can be given to a sideloaded app by the owner (the two streaming roles are `systemOnly`). A virtual-device (CDM) association is therefore also closed.

### 1.4 Can accessibility read and act on such a display? (verified in source, not tried)

- `AccessibilityManagerService.AccessibilityDisplayListener.isValidDisplay` (`services/accessibility/java/com/android/server/accessibility/AccessibilityManagerService.java:5640` to `5656`; the `FLAG_PRIVATE` test exists at the tags 13 to 15 too) ignores **private** virtual displays (type virtual, `FLAG_PRIVATE`) unless owned by System UI. A display without `FLAG_PRIVATE`, that is a `PUBLIC` display, is tracked. `onDisplayAdded` (5546 to 5565) returns early for invalid displays, so private displays get **no window tracking and no gesture injector**.
- On a tracked display the service API has the pieces: `AccessibilityService.getWindowsOnAllDisplays()` (`core/java/android/accessibilityservice/AccessibilityService.java:1101`, needs `canRetrieveWindowContent` and `FLAG_RETRIEVE_INTERACTIVE_WINDOWS`), `GestureDescription.Builder.setDisplayId` (`GestureDescription.java:220`) with `dispatchGesture` (`AccessibilityService.java:1286` to `1309`, routed to the display's injector at `AccessibilityManagerService.java:2038` to `2052`), `takeScreenshot(displayId, …)` (`AccessibilityService.java:2705`) and `takeScreenshotOfWindow` (2761). The service rejects a screenshot of a **private** virtual display with `ERROR_TAKE_SCREENSHOT_INVALID_DISPLAY` (`services/accessibility/.../AbstractAccessibilityServiceConnection.java:1542` to `1550`: "Private virtual displays are created by the ap and is not allowed to access by other aps").
- Secure windows: `takeScreenshotOfWindow` returns `ERROR_TAKE_SCREENSHOT_SECURE_WINDOW` for a `FLAG_SECURE` window unless the service can capture secure layers (`AbstractAccessibilityServiceConnection.java:1460` to `1475`, behind `Flags.allowSecureScreenshots()`, so its release state is unknown to me).
- **Inferred**: a `PUBLIC` display created by the shell identity (scrcpy creates one, §2.2) is visible to an enabled accessibility service of Outlore, which could then read and tap it. Agent-VScreen's README says its element list merges "the accessibility tree and on-device OCR" (§4.3), which agrees, but see Not verified.

## 2. What Shizuku or wireless-debugging self-adb adds

### 2.1 What it is

- **Shizuku** (Apache-2.0, `RikkaApps/Shizuku`): "Shizuku guides users to run a process, Shizuku server, with root or ADB first" and hands apps a binder to it (`README.md`). Its `manager/src/main/java/moe/shizuku/manager/adb/` folder contains `AdbPairingClient.kt`, `AdbClient.kt`, `AdbMdns.kt` and `AdbPairingService.kt`: **the app itself pairs with and connects to the phone's own `adbd`**. The server process runs as the ADB shell identity (uid 2000); apps call system services through it (`ShizukuBinderWrapper`), or run their own code there as a user service (Shizuku API; not read, see Not verified).
- **Setup, user steps** (`shizuku.rikka.app/guide/setup/`): "Starting with wireless debugging works on Android 11 or above", "does not require a connection to a computer". Enable Developer options and Wireless debugging, pair once with the code from the pairing dialog (typed into Shizuku's notification), then start. "Due to system limitations, the startup steps need to be performed again after each reboot." Pairing is one-time. Warnings: turning Developer options or USB debugging off stops it; "If it does not start, try disabling and enabling wireless debugging".
- **Android's own doc** (`developer.android.com/tools/adb`, "Connect to a device over Wi-Fi"): the device must run Android 11 or higher and be on the same wireless network as the client; the owner may tick "always allow on this network". The same page says **Android 17 with adb 37 brings "adb Wi-Fi 2.0"**, where the device "will automatically connect to the workstation when the device connects to a wireless debugging trusted network"; it is written for a workstation and I did not check whether it helps an on-device client.
- **Cost of self-adb inside Outlore instead of Shizuku**: Outlore would carry its own pairing/TLS client (the Shizuku code shows what that is: SPAKE2 pairing, Conscrypt hidden API) and its own shell-identity server. Shizuku's licence is Apache-2.0 (compatible with the open-source rule; the README restricts use of its name, application ID and permission string). Using Shizuku as a separate app that the owner installs is less code but one more app and one more permission prompt.

### 2.2 What the shell identity does that nothing else does (verified or inferred as marked)

- **A trusted, own-content, unlocked virtual display and launching any app on it.** scrcpy's server (a shell-identity process started by `adb`) does this in `server/src/main/java/com/genymobile/scrcpy/video/NewDisplayCapture.java`, `startNew` (lines 211 to 237): flags `PUBLIC | PRESENTATION | OWN_CONTENT_ONLY | SUPPORTS_TOUCH | ROTATES_WITH_CONTENT`, and from Android 13 `TRUSTED | OWN_DISPLAY_GROUP | ALWAYS_UNLOCKED | TOUCH_FEEDBACK_DISABLED`, from Android 14 `OWN_FOCUS | DEVICE_DISPLAY_GROUP`. These match the permissions in §1.3 and the checks in §1.1, so the display passes `isTrusted()` and third-party activities are allowed (§1.2). `--start-app` starts an app on it. scrcpy's `doc/virtual-display.md`: "On some devices, a launcher is available in the virtual display. When no launcher is available … the virtual display is empty. In that case, you must start an Android app", and "when the virtual display is closed, the running apps are destroyed" unless `--no-vd-destroy-content`. scrcpy README: the device needs "at least API 21".
- **Frames without MediaProjection**: the creator passes its own `Surface` to `createVirtualDisplay` and gets the frames there; scrcpy feeds an encoder. No screenshot permission prompt, no status-bar capture indicator (**inferred**, since MediaProjection is the thing that shows it).
- **Input to that display** from the shell identity (scrcpy injects events with a display id; not read in detail), and **settings the app cannot write**: Agent-VScreen has Shizuku "add" its accessibility service to the enabled list, notifications, overlay and battery allowances ("One-tap setup", README), which is how it avoids Android's restricted-settings step (§3.2).
- **`am start --display`, `input -d`, `screencap -d`, `uiautomator`** (the owner's list): the same identity runs them. I read the permissions (§1.3), not these commands' source. A `UiAutomation` connection (`core/java/android/app/UiAutomation.java`, `getWindowsOnAllDisplays` at 906) exists for shell-identity code and does not need the accessibility service to be turned on in Settings; it "suppresses accessibility services by default" unless `FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES` (line 177, comment 169 to 176) is passed, which matters for the owner's own TalkBack. **Inferred**, not tried.

### 2.3 Restart persistence, setup steps, security cost

- **Restart**: Shizuku must be started again after each phone reboot (the setup guide). Agent-VScreen: "Start Shizuku again after each phone restart", and with Shizuku off, commands needing the screen return `NOT_CONNECTED` (its `API.md` §8, in Chinese).
- **Setup steps for the owner** (Shizuku route): enable Developer options; connect to Wi-Fi; enable Wireless debugging; pair once; start the server; grant the app in Shizuku's list; then the app's own grants (overlay, notifications, optional accessibility, battery). Roughly eight steps on first use, two after a reboot.
- **Security cost**: whatever has the Shizuku grant runs commands as the ADB shell identity, which holds many signature permissions, including those in §1.3. Outlore would hold that grant, and Outlore's pairing link is the only door to it. A bug in the phone tools becomes a shell-level bug. Agent-VScreen documents the same fact: "The token equals control of the phone" (README). **Inferred**: the grant should be tied to the same per-group switches as step 1 and to an explicit "background screen" switch.

## 3. Accessibility only, without a virtual display

### 3.1 What it can and cannot do (verified)

- An accessibility service sees and acts on **windows the system tracks**: `getWindowsOnAllDisplays` and the per-display window lists are built from the window manager's windows on each tracked display (§1.4). An app that is not on a display has no window there. On the default display the windows are the ones on the owner's screen, so acting on them means the app must be in front, which takes the screen over.
- `performAction(ACTION_CLICK, ACTION_SET_TEXT …)` goes to a node by window id and node id (`AbstractAccessibilityServiceConnection.performAccessibilityAction`, line 1082 in the same file; it first resolves the window and checks `canGetAccessibilityNodeInfoLocked`). The node must come from a tracked window. **Not verified** whether a node fetched earlier still answers `performAction` after its activity stops (no window, process alive). I did not find a source that says it works, and I would not build on it.
- **Gesture dispatch** (`dispatchGesture`) injects touches on a display; on the default display it taps the owner's screen.
- **Data-sensitive and secure content** (verified): a view can mark itself `accessibilityDataSensitive`, and services that do not declare **`isAccessibilityTool`** are refused for those views and for views using `filterTouchesWhenObscured` (`core/java/android/view/View.java:3318` to `3348`, `AccessibilityServiceInfo.isAccessibilityTool` at line 1356). An agent service is not an accessibility tool in Google's sense (`isAccessibilityTool` is meant for apps that help people with disabilities; policy is Play's, not enforced by the platform at install, **not verified**), so declaring it truthfully means these views are closed to it. `FLAG_SECURE` windows are not screenshotted (§1.4).

### 3.2 Restricted settings for a sideloaded app (verified)

- **Rule in the platform** (`services/core/java/com/android/server/pm/InstallPackageHelper.java:3118` to `3139`, tag 16): after an install, if `request.getPackageSource()` is `PACKAGE_SOURCE_LOCAL_FILE` or `PACKAGE_SOURCE_DOWNLOADED_FILE`, the app gets `OP_ACCESS_RESTRICTED_SETTINGS` set to `MODE_ERRORED`, which is the "explicitly guarded" state used by Enhanced Confirmation (ECM). The comment says that when the `enhancedConfirmationModeApisEnabled` and `extendEcmToAllSettings` flags are on ("in Android B", that is Android 16), the default becomes "should be decided later" and this step is unnecessary. **I could not read the ECM service source** (`EnhancedConfirmationService` was not at any path I tried), so which settings ECM guards on a given phone and whether those flags are on in release builds is **not verified**.
- **Google's support page** (`support.google.com/android/answer/12623953`): "some device settings may be restricted when you install an app"; the user opens Settings, Apps, the app, taps More, then **Allow restricted settings**, and "Some of these steps work only on Android 13 and up". The page names accessibility apps as an example. Secondary sources (Kaspersky, Esper, ESET) add that the option appears only after the user has once tried to turn the service on and been blocked, and that OEM menus differ; I did not verify these against AOSP.
- **Outlore's updater** installs with `Intent.ACTION_VIEW` of a `FileProvider` URI of type `application/vnd.android.package-archive` (`apps/app/modules/outlore-installer/android/src/main/java/app/outlore/installer/OutloreInstallerModule.kt:157` to `160`), that is through the system installer, not a `PackageInstaller` session. **Inferred**: such installs carry a local-file or downloaded-file package source, so the app is guarded; the owner then needs the restricted-settings step before the accessibility service can be turned on. A session-based installer can state `setPackageSource(PACKAGE_SOURCE_STORE)` (`PackageInstaller.SessionParams`, API 33), which I read as an "app-store" signal; whether it exempts the app, and whether doing so for a self-update is acceptable, is **not verified**.
- **Shizuku route skips it**: the shell identity can add the service to the enabled list directly (Agent-VScreen does; §2.2).

## 4. How existing products do it

### 4.1 Google

- **Gemini screen automation** (blog.google, "Let Gemini handle your multi-step daily tasks on Android", and the Android Developers Blog post of 2026-02-25 "The Intelligent OS"): Gemini "automates the task by running the app you need in a secure, virtual window on your phone"; "Gemini will work seamlessly in the background, leaving you free to keep using your phone"; the owner can "monitor Gemini's progress live via notifications, allowing you to view, jump in or stop the task"; it "can only access limited apps, and not the rest of your device". Launch: Pixel 10 series and Galaxy S26 series, US and Korea, "select apps in the food, grocery and rideshare categories". Android Central (secondary): Pixel 10 on Android 16 QPR3, free users about five requests a day, Ultra 120. The developer blog calls it "a UI automation framework … This is the platform doing the heavy lifting" and says Google will "share more details later this year" for developers. **No developer API or permission for third-party agents is documented** in what I read.
- **AppFunctions** (`developer.android.com/ai/appfunctions`): Android 16 or higher; "Discovering and calling other apps' AppFunctions requires the privileged `EXECUTE_APP_FUNCTIONS` permission, which Android grants only to authorized system assistants", and an app "can call AppFunctions declared inside its own package". The Android 17 post (2026-06-16) says the Gemini integration "is currently in a private preview with trusted testers". **Closed to Outlore**; apps could still *expose* functions to Gemini, which is a different goal.
- **Gemini's virtual window is not documented**: whether it is a trusted virtual display, an "App Bubble" style window or something else is not stated in anything I read. §1 shows that only a privileged identity can host other apps like this, which agrees with it being a system feature (**inferred**).

### 4.2 scrcpy

`--new-display[=WxH/dpi]` creates a display of its own and mirrors it to a PC window (§2.2); this is the proof that the shell identity can run apps on a hidden display, with a PC running `adb` only at start. Known quirks in its doc: some devices show a launcher, some do not; an empty display produces no frame; system decorations and IME placement are options (`--no-vd-system-decorations`, `--display-ime-policy`). I did not read scrcpy's issue tracker, so per-vendor failures are **not verified**.

### 4.3 Agent-VScreen (`kilolonion/agent-vscreen`, MIT)

The closest match to what the owner wants, and a direct precedent.
- "Agent-VScreen opens and drives other apps on an invisible virtual display, so your own screen stays yours"; a floating window shows the work, can be taken over or stopped; agents connect by CLI, MCP or HTTP (`127.0.0.1:18765`, or over Tailscale); "The app calls no AI model" (README).
- **Privileges: Shizuku (default, "no root needed") or root.** Android 11+, "Android 14+ recommended", arm64. "Start Shizuku again after each phone restart."
- Reads the screen with "the accessibility tree and on-device OCR … merged into one numbered list", acts by tap/swipe/type/key; its accessibility service is **read-only** ("does not do gestures"), and exists mainly so the floating window is not hidden by the "hide non-system overlays" rule that settings, installers, permission dialogs "and many banking apps" request (`API.md` §1). Without accessibility it still works from OCR, and non-ASCII text goes by clipboard paste.
- Payment buttons "ask" by default; "steps that need a password or a code move to your own screen" (`handoff`).
- **Real-phone evidence**: two regression rounds on **one phone**, Honor Magic 7, MagicOS 11, Android 17 (`API.md` §8). Not run: the second device, screen off for 10 minutes, resuming after Shizuku stops, other vendors. The author also notes a front door inside the app process that vendor freezers can kill; a shell-identity front door is "planned" (`docs/SPIKE-FRONT-DOOR.md`, not read). Android 10+ forbids running downloaded executables from app data (the same section).
- A third-party page called it "paid" while the repository is MIT; I used the repository.

### 4.4 Other open-source agents (all take over the real screen)

- **Mobilerun/DroidRun Portal**: an Android **accessibility service** read through an ADB `content://` provider, or a local HTTP (port 8080) and WebSocket (8081) server with a token, or a reverse WebSocket; "UI tree extraction, gestures, overlay operations, and screenshots still require the AccessibilityService"; it "supports multi-window environments" but the README does not mention virtual displays, secure windows or restricted settings.
- **Open-AutoGLM** (`zai-org`): the agent runs on a computer and "controls devices via ADB", screenshot to vision model to tap coordinates; text goes through **ADB Keyboard**; a black screenshot "usually means … a sensitive page (payment, password, banking apps)" and the agent asks the owner to take over.
- **AppAgent** (`TencentQQGYLab`): ADB from a PC over USB, a multimodal model, element labels; no mention of virtual displays.
- **Not read**: Mobile-Agent (X-PLUG), `Virtual Display for Shizuku` (Play Store listing only), Dextop, DroidOS, Project Astra material, Gemini API computer-use model docs. Search results say Dextop and `Virtual Display for Shizuku` use Shizuku to create and launch apps on virtual displays; I did not open their source.

## 5. Recommendation

### 5.1 Which route

| Route | Background (owner keeps using the phone) | Setup | Needs a PC at run time | Works on other apps |
| --- | --- | --- | --- | --- |
| Accessibility service on the real screen (the old step 2) | No: it needs the app in front | Restricted-settings step, enable service | No | Yes, minus data-sensitive and secure windows |
| App-owned virtual display, no privileges | Cannot host other apps (§1.2) | none | No | Only its own and `allowEmbedded` activities |
| MediaProjection | Mirror of the real screen only (§1.1) | A consent dialog per use | No | Real screen only |
| **Shizuku (or Outlore's own self-adb) plus a trusted virtual display** | **Yes** | Developer options, wireless debugging, pair once, start after each reboot | **No after setup** | Yes, minus secure windows and apps that refuse |
| AppFunctions, Gemini UI automation | Yes | n/a | No | Closed to third parties (§4.1) |

**True background control with the least setup is the Shizuku route (shell identity, trusted virtual display, the agent's reads and taps on that display).** Nothing else on a stock phone does it. A reboot costs the owner two taps.

### 5.2 What it can never do

- **`FLAG_SECURE` content** (banking apps, many payment and password screens, DRM video): a screenshot of a virtual display that the creator owns normally shows such windows as black; the accessibility tree is a separate path and may still be readable (§1.4; `data-sensitive` views are closed to non-tool services). Open-AutoGLM and Agent-VScreen both hand such steps to the owner.
- **Apps that refuse a secondary display or an emulated environment** (some banking, game and DRM apps; vendors' launchers on a virtual display); Agent-VScreen's own list says "many banking apps" ask for hidden overlays. **Not verified** for any given app.
- **Biometric, camera and sensor prompts** that expect the owner, SIM and carrier prompts, and system dialogs on the main display.
- **Reboot persistence**: the shell server dies with the phone and must be restarted by the owner; Android has no supported way to start it by itself (Shizuku's own guide).
- **A phone with no Wi-Fi** for the setup (wireless debugging needs a wireless network, §2.1).
- **Vendor behavior**: some vendors freeze background apps; tested on one phone only by the nearest precedent (§4.3).

### 5.3 Proposed shape of step 2 (for a specification; not decided)

1. **Keep step 1 as it is** (app-own capabilities) and add step 2 as a second group of tools behind a new switch, **Let threads use a background screen**, separate from the step-1 groups. The switch is the only consent, as in step 1 ([specification](../capabilities/phone-control/specifications.md)).
2. **Build first, in order, each checked on a real phone before the next:**
   1. A **privileged-identity bridge** in a Kotlin module of the APK (like `outlore-installer`): either Shizuku's API, or Outlore's own pairing client. Prove only: "the app can run a command as the shell identity, and the owner can recover after a reboot".
   2. A **background display service** (shell side): create the trusted display with the scrcpy flags, start an app on it, hold its frames from a surface in the same process, and destroy it on stop. No agent tools yet.
   3. **Read**: `phone_screen_read` over the display (accessibility tree if the service is on, OCR or a screenshot description otherwise), then **act** (`tap`, `type`, `swipe`, `back`, `launch app`) injected for that display id. All through the existing `PhoneCall` frame; no extra server on the phone.
   4. A **take-over view** (the owner can watch or take the display on the real screen) and a **stop**; hand-off for passwords, codes and payments.
3. **Make accessibility optional**, not the core. If used, declare it for reading only and expect the restricted-settings step; mention in the spec that an agent service is not an accessibility tool (§3.1).
4. **Mark the unavoidable limits in the tool answers**: "This screen is protected by the app" for blank or secure frames, so the thread says so instead of guessing.
5. Record a decision record (new, after 0028) for the privileged identity, because it widens the trust given to the app; update the "Nothing is kept" text for screenshots.

### 5.4 What a real-phone spike must prove

Run on at least one Pixel (Android 16) and one non-Pixel (Samsung or Xiaomi/Honor) and, if possible, Android 13 and 17. Each is pass/fail:

1. The app starts a shell-identity process after the owner does the wireless-debugging steps **with no PC**, and again after a reboot with only the documented repeat steps.
2. From that process: create a display with the §2.2 flags, launch **Settings and Chrome and a third-party app** on it by display id, and see them draw there **and not on the real screen**. Check the window can survive the owner switching apps, locking the screen, and Doze.
3. Frames reach the app (surface or `screencap`) at a usable rate, with **no MediaProjection prompt**, and the owner's screen is unaffected.
4. Touch and text reach **only** that display (the real screen does not react); IME behavior (the keyboard appears on the real screen or not) on both phones.
5. The accessibility tree of that display is readable by an enabled accessibility service of Outlore (the §1.4 inference), or else OCR works; record which.
6. What happens with a banking app, a `FLAG_SECURE` screen, a DRM video, a camera app: blank frame, refusal or crash, and what the tree shows.
7. Battery and heat over 30 minutes; vendor freezers (does the shell process or the app die when the screen is off?).
8. Restricted settings: on a build installed through Outlore's updater, whether the accessibility service can be turned on and which steps the owner must take; with `setPackageSource` changed, whether the step disappears (§3.2).

## Not verified

- Whether an enabled accessibility service **actually sees and taps** a `PUBLIC | TRUSTED` virtual display created by the shell identity on a real phone. Source says it is tracked (§1.4); Agent-VScreen's use of the tree is the only practical evidence, from one phone.
- Whether a stopped activity's cached node answers `performAction` (§3.1), and what the accessibility API returns for apps that are not on any display.
- **ECM**: the source of the Enhanced Confirmation service was not found; I did not verify which settings it guards, the default of the `OP_ACCESS_RESTRICTED_SETTINGS` mode in released builds of Android 16, or what Android 17 changed. The "app store" exemption through `setPackageSource` is untested, and I did not read the system installer's code that sets a package source for `ACTION_VIEW` installs.
- Scrcpy's input injection and `am`/`input`/`screencap` flags for display ids: permissions read, command source not.
- Shizuku: the user-service API (`Shizuku-API`), how long the server survives (the guide says reboot ends it, nothing else), behavior on Android 16 ("install the GitHub build, not the Play Store build" was in a Dextop README snippet I did not open), and Android 17. The newest Shizuku commit is from 2025-06-18; whether it is maintained is for the owner to judge.
- `Flags.allowSecureScreenshots` and the other flag-gated behaviors in the Android 16 source: **flag state in shipped builds is unknown**. Android 17 AOSP was not read (it was released 2026-06-16; the task covers 13 to 16).
- How Gemini's "secure, virtual window" is built (§4.1); whether Samsung and Google use the same mechanism; any API for third parties. No developer documentation found.
- Agent-VScreen's claims about banking apps, OCR and Tailscale were taken from its README and `API.md`; I did not run it. The single-phone test coverage is its author's statement.
- Per-vendor behavior (MagicOS, One UI, HyperOS) for virtual displays, launchers on them and background freezing. Scrcpy's issue tracker, Mobile-Agent, Dextop, DroidOS, Virtual Display for Shizuku and Android's Project Astra material were not read.
- Cost and legal questions of shipping a privileged helper (Play policy does not apply to a sideloaded APK; the owner's own policy does).

## Sources

AOSP (`https://android.googlesource.com/platform/…/+/refs/tags/<tag>/<path>`; tags `android-13.0.0_r1` to `android-16.0.0_r1`): `frameworks/base` at `core/java/android/hardware/display/DisplayManager.java`, `services/core/java/com/android/server/display/DisplayManagerService.java`, `services/core/java/com/android/server/wm/ActivityTaskSupervisor.java`, `services/core/java/com/android/server/media/projection/MediaProjectionManagerService.java`, `services/core/java/com/android/server/pm/InstallPackageHelper.java`, `services/accessibility/java/com/android/server/accessibility/{AccessibilityManagerService,AbstractAccessibilityServiceConnection,AccessibilityServiceConnection,AccessibilityInputFilter}.java`, `core/java/android/accessibilityservice/{AccessibilityService,AccessibilityServiceInfo,GestureDescription}.java`, `core/java/android/app/UiAutomation.java`, `core/java/android/view/View.java`, `core/java/android/content/pm/ActivityInfo.java`, `core/java/com/android/internal/pm/pkg/component/ParsedActivityUtils.java`, `core/res/AndroidManifest.xml`, `packages/Shell/AndroidManifest.xml`; `platform/packages/modules/Permission` at `PermissionController/res/xml/roles.xml`.

Projects: `github.com/Genymobile/scrcpy` (`server/src/main/java/com/genymobile/scrcpy/video/NewDisplayCapture.java`, `doc/virtual-display.md`, `README.md`); `github.com/RikkaApps/Shizuku` (`README.md`, `manager/src/main/java/moe/shizuku/manager/adb/`); `github.com/kilolonion/agent-vscreen` (`README.md`, `API.md`); `github.com/droidrun/droidrun-portal` `README.md`; `github.com/zai-org/Open-AutoGLM` `README_en.md`; `github.com/TencentQQGYLab/AppAgent` `README.md`.

Google and others: [Shizuku setup guide](https://shizuku.rikka.app/guide/setup/) · [adb: connect over Wi-Fi](https://developer.android.com/tools/adb) · [Restricted settings help](https://support.google.com/android/answer/12623953) · [PackageInstaller.SessionParams](https://developer.android.com/reference/android/content/pm/PackageInstaller.SessionParams) · [AppFunctions](https://developer.android.com/ai/appfunctions) · [The Intelligent OS (2026-02-25)](https://developer.android.com/blog/posts/the-intelligent-os-making-ai-agents-more-helpful-for-android-apps) · [Android 17 is Here (2026-06-16)](https://developer.android.com/blog/posts/android-17-is-here) · [Gemini multi-step tasks on Android](https://blog.google/innovation-and-ai/products/gemini-app/android-multi-step-tasks/) · [Android Central, Pixel 10 rollout](https://www.androidcentral.com/phones/google-pixel/gemini-screen-automation-expands-to-pixel-10-series).

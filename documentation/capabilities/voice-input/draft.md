# Voice input: draft

Open items only. Nothing here is agreed behavior yet: the owner has answered the decisions below in the thread (2026-11-18) but has not asked for a specification. Research: [voice-input-2026-11-18.md](../../research/voice-input-2026-11-18.md) (commit `00d569c`; its unverified claims are listed in its last section).

## Problem and intended outcome (proposed)

The owner can dictate a message instead of typing it, in every message box, on desktop, web and phone, and then send it as usual.

## Proposed behavior, to confirm

- A microphone button beside the send button in the shared composer (`apps/app/src/ui/controls.tsx`, `Composer`), so every message box has it.
- Pressing it starts listening; pressing it again or pausing ends it. The words go into the box at the cursor. Nothing is sent until the owner sends it.
- While listening, the button shows that, and a cancel discards what this session dictated, leaving the typed text as it was.
- When voice cannot run (permission refused, model not downloaded, host not reachable), the button says why in plain words; typing is never affected.
- Outlore stores no audio. Only the text the owner sends is kept, as any typed message is.

## Decided by the owner (2026-11-18)

- **No vendor receives audio.** Recognition runs on the owner's own computer or phone.
- **Model: `base`** (Whisper, 142 MiB, about 388 MB memory), downloaded once.
- **Languages: many**, so a multilingual model, not the `.en` variants.
- **No direct voice for now.** Speech-to-text only.
- **Phone: transcription on the phone itself**, through a native recogniser (`expo-speech-recognition`, MIT, needs a development build; SDK 58 support not verified). Not the host path.

## Consequences to settle

- **Two paths.** The phone uses its own recogniser, so desktop and web (host transcription with whisper.cpp, MIT, over the existing encrypted link) and the phone do not share one code path. The research's "one path everywhere" recommendation no longer holds for the phone.
- **Phone recognition and the vendor rule.** On iOS, `requiresOnDeviceRecognition` must be set so audio does not go to Apple's servers; on Android, `createOnDeviceSpeechRecognizer` needs a downloaded language model, and the default service may stream audio to Google (the research cites the Android reference). The owner's rule is that no vendor receives audio, so the phone path must refuse a recogniser that cannot run on device. Confirm this as the behavior.
- **Model file on the phone.** The phone path needs its own download (or none, if the platform's on-device model is used). Not yet researched for the phone.
- **Platform order.** The owner answered "I have no idea. We just ship text, not voice at the end." Read as no preference: desktop first, then phone and web, to confirm.
- **Licences.** Not yet decided by the owner. Proposal: exclude Moonshine's community-licensed non-English models and Vosk's non-commercial models; Parakeet v2 (CC-BY-4.0, English only) is allowed only if wanted.
- **Start and stop.** Proposal: press to start, press to stop (push-to-talk, no wake word). Not yet decided.
- **Out of this draft unless the owner asks:** spoken replies (reading aloud), voice commands such as "send", and voice in Chronicler's own replies.

## Constraints that apply

- [Local data](../../requirements.md#privacy-and-data): audio stays on the computer or phone unless the owner chooses a service.
- [Nearly free to run](../../requirements.md#budget): no project-run speech service, and the relay must not host model files (that would cost the project).
- [Same features in every app](../../requirements.md#access): desktop, web and phone offer the same voice input, with the nearest equivalent of each device's permission prompt.
- [Fully open source](../../requirements.md#licensing): every library and model used has its licence recorded, and the model's licence is checked too.

## Technical notes (not agreed behavior)

- Desktop is Electron `45.3.1`. The desktop build already carries Electron's default macOS microphone string ("This app needs access to the microphone") in its `Info.plist`; a clearer Outlore string would be set in packaging. The desktop source has no `setPermissionRequestHandler` (`apps/desktop/src`), so the microphone request must be tested in Electron, not assumed. Web Speech in Electron is not to be relied on until tested.
- The phone app is Expo `~58.0.25` on React Native `0.88.1`. `apps/app/app.json` turns `microphonePermission` and `recordAudioAndroid` off for the camera plugin; the phone path needs them on, plus iOS `NSSpeechRecognitionUsageDescription`. The phone path is a development build, not Expo Go.
- The web build runs in the browser, where microphone access needs a secure page (HTTPS or localhost). The relay serves the web build over HTTPS.

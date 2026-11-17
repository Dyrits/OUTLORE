# Voice input for the message boxes: primary-source notes

Researched 2026-11-18 for the owner's request to use voice instead of typed text in the app's message boxes (the composer), as speech-to-text or as direct voice. Research only: nothing was built, installed, cloned or changed except this note.

## Question

Can Outlore accept voice in its composer on desktop, web, Android and iOS, under the [requirements](../requirements.md)? Two options are compared:

- **(a) Speech-to-text**: the owner speaks, the audio becomes text in the composer, and the owner edits and sends it as usual.
- **(b) Direct voice**: a model takes audio in and answers with speech, in conversation.

The requirements that decide most of it: no infrastructure paid for other users ([Budget](../requirements.md#budget)); missions, threads and workspace contents stay on the user's computer, and nothing leaves it except what a harness, provider or connected service needs ([Local data](../requirements.md#privacy-and-data)); the same features in every app; and open-source licences for anything shipped ([Licensing](../requirements.md#licensing)).

## Outlore facts that shape the answer

Read at commit `00d569c` (2026-11-18).

- Desktop is Electron, pinned at `45.3.1` ([`apps/desktop/package.json:23`](../../apps/desktop/package.json)). When packaged, the window loads the app from `${appScheme}://app/`, and in development from a local server ([`apps/desktop/src/main.ts:23`, `:76`](../../apps/desktop/src/main.ts)). So desktop runs the same browser UI as the web app, inside Chromium.
- Desktop starts the Outlore service as a child process and loads it over a local WebSocket ([`apps/desktop/src/main.ts`](../../apps/desktop/src/main.ts), the `Outlore service` fork and its `ready` message). A host-side transcriber would run there.
- Phone is Expo `58.0.25` on React Native `0.88.1` ([`apps/app/package.json:18`, `:26`](../../apps/app/package.json)), with a native `android/` folder.
- The phone does not ask for the microphone today: `apps/app/app.json` sets `"microphonePermission": false` and `"recordAudioAndroid": false` for `expo-camera` (lines near 26 of that file).
- The message box is `ChipEditor`: native in [`apps/app/src/ui/chipEditor.tsx:8`](../../apps/app/src/ui/chipEditor.tsx), and the web version in [`apps/app/src/ui/chipEditor.web.tsx:96`](../../apps/app/src/ui/chipEditor.web.tsx). Web and desktop share the second one.

## Method

- Primary sources: W3C spec, Apple and Android reference pages, Electron docs, the owning repositories (README and LICENSE read at a pinned commit where one is given), model cards, and provider API references.
- WebFetch returns a model-written summary of each page. Quotes below are the summary's verbatim quotes; line numbers are not available. "Not read" means the page could not be opened, not that it is absent.
- Search results were used only as leads. Where a claim rests on a forum or thread, it is marked as such.
- Apple's own pages returned empty bodies. The same content was read from Apple's JSON data endpoints (`developer.apple.com/tutorials/data/documentation/...json`).

## Findings: speech-to-text (option a)

### Web (browsers)

- **Spec.** The W3C Web Speech API draft ([webaudio.github.io/web-speech-api](https://webaudio.github.io/web-speech-api/), Draft Community Group Report dated 27 October 2026). `processLocally` defaults to false: "user speech data might be sent to a remote server for processing". `true` means "the speech recognition process MUST be performed locally on the user's device."
- **Support.** MDN's browser-compat data (`mdn/browser-compat-data`, `api/SpeechRecognition.json`, read via WebFetch on 2026-11-18; the MDN page was last modified 2026-11-16) lists: Chrome 139 unprefixed and `webkit` prefix since 33; Chrome for Android mirrors Chrome; Safari 14.1, prefixed; Safari on iOS mirrors Safari; Firefox 160 (*unverified: I could not confirm this against Firefox release notes, and the summary may have misread it*); Firefox for Android not supported. Recognition on Chrome "You'll need to serve your code through a web server".
- **`processLocally`** (MDN data): Chrome 139; Chrome for Android not supported; Safari not supported.
- **Where audio goes.** By default a server. MDN: "On some browsers, speech recognition uses a server-based recognition engine by default. Your audio is sent to a web service for recognition processing." The vendor is not named on MDN. A Chromium-dev thread commenter says `webkitSpeechRecognition` "makes a network request to remote servers including an API key" ([thread](https://groups.google.com/a/chromium.org/g/chromium-dev/c/RBZXqc0Zvmc), 11 March 2025; a user comment, not a Chromium statement).
- **Cost.** No per-use fee is listed for the user or the project. *Not verified* for vendor terms.
- **Licence.** Browser-supplied; not applicable to Outlore's code.
- **Latency, accuracy, languages.** Not measured here.

### Electron (desktop)

- **Microphone permission.** Electron's session docs ([electronjs.org/docs/latest/api/session](https://www.electronjs.org/docs/latest/api/session)): `session.setPermissionRequestHandler` responds to requests such as "camera, microphone and speakers"; the handler must allow the `media` request.
- **Web Speech in Electron.** Reports since 2016 say `webkitSpeechRecognition` returns a `network` error inside Electron while it works in Chrome ([Chromium-dev thread](https://groups.google.com/a/chromium.org/g/chromium-dev/c/RBZXqc0Zvmc), opened 18 April 2016; a 2025 reply reports the same). One answer on Stack Overflow says Chromium does not ship the Google API keys that Speech needs; that is a secondary claim and is not confirmed here.
- **Primary-source gap.** Electron's build docs (`electron/electron`, `docs/development/build-instructions-gn.md` at `main`) mention no keys and no speech API. Chromium's `google_apis/README.md` could not be read (404 on the `chromium.googlesource.com` path, a sign-in redirect on `source.chromium.org`). **Not verified.**
- **Conclusion for Electron.** Web Speech cannot be assumed to work in Outlore's pinned Electron `45.3.1`. It needs a test before any reliance on it.

### Android

- **`SpeechRecognizer`** ([developer.android.com/reference/android/speech/SpeechRecognizer](https://developer.android.com/reference/android/speech/SpeechRecognizer), API 8). Quote: "The implementation of this API is likely to stream audio to remote servers to perform speech recognition." It needs `RECORD_AUDIO` and is "not intended to be used for continuous recognition".
- **On-device.** `SpeechRecognizer.createOnDeviceSpeechRecognizer(context)` (API 31) "will fail" if `isOnDeviceRecognitionAvailable(context)` is false. `triggerModelDownload` (API 33; with a listener, API 34) downloads language support and "might trigger user interaction to approve the download". The error `ERROR_LANGUAGE_UNAVAILABLE` (API 31) means the language is supported but not downloaded yet.
- **Default service.** The expo-speech-recognition README says the default depends on the OS version: "Usually this is `com.google.android.tts` on Android 13+". That is a third-party statement, **not verified** against Android's source.
- **Licence.** Platform-supplied; not applicable.

### iOS

- **`SFSpeechRecognizer`** availability: iOS 10.0+, macOS 10.15+, Mac Catalyst 10.0+, visionOS 1.0+ (Apple JSON, `sfspeechrecognizer.json`, read 2026-11-18). `supportsOnDeviceRecognition`: "A Boolean value that indicates whether the speech recognizer can operate without network access."
- **`SFSpeechRecognitionRequest.requiresOnDeviceRecognition`**: iOS 13.0+, macOS 10.15+. "Set this property to `true` to prevent an `SFSpeechRecognitionRequest` from sending audio over the network. However, on-device requests won't be as accurate." It is honoured only if `supportsOnDeviceRecognition` is true.
- **Server recognition.** Apple's permission guide says recognition "involves capturing audio of the user's voice and sending that data to Apple's servers for processing", and that the user's permission is needed "before sending that data across the network to Apple's servers". It adds that this applies only to `SFSpeechRecognizer`, and that `SpeechAnalyzer` transcriber modules "don't send audio data of the user's voice to Apple's servers" (Apple JSON, `asking-permission-to-use-speech-recognition.json`). `SpeechAnalyzer`'s availability was **not read**.
- **Permission key.** `NSSpeechRecognitionUsageDescription` must be in `Info.plist` "regardless of whether you set `requiresOnDeviceRecognition` to true or false. If this key is not present, your app will crash when it calls `requestAuthorization(_:)`."
- **Limits.** Apple's tips: recognition "places a relatively high burden on battery life and network usage", and "limits are enforced" on the network service.
- **Licence.** Platform-supplied.

### Expo and React Native (phone)

- **`expo-speech`** is text-to-speech only ([docs.expo.dev/versions/latest/sdk/speech](https://docs.expo.dev/versions/latest/sdk/speech/)). It is for speaking answers, not for recognition. It works on Android, iOS and web.
- **`expo-audio`** records and streams raw audio ([docs.expo.dev/versions/latest/sdk/audio](https://docs.expo.dev/versions/latest/sdk/audio/)). `useAudioStream` is "a native audio stream for real-time PCM microphone capture", with `float32` or `int16` samples at a configurable rate. `startFileRecordingAsync` writes WAV or raw PCM and is Android and iOS only. Web is listed, with the caveat "Web browsers require sites to be served securely for them to listen to a mic", and MediaRecorder "behavior varies by browser".
- **`expo-speech-recognition`** (jamsch, MIT per the repository page, [github.com/jamsch/expo-speech-recognition](https://github.com/jamsch/expo-speech-recognition)). Wraps `SFSpeechRecognizer` on iOS and the Android `SpeechRecognizer`; on web it wraps the Web Speech API (Chrome desktop, Safari desktop 16+, Chrome on Android; not Chrome on iOS, Brave or Firefox). It needs a config plugin and a development build, and "for projects without `ios/` and `android/` directories, you need to create a development build". Its install line pins "`expo-speech-recognition@^57.0.0 # Expo SDK 57`"; Outlore is on Expo SDK 58, so **compatibility is not verified**. Its Android on-device path needs a downloaded language model. Its `requiresOnDeviceRecognition` is "Prevent device from sending audio over the network. Only enabled if the device supports it."
- **Expo licence.** `expo/expo` `LICENSE` is MIT, "Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)" ([raw LICENSE](https://raw.githubusercontent.com/expo/expo/main/LICENSE), read 2026-11-18). The `expo-audio` and `expo-speech` pages name no licence of their own; they point to the same repository.

### Open-source engines that run on the user's computer

| Engine | Licence (source) | Platforms named | Models and languages | Install or download | Notes |
| --- | --- | --- | --- | --- | --- |
| **whisper.cpp** (`ggml-org/whisper.cpp`, commit [`8302b819`](https://github.com/ggml-org/whisper.cpp/commit/8302b819fc3096c03cedbc91ef1fe982cc6ebb77), 2026-11-17) | MIT; `LICENSE`: "Copyright (c) 2023-2026 The ggml authors" | macOS (Intel and Arm), iOS, Android, Java, Linux and FreeBSD, WebAssembly, Windows (MSVC and MinGW), Raspberry Pi, Docker (README) | `tiny`, `base`, `small`, `medium`, `large-v1/v2/v3`, `large-v3-turbo`, plus `.en` English-only variants (README). The unsuffixed ones are multilingual by Whisper's naming (inferred). | Model files on disk: tiny 75 MiB, base 142 MiB, small 466 MiB, medium 1.5 GiB, large 2.9 GiB; memory about 273 MB, 388 MB, 852 MB, 2.1 GB, 3.9 GB (README table). | `whisper-cli` "currently runs only with 16-bit WAV files"; the README gives an ffmpeg conversion example. Core ML and Metal on Apple; the ">x3 faster" Core ML claim is the project's own, not measured. |
| **Whisper models** (`openai/whisper`, README read 2026-11-18) | MIT: "Whisper's code and model weights are released under the MIT License." | n/a | multilingual and English-only sizes | n/a | The weights share the MIT licence with the code. |
| **sherpa-onnx** (`k2-fsa/sherpa-onnx`, commit [`aa273e80`](https://github.com/k2-fsa/sherpa-onnx/commit/aa273e8029af4e0aabac7d7455a177c5b493aa34), 2026-11-17) | Apache-2.0 (`LICENSE`, Apache License 2.0) | Android (x64, x86, arm64, arm32), iOS (arm64; Flutter builds "need to build from source"), HarmonyOS, Linux, macOS, Windows, WebAssembly. Electron **not listed**; only a third-party project mentions Electron. | Streaming and non-streaming Zipformer, Paraformer, CTC, Whisper tiny.en, Moonshine tiny, SenseVoice (Chinese, Cantonese, English, Korean, Japanese), NeMo Parakeet TDT 0.6B v2 int8 (English). README: the table "lists only SOME of them". | Per-model licences **not checked** one by one. | Node or Electron binding **not verified**. |
| **Vosk** (`alphacep/vosk-api`, commit [`4ab98215`](https://github.com/alphacep/vosk-api/commit/4ab9821510b488efb7740094714a130bd3545e90), 2026-10-15) | Apache-2.0 (`COPYING`) | Repository description: "Offline speech recognition API for Android, iOS, Raspberry Pi and servers with Python, Java, C# and Node." Electron and web **not stated**. | "20+ languages and dialects" (README), 25 listed. Model licences vary (alphacephei.com model table): most Apache 2.0; LGPL-3.0, GPLv3, CC-BY-NC-SA 4.0 (non-commercial, unsuitable), and MIT for some. | Models are downloaded as zip files from alphacephei.com. Small model "around 50Mb in size and requires about 300Mb of memory in runtime" (README). | Small English US model 40 MB (model table). |
| **Moonshine** (`moonshine-ai/moonshine`, `LICENSE` read 2026-11-18) | Code MIT; models MIT "by default"; **legacy non-English speech-to-text models fall under the Moonshine AI Community License Agreement** | not read | per language | not read | The community licence is not an OSI-approved licence, so it needs the owner's review before use. |
| **Parakeet TDT 0.6B v2** (`nvidia/parakeet-tdt-0.6b-v2`, Hugging Face model card, read 2026-11-18) | CC-BY-4.0 (model card) | n/a | English only ("high-quality English transcription") | About 600 million parameters | The multilingual Parakeet TDT 0.6B V3 is on the same page; its licence was **not read**. |

## Findings: direct voice (option b)

- **Claude API cannot take audio today.** Anthropic's Messages reference ([platform.claude.com/docs/en/api/messages.md](https://platform.claude.com/docs/en/api/messages.md), read 2026-11-18, first 100,000 of about 1.3 million characters, where the content-block list sits) lists user content block types `text`, `image`, `document`, `search_result`, and the tool and thinking blocks. It lists no `audio` or `video` block. Its media types are images (JPEG, PNG, GIF, WebP) and documents (PDF, plain text). So a direct conversation with Claude needs a separate speech step, either transcription or a voice model that talks to Claude as text. Claude's own apps were **not researched**.
- **OpenAI Realtime** ([developers.openai.com/api/docs/guides/realtime](https://developers.openai.com/api/docs/guides/realtime), redirected from `platform.openai.com`, read 2026-11-18). Transport: "connects over WebRTC in the browser or WebSocket on the server". The example names `gpt-realtime-2.1`. Audio formats, data retention and training terms are **not stated** on that page.
- **OpenAI prices** ([developers.openai.com/api/docs/pricing](https://developers.openai.com/api/docs/pricing), read 2026-11-18, no date shown): `gpt-realtime` audio input $32.00 and output $64.00 per 1M tokens; text input $4.00 and output $16.00; cached audio input $0.40. Transcription: `gpt-4o-transcribe` $0.006 per minute; `gpt-4o-mini-transcribe` $0.003 per minute; `whisper` $0.006 per minute. **No per-minute price for Realtime audio is listed**, so the cost of a minute of direct voice cannot be computed from this page.
- **Gemini Live** ([aistudio.google.com/docs/live-api](https://aistudio.google.com/docs/live-api), redirected from `ai.google.dev`, read 2026-11-18). Transport: "Stateful WebSocket connection (WSS)". Input: "raw 16-bit PCM audio, 16kHz, little-endian". Output: "raw 16-bit PCM audio, 24kHz, little-endian". Images up to one frame per second. Pricing, free-tier availability and audio billing are **not stated**.
- **Gemini Live model IDs** (AI Studio models page, [aistudio.google.com/docs/models](https://aistudio.google.com/docs/models), read through a summary, no date): `gemini-3.8-live`, `gemini-3.8-live-extended-thinking`, `gemini-3.1-flash-live-preview` (legacy), `gemini-2.5-flash-native-audio-preview-12-2025` (deprecated for new users), `gemini-3.5-live-translate-preview`. *Re-check these against the page before use.*
- **Phone capture** for a 16 kHz PCM stream is what `expo-audio`'s `useAudioStream` provides (see above).

## Recommendation

Build one path first, the same on every platform: **speech becomes text in the composer, and the owner sends it as usual.** Audio is transcribed on the owner's own computer, so it never goes to a vendor.

- **Desktop (Electron):** the window records through `getUserMedia`, after a `setPermissionRequestHandler` that allows `media`. The host service runs **whisper.cpp** (MIT) on the recorded audio, converted to 16-bit WAV, and returns text to the composer. Do not rely on Web Speech in Electron until it has been tested on `45.3.1`.
- **Web:** the same path as desktop. The browser records (on HTTPS, as Expo's own docs require for a microphone) and sends the audio over the existing encrypted connection to the owner's host, which runs whisper.cpp. The web app adds no new infrastructure, and the relay carries only encrypted audio it cannot read. Browser Web Speech is an opt-in alternative only, because its default sends audio to the browser vendor.
- **Android and iOS (phone):** the same host path. One behaviour for every app, no native module, no vendor. The phone's audio crosses the encrypted link to the computer, and latency is **not measured**. If that latency proves too high, the on-device recognisers are the alternative: `SFSpeechRecognitionRequest.requiresOnDeviceRecognition` on iOS and `createOnDeviceSpeechRecognizer` on Android, each through `expo-speech-recognition` (MIT, which needs a development build; SDK 58 compatibility not verified). That is an owner decision (see below).
- **Direct voice (b): not recommended now.** Claude takes no audio, so direct voice would need a voice provider (OpenAI or Google) that receives the owner's speech. That sends audio to a vendor and costs the owner, and Realtime's per-minute cost cannot be computed from the sources. If the owner wants it later, it should be a separate provider session under the owner's own key, with its transcript written to the thread.

Practical cost of the recommended path: no per-use fee to the owner or the project. The owner downloads one model file: `base` (142 MiB on disk, about 388 MB in memory) is my suggestion for multilingual use; `small` (466 MiB, about 852 MB) is more accurate; `tiny` (75 MiB) is smallest. Model download sources were **not verified**; a third-party host costs the project nothing, but the relay must not host the file, because that would cost the project.

## Owner decisions

1. **May speech leave the computer to a vendor?** Recommended answer: no. Browser Web Speech, Apple's `SFSpeechRecognizer` server path, Android's default recogniser and any Realtime or Gemini voice all send audio to a vendor.
2. **Is a model download of 75 to 466 MiB acceptable?** It is the one-time cost of the recommended path. The owner picks the size.
3. **Multilingual or English only?** Multilingual models are larger; `.en` models are English only.
4. **Is direct voice wanted at all**, and if so, with which provider key (OpenAI or Google)? It sends audio to that provider.
5. **Phone: host path or on-device recogniser?** The host path needs no native module; the on-device path needs `expo-speech-recognition` and a development build, and gives speed and no-vendor privacy on the phone.
6. **Microphone permission on the phone.** Today `apps/app/app.json` turns the microphone off. Enabling it changes what the owner is asked on install.
7. **Licences.** Exclude Moonshine's community-licensed non-English models and Vosk's non-commercial models unless the owner accepts them; Parakeet v2 is CC-BY-4.0 and English only.

## Not verified

- Chromium's `google_apis/README.md` (the Electron speech-key claim): not read. The Electron-key cause is secondary, from a thread and Stack Overflow.
- Firefox support for `SpeechRecognition`: the MDN data summary says Firefox 160; not confirmed.
- Apple's `SpeechAnalyzer` availability and behaviour beyond the permission page.
- Android's default recogniser package, on-device language list, and the `com.google.android.tts` claim (third-party README only).
- `expo-speech-recognition` on Expo SDK 58 (its README pins SDK 57).
- OpenAI Realtime audio formats, data-retention and training terms; Gemini Live pricing, free tier and audio billing; Gemini model IDs (summary, undated).
- Model download host for whisper.cpp models; sherpa-onnx Node or Electron binding; per-model licences in sherpa-onnx and Vosk beyond what the tables state.
- Latency, accuracy and CPU or memory cost on the owner's machine or phone: none measured here.
- Electron's licence: `electron/electron` `LICENSE` read as MIT, "Copyright (c) 2013-2020 GitHub Inc." (the copyright line is from the file; its MIT wording was matched, not checked word for word).
- Claude's own apps' voice mode: not researched.
- Parakeet TDT 0.6B V3 licence: not read.

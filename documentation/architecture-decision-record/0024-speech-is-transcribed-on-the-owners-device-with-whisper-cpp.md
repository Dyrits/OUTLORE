---
status: accepted
---

# Speech is transcribed on the owner's computer or phone, with whisper.cpp

Decided by the owner on 2026-11-18 in the quest's thread: no vendor receives audio, speech-to-text only, the `base` model, many languages, transcription on the phone itself, and the first batch tried with whisper.cpp on both apps ([voice-input draft](../capabilities/voice-input/draft.md), [research](../research/voice-input-2026-11-18.md)). The phone part is not yet verified (see Consequences).

## Why

- **No vendor receives audio.** The owner's rule, and [Local data](../requirements.md#privacy-and-data): the recording is transcribed on the device that made it, so nothing leaves it for voice.
- **One engine on both apps.** whisper.cpp runs on macOS, Windows, Linux, iOS and Android (its README, MIT licence, [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp)). The same ggml model file serves desktop and phone.
- **Nearly free to run.** No speech service is paid for by the project ([Budget](../requirements.md#budget)); the model is downloaded once by the owner.
- **Measured on the desktop path.** On this Mac, the `base` model transcribed an 11-second English recording correctly in 0.53 s on the CPU, and automatic language detection gave the same sentence (see the verification record).

## Considered Options

- **Web Speech API (browser or Electron)**: rejected as the default. The spec says the default may send audio to a remote server; `processLocally` keeps it local in Chrome 139 only, Safari does not support it, and Electron's own speech recognition failed in reports since 2016 ([research](../research/voice-input-2026-11-18.md)).
- **The phone's own recognisers (`SFSpeechRecognizer`, Android `SpeechRecognizer`)**: rejected as the only path. Apple's server recognition and Android's default service may send audio to a vendor; the on-device modes are per-device and need a language model download. Kept as a possible phone alternative behind the same rule.
- **Vendor speech APIs (OpenAI, Google) and direct voice**: rejected for now. The Claude API takes no audio input, so a voice provider would receive the owner's speech.
- **sherpa-onnx, Vosk, Moonshine, Parakeet**: not chosen. sherpa-onnx (Apache-2.0) lists no Electron binding; Vosk's and Moonshine's non-English models carry non-commercial or community licences; Parakeet v2 is English only (CC-BY-4.0). Each was checked in the research note.

## Consequences

- Each app ships whisper.cpp built for its platform, and the model is a download of about 142 MiB; neither is built into the app yet.
- Desktop and web need a host that runs the engine. The phone needs a native module wrapping whisper.cpp for Android and iOS; the module and its licence are not chosen yet.
- The engine's GPU path (Metal) aborted inside the sandbox and is not checked outside it; the CPU path is the one verified.
- Latency, memory and battery on a phone are not measured; the phone spike must measure them before the phone is built.
- The transcriber's inputs are a 16 kHz, mono, 16-bit WAV file. Other recordings are refused with a plain reason, not converted.

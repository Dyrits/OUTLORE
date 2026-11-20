# Verification of automatic desktop voice setup

Worktree `.worktrees/desktop-voice-setup`, based on `801e8c77`.
The owner requested automatic setup on 2026-11-20, and [ADR 0024](../architecture-decision-record/0024-speech-is-transcribed-on-the-owners-device-with-whisper-cpp.md) calls for bundling the engine and downloading the model.

- The focused suite passed with 24 tests and three opt-in skips.
- The model tests exercise one download for concurrent requests, cache reuse, checksum rejection, and retry after a bad download.
- The dictation tests exercise the bundled paths and the manual paths through the service.
- The packaging script built and launched whisper.cpp at `8302b819fc3096c03cedbc91ef1fe982cc6ebb77` on macOS arm64 with CMake 4.2.3.
- A clean data directory downloaded the 147,951,465-byte `ggml-base.bin` from Hugging Face and verified SHA-256 `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe`.
- With the downloaded model, the new engine, and both manual variables unset, `ReadDictation` reported ready and `TranscribeDictation` returned the expected words from whisper.cpp's `jfk.wav`.

The first press still needs a microphone permission grant and an internet connection to download the model.
A real microphone and macOS Intel, Windows, and Linux installers are unverified.

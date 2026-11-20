# Handoff: Automatic desktop voice input setup

Supersedes: none
Workspace: OUTLORE repository, branch `worktree/desktop-voice-setup` (worktree `.worktrees/desktop-voice-setup`), published to `origin/main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The desktop microphone works without the owner setting `OUTLORE_WHISPER_CLI` and `OUTLORE_WHISPER_MODEL`: the installers ship whisper.cpp and the first press downloads and verifies the model. Done means a packaged app on each platform dictates on a fresh machine with only an internet connection and a microphone grant.

## State

- Implemented and committed as "Set up desktop voice input automatically" (CHG-0594, rebased onto `origin/main` at `d0e4574c`). Verified before the rebase: Biome clean, typecheck of all 7 workspaces, 24 focused voice and packaging tests, and the full suite (2,600 passed; one timing test in `stdioMcp.test.ts` failed under load and passed alone, 13 of 13).
- Verified: a clean data directory downloaded `ggml-base.bin` (147,951,465 bytes) with the pinned SHA-256, and the macOS arm64 engine transcribed whisper.cpp's `jfk.wav` through the service with both manual variables unset. The engine's Mach-O minimum is macOS 13.0, equal to Electron's `LSMinimumSystemVersion` (checked with `otool` and `PlistBuddy`).
- Assumed: the post-rebase result. Only the changelog conflicted (renumbered CHG-0591 to CHG-0594); lint, typecheck and the voice and desktop tests were run again after it, see the changelog and verification note for recorded results.
- Not verified: a real microphone, a packaged and signed app launched from an installer, macOS Intel, Windows, and Linux builds. The x64 build disables AVX, AVX2, BMI2, FMA, F16C, and SSE4.2 for portability and has not been run.
- Searched all 13 worktrees, branches, and history on 2026-11-20: no earlier automatic setup existed; only the batch 2 dictation (0.1.9) did.

## Decisions

- Bundle the engine in installers and download the model on first use, as [ADR 0024](../../documentation/architecture-decision-record/0024-speech-is-transcribed-on-the-owners-device-with-whisper-cpp.md) says; no new service or vendor.
- The model is the multilingual `base`, downloaded from Hugging Face and refused on any SHA-256 mismatch; a later press retries a failed download.
- whisper.cpp is pinned at `8302b819fc3096c03cedbc91ef1fe982cc6ebb77`, built by `apps/desktop/scripts/buildWhisper.ts`, which needs Git, CMake, and a C and C++ compiler at packaging time.
- Explicit `OUTLORE_WHISPER_CLI` and `OUTLORE_WHISPER_MODEL` still win over automatic setup.

## Next

1. Run a packaged desktop build (`bun run package`) and press the microphone on a clean profile with a real microphone; confirm the permission prompt, the one-time download, and offline reuse.
2. Build and run the Windows, Linux, and macOS Intel installers, checking the bundled engine starts.
3. Show download progress or a clear failure message in the composer if the owner finds the first press too quiet (the service's `whisperModel.ts` reports no download progress; what the composer shows while waiting was not checked).
4. Mobile voice input and the web app remain outside this batch (see the work in progress).

## Open questions

- Is a download of 141 MiB on first press acceptable on metered connections, or should the owner confirm it first? The owner decides.
- Should the model be configurable in the Workshop (backlog item deferred from batch 2)?

## Sources

- `documentation/verification/2026-11-20-desktop-voice-setup.md`
- `documentation/changelog/0.1.13-Prototype.md` (CHG-0594)
- `documentation/work-in-progress.md` (Voice input, batch 3)
- `packages/service/src/voice/whisperModel.ts`, `packages/service/src/voice/dictation.ts`, `apps/desktop/src/whisper.ts`, `apps/desktop/scripts/buildWhisper.ts`
- `README.md` (packaging and voice setup notes)

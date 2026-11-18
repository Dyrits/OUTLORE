# Verification: dictation in the desktop window, batch 2 (2026-11-18)

Batch: [CHG-0499](../changelog/0.1.8-Prototype.md), on [CHG-0450](../changelog/0.1.8-Prototype.md), [CHG-0451](../changelog/0.1.8-Prototype.md) and [ADR 0024](../architecture-decision-record/0024-speech-is-transcribed-on-the-owners-device-with-whisper-cpp.md). Worktree `.worktrees/voice-dictation` on `worktree/voice-dictation`, started from `main` at `a42c282`, then rebased onto `main` at `8720dc5` (CHG-0498). The checks below ran before the rebase, on the owner's Mac, unless a line says otherwise; the rebase had no conflict. After it, Biome, typecheck and the full suite ran again: 258 files passed, 4 skipped; 2,080 tests passed, 55 skipped. The window run was not repeated after it.

## Engine

The same build as [batch 1](2026-11-18-voice-transcriber.md): whisper.cpp at `8302b819`, model `ggml-base.bin` (sha256 `60ed5bc3…fba2efe`), in `$TMPDIR/outlore-voice`, and its sample `jfk.wav` (16 kHz, mono, 11 s).

## Checks that passed

- Biome (`biome check .`, 884 files) and `bun run typecheck` on all seven workspaces: exit 0. The pre-commit hook ran both again, and the tests related to the changed files (163 files passed, 2 skipped; 1,317 tests passed, 11 skipped).
- Full suite, `CI=1 bun run test`, inside the sandbox: 258 files passed, 4 skipped; 2,079 tests passed, 55 skipped; 82 s. The sandbox skips the Seatbelt, process-table and pty tests, and the engine tests skip without their paths.
- New tests: `apps/app/test/dictation/dictation.test.ts` (12: the WAV and resampling, placing the words, engine markers, microphone refusals) and `packages/service/test/voice/dictation.test.ts` (7, with an executable standing in for the engine, plus one opt-in that runs a real recording through whisper.cpp when `OUTLORE_WHISPER_CLI`, `OUTLORE_WHISPER_MODEL` and `OUTLORE_WHISPER_SAMPLE` are set).
- A real window: `drive.ts` in this folder starts a throwaway Electron (fake harness, temporary data folder, never the owner's profile) on the exported app, with Chromium's fake microphone playing `jfk.wav`, and drives it over the debugging protocol. Run outside the sandbox, because Electron cannot open a window inside it. Result, from the run's output:
  - Cancel: after typing "Typed first:", a press and a cancel left the box as `"Typed first:"` (`listening.png` shows the recording state with the cross).
  - Dictation: the second press recorded about 11 s and, after the stop, `"Typed first: And so my fellow Americans, ask not what your country can do for you, ask what you can do for your country."` (`transcribing.png`, `transcribed.png`). No error showed under the box.
  - Without the engine's settings: the press showed "Voice input is not set up on this computer: set OUTLORE_WHISPER_CLI …" and the button stayed **Dictate** (`not-set-up.png`).

## Faults found while checking, both in the harness, not the app

- The first run transcribed "you" only. Chromium's audio sandbox could not read the speech file ("Failed to read … as input to the fake device"), so the fake microphone was silent. The script now starts its throwaway window with `--no-sandbox`.
- Chromium's echo cancellation and noise suppression treat a played-back file as noise, so the script opens the fake microphone without them. The app keeps its own settings (`echoCancellation` and `noiseSuppression` on) for a real microphone; whether they help or hurt real speech is not checked.

## Not checked

- A real microphone, and a person's voice.
- Languages other than English.
- The GPU path outside the sandbox (the window run set `OUTLORE_WHISPER_GPU=false`).
- Windows and Linux; a packaged build (nothing bundles the engine or the model yet).
- The native editor's `insertText` and the phone: the phone offers no microphone in this batch, and only typecheck covers `chipEditor.tsx`.
- The microphone permission prompt of macOS in the packaged app (the fake interface accepts it).
- The window run after the rebase onto `main`.
- The owner's look at the button's place and states.

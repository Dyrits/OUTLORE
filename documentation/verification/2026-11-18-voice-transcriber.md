# Verification: the voice transcriber, batch 1 (2026-11-18)

Batch: [CHG-0451](../changelog/0.1.8-Prototype.md), approach [CHG-0450](../changelog/0.1.8-Prototype.md) and [ADR 0024](../architecture-decision-record/0024-speech-is-transcribed-on-the-owners-device-with-whisper-cpp.md). Worktree `.worktrees/voice-input` on `worktree/voice-input`, starting from `main` at `00d569c`. Everything below was run in this session, in Claude Code's sandbox on the owner's Mac, unless a line says otherwise.

## Engine and model

- whisper.cpp at commit `8302b819fc3096c03cedbc91ef1fe982cc6ebb77`, cloned from `github.com/ggml-org/whisper.cpp` and built with CMake (Release, tests off): `whisper-cli` and `libwhisper` 1.9.5. Built outside the repository, in `$TMPDIR/outlore-voice`.
- Model `ggml-base.bin` from `huggingface.co/ggerganov/whisper.cpp`: 147,951,465 bytes (about 141 MiB), sha256 `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe`. Multilingual (no `.en` suffix).
- Sample: whisper.cpp's `samples/jfk.wav`, 16 kHz, mono, 16-bit PCM, 11.0 s. The `say` command produced silent audio in the sandbox, so it was not used.

## Engine runs (direct, outside the module)

| Run | Result |
| --- | --- |
| `whisper-cli -m base -f jfk.wav -np -nt -l en` (GPU on) | aborted: `GGML_ASSERT(buffer) failed` in `ggml-backend.cpp`, inside `whisper_init`; the sandbox blocks the GPU buffer |
| `whisper-cli -ng ... -l en` (CPU) | exit 0, 0.53 s wall, user 1.46 s; "And so my fellow Americans, ask not what your country can do for you, ask what you can do for your country." |
| `whisper-cli -ng ... -l auto` (CPU) | exit 0, same sentence |

Peak memory was not measured: the sandbox hides the engine's process from `ps`, and `/usr/bin/time -l` is refused (`sysctl` not permitted).

## Module tests

Command, from the worktree root: `ELECTRON_RUN_AS_NODE=1 npx --no-install electron node_modules/vitest/vitest.mjs run packages/service/test/voice/transcribe.test.ts`.

- Without the engine's paths: 7 passed, 2 skipped (the two engine tests).
- With `OUTLORE_WHISPER_CLI`, `OUTLORE_WHISPER_MODEL`, `OUTLORE_WHISPER_SAMPLE` set to the build, the model and `jfk.wav`, and `OUTLORE_WHISPER_GPU=false`: 9 passed. The transcript contains "ask not what your country can do for you".

The test set covers: a valid 16 kHz mono 16-bit header; a non-WAV file; stereo, 44.1 kHz, 8-bit and compressed audio; an empty recording; a recording cut short; a missing engine (a plain failure, no empty transcript); a missing recording; missing settings failing through `Config`; the defaults (`auto`, GPU on).

## Other checks

- `tsc -p .` in `packages/service`: exit 0.
- `biome check` on `packages/service/src/voice` and `packages/service/test/voice`: exit 0 (after Biome's formatter rewrote both files).
- Full suite, `CI=1 bun run test`: 254 files passed, 4 skipped; 2,055 tests passed, 56 skipped; 66 s. The sandbox skips the Seatbelt, process-table and pty tests, and the engine tests skip without their paths.

## Not checked

- The GPU path outside the sandbox (the sandbox aborts Metal).
- Peak memory, latency, battery: no phone build, and no `ps` in the sandbox.
- Windows and Linux builds of the engine.
- The composer, the microphone, the recording, and the phone: not built in this batch.
- The engine running on the owner's Mac outside the sandbox, with the GPU on.
- Licences of the model and engine beyond the sources cited in the research note: MIT for whisper.cpp and Whisper's weights, as its README and repository state.

## Merge into `main`

With the voice batch merged into the tree at `b2a6d42`, `bun run typecheck`, `CI=1 bun run test`, and `bun run check` passed. The suite reported 2,074 passed and 52 skipped. The engine and model from the original run were unavailable in this session, so the two tests that require them were skipped.

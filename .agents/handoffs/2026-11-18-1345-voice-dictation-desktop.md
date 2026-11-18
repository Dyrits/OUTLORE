# Handoff: voice input, desktop dictation built

Supersedes: [2026-11-18-0109-voice-input.md](2026-11-18-0109-voice-input.md)
Workspace: repository `Dyrits/OUTLORE` (checkout `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`). Built in `.worktrees/voice-dictation` on `worktree/voice-dictation`, started from `main` at `a42c282` and rebased onto `main` at `8720dc5` (which was also `origin/main`).

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner can dictate a message instead of typing it, in every message box, on desktop, web and phone, then send it as usual; speech is transcribed on the owner's own computer or phone with whisper.cpp and no vendor receives audio (ADR 0024). This batch, "the audio message", is desktop only: a microphone button in the shared Composer. Done for the whole feature means the same on the web app and the phone, the engine and model reaching a packaged build, and the owner accepting how the button looks and feels.

## State

- Delivered as CHG-0499 (`documentation/changelog/0.1.8-Prototype.md`): the Composer's microphone button (press to record, press to stop, a cross cancels and discards); the window records raw samples, resamples to 16 kHz mono and writes a 16-bit WAV; the new service requests `ReadDictation` (can the host transcribe now, with the reason if not) and `TranscribeDictation` (one base64 WAV, at most five minutes) run `transcribeWav` from CHG-0451 on a private temporary folder erased afterwards; the words are inserted at the cursor of the box, never sent. Without `OUTLORE_WHISPER_CLI` and `OUTLORE_WHISPER_MODEL`, or with a missing tool or model, the press shows the reason and nothing records. A page without the desktop bridge (a browser, the phone) shows no microphone.
- Code: `apps/app/src/dictation/` (`dictation.ts` pure logic, `dictationButton.tsx`, `useDictation.ts`, `recorder.web.ts`, `recorder.ts`, `recorderTypes.ts`); `insertText` on both editors (`apps/app/src/ui/chipEditor.tsx`, `chipEditor.web.tsx`); `apps/app/src/ui/chipEditorDom.ts` and `composerMenu.tsx` were split out to stay under the size limits; `packages/contracts/src/dictation.ts` and the two requests; `packages/service/src/voice/dictation.ts` with its handlers in `packages/service/src/work/messagesHandlers.ts`.
- Verified in this session: `bunx biome check .`, `bun run typecheck` (all seven workspaces) and `CI=1 bun run test` pass on the rebased tree: 258 files passed, 4 skipped; 2,080 tests passed, 55 skipped. New tests: 12 in `apps/app/test/dictation/dictation.test.ts`, 8 (1 opt-in, skipped without the engine) in `packages/service/test/voice/dictation.test.ts`.
- Verified in this session, before the rebase: a real throwaway Electron window driven by `documentation/verification/2026-11-18-dictation/drive.ts` (fake harness, temporary data folder, Chromium's fake microphone playing whisper.cpp's `jfk.wav`, real engine, CPU): cancel left the typed text alone; a dictation put "And so my fellow Americans, ask not what your country can do for you, ask what you can do for your country." after the typed text; without the engine's settings the "not set up" reason showed. Screenshots sit beside the script. The window run needs a machine that can open a window (not Claude Code's sandbox) and needs `--no-sandbox` for the fake microphone to read its file. The window run was not repeated after the rebase.
- Assumed, not checked: a real microphone and voice; echo cancellation and noise suppression on a real microphone (the app keeps them on; the script turns them off for the fake one); languages other than English; Windows and Linux; the GPU path outside the sandbox (the window run set `OUTLORE_WHISPER_GPU=false`); the native editor's `insertText` beyond typecheck; macOS's microphone prompt in a packaged app.
- The engine for trying it by hand is whisper.cpp at `8302b819` built under `$TMPDIR/outlore-voice/whisper.cpp` with `models/ggml-base.bin` (sha256 `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe`); a new session may find `$TMPDIR` emptied and need to rebuild (see the transcriber verification).
- The owner has not seen the button.

## Decisions

- **Desktop dictation only, press to start and press to stop, cancel discards, text inserted never sent, engine and model from `OUTLORE_WHISPER_CLI` / `OUTLORE_WHISPER_MODEL`.** Owner, 2026-11-18, in the quest journal (entry 1); packaging, download, web and phone are later batches.
- **The recording is raw samples from the audio graph, converted in the window to the WAV the engine reads**, so no codec runs on either side and the service keeps refusing anything but 16 kHz mono 16-bit (CHG-0451). The `ScriptProcessor` node is deprecated but runs in Chromium; an audio worklet would need its own module file. My choice, unconfirmed by the owner.
- **No audio is kept**: the service erases the temporary folder whatever the outcome (ADR 0024).
- Earlier decisions stand: no vendor receives audio; whisper.cpp on both apps with the `base` model; the phone transcribes on the phone itself (see the superseded handoff and ADR 0024).

## Next

1. Ask the owner to try the button in a window with a real microphone (the engine variables set) and say whether its place and states are right; fix what they find.
2. Decide the next batch with the owner: the engine and model reaching a packaged build (bundling or a download, and a setting in the Workshop instead of environment variables), or the web app and the phone. The phone still needs the spike (time, memory and battery of `base` on a device, the module's licence, whether `expo-speech-recognition` is needed); the app's `app.json` turns the microphone permission off today.
3. Repeat the window run (`drive.ts`) on the merged tree when convenient: from `apps/desktop` after `bun run build` and a web export of `apps/app`, as the script's header says.

## Open questions

- Licences to exclude (owner): the draft proposes Moonshine's community-licensed non-English models and Vosk's non-commercial models. No answer yet.
- Whether the phone spike goes before the packaging work (owner).
- Whether noise suppression and echo cancellation help or hurt real speech with `base` (a try with a real microphone answers it).

## Sources

- Quest journal entry 1 (the owner's agreement, 2026-11-18).
- Commits `04e9fcb` (code) and `b6bcfb2` (documents) on `worktree/voice-dictation`, on base `8720dc5`; this handoff is committed after them.
- `documentation/changelog/0.1.8-Prototype.md` (CHG-0450, CHG-0451, CHG-0499); `documentation/verification/2026-11-18-dictation.md` and its folder; `documentation/verification/2026-11-18-voice-transcriber.md`; `documentation/work-in-progress.md` (Voice input).
- `documentation/capabilities/voice-input/draft.md`, `documentation/research/voice-input-2026-11-18.md`, `documentation/architecture-decision-record/0024-speech-is-transcribed-on-the-owners-device-with-whisper-cpp.md`.
- whisper.cpp: `https://github.com/ggml-org/whisper.cpp` at `8302b819fc3096c03cedbc91ef1fe982cc6ebb77` (MIT); model `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin`.

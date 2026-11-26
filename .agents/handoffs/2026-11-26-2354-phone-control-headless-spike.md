# Handoff: phone control step 1 delivered, step 2 headless spike awaiting the owner

Supersedes: `2026-11-26-2200-phone-control-step-1-built.md`
Workspace: OUTLORE repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Let agents control the owner's phone through `phone_*` tools that the Android app executes.
Step 1 (the app's own capabilities) is built; done means the owner has checked it on a real phone.
Step 2 is headless control in the background, without taking over the screen the owner uses; done means it is specified and built after a real-phone spike proves a background screen works on the owner's phone.

## State

- Step 1 is on `origin/main` (verified: `git merge-base --is-ancestor 875e5138 origin/main` succeeds, and `git rev-list --left-right --count origin/main...main` printed `0 0` after a fetch on 2026-11-26): wire schemas, `PhoneLink`, `Sessions.sendTo`, six `phone_*` tools, the app's executor, switches, settings card and hook, and the thread panel's list of phone tools that are on.
- Verified: `CI=1 bun run test` passed 3,652 tests (30 skipped) before the thread-panel change; after it only the related tests (1,433 passed), the typecheck and Biome ran.
- Not verified: anything on an Android emulator or a real phone; the direct WebRTC path (only a real local relay is tested); Android's permission prompts; the app staying connected in the background.
- The research note `documentation/research/phone-headless-control-2026-11-26.md` (committed) finds that background control needs a trusted virtual display made by the ADB shell identity, reached through Shizuku or the app's own wireless-debugging link; the only known real-phone proof is one Honor phone on Android 17. Its claims come from AOSP and project sources and have not been run on the owner's phone.
- The spike checklist `documentation/capabilities/phone-control/spike-background-screen.md` (committed) is for the owner to run; its stage A needs only a computer with `adb` and scrcpy 3.0 or newer. No results have come back.
- Another quest works in the same checkout (phone Back button, growing bar, mobile menu); its changes were uncommitted when this was written and are not part of this work.

## Decisions

- The phone's per-group switch is the only consent; each call names its phone in an optional `phone` argument (owner, 2026-11-26; CHG-0768; the "named phone" reading of "the targeted one" is mine and unconfirmed).
- Step 2 is headless, not an accessibility service on the real screen (owner, 2026-11-26; CHG-0771).
- A real-phone spike comes before any step 2 specification, decision record or code (owner, 2026-11-26; CHG-0771).
- Environment: the host's git environment lacks `GIT_CONFIG_VALUE_0`, so every git command needs a `GIT_CONFIG_COUNT=0` prefix; own-copy errands are refused for that reason; `bun install` runs outside the sandbox.

## Next

1. The owner installs a new APK (six Expo packages and location permissions were added), turns on groups in Menu, Settings, Permissions and calls each tool from a thread on the real phone; fix what the phone shows.
2. The owner runs stage A of the spike and reports the phone's model, Android version and each step's result.
3. If stage A passes, choose between Shizuku and the app's own wireless debugging, then build stage B (a throwaway in-app bridge that creates the hidden display and starts Settings on it); if it fails, report which step failed and reconsider step 2.
4. After the spike, specify step 2 with its own decision record (a shell-level grant widens the app's trust) and a separate switch.

## Open questions

- Whether the owner's phone supports a trusted virtual display (stage A answers it).
- Shizuku or self-adb for the shell identity, after stage A.
- Whether step 1 needs a foreground service to stay connected in the background (a real-phone measurement).
- Whether `PhoneCall` reaches one device on the direct path as it does through the relay.

## Sources

- `documentation/changelog/0.2.10-Pre-Alpha.md` (CHG-0767, CHG-0768, CHG-0770, CHG-0771), `documentation/work-in-progress.md`
- `documentation/capabilities/phone-control/specifications.md`, `blueprint.md`, `spike-background-screen.md`
- `documentation/research/phone-headless-control-2026-11-26.md`
- `documentation/architecture-decision-record/0028-phone-tools-served-by-the-paired-app-over-the-existing-channel.md`
- Quest journal entries 1 to 7 of "Remotely control the mobile phone"

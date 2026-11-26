# Handoff: phone control step 1 built and merged, real-phone check open

Supersedes: `2026-11-26-1700-phone-control-design.md`
Workspace: OUTLORE repository, branch `main` (local, not pushed)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Let agents control the owner's phone through `phone_*` tools that the Android app executes; step 1 is the app's own capabilities.
Done means step 1 is checked on a real phone by the owner; step 2 (whole-screen control through an accessibility service) is specified and built separately.

## State

- Built and merged on `main` (verified: `git log`, merge `ac964033`, hookup `b7dc8802`, work-in-progress `62f94b29`, plus the thread-panel commit that follows them): wire schemas in `packages/contracts/src/phoneCalls.ts`; `Sessions.sendTo`, `PhoneLink`, the six tools and handlers in `packages/service/src/work/phone*.ts`; the executor, device seam, switches, settings card and hook in `apps/app/src/phone/` and `apps/app/src/settings/phoneUse.tsx`.
- Verified: `CI=1 bun run test` passed 3,652 tests (30 skipped) before the thread-panel change; after it, the workspace typecheck, Biome and `phoneTools.test.ts` with `threadPanelTools.test.ts` (12 tests) passed. The full suite was not rerun after the thread-panel change.
- Not verified: anything on an Android emulator or a real phone; the direct WebRTC path (only a real local relay is tested); Android's permission prompts, the notification channel, `Linking`; whether the app stays connected in the background.
- Not pushed. Another quest has uncommitted Back-button work (CHG-0769: `narrowShell.tsx`, `phoneShell.ts`, its test, and an entry in the 0.2.10 changelog) and mobile-menu boards in the main checkout; leave them.
- The build adds six Expo packages and Android location permissions: the phone needs a new APK.

## Decisions

- The phone's per-group switch is the only consent; no per-call approval, no Always allow (owner, 2026-11-26; CHG-0768).
- Every call names its phone in an optional `phone` argument, which may be left out while exactly one phone is connected; this is my reading of the owner's "the targeted one" and should be confirmed.
- Builders' choices the owner may redirect (CHG-0770): `phone_open` takes `{url}` (http, https, mailto, tel, sms, geo) or `{app}` (calendar, dialer, email, maps, messages, settings, spotify, telegram, whatsapp, youtube); `phone_notify` title defaults to "Outlore"; a phone is named by its paired-device name, ignoring case.
- Environment: own-copy errands were refused here because the host's git environment lacks `GIT_CONFIG_VALUE_0`; every git command needs `GIT_CONFIG_COUNT=0`, and `bun install` must run outside the sandbox.

## Next

1. The owner installs a new APK, turns on groups in Menu, Settings, Permissions, and calls each tool from a thread on the real phone; fix what the phone shows.
2. Confirm the "the targeted one" reading and redirect the builders' choices if wanted.
3. Push to `main` once the owner approves (ask first).
4. Specify step 2 (accessibility service in a Kotlin module like `apps/app/modules/outlore-installer`) with its own record.

## Open questions

- Whether step 1 needs a foreground service to stay connected in the background (a real-phone measurement).
- Whether `PhoneCall` reaches one device on the direct path as it does through the relay (a direct-path test is missing).
- Two paired phones with the same name are refused as ambiguous when named; untested.

## Sources

- `documentation/changelog/0.2.10-Pre-Alpha.md` (CHG-0767, CHG-0768, CHG-0770), `documentation/work-in-progress.md`
- `documentation/capabilities/phone-control/specifications.md`, `blueprint.md`
- `documentation/architecture-decision-record/0028-phone-tools-served-by-the-paired-app-over-the-existing-channel.md`
- Quest journal entries 1 to 4 of "Remotely control the mobile phone"

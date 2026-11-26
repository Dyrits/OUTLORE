# Phone control blueprint

Status: proposed technical design, 2026-11-26, for the owner's review, under the [specifications](specifications.md) and [0028](../../architecture-decision-record/0028-phone-tools-served-by-the-paired-app-over-the-existing-channel.md); step 1 only.

The host keeps the agents' door (its MCP tool server, [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)) and the paired app executes.
A call goes thread tool, host module, `PhoneCall` frame to one device, the app's executor, `AnswerPhoneCall` request, back to the waiting tool.
Parts touched: `packages/contracts`, `packages/service` (`core/sessions.ts`, `work/`), `packages/controller`, `apps/app`.
No new part, no store, no relay change.

## Modules

- **Phone wire** (`packages/contracts/src/phoneCalls.ts`): the schemas. `PhoneCall` server frame `{callId, deviceId, tool, args}`; requests `SetPhoneTools {tools: ReadonlyArray<PhoneGroup>}` (the groups switched on, sent on connect and on each change) and `AnswerPhoneCall {callId, outcome}` where outcome is `Done {value}` or `Refused {reason}`. Request source rules: both accepted from a paired device only. Optional-field and unknown-frame rules as in the wire-compatibility lore.
- **Phone tools catalogue entries** (`packages/service/src/work/phoneToolDefinitions.ts`): each `phone_*` tool defined once beside the other definitions in `threadTools.ts`: name, description, argument schema (every tool also takes an optional `phone`) and group. Offered to a thread only when `PhoneLink.isAvailable` holds.
- **Phone link** (`packages/service/src/work/phoneLink.ts`, a service): the host's one place that knows which paired phone is connected and which groups it allows. Interface: `isAvailable`, `call(group, tool, args, phone?): Effect<Value, PhoneRefusal>`, where `phone` names a paired phone and may be left out only while exactly one phone with the group on is connected. It records the phone's `SetPhoneTools`, sends a `PhoneCall` to that device through `Sessions.sendTo`, waits for its `AnswerPhoneCall` with a 30 second limit, and fails at once with "No phone connected" or a refusal sentence. A pending call fails when its session is removed. Holds no persisted data.
- **Sessions targeting** (`core/sessions.ts`): `add` takes the device's identity, and `sendTo(deviceId, frame)` is added beside `broadcast`. The device identity comes from the paired-device record the host already keeps.
- **Phone tool handlers** (`work/phoneToolHandlers.ts`): bind each tool to `PhoneLink.call`. No approval path: the phone's switch is the consent (owner, 2026-11-26).
- **Phone executor** (`apps/app/src/phone/phoneExecutor.ts`): given a `PhoneCall`, checks the group's switch, then runs the tool through a `PhoneDevice` seam and answers. Interface: `execute(call): Promise<Outcome>`. Never throws; an Android refusal becomes `Refused`.
- **Phone device seam** (`apps/app/src/phone/phoneDevice.ts`, `.native.ts`, `.web.ts`): one function per tool over `expo-battery`, `expo-network`, `expo-device`, `expo-location`, `expo-clipboard`, `Linking`, `expo-notifications`. The web adapter answers every call `Refused: "This is not the phone app"`, so a browser never offers tools. Check each Expo API against the docs of the installed SDK before use ([apps/app/AGENTS.md](../../../apps/app/AGENTS.md)).
- **Phone consent settings** (`apps/app/src/settings/phoneUse.tsx`, `apps/app/src/phone/phoneSwitches.ts`): the card of switches, stored in `expo-secure-store` on the phone; after a change it sends `SetPhoneTools`. A switch is never read from the host.

## Data

The host stores nothing: the phone's groups and pending calls live in memory and die with the session.
The switches live on the phone only.
A standing permission from Always allow is stored by the existing permission store.

## Seams

- **PhoneDevice**: what runs on Android versus what a browser or test supplies; adapters: Expo native, web refusal, fake with canned values.
- **Sessions sink**: a connected device; adapters: real transports, a test sink that records frames.

## Acceptance

| Acceptance criterion | Module and test seam |
| --- | --- |
| Switch off refuses and does nothing | Phone executor; fake `PhoneDevice`, assert not called |
| Allowed call returns the phone's value; clipboard round trip | Phone link with a test sink wired to the executor and a fake device |
| No phone connected fails at once; several phones need `phone` | Phone link `call`, no sink registered, two sinks registered |
| Thread, Chronicler and other devices cannot change switches | Phone wire request source rules; request handler test |
| Same tools on every harness | Tool catalogue listing test; tools come from `threadTools` only |
| Old and new peers coexist | Wire schema decode test with an unknown frame and a missing optional field |

## Requirements

| Requirement | How the design meets it |
| --- | --- |
| Approval per action | Owner's choice (2026-11-26): the phone's switch is the consent, no per-call approval for `phone_*` tools |
| Same features in every app | The tools sit in the host tool server; every paired phone works, a browser shows none |
| Local data | Host stores nothing; the card says results reach the model provider |
| Nearly free to run | A call is one small frame each way on the existing link |

## Alternatives

- **ADB**, **an MCP server in the APK**, **an external MCP endpoint**: see 0028.
- **Broadcasting `PhoneCall` to every device**: rejected, it hands the call to screens that are not the phone.

## Open

- Several phones: decided (owner, 2026-11-26): the call names the phone in `phone`; with several connected and none named it fails naming them.
- Foreground service: recommendation, none in step 1; measure on a real phone first.
- Step 2 (accessibility service in a Kotlin module like `outlore-installer`) gets its own specification and record.

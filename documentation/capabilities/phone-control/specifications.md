# Phone control

## Implementation status · 2026-11-26

**Step 1 is agreed (owner, 2026-11-26: switch only, calls name their phone), not built.** Step 2 (whole-screen control) is a direction only and needs its own specification and decision record before any work.
Design: [blueprint](blueprint.md) and [0028](../../architecture-decision-record/0028-phone-tools-served-by-the-paired-app-over-the-existing-channel.md) (proposed).

## Problem and outcome

An owner who steers threads from a computer cannot ask them to use the phone: read its location or battery, copy text to its clipboard, open a link on it, tell the owner through it.
The outcome: a thread calls a `phone_*` tool; the paired Outlore app on the owner's phone does it, only if the owner allowed that kind of use on the phone, and answers.

## Agreed behavior (the owner, 2026-11-26)

- **Agents see Outlore tools, not the phone.** Threads, Chronicler included, call `phone_*` tools of Outlore's own tool server, on every harness alike ([0028](../../architecture-decision-record/0028-phone-tools-served-by-the-paired-app-over-the-existing-channel.md)).
- **The paired channel carries it.** The host sends each call to the phone over the existing paired link, direct or through the relay, and the phone answers over it. No server runs on the phone, and no ADB, tunnel or extra port is used.
- **Two steps.** Step 1: the app's own capabilities. Step 2: control of the whole screen through an Android accessibility service in the APK, specified later.

## Proposals for the owner to correct

- **Consent lives on the phone.** The phone's settings (Menu, then Settings) hold a **Let threads use this phone** card with one switch per group, all off by default, changeable only on the phone; a host, a thread, Chronicler or another paired device cannot change them. The tools are offered to a thread only while a paired phone is connected with at least one group on.
- **Step 1 groups and tools.**

| Group | Tool | Behavior | Android permission |
| --- | --- | --- | --- |
| Information | `phone_info` | Battery level and charging, network kind, the device model, the time zone. | none |
| Location | `phone_location` | The current position and its accuracy. | location, asked by Android when first used |
| Clipboard | `phone_clipboard_read`, `phone_clipboard_write` | Reads or replaces the clipboard's text. | none |
| Open | `phone_open` | Opens a link, or an installed app by name. | none |
| Notify | `phone_notify` | Shows a notification with a title and text from the thread. | notifications, asked by Android when first used |

- **The switch is the consent (owner, 2026-11-26).** Once a group's switch is on, the phone runs its calls without asking again: there is no per-call approval and no Always allow for `phone_*` tools. Android's own permission prompt (location, notifications) still appears on first use.
- **Only a connected phone, and the call names it (owner, 2026-11-26).** With no phone connected a call fails at once with "No phone connected. Open Outlore on the phone." and never waits. Every `phone_*` tool takes an optional `phone` argument naming a paired phone; it can be left out while exactly one phone with the group on is connected. With several, a call without `phone` fails at once naming the connected phones ("Several phones are connected: Pixel, Galaxy. Name one in `phone`."); a named phone that is not connected or has the group off fails with its own sentence.
- **The app must be open.** Step 1 works only while the app is running and connected; keeping it connected in the background is a later decision.
- **Nothing is kept.** Outlore stores no location, clipboard text or screenshot from a call; the result goes to the thread's model provider like any tool result, and the card says so before a switch is turned on.
- **Failures are plain.** A switch off, a refused Android permission, a closed app and a timeout (30 seconds) each return one sentence the thread can read and relay.

## Not in step 1

Reading the screen, screenshots, taps, typing, SMS, calls, contacts, photos and files, the camera, and anything in the background.

## Acceptance

- With a switch off, its tool returns "The phone's owner has not allowed this" and the phone does nothing.
- With the switch on and the call allowed, the tool returns the phone's value; `phone_clipboard_write` then `phone_clipboard_read` returns the text written.
- With no phone connected, every `phone_*` call fails at once with the stated sentence.
- A thread, Chronicler and a paired device cannot change the switches.
- The same tools work on Claude Code, Codex and OpenCode threads.
- A host that does not know `PhoneCall` and a phone that does (and the reverse) keep working for everything else.

## Open

- Several paired phones: which one answers.
- Whether step 1 needs a foreground service to stay connected, measured on a real phone.
- Step 2: the accessibility service's grant flow, what a screenshot may show (secure windows), and a record of its own.

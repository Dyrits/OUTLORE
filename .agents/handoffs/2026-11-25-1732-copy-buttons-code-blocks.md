# Handoff: Copy buttons on replies and code blocks, and more visible code blocks

Supersedes: none
Workspace: outlore (repository root, branch `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked for a button to copy an agent's whole reply, a button to copy a single code block, and code blocks that read apart from the message in every theme.
Done means the owner has looked at both in the desktop window across the themes and accepted them, and CHG-0738 is recorded as a Delivery.

## State

- **Copy buttons built (verified: files read, app typecheck and Biome run clean, related Vitest tests pass in the pre-commit hook):** `apps/app/src/ui/copyButton.tsx` is a small icon button that writes to `navigator.clipboard` and shows a check mark for 1.5 seconds.
  It sits at the right of a footer line under each `AgentReply` (hidden for a draft) in `apps/app/src/conversation/conversationEntries.tsx`, and in the top right of each code block in `apps/app/src/conversation/markdown.tsx`.
  Footer styles `replyFooter` and `replyCopy` are in `apps/app/src/foundation/styles.ts`.
- **Code blocks made visible (verified: same checks):** code blocks and inline code use `codeVeil`, the text color at opacity 0.08, plus a 1px `colors.edge` border on the block, because the surface color was nearly the card's own color in most themes.
- **Committed on `main`:** `6279ea1b` (buttons, with changelog entry CHG-0738 in the new `documentation/changelog/0.2.8-Pre-Alpha.md`) and `172e98de` (contrast).
  The work-in-progress entry and this handoff are committed after them; the push to `origin/main` follows.
- **Not verified:** no one has seen either change running in the desktop window, in a browser, or on Android.
  The copy uses `navigator.clipboard`, as the pairing screen does, and was not checked on Android.
  No test covers the buttons; the existing tests cover only the markdown parsing rules.
- **Not copied:** only agent replies get the reply button; the owner's messages, notices, and the pinned thread root card do not.

## Decisions

- **Reply button sits in a footer under the reply, not in the header:** the header row aligns its items on the text baseline, and the usage line already lives under the reply.
  Not recorded elsewhere.
- **A veil of the text color, not a new palette token:** it works on any card color and needed no change to the many palette files.
  Not recorded elsewhere.
- **The changelog entry is CHG-0738 in `0.2.8-Pre-Alpha.md`:** work after the `0.2.7-Pre-Alpha` tag goes in the next version's file, per `AGENTS.md`.

## Next

1. Look at the buttons and the code blocks in the desktop window in the Iskios, one, mono, and slate themes, light and dark; adjust the veil opacity (`codeVeil` in `markdown.tsx`) if it is too faint or too strong.
2. Decide with the owner whether the copy buttons should also appear on other cards (owner messages, notices, the pinned root) and whether Android needs a native clipboard module.
3. Once accepted, record the Delivery in the `0.2.8-Pre-Alpha` changelog and remove the work-in-progress entry.

## Open questions

- Does `navigator.clipboard` work in the Android build? The owner or a device check answers.
- Is 0.08 the right strength for the code veil in every theme? The owner's look answers.

## Sources

- `apps/app/src/ui/copyButton.tsx`
- `apps/app/src/conversation/conversationEntries.tsx`
- `apps/app/src/conversation/markdown.tsx`
- `apps/app/src/foundation/styles.ts`
- `documentation/changelog/0.2.8-Pre-Alpha.md` (CHG-0738)
- `documentation/work-in-progress.md` (the "Copy buttons and visible code blocks" section)
- Commits `6279ea1b` and `172e98de`

# Rituals

Status: the entity model was agreed on 2026-11-21 (CHG-0616): a Ritual is a top-level entity of a realm, beside the quests, and each run opens an errand beneath it. It **replaces** the built model of 2026-11-10 (one quest per Ritual, each run a turn in that quest's main thread, kept in a separate Rituals place; CHG-0098, CHG-0100) and is **not built yet**: the current build still runs the old model, and the implementation batch follows. Everything the owner did not decide is **provisional** until the owner reviews it.

## Problem and outcome

The owner repeats the same request: a morning digest, a weekly dependency check. A Ritual is that request with a schedule, a Companion (model), and fallback Companions. It stands in the realm beside the quests, shows its whole history in one conversation, runs each run as an errand the owner can follow like any other, and can be run by hand at any moment. Rituals are the "routine" of the glossary, under its guild name.

## Agreed behavior

### The Ritual

- **A Ritual** has a title, an instruction, a schedule, a harness with account, Companion (model) and effort, an ordered list of fallback Companions, an on or off switch, a budget of its own, and a journal of its own. A Ritual Outlore creates on a tier takes the tier's backups as its fallbacks ([companion-presets](../companion-presets/specifications.md#provisional-choices)).
- **An entity of the realm, beside the quests**: a Ritual is listed in its realm's list among the quests, with its own look (the moon, its schedule, a dot while a run is underway); a Ritual of no realm is listed with the realm-less quests. The separate Rituals place and its rail category are removed. Opening a Ritual shows it in the middle pane like a quest. Its controls live in its panel: the schedule, **Run now**, the on or off switch, and **Edit**. The owner is never offered a Ritual as a matching quest (`find_missions`).
- **A journal like a quest's**: a briefing and a change log shared by every run and updated as it works ([mission-journal](../mission-journal/specifications.md)), so each run starts from where the last left off.
- **Creation** has three ways in:
  - An open quest's panel offers **Schedule as a Ritual**, which opens the form with the realm already taken from that quest. The new Ritual keeps a visible **origin link** to that quest on its card and in its panel — a link, nothing else inherited (no shared conversation, journal, or lore beyond the realm's).
  - Chronicler's `create_ritual` ([mission-coordination](../mission-coordination/specifications.md#rituals)).
  - A **+ Ritual** button beside the realm's quests.
- **Where runs work**: a run works in the Ritual's realm — its workspace and its lore, with thread-scoped lore beneath the Ritual like an errand's beneath its quest. Moving a Ritual to another realm is not offered.
- **Budget**: a Ritual has a budget of its own, shown as a ring in its panel like a quest's, and a line on the dashboard's spending. A run that meets a reached budget waits in Attention, as any thread does ([budget-control](../budget-control/specifications.md)).
- **Edit**: every field can be edited from the panel. A change applies to the next run; the next time is worked out again only when the schedule or the switch changed.
- **Delete**: one confirmation, naming what is lost — the Ritual, its runs' errands, and its history are removed permanently. Switching a Ritual off keeps its history; deleting it does not.
- **Realm archive**: archiving a realm names its Rituals, switches them off, stops a run underway, and keeps each Ritual in place with its instruction and history, marked **Realm archived**. While the realm is archived a Ritual cannot be switched on or run. Restore and Start afresh leave the Rituals off until the owner switches them on (CHG-0270 carries over to the entity model).

### Runs

- **Each run is an errand beneath the Ritual** ([thread-tree](../thread-tree/specifications.md)). It opens with the trigger line as its opening request, first line "Ritual · scheduled 07:00" or "Ritual · run by you". It is stored like an owner message, but marked as the run's own: it never counts as the owner's words (CHG-0208), and wearing its trigger it grants no mention reach ([thread-messaging](../thread-messaging/specifications.md)). The errand runs with the Ritual's Companion; its own backup list is empty — fallback comes from the Ritual's list (below).
- **The Ritual's conversation is the run history**: each run's trigger line, and when its errand finishes, its report ("Result from thread …"), Fulfilled or Failed. Each run stays individually openable as its errand. The composer is hidden there — no thread takes turns at a Ritual's top, and **Run now** is the only way to start a run on the spot; anything the owner wants changed about the Ritual itself is one tap away in its panel.
- **A scheduled run that cannot start** (the primary Companion is on a removed account, or a write fails) is not lost silently: it leaves a Failed line with the reason ("Could not start the scheduled run: \<reason\>") and no errand. None of its partial writes stay (the start runs inside one savepoint, as before), and the Ritual moves to its next time.
- **Schedule presets only** (no cron): every day at a time; weekdays at a time; every week on a day at a time; every month on a day at a time; every N hours. Times are the computer's local time. The local service's scheduler sleeps until the next Ritual is due, wakes on any change and at least hourly. A run that starts more than 5 minutes after its time (the app was closed, or the computer asleep) is skipped, not caught up; the quest-say- nothing rule carries over: a skip leaves no line, and the Ritual moves to its next time.
- **One run at a time**: a scheduled run whose predecessor errand is still Underway is skipped (a deliberate skip, as before); a manual **Run now** is refused with the reason.
- **Run now** is on the Ritual's panel and starts a run at any moment, whatever the schedule and the switch (a Ritual off still runs by hand, as before).
- **Fallback Companions**: when a run's turn fails (usage limit, overload, model unavailable, harness signed out), the errand hands over to the next Companion on the Ritual's list, which may be on another harness, and the instruction is run again with the conversation so far ([thread-handover](../thread-handover/specifications.md)). Each switch is a visible line in the run's errand, for example "Fell back to Codex · gpt-6.1-sol · default effort · Usage limit reached · 07:00", and the replies keep their own author. A Companion that is already the errand's, or whose account was removed, is passed over. When the list is used up the run is Failed. The next run starts on the primary Companion again.
- **Approval and scope**: a Ritual's runs have no owner turn, so the structural actions they may take without asking are listed in its reviewed scope (CHG-0208, unchanged): each entry an operation (stop a quest's threads, mark a quest Done, archive a quest, rename a quest, change a setting), its exact target, and its exact new value where it has one. The scope is empty by default, reviewed in the Ritual's form, and revoked by removing entries; a Ritual created by Chronicler starts with none. During a run, an action exactly in scope runs and leaves a line; anything else asks once. A setting kept for the owner (approval level, budgets, price fetching) cannot be in a scope, and the scope holds no commands: protected commands need none. Otherwise a run follows [action-approval](../action-approval/specifications.md): commands run unasked in the sandbox, and an escape or an action the thread judges consequential asks, whatever the instruction says.
- **Run states** keep their words: Underway, Done (a turn completed, even after a fallback), Interrupted (a Stopped errand, or a service restart mid-run), Failed (every Companion failed); a run that never started shows Failed with its reason.

## Migration of existing Rituals

- Each existing Ritual's quest becomes the Ritual: the entity listed with the rituals in its realm, its panel holding the controls, its past runs (turns of the old quest's main thread) staying readable in the Ritual's conversation, and future runs opening as errands. Nothing is lost or restarted; the owner's existing Rituals carry over in place (CHG-0616, breaking display change named in the release notes).

## Not built (out of this change as well)

- Webhook and event triggers (they need the relay Worker).
- Catching up missed runs, jitter, and time zones other than the computer's.
- Moving a Ritual between realms, or opening an errand beneath a Ritual by hand (its runs are the errands). To repeat work with variations, create a second Ritual (they each have their own journal) or run a quest.
- A Ritual created by a thread tool, except by Chronicler, whose `create_ritual` makes one at the owner's request ([mission-coordination](../mission-coordination/specifications.md#rituals)).

## Provisional choices to review

- The composer hidden in a Ritual's conversation (accepted on recommendation, CHG-0616).
- Delete removing the history permanently (accepted on recommendation, CHG-0616).
- A journal of the Ritual's own, shared by its runs (accepted on recommendation, CHG-0616).
- The look of the ritual row among the quests (the moon, the schedule, the dot) awaits the owner's eye.
- A Ritual of no realm: listed with the realm-less quests.
- An origin quest archived or deleted while its Ritual lives: the link stays, pointing at the archive or nowhere (decide when seen).
- A run is an owner message in storage, so remains of the old rule hold: the run's trigger never counts as the owner's words; ended Ritual rules treat it as the owner writing.
- A run of a realm-archived Ritual stays a deliberate skip, and a manual Run now is refused with the reason.

## Acceptance and validation

Agreed checks when the model is built (the old model's checks, in [verification](../../verification/), describe the built behavior being replaced):

- A scheduled run opens an errand beneath the Ritual with its trigger line; one not due, or off, does not (test clock).
- A run missed beyond the grace is skipped and the Ritual moves to its next time; a run whose predecessor is still Underway is skipped when scheduled, and Run now is refused with the reason.
- A scheduled run that cannot start leaves a Failed line with the reason and no partial writes (removed account; an injected failing write).
- A failed turn falls back to the next Companion with the visible switch line and finishes there; a used-up list fails the run; the next run starts on the primary Companion again.
- A run meeting a reached budget waits in Attention; the Ritual's panel shows its budget ring.
- The Ritual appears in its realm's list among the quests; `find_missions` never returns it; the Rituals place and rail category are gone.
- Each run's report lands in the Ritual's conversation; the composer is hidden there; the errand is openable.
- The realm archive names the realm's Rituals, switches them off, stops a run underway, keeps them marked **Realm archived**, and they stay off after Restore and Start afresh.
- Deleting a Ritual asks once and removes it with its runs; Cancel keeps everything.
- The migration turns an existing Ritual's quest into the Ritual entity; its past runs stay readable; a new run opens as an errand.
- Human acceptance: the ritual row among quests and the panel in the running app, on the fake harness, then a live harness run; the look on a phone and at other window widths.

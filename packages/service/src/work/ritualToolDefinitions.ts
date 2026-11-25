import { EffortChoice, HarnessName, ModelChoice, RitualSchedule, TierName, UpdateRitual } from "@outlore/contracts";
import { Schema } from "effect";
import { toolRefusal } from "../core/index.ts";
import { definitionOf, optionalText, text } from "./toolDefinition.ts";

// The thread tools that propose a Ritual or its changes (thread tool catalogue, threadTools.ts).

/** The Ritual tools, by name. */
export const ritualToolDefinitions = {
  create_ritual: definitionOf({
    description:
      "Propose a scheduled Ritual in this conversation's realm. From a quest or errand, Outlore links it to that quest. Pick the schedule preset that fits. It always asks the owner one Allow or Deny question with its title, schedule, realm, Companion, and instruction, and waits; naming the title in a message is not enough. It starts on and runs when next due; each run is an errand beneath the Ritual, and its whole history shows in the Ritual's own conversation. Its runs may take no structural action unasked until the owner sets its scope in the Ritual's form; its instruction never grants any.",
    invalid: toolRefusal(
      "Invalid arguments: give instruction, title, and schedule (Daily, Weekdays, Weekly, Monthly, or Hourly).",
    ),
    isUnasked: true,
    schema: Schema.Struct({
      effort: Schema.optionalKey(
        EffortChoice.annotate({ description: "How hard each run works. Yours when left out." }),
      ),
      harness: Schema.optionalKey(HarnessName.annotate({ description: "The harness. Yours when left out." })),
      instruction: text("What each run does, complete enough to act on: a run sees none of your conversation."),
      model: Schema.optionalKey(ModelChoice.annotate({ description: "The model. Yours when left out." })),
      origin: optionalText(
        "Leave out in a realm conversation, quest, or errand. The original control conversation can specify an origin quest by id.",
      ),
      realm: optionalText(
        "Leave out in a realm conversation, quest, or errand. The original control conversation can name a realm when it gives no origin.",
      ),
      schedule: RitualSchedule.annotate({
        description:
          'When it runs, in the computer\'s local time, for example {"_tag":"Hourly","hours":1}, {"_tag":"Daily","time":"07:00"}, {"_tag":"Weekly","day":1,"time":"09:00"} (day 0 is Sunday), {"_tag":"Monthly","day":1,"time":"08:00"}, or {"_tag":"Weekdays","time":"08:30"}.',
      }),
      tier: Schema.optionalKey(
        TierName.annotate({
          description:
            "How demanding the work is, as the owner set their Companions for it: Light (small, well-scoped, checkable), Balanced (ordinary work), Heavy (ambiguous, architectural, or risky). Left out, the default Companion; a tier the owner did not set also falls back to it.",
        }),
      ),
      title: text("A short title of a few words, at most 80 characters."),
    }),
  }),
  edit_ritual: definitionOf({
    description:
      "From a quest or errand, propose changes to a Ritual in your realm. Give its exact title or Ritual id and the fields to change. The owner sees the proposed changes and must approve them. Changes take effect on the next run.",
    invalid: toolRefusal("Give a Ritual title or id and the fields to change."),
    isUnasked: true,
    schema: Schema.Struct({
      fallbacks: Schema.optionalKey(
        UpdateRitual.fields.fallbacks.annotate({
          description: "Replacement fallback Companions, in order. An empty list removes the current fallbacks.",
        }),
      ),
      instruction: Schema.optionalKey(
        UpdateRitual.fields.instruction.annotate({ description: "Replacement instruction for the next run." }),
      ),
      isOn: Schema.optionalKey(
        UpdateRitual.fields.isOn.annotate({ description: "Whether the Ritual should run automatically." }),
      ),
      primary: Schema.optionalKey(
        UpdateRitual.fields.primary.annotate({ description: "Replacement primary Companion for the next run." }),
      ),
      ritual: text("Exact title or Ritual id."),
      schedule: Schema.optionalKey(
        UpdateRitual.fields.schedule.annotate({
          description: "Replacement schedule preset in the computer's local time.",
        }),
      ),
      title: Schema.optionalKey(UpdateRitual.fields.title.annotate({ description: "Replacement title." })),
    }),
  }),
};

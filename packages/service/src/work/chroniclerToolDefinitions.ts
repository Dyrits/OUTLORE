import { Schema } from "effect";
import { toolRefusal } from "../core/index.ts";
import { definitionOf, optionalText, optionalWhole, text } from "./toolDefinition.ts";

// The thread tools only Chronicler uses (thread tool catalogue, threadTools.ts): acting on quests and realms, settings, the app guide, and its own history.

/** Chronicler's tools, by name. */
export const chroniclerToolDefinitions = {
  act_on_mission: definitionOf({
    description:
      "Chronicler uses it, at the owner's request: stop a quest's threads, mark it Done, archive it, or rename it. Chronicler derives the exact action and target from the call. It runs at once when the owner's own message in this turn named that action and quest (and new title) plainly; otherwise it asks the owner one Allow or Deny question naming them and waits; marking Done or archiving a quest with threads at work always asks. Do not ask a second question in chat. Nothing you pass counts as the owner's words.",
    invalid: toolRefusal("Invalid arguments: give mission and action (Stop, Done, Archive, or Rename)."),
    isUnasked: true,
    schema: Schema.Struct({
      action: Schema.Literals(["Stop", "Done", "Archive", "Rename"]).annotate({
        description: "Stop: stop every thread at work in the quest. Done and Archive: end it. Rename: give it a title.",
      }),
      mission: text("The quest's id, from your context or find_missions."),
      title: optionalText("For Rename: the new title."),
    }),
  }),
  change_setting: definitionOf({
    description:
      "Chronicler uses it, at the owner's request: change one of the owner's settings (read_settings lists them). It runs at once when the owner's own message in this turn named that setting and its new value plainly; otherwise it asks the owner one Allow or Deny question naming them and waits. The approval level, budgets, price fetching, and permission to run outside the sandbox without asking are the owner's alone and are refused.",
    invalid: toolRefusal("Invalid arguments: give setting and value."),
    isUnasked: true,
    schema: Schema.Struct({
      setting: text("The setting's name, as read_settings gives it, for example shouldShowFinishedQuests."),
      value: text(
        'The new value as JSON text, whole and in the shape read_settings shows for that setting, for example true, 14, "Steer", or {"cost":null,"tokens":null}.',
      ),
    }),
  }),
  create_realm: definitionOf({
    description:
      "Only Chronicler uses it, at the owner's request: make a realm, tied to a folder or to none. It runs at once when the owner's own message in this turn asked for a realm by that name (and folder) plainly; otherwise it asks the owner one Allow or Deny question naming them and waits.",
    invalid: toolRefusal("Invalid arguments: give name; folder is optional."),
    isUnasked: true,
    schema: Schema.Struct({
      folder: optionalText(
        "The folder's full path, when the realm is tied to a folder; left out for a realm tied to none.",
      ),
      name: text("The realm's name, at most 80 characters."),
    }),
  }),
  read_app_guide: definitionOf({
    description:
      "Only Chronicler uses it. Read the app guide, to answer a question about how Outlore works or how to use it. With no topic it lists the topics; give a topic id, or a few words of the owner's question, to read that part.",
    invalid: toolRefusal("Invalid arguments: topic is text, or leave it out to list the topics."),
    isUnasked: true,
    schema: Schema.Struct({
      topic: optionalText(
        "A topic id from the list, or a few words of the question, such as how Rituals are scheduled.",
      ),
    }),
  }),
  read_control_history: definitionOf({
    description:
      "Only Chronicler uses it. Read your own older messages with the owner, newest first, when they ask about something said earlier, for example 'Remember what we did about X?'.",
    invalid: toolRefusal("Invalid arguments: query is text; before and count are whole numbers."),
    isUnasked: true,
    schema: Schema.Struct({
      before: optionalWhole("Only messages numbered below this one, to read older ones."),
      count: optionalWhole("How many messages, 10 by default, at most 40."),
      query: optionalText("Only messages that contain these words."),
    }),
  }),
  read_settings: definitionOf({
    description:
      "Only Chronicler uses it. Read the owner's settings as JSON, to answer a question about them or before you change one.",
    invalid: toolRefusal("Invalid arguments: read_settings takes none."),
    isUnasked: true,
    schema: Schema.Struct({}),
  }),
  rename_realm: definitionOf({
    description:
      "Only Chronicler uses it, at the owner's request: rename a realm. It runs at once when the owner's own message in this turn named that realm and its new name plainly; otherwise it asks the owner one Allow or Deny question naming them and waits.",
    invalid: toolRefusal("Invalid arguments: give realm and name."),
    isUnasked: true,
    schema: Schema.Struct({
      name: text("The realm's new name, at most 80 characters."),
      realm: text("The name or folder of one of the realms listed in your context."),
    }),
  }),
};

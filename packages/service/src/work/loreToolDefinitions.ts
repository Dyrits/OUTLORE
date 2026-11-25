import { Schema } from "effect";
import { toolRefusal } from "../core/index.ts";
import { definitionOf, optionalText, optionalWhole, text } from "./toolDefinition.ts";

// Stored and wire names keep `intel` so existing data and agents still work: thread tool names (`save_intel`, ...).

const ToolScope = Schema.Literals(["thread", "mission", "workspace", "global"]);
const ToolKind = Schema.Literals(["rule", "preference", "decision", "fact", "temporary"]);
const kindHelp =
  "rule: an instruction to follow, never fades; preference: how the owner likes things; decision: a settled choice; fact: how things are; temporary: true for days only.";

/** The answer to a `search_intel` call with neither query nor ids. */
export const searchInvalid = toolRefusal(
  "Invalid arguments: give query, ids, or both, and optionally scope (thread, mission, workspace, or global).",
);
/** What each lore scope means, as the tools' descriptions give it to a thread. */
export const scopeHelp =
  "thread: this errand and the threads beneath it (on a quest's top thread, saving at thread puts the lore on the quest, but searching with thread leaves it out: search it with mission); mission: the quest and all its threads; workspace: the realm, with or without a folder, and all its quests; global: everywhere, after the owner's approval.";

// The lore thread tools (scoped-intel, thread tool catalogue, threadTools.ts).

/** The lore tools, by name. */
export const loreToolDefinitions = {
  forget_intel: definitionOf({
    description:
      "Delete a lore entry that no longer holds, by its id. Thread and workspace lore go at once; deleting a global lore entry waits for the owner's approval.",
    invalid: toolRefusal("Invalid arguments: give id."),
    isUnasked: true,
    schema: Schema.Struct({ id: text("The lore entry's id, as your context or search_intel gives it.") }),
  }),
  relied_on_intel: definitionOf({
    description:
      "Say that lore entries from your context shaped what you did, by their ids. Each counts as a use and keeps it from fading; only lore that really guided you counts.",
    invalid: toolRefusal("Invalid arguments: give ids, at least one."),
    isUnasked: true,
    schema: Schema.Struct({
      ids: Schema.Array(Schema.String)
        .check(Schema.isMinLength(1))
        .annotate({ description: "The ids of the lore entries you relied on, as your context lists them." }),
    }),
  }),
  save_intel: definitionOf({
    description:
      "Save one rule, preference, decision, fact, or temporary note that later work should know, at the narrowest scope that fits, only when it is worth keeping. Thread, mission, and workspace lore are saved at once; global lore waits for the owner's approval. A save repeating a lore entry in that scope or a wider one, or a newer version of it, replaces that lore entry.",
    invalid: toolRefusal(
      "Invalid arguments: give text, scope (thread, mission, workspace, or global), and kind (rule, preference, decision, fact, or temporary).",
    ),
    isUnasked: true,
    schema: Schema.Struct({
      journalEntry: optionalWhole(
        "The number of the journal entry it rests on, when there is one; otherwise the message you are answering is recorded.",
      ),
      kind: ToolKind.annotate({ description: `What it is, which sets how fast it fades unused. ${kindHelp}` }),
      scope: ToolScope.annotate({ description: `Where it applies. ${scopeHelp}` }),
      text: text("One fact, at most 200 tokens."),
    }),
  }),
  search_intel: definitionOf({
    description:
      "Search the active and dormant lore in your scope by words, best match first, or read lore entries in full by their ids, such as global lore from your context's index. Reading a lore entry counts as a use and keeps it from fading.",
    invalid: searchInvalid,
    isUnasked: true,
    schema: Schema.Struct({
      ids: Schema.optionalKey(
        Schema.Array(Schema.String).annotate({ description: "Lore ids to read in full, as your context lists them." }),
      ),
      query: optionalText("Words to look for."),
      scope: Schema.optionalKey(ToolScope.annotate({ description: `Only lore of this scope. ${scopeHelp}` })),
    }),
  }),
  update_intel: definitionOf({
    description:
      "Correct a lore entry's text, or propose a wider scope for it when it is not specific to where it was saved. Thread and workspace corrections apply at once; a change to global lore and every widening wait for the owner's approval.",
    invalid: toolRefusal("Invalid arguments: give id, and text, scope, or both."),
    isUnasked: true,
    schema: Schema.Struct({
      id: text("The lore entry's id, as your context or search_intel gives it."),
      scope: Schema.optionalKey(ToolScope.annotate({ description: `A wider scope to move it to. ${scopeHelp}` })),
      text: optionalText("The corrected text, one fact, at most 200 tokens."),
    }),
  }),
};

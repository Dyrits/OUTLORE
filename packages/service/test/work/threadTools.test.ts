import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { unaskedToolNamesOf } from "../../src/work/threadToolAccess.ts";
import {
  isCoveredByCodeMode,
  startsWork,
  type ThreadToolName,
  threadTools,
  toolListing,
  toolListingOf,
} from "../../src/work/threadTools.ts";

// Stored and wire names keep `intel` so existing data and agents still work: thread tool names (`save_intel`, ...).

/** The parts of a tool's input schema these checks read. */
const InputSchema = Schema.Struct({
  properties: Schema.optional(
    Schema.Record(Schema.String, Schema.Struct({ description: Schema.optional(Schema.String) })),
  ),
  required: Schema.optional(Schema.Array(Schema.String)),
  type: Schema.optional(Schema.String),
});
const inputSchemaOf = (tool: (typeof toolListing)[number]) => Schema.decodeUnknownSync(InputSchema)(tool.inputSchema);

describe("listing the thread tools", () => {
  it("describes the owner-kept sandbox setting and the full quest matching inputs", () => {
    expect(threadTools.change_setting.description).toContain("outside the sandbox");
    expect(threadTools.find_missions.description).toContain("opening request");
    expect(threadTools.find_missions.description).toContain("ticket key");
  });

  it("lists every tool with the required arguments its decoder needs", () => {
    const required = Object.fromEntries(toolListing.map((tool) => [tool.name, inputSchemaOf(tool).required ?? []]));
    expect(required).toMatchObject({
      find_missions: ["request"],
      interrupt_thread: ["thread"],
      open_thread: ["request"],
      read_journal: [],
      report_result: ["journal", "result"],
      request_approval: ["action", "command"],
      send_thread_message: ["text", "to"],
      set_mission_title: ["title"],
      suggest_mission: ["text", "title"],
      update_journal: ["entry"],
    });
    expect(toolListing.map((tool) => tool.name).sort()).toEqual(Object.keys(threadTools).sort());
  });

  // MCP asks each tool's input schema to be an object schema; Claude Code drops the whole listing when one is not,
  // so every permission prompt then fails with "MCP tool ... not found. Available MCP tools: none" (read_settings,
  // whose empty struct encoded as `{ "not": { "type": "null" } }`).
  it("gives every tool an object input schema, which Claude Code needs to accept the listing", () => {
    const notObjects = toolListing.filter((tool) => inputSchemaOf(tool).type !== "object").map((tool) => tool.name);
    expect(notObjects).toEqual([]);
  });

  it("runs every tool unasked except the approval tools themselves", () => {
    const names = unaskedToolNamesOf("outlore", false);
    expect(names).toContain("mcp__outlore__open_thread");
    expect(names).not.toContain("mcp__outlore__run_code");
    expect(names).not.toContain("mcp__outlore__request_approval");
    expect(names).not.toContain("mcp__outlore__answer_prompt");
    expect(names).toHaveLength(Object.keys(threadTools).length - 2);
  });

  it("also runs Code Mode's tool unasked while Code Mode is on, and only then", () => {
    expect(unaskedToolNamesOf("outlore", true)).toEqual([
      ...unaskedToolNamesOf("outlore", false),
      "mcp__outlore__run_code",
    ]);
  });

  // Code Mode runs the covered tools from code, where Claude Code's own prompt cannot ask first: only tools that already
  // run unasked, asking the owner in their own handler when they must, may be covered.
  it("covers only tools that run unasked, and leaves the approval tools and the turn-ending tools direct", () => {
    const covered = Object.keys(threadTools).filter(isCoveredByCodeMode);
    expect(covered.filter((name) => !threadTools[name as ThreadToolName].isUnasked)).toEqual([]);
    const direct = Object.keys(threadTools).filter((name) => !isCoveredByCodeMode(name));
    expect(direct.sort()).toEqual(["answer_prompt", "report_result", "request_approval", "suggest_mission"]);
  });

  it("counts only the tools that start or redirect other threads' work", () => {
    expect(Object.keys(threadTools).filter(startsWork).sort()).toEqual([
      "interrupt_thread",
      "open_thread",
      "send_thread_message",
    ]);
  });

  it("describes every argument a thread fills in", () => {
    const missing = toolListing
      .filter((tool) => tool.name !== "answer_prompt")
      .flatMap((tool) =>
        Object.entries(inputSchemaOf(tool).properties ?? {})
          .filter(([, property]) => property.description === undefined)
          .map(([name]) => `${tool.name}.${name}`),
      );
    expect(missing).toEqual([]);
  });

  it("names every lore entry kind in save_intel", () => {
    expect(toolListing.find((tool) => tool.name === "save_intel")?.description).toContain("temporary");
  });

  it("tells the model where a phone tool's result goes and who switches its group on", () => {
    const phoneTools = toolListing.filter((tool) => tool.name.startsWith("phone_"));
    expect(phoneTools.map((tool) => tool.name).sort()).toEqual([
      "phone_clipboard_read",
      "phone_clipboard_write",
      "phone_info",
      "phone_location",
      "phone_notify",
      "phone_open",
    ]);
    for (const tool of phoneTools) {
      expect(tool.description, tool.name).toContain("model provider");
      expect(tool.description, tool.name).toContain("switched this kind of phone use on");
      expect(inputSchemaOf(tool).properties, tool.name).toHaveProperty("phone");
      expect(inputSchemaOf(tool).required ?? [], tool.name).not.toContain("phone");
    }
  });

  it("takes the arguments each phone tool needs, besides the optional phone", () => {
    const required = Object.fromEntries(
      toolListing
        .filter((tool) => tool.name.startsWith("phone_"))
        .map((tool) => [tool.name, inputSchemaOf(tool).required ?? []]),
    );
    expect(required).toEqual({
      phone_clipboard_read: [],
      phone_clipboard_write: ["text"],
      phone_info: [],
      phone_location: [],
      phone_notify: ["text"],
      phone_open: [],
    });
  });

  it("lists a phone tool only when it is offered, and runs it unasked", () => {
    const names = (offered: ReadonlySet<string>) => toolListingOf(true, offered).map((tool) => tool.name);
    expect(names(new Set()).filter((name) => name.startsWith("phone_"))).toEqual([]);
    expect(names(new Set(["phone_info"])).filter((name) => name.startsWith("phone_"))).toEqual(["phone_info"]);
    expect(unaskedToolNamesOf("outlore", false)).toContain("mcp__outlore__phone_info");
  });

  it("tells the model which apps and link schemes phone_open accepts", () => {
    const description = toolListing.find((tool) => tool.name === "phone_open")?.description ?? "";
    for (const word of [
      "calendar",
      "dialer",
      "email",
      "maps",
      "messages",
      "settings",
      "spotify",
      "telegram",
      "whatsapp",
      "youtube",
    ])
      expect(description).toContain(word);
    for (const scheme of ["http", "https", "mailto", "tel", "sms", "geo"]) expect(description).toContain(scheme);
  });
});

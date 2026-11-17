import { describe, expect, it } from "vitest";
import { declarationOf, identifierOf, typeOfSchema } from "../../src/connectors/codeTypes.ts";

describe("declaring connector tools as types", () => {
  it("writes primitives, enums, constants, unions and arrays", () => {
    expect(typeOfSchema({ type: "integer" })).toBe("number");
    expect(typeOfSchema({ enum: ["a", "b"] })).toBe('"a" | "b"');
    expect(typeOfSchema({ const: 3 })).toBe("3");
    expect(typeOfSchema({ type: ["string", "null"] })).toBe("string | null");
    expect(typeOfSchema({ anyOf: [{ type: "string" }, { type: "number" }] })).toBe("string | number");
    expect(typeOfSchema({ items: { type: "string" }, type: "array" })).toBe("string[]");
    expect(typeOfSchema({ items: { enum: ["a", "b"] }, type: "array" })).toBe('Array<"a" | "b">');
    expect(typeOfSchema({ $ref: "#/x" })).toBe("unknown");
  });

  it("writes an object's properties, marking the optional ones and quoting keys that are not identifiers", () => {
    const type = typeOfSchema({
      properties: { "due-date": { type: "string" }, title: { description: "Its title.", type: "string" } },
      required: ["title"],
      type: "object",
    });
    expect(type).toBe('{\n  "due-date"?: string;\n  /** Its title. */\n  title: string;\n}');
  });

  it("keeps a description from closing its comment", () => {
    const declaration = declarationOf([
      {
        member: "go",
        namespace: "fake",
        tool: {
          connector: "fake",
          description: "Ends */ here",
          inputSchema: { type: "object" },
          name: "fake__go",
          tool: "go",
        },
      },
    ]);
    expect(declaration).toContain("/** Ends * / here */");
    expect(declaration).toContain("go(input: Record<string, unknown>): Promise<unknown>;");
  });

  it("turns tool names into identifiers", () => {
    expect(identifierOf("list-events")).toBe("list_events");
    expect(identifierOf("2fa.check")).toBe("_2fa_check");
  });
});

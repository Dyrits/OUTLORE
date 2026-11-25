import { Schema } from "effect";
import type { ToolAnswer } from "../core/index.ts";

/** A described text argument. */
export const text = (description: string) => Schema.String.annotate({ description });
/** A described text argument that may be left out. */
export const optionalText = (description: string) => Schema.optionalKey(text(description));
/** A described whole-number argument that may be left out. */
export const optionalWhole = (description: string) => Schema.optionalKey(Schema.Int.annotate({ description }));

/** One thread tool: its description, argument schema, answer to invalid arguments, and the JSON schema MCP lists. */
export const definitionOf = <S extends Schema.ConstraintDecoder<unknown> & Schema.Top>(definition: {
  readonly description: string;
  readonly schema: S;
  /** The answer to arguments that do not decode. */
  readonly invalid: ToolAnswer;
  /** Whether a thread uses it without asking the owner; false for the approval tools themselves. */
  readonly isUnasked: boolean;
}) => {
  const schema: Record<string, unknown> = Schema.toJsonSchemaDocument(definition.schema).schema;
  return {
    ...definition,
    // MCP asks every input schema to be an object schema, and Claude Code drops the whole listing when one is
    // not. A struct with no fields encodes as `{ "not": { "type": "null" } }`, so it is written out here.
    inputSchema: schema.type === "object" ? schema : { properties: {}, type: "object" },
  };
};

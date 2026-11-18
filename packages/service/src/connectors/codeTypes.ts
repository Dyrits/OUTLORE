import { Predicate } from "effect";
import type { ConnectorTool } from "./gateway.ts";

// The declarations a thread reads in Code Mode's tool description, written from each tool's JSON Schema, as
// Cloudflare's Code Mode does (`generateTypesFromJsonSchema`): a model writes correct calls more often from types
// than from schemas. Only what a model needs is rendered; anything else reads `unknown`.

/** How deep nested objects are written out before they read `unknown`. */
const maxDepth = 4;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  Predicate.isObject(value) && !Array.isArray(value);

const identifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** A property key as TypeScript writes it: bare when it is an identifier, quoted otherwise. */
const keyOf = (key: string) => (identifierPattern.test(key) ? key : JSON.stringify(key));

/** A description as one line of a `/** *\/` comment, safe to close. */
const commentOf = (description: unknown, indent: string) =>
  typeof description === "string" && description.trim() !== ""
    ? `${indent}/** ${description.trim().replace(/\s+/g, " ").replaceAll("*/", "* /")} */\n`
    : "";

const primitiveTypes: Readonly<Record<string, string>> = {
  boolean: "boolean",
  integer: "number",
  null: "null",
  number: "number",
  string: "string",
};

/** The TypeScript type of a JSON Schema. */
export const typeOfSchema = (schema: unknown, depth = 0, indent = ""): string => {
  if (!isRecord(schema)) return "unknown";
  if (Object.hasOwn(schema, "const")) return JSON.stringify(schema.const) ?? "unknown";
  if (Array.isArray(schema.enum) && schema.enum.length > 0)
    return schema.enum.map((value) => JSON.stringify(value) ?? "unknown").join(" | ");
  const variants = Array.isArray(schema.anyOf) ? schema.anyOf : Array.isArray(schema.oneOf) ? schema.oneOf : null;
  if (variants !== null && variants.length > 0)
    return variants.map((variant) => typeOfSchema(variant, depth, indent)).join(" | ");
  if (Array.isArray(schema.type))
    return schema.type.map((type) => typeOfSchema({ ...schema, type }, depth, indent)).join(" | ");
  const type = schema.type;
  if (typeof type === "string" && Object.hasOwn(primitiveTypes, type)) return primitiveTypes[type] ?? "unknown";
  if (type === "array") {
    const item = typeOfSchema(schema.items, depth + 1, indent);
    return item.includes(" ") ? `Array<${item}>` : `${item}[]`;
  }
  if (type === "object" || isRecord(schema.properties)) return objectTypeOf(schema, depth, indent);
  return "unknown";
};

const objectTypeOf = (schema: Readonly<Record<string, unknown>>, depth: number, indent: string): string => {
  const properties = isRecord(schema.properties) ? Object.entries(schema.properties) : [];
  if (depth >= maxDepth || properties.length === 0) return "Record<string, unknown>";
  const required = new Set(Array.isArray(schema.required) ? schema.required.filter(Predicate.isString) : []);
  const inner = `${indent}  `;
  const lines = properties.map(([key, property]) => {
    const description = isRecord(property) ? property.description : null;
    const optional = required.has(key) ? "" : "?";
    return `${commentOf(description, inner)}${inner}${keyOf(key)}${optional}: ${typeOfSchema(property, depth + 1, inner)};\n`;
  });
  return `{\n${lines.join("")}${indent}}`;
};

/** A name usable as `connectors.<namespace>.<name>` or `outlore.<name>`: letters, digits, `_` and `$`, not starting with a digit. */
export const identifierOf = (name: string) => {
  const replaced = name.replace(/[^A-Za-z0-9_$]/g, "_");
  return /^[0-9]/.test(replaced) ? `_${replaced}` : replaced;
};

/** Where one connector tool lives in the code: `connectors.<namespace>.<member>`. */
export type Binding = { readonly member: string; readonly namespace: string; readonly tool: ConnectorTool };

/** The `connectors` declaration a thread writes its code against. */
export const declarationOf = (bindings: ReadonlyArray<Binding>) => {
  const namespaces = new Map<string, Array<Binding>>();
  for (const binding of bindings) {
    const members = namespaces.get(binding.namespace) ?? [];
    members.push(binding);
    namespaces.set(binding.namespace, members);
  }
  const blocks = [...namespaces].map(([namespace, members]) => {
    const lines = members.map(
      ({ member, tool }) =>
        `${commentOf(tool.description, "    ")}    ${keyOf(member)}(input: ${typeOfSchema(tool.inputSchema, 1, "    ")}): Promise<unknown>;\n`,
    );
    return `  ${keyOf(namespace)}: {\n${lines.join("")}  };\n`;
  });
  return `declare const connectors: {\n${blocks.join("")}};`;
};

/** One of Outlore's own tools as Code Mode lists it in the code: `outlore.<name>`. */
export type OwnTool = {
  readonly description: string;
  /** The tool's JSON Schema for its arguments. */
  readonly inputSchema: Readonly<Record<string, unknown>>;
  /** The tool's name, which is also its member of `outlore`. */
  readonly name: string;
};

/** The `outlore` declaration a thread writes its calls to Outlore's own tools against. */
export const ownDeclarationOf = (tools: ReadonlyArray<OwnTool>) => {
  const lines = tools.map(
    ({ description, inputSchema, name }) =>
      `${commentOf(description, "  ")}  ${keyOf(identifierOf(name))}(input: ${typeOfSchema(inputSchema, 1, "  ")}): Promise<unknown>;\n`,
  );
  return `declare const outlore: {\n${lines.join("")}};`;
};

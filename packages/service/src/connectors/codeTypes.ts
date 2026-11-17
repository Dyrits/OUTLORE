import { Predicate } from "effect";

// The declarations a thread reads in Code Mode's tool description, written from each connector tool's JSON Schema, as
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

/** A name usable as `connectors.<namespace>.<name>`: letters, digits, `_` and `$`, not starting with a digit. */
export const identifierOf = (name: string) => {
  const replaced = name.replace(/[^A-Za-z0-9_$]/g, "_");
  return /^[0-9]/.test(replaced) ? `_${replaced}` : replaced;
};

/** One function of the declaration: where it lives, what it says, and what it takes. */
export type DeclaredFunction = {
  readonly description: string;
  readonly inputSchema: unknown;
  readonly member: string;
  readonly namespace: string;
};

/** The `connectors` declaration a thread writes its code against. */
export const declarationOf = (functions: ReadonlyArray<DeclaredFunction>) => {
  const namespaces = new Map<string, Array<DeclaredFunction>>();
  for (const declared of functions) {
    const members = namespaces.get(declared.namespace) ?? [];
    members.push(declared);
    namespaces.set(declared.namespace, members);
  }
  const blocks = [...namespaces].map(([namespace, members]) => {
    const lines = members.map(
      (member) =>
        `${commentOf(member.description, "    ")}    ${keyOf(member.member)}(input: ${typeOfSchema(member.inputSchema, 1, "    ")}): Promise<unknown>;\n`,
    );
    return `  ${keyOf(namespace)}: {\n${lines.join("")}  };\n`;
  });
  return `declare const connectors: {\n${blocks.join("")}};`;
};

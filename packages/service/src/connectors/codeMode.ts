import { Effect, Exit, Match, Schema } from "effect";
import { type ToolAnswer, toolRefusal } from "../core/index.ts";
import type { CodeExecutor } from "./codeExecutor.ts";
import { CodeCallFailure, type CodeFunction, type CodeRun, defaultCodeLimits } from "./codeRun.ts";
import { type Binding, declarationOf, identifierOf } from "./codeTypes.ts";
import type { ConnectorGateway, ConnectorTool } from "./gateway.ts";

// Code Mode for connectors (connectors specification, Code Mode; CHG-0324, CHG-0441): with the setting on, a thread is
// offered one tool that runs a short program calling its connector tools, instead of each tool. Every call the program
// makes goes through the same gateway call a listed tool would, so the switches, the questions and the answers are the
// same; only the listing and the way of calling change.

/** The one tool Code Mode lists in place of the connector tools. */
export const codeToolName = "run_connector_code";

/** The most characters of a run's answer a thread reads, as Cloudflare's Code Mode caps its own (about 6,000 tokens). */
const maxAnswerCharacters = 24_000;

/** Each tool's place in the code; two tools whose names read the same as identifiers get a numbered suffix. */
const bindingsOf = (tools: ReadonlyArray<ConnectorTool>): ReadonlyArray<Binding> => {
  const taken = new Set<string>();
  return tools.map((tool) => {
    const namespace = identifierOf(tool.connector);
    const base = identifierOf(tool.tool);
    let member = base;
    for (let suffix = 2; taken.has(`${namespace}.${member}`); suffix++) member = `${base}_${suffix}`;
    taken.add(`${namespace}.${member}`);
    return { member, namespace, tool };
  });
};

const exampleOf = (bindings: ReadonlyArray<Binding>) => {
  const first = bindings[0];
  return first === undefined
    ? ""
    : `\n\nExample: async () => { const found = await connectors.${first.namespace}.${first.member}({ /* its input */ }); return found; }`;
};

const descriptionOf = (bindings: ReadonlyArray<Binding>) =>
  `Run a short JavaScript program that calls your connectors' tools, and get back what it returns. Use it to chain several calls, or to filter or sum their results, so only what you need comes back.

Available:
${declarationOf(bindings)}

Write an async arrow function in plain JavaScript (no TypeScript types) that returns the result; a function body ending in return also works. Each call returns the tool's result, parsed from JSON when it is JSON. A call the owner denies, or to a connector or tool that is switched off, throws an Error with the reason; a write may wait for the owner's answer. The program has no files, network, environment or modules: only connectors and console.log, whose lines come back with the result. It stops after ${defaultCodeLimits.cpuMillis / 1000} seconds of running time (waiting for a call does not count) or ${defaultCodeLimits.maxCalls} calls.${exampleOf(bindings)}`;

/** The listing entry of Code Mode's tool for these connector tools, or null when there are none to call. */
const codeToolOf = (tools: ReadonlyArray<ConnectorTool>) =>
  tools.length === 0
    ? null
    : {
        description: descriptionOf(bindingsOf(tools)),
        inputSchema: {
          properties: { code: { description: "The JavaScript async arrow function to run.", type: "string" } },
          required: ["code"],
          type: "object",
        },
        name: codeToolName,
      };

/** A tool's answer as the code sees it: its JSON value when it is JSON, else its text. */
const resultOf = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const textOf = (value: unknown) =>
  typeof value === "string" ? value : (JSON.stringify(value, null, 2) ?? "The code returned nothing.");

const cut = (text: string) =>
  text.length <= maxAnswerCharacters
    ? text
    : `${text.slice(0, maxAnswerCharacters)}\n[Cut: ${text.length - maxAnswerCharacters} more characters. Return less, such as a filtered or summed result.]`;

/** The thread's answer for a finished run: what it returned, or why it failed, then what it logged. */
const answerOf = (run: CodeRun): ToolAnswer => {
  const text = Match.valueTags(run.outcome, {
    Failed: (outcome) => `The code failed: ${outcome.message}`,
    Returned: (outcome) => textOf(outcome.value),
  });
  const logs = run.logs.length === 0 ? "" : `\n\nLogged:\n${run.logs.join("\n")}`;
  return { isError: run.outcome._tag === "Failed", text: cut(`${text}${logs}`) };
};

const CodeArguments = Schema.Struct({ code: Schema.String });
const decodeArguments = Schema.decodeUnknownExit(CodeArguments);

/** Runs a thread's program against its connector tools, each call through the gateway as a listed tool would be. */
const runConnectorCode = (
  executor: CodeExecutor["Service"],
  gateway: ConnectorGateway["Service"],
  threadId: string,
  args: unknown,
) =>
  Effect.gen(function* () {
    const decoded = decodeArguments(args);
    if (Exit.isFailure(decoded)) return toolRefusal("Invalid arguments: give code, a JavaScript async arrow function.");
    const tools = yield* gateway.listingFor(threadId);
    const functions: Record<string, Record<string, CodeFunction>> = {};
    for (const { member, namespace, tool } of bindingsOf(tools)) {
      const members = functions[namespace] ?? {};
      members[member] = (input) =>
        gateway
          .call(threadId, tool.name, input)
          .pipe(
            Effect.flatMap((answer) =>
              answer.isError
                ? Effect.fail(new CodeCallFailure({ message: answer.text }))
                : Effect.succeed(resultOf(answer.text)),
            ),
          );
      functions[namespace] = members;
    }
    return answerOf(yield* executor.run(decoded.value.code, functions, defaultCodeLimits));
  });

/** The connector part of a thread's listing: Code Mode's one tool when it is on, else each connector tool. */
export const connectorListingOf = (tools: ReadonlyArray<ConnectorTool>, shouldUseCodeMode: boolean) => {
  if (!shouldUseCodeMode)
    return tools.map(({ description, inputSchema, name }) => ({ description, inputSchema, name }));
  const codeTool = codeToolOf(tools);
  return codeTool === null ? [] : [codeTool];
};

/**
 * Answers a call to Code Mode's tool or to a connector tool, or null when the name is neither. With Code Mode on, a
 * connector tool is reached only from code; with it off, Code Mode's tool is unknown.
 */
export const answerConnectorCall = (
  executor: CodeExecutor["Service"],
  gateway: ConnectorGateway["Service"],
  call: {
    readonly args: unknown;
    readonly name: string;
    readonly shouldUseCodeMode: boolean;
    readonly threadId: string;
  },
) =>
  Effect.gen(function* () {
    if (call.name === codeToolName)
      return call.shouldUseCodeMode ? yield* runConnectorCode(executor, gateway, call.threadId, call.args) : null;
    const tools = yield* gateway.listingFor(call.threadId);
    if (!tools.some((tool) => tool.name === call.name)) return null;
    if (call.shouldUseCodeMode)
      return toolRefusal(`Code Mode is on: call ${call.name} from code, with ${codeToolName}.`);
    return yield* gateway.call(call.threadId, call.name, call.args);
  });

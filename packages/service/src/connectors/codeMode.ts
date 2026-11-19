import { Effect, Exit, Match, Schema } from "effect";
import { type ToolAnswer, toolRefusal } from "../core/index.ts";
import { splitListedName } from "./catalog.ts";
import type { CodeExecutor } from "./codeExecutor.ts";
import { CodeCallFailure, type CodeFunction, type CodeFunctions, type CodeRun, defaultCodeLimits } from "./codeRun.ts";
import { type Binding, declarationOf, identifierOf, type OwnTool, ownDeclarationOf } from "./codeTypes.ts";
import type { ConnectorGateway, ConnectorTool } from "./gateway.ts";

// Code Mode (connectors specification, Code Mode; CHG-0324, CHG-0441, CHG-0446): with the setting on, a thread is
// offered one tool that runs a short program calling the tools of its tool server, in place of listing each of them:
// its connectors' tools as `connectors.<connector>.<tool>` and Outlore's own thread tools as `outlore.<tool>`, but not
// the few that must stay direct. Every call the program makes goes through the same door a listed tool's call would,
// so the switches, the questions and the answers are the same; only the listing and the way of calling change.

/** The one tool Code Mode lists in place of the tools it covers. */
export const codeToolName = "run_code";

/**
 * The most calls one run may make to tools that start or redirect other work, so one run cannot open a flood of
 * threads: a refused call comes back to the code as an error.
 */
export const maxWorkStartsPerRun = 5;

/** The most characters of a run's answer a thread reads, as Cloudflare's Code Mode caps its own (about 6,000 tokens). */
const maxAnswerCharacters = 24_000;

/** Outlore's own thread tools as Code Mode reaches them; the tool server builds it for one thread. */
export type OwnTools = {
  /** Calls one covered tool through the checks a direct call has, answering as it would. */
  readonly call: (name: string, args: unknown) => Effect.Effect<ToolAnswer>;
  /** Whether Code Mode covers the tool: it is listed in the code and no longer listed directly. */
  readonly isCovered: (name: string) => boolean;
  /** Whether the tool starts or redirects other threads' work, which a run may do only so many times. */
  readonly startsWork: (name: string) => boolean;
};

/** Each connector tool's place in the code; two tools whose names read the same as identifiers get a numbered suffix. */
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

const exampleOf = (bindings: ReadonlyArray<Binding>, covered: ReadonlyArray<OwnTool>) => {
  const first = bindings[0];
  if (first !== undefined)
    return `\n\nExample: async () => { const found = await connectors.${first.namespace}.${first.member}({ /* its input */ }); return found; }`;
  const own = covered[0];
  return own === undefined
    ? ""
    : `\n\nExample: async () => { const answer = await outlore.${identifierOf(own.name)}({ /* its input */ }); return answer; }`;
};

const descriptionOf = (
  bindings: ReadonlyArray<Binding>,
  covered: ReadonlyArray<OwnTool>,
  direct: ReadonlyArray<string>,
) => {
  const declarations = [
    ...(covered.length === 0 ? [] : [ownDeclarationOf(covered)]),
    ...(bindings.length === 0 ? [] : [declarationOf(bindings)]),
  ].join("\n\n");
  const stays =
    direct.length === 0
      ? ""
      : ` ${direct.join(", ")} stay${direct.length === 1 ? "s" : ""} listed as tools of their own: call ${direct.length === 1 ? "it" : "them"} directly, not from code.`;
  return `Run a short JavaScript program that calls Outlore's tools and your connectors' tools, and get back what it returns. Those tools are not listed one by one: call them from here. Use it to chain several calls, or to filter or sum their results, so only what you need comes back.

Available:
${declarations}

Write an async arrow function in plain JavaScript (no TypeScript types) that returns the result; a function body ending in return also works. Each call returns the tool's result, parsed from JSON when it is JSON. A call is checked exactly as a direct call to the tool would be: a call the owner denies, or to a connector or tool that is switched off, or that is refused, throws an Error with the reason, and a call that asks the owner waits for the answer.${stays} The program has no files, network, environment or modules: only outlore, connectors and console.log, whose lines come back with the result. It stops after ${defaultCodeLimits.cpuMillis / 1000} seconds of running time (waiting for a call does not count) or ${defaultCodeLimits.maxCalls} calls, and it may make at most ${maxWorkStartsPerRun} calls that start or redirect other work (open_thread, send_thread_message, interrupt_thread).${exampleOf(bindings, covered)}`;
};

/** The listing entry of Code Mode's tool for these tools, or null when there is nothing to call. */
const codeToolOf = (
  connectors: ReadonlyArray<ConnectorTool>,
  covered: ReadonlyArray<OwnTool>,
  direct: ReadonlyArray<string>,
) =>
  connectors.length === 0 && covered.length === 0
    ? null
    : {
        description: descriptionOf(bindingsOf(connectors), covered, direct),
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

/** A tool's call as the code sees it: its answer's value, or an error thrown into the code. */
const codeResultOf = (answer: ToolAnswer) =>
  answer.isError ? Effect.fail(new CodeCallFailure({ message: answer.text })) : Effect.succeed(resultOf(answer.text));

/**
 * Runs a thread's program against its tools: each connector call through the gateway and each call to one of Outlore's
 * tools through its own door, as a listed tool would be. The number of calls that start work is counted for the run.
 */
const runCode = (
  executor: CodeExecutor["Service"],
  gateway: ConnectorGateway["Service"],
  own: OwnTools,
  ownTools: ReadonlyArray<OwnTool>,
  threadId: string,
  args: unknown,
) =>
  Effect.gen(function* () {
    const decoded = decodeArguments(args);
    if (Exit.isFailure(decoded)) return toolRefusal("Invalid arguments: give code, a JavaScript async arrow function.");
    const connectors: Record<string, Record<string, CodeFunction>> = {};
    for (const { member, namespace, tool } of bindingsOf(yield* gateway.listingFor(threadId))) {
      const members = connectors[namespace] ?? {};
      members[member] = (input) => gateway.call(threadId, tool.name, input).pipe(Effect.flatMap(codeResultOf));
      connectors[namespace] = members;
    }
    const outlore: Record<string, CodeFunction> = {};
    let workStarts = 0;
    for (const { name } of ownTools.filter((tool) => own.isCovered(tool.name))) {
      outlore[identifierOf(name)] = (input) =>
        Effect.suspend(() => {
          if (own.startsWork(name)) {
            workStarts += 1;
            if (workStarts > maxWorkStartsPerRun)
              return Effect.fail(
                new CodeCallFailure({
                  message: `Not done: one run may make at most ${maxWorkStartsPerRun} calls that start or redirect other work. Go on in another run.`,
                }),
              );
          }
          return own.call(name, input).pipe(Effect.flatMap(codeResultOf));
        });
    }
    const functions: CodeFunctions = { connectors, outlore };
    return answerOf(yield* executor.run(decoded.value.code, functions, defaultCodeLimits));
  });

/** One entry of a thread's tool listing, as MCP's `tools/list` gives it. */
type Listed = {
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly name: string;
};

/**
 * The tools a thread is offered. With Code Mode off, each of Outlore's tools and each connector tool. With it on, the
 * tools that stay direct and Code Mode's one tool, which declares the covered tools (Outlore's and the connectors') in
 * their place, or none of it when there is nothing to call.
 */
export const offeredToolsOf = (
  ownListed: ReadonlyArray<OwnTool>,
  connectors: ReadonlyArray<ConnectorTool>,
  own: Pick<OwnTools, "isCovered">,
  shouldUseCodeMode: boolean,
): ReadonlyArray<Listed> => {
  const connectorEntries = connectors.map(({ description, inputSchema, name }) => ({ description, inputSchema, name }));
  if (!shouldUseCodeMode) return [...ownListed, ...connectorEntries];
  const direct = ownListed.filter((tool) => !own.isCovered(tool.name));
  const codeTool = codeToolOf(
    connectors,
    ownListed.filter((tool) => own.isCovered(tool.name)),
    direct.map((tool) => tool.name),
  );
  return codeTool === null ? direct : [...direct, codeTool];
};

/**
 * Answers a call to Code Mode's tool, to a connector tool or to a tool of Outlore's that Code Mode covers, or answers
 * null when the name is none of those and the caller carries on (a tool that stays direct, or a thread tool with
 * Code Mode off). With Code Mode on, a covered tool is reached only from code; with it off, Code Mode's tool is unknown.
 */
export const answerCodeModeCall = (
  executor: CodeExecutor["Service"],
  gateway: ConnectorGateway["Service"],
  own: OwnTools,
  call: {
    readonly args: unknown;
    readonly name: string;
    /** Outlore's tools as the thread is listed them. */
    readonly ownListed: ReadonlyArray<OwnTool>;
    readonly shouldUseCodeMode: boolean;
    readonly threadId: string;
  },
) =>
  Effect.gen(function* () {
    if (call.name === codeToolName)
      return call.shouldUseCodeMode
        ? yield* runCode(executor, gateway, own, call.ownListed, call.threadId, call.args)
        : null;
    if (own.isCovered(call.name))
      return call.shouldUseCodeMode
        ? toolRefusal(`Code Mode is on: call ${call.name} from code, with ${codeToolName}.`)
        : null;
    const isListed = (yield* gateway.listingFor(call.threadId)).some((tool) => tool.name === call.name);
    if (call.shouldUseCodeMode)
      return isListed ? toolRefusal(`Code Mode is on: call ${call.name} from code, with ${codeToolName}.`) : null;
    // A name that reads as a connector's tool goes to the gateway even when the thread is no longer offered it, so the
    // thread is told the connector is off for it, not that the tool is unknown (connectors specification).
    return isListed || splitListedName(call.name) !== null
      ? yield* gateway.call(call.threadId, call.name, call.args)
      : null;
  });

import { Exit, type Fiber, Schema } from "effect";
import type { QuickJSContext, QuickJSDeferredPromise, QuickJSHandle, QuickJSRuntime } from "quickjs-emscripten-core";
import type { CodeCallFailure, CodeFunction, CodeFunctions, CodeLimits, CodeOutcome, CodeRun } from "./codeRun.ts";

const megabytesOf = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

// A program first read as one expression (an arrow function, or a call), then as a function body when that does not
// parse: models write both, and Cloudflare's own description asks for the first.
const expressionProgramOf = (code: string) =>
  `(async () => {\nconst __outlore_value = (\n${code}\n);\nreturn typeof __outlore_value === "function" ? await __outlore_value() : await __outlore_value;\n})()`;
const bodyProgramOf = (code: string) => `(async () => {\n${code}\n})()`;

const ErrorShape = Schema.Struct({ message: Schema.optional(Schema.String), name: Schema.optional(Schema.String) });
const decodeError = Schema.decodeUnknownExit(ErrorShape);

/** The plain words of a value QuickJS threw. */
const errorTextOf = (thrown: unknown) => {
  const decoded = decodeError(thrown);
  if (Exit.isSuccess(decoded) && decoded.value.message !== undefined)
    return `${decoded.value.name ?? "Error"}: ${decoded.value.message}`;
  return `Error: ${typeof thrown === "string" ? thrown : JSON.stringify(thrown)}`;
};

/** A log line from `console.log`'s arguments, as a console would print them. */
const logLineOf = (values: ReadonlyArray<unknown>) =>
  values.map((value) => (typeof value === "string" ? value : (JSON.stringify(value) ?? String(value)))).join(" ");

type RunState = {
  callCount: number;
  isDone: boolean;
  logCharacters: number;
  /** Time spent inside QuickJS before the current entry. */
  spentMillis: number;
  /** When the current entry into QuickJS began, or null between entries. */
  enteredAt: number | null;
  isOverTime: boolean;
};

/**
 * Runs the code once in a fresh context of the runtime, resuming with the finished run, and returns what stops it
 * early. The model's JavaScript sees only the ECMAScript built-ins, `console`, and the given functions under the one
 * global `connectors`. A call is a promise inside QuickJS that resolves when its Effect ends, so a call that waits for
 * the owner holds no CPU and does not count against the time limit.
 */
export const runOnce = (
  runtime: QuickJSRuntime,
  code: string,
  functions: CodeFunctions,
  limits: CodeLimits,
  now: () => number,
  forkCall: (call: ReturnType<CodeFunction>) => Fiber.Fiber<unknown, CodeCallFailure>,
  resume: (run: CodeRun) => void,
) => {
  const state: RunState = {
    callCount: 0,
    enteredAt: null,
    isDone: false,
    isOverTime: false,
    logCharacters: 0,
    spentMillis: 0,
  };
  const logs: Array<string> = [];
  const pending = new Set<QuickJSDeferredPromise>();
  const calls = new Set<Fiber.Fiber<unknown, CodeCallFailure>>();
  const context: QuickJSContext = runtime.newContext();

  runtime.setInterruptHandler(() => {
    if (state.enteredAt === null) return false;
    state.isOverTime = state.spentMillis + (now() - state.enteredAt) > limits.cpuMillis;
    return state.isOverTime;
  });

  /** Runs one entry into QuickJS, counting its time. */
  const runTimed = <A>(enter: () => A) => {
    state.enteredAt = now();
    try {
      return enter();
    } finally {
      state.spentMillis += now() - state.enteredAt;
      state.enteredAt = null;
    }
  };

  const dispose = () => {
    if (state.isDone) return;
    state.isDone = true;
    for (const call of calls) call.interruptUnsafe();
    for (const deferred of pending) deferred.dispose();
    pending.clear();
    context.dispose();
  };

  const finish = (outcome: CodeOutcome) => {
    if (state.isDone) return;
    dispose();
    resume({ callCount: state.callCount, logs, outcome });
  };

  const failureOf = (thrown: unknown): CodeOutcome => {
    if (state.isOverTime)
      return { _tag: "Failed", message: `The code ran past its time limit (${limits.cpuMillis} ms).` };
    const text = errorTextOf(thrown);
    if (text === "InternalError: out of memory")
      return { _tag: "Failed", message: `The code ran out of memory (${megabytesOf(limits.memoryBytes)}).` };
    return { _tag: "Failed", message: text };
  };

  const failWith = (error: QuickJSHandle) => {
    const thrown = context.dump(error);
    error.dispose();
    finish(failureOf(thrown));
  };

  const rejectWith = (deferred: QuickJSDeferredPromise, message: string) => {
    const error = context.newError(message);
    deferred.reject(error);
    error.dispose();
  };

  const runPendingJobs = () => {
    const ran = runTimed(() => runtime.executePendingJobs());
    if (ran.error !== undefined) failWith(ran.error);
  };

  // Plain data crosses as JSON text, parsed by QuickJS's own `JSON.parse`, so no host object enters the code.
  const valueHandleOf = (value: unknown): QuickJSHandle => {
    const text = JSON.stringify(value);
    if (text === undefined) return context.undefined;
    const json = context.getProp(context.global, "JSON");
    const parse = context.getProp(json, "parse");
    const textHandle = context.newString(text);
    const parsed = context.callFunction(parse, json, textHandle);
    textHandle.dispose();
    parse.dispose();
    json.dispose();
    return context.unwrapResult(parsed);
  };

  const settle = (deferred: QuickJSDeferredPromise, exit: Exit.Exit<unknown, CodeCallFailure>) => {
    if (state.isDone || !pending.has(deferred)) return;
    pending.delete(deferred);
    if (Exit.isSuccess(exit)) {
      const value = valueHandleOf(exit.value);
      deferred.resolve(value);
      value.dispose();
    } else {
      const failure = Exit.findErrorOption(exit);
      rejectWith(deferred, failure._tag === "Some" ? failure.value.message : "The call failed.");
    }
    deferred.dispose();
    runPendingJobs();
  };

  const callOf = (call: CodeFunction) => (input: QuickJSHandle) => {
    const deferred = context.newPromise();
    if (state.callCount >= limits.maxCalls) {
      rejectWith(deferred, `The code made more than ${limits.maxCalls} connector calls.`);
      const handle = deferred.handle.dup();
      deferred.dispose();
      return handle;
    }
    state.callCount += 1;
    const argument = context.typeof(input) === "undefined" ? {} : context.dump(input);
    pending.add(deferred);
    const handle = deferred.handle.dup();
    const fiber = forkCall(call(argument));
    calls.add(fiber);
    fiber.addObserver((exit) => {
      calls.delete(fiber);
      // A call can end before the fork returns; settling waits until QuickJS has left this function.
      queueMicrotask(() => settle(deferred, exit));
    });
    return handle;
  };

  const install = () => {
    const consoleObject = context.newObject();
    const log = context.newFunction("log", (...values) => {
      const line = logLineOf(values.map((value) => context.dump(value)));
      if (state.logCharacters < limits.maxLogCharacters) {
        const kept = line.slice(0, limits.maxLogCharacters - state.logCharacters);
        state.logCharacters += kept.length;
        logs.push(kept);
      }
    });
    for (const name of ["log", "info", "warn", "error", "debug"]) context.setProp(consoleObject, name, log);
    log.dispose();
    context.setProp(context.global, "console", consoleObject);
    consoleObject.dispose();

    const connectors = context.newObject();
    for (const [namespace, members] of Object.entries(functions)) {
      const namespaceObject = context.newObject();
      for (const [name, call] of Object.entries(members)) {
        const handle = context.newFunction(name, callOf(call));
        context.setProp(namespaceObject, name, handle);
        handle.dispose();
      }
      context.setProp(connectors, namespace, namespaceObject);
      namespaceObject.dispose();
    }
    context.setProp(context.global, "connectors", connectors);
    connectors.dispose();
  };

  const evaluate = () => {
    const first = runTimed(() => context.evalCode(expressionProgramOf(code), "code.js"));
    if (first.error === undefined) return first;
    const firstError = context.dump(first.error);
    if (!errorTextOf(firstError).startsWith("SyntaxError")) return first;
    first.error.dispose();
    return runTimed(() => context.evalCode(bodyProgramOf(code), "code.js"));
  };

  install();
  const evaluated = evaluate();
  if (evaluated.error !== undefined) {
    failWith(evaluated.error);
    return dispose;
  }
  const promise = evaluated.value;
  context
    .resolvePromise(promise)
    .then((settled) => {
      if (state.isDone) {
        if (settled.error !== undefined) settled.error.dispose();
        else settled.value.dispose();
        return;
      }
      if (settled.error !== undefined) return failWith(settled.error);
      const value = context.dump(settled.value);
      settled.value.dispose();
      finish({ _tag: "Returned", value });
    })
    .catch((error: unknown) => {
      if (!state.isDone) finish(failureOf(error));
    });
  promise.dispose();
  // Jobs the code queued without a call (an already resolved `await`) run now.
  runPendingJobs();
  return dispose;
};

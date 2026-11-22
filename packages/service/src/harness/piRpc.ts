import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Deferred, Duration, Effect, Queue } from "effect";
import { fieldOf, HarnessFailure, reducedEnvironmentOf, textFieldOf } from "../core/index.ts";
import { type PiProvider, piModelsOf } from "./pi.ts";

// Pi's own RPC framing (earendil-works/pi in `--mode rpc`): one JSON record a line, each answer correlated by the
// id its request carried, every other record a notification. The shape follows the core JSON-RPC transport
// (core/lineProcess.ts) with Pi's field names: a request is `{ type, …fields, id }`, an answer
// `{ type: "response", id, command, success, data | error }`.

/** What a Pi process sends that is not an answer to one of ours: one notification record, or its end. */
export type PiIncoming =
  | { readonly _tag: "Record"; readonly record: unknown }
  | { readonly _tag: "Exit"; readonly reason: string };

/** One running Pi RPC process, started once and spoken to for its whole life. */
export interface PiProcess {
  /** Ends the process; its pending requests fail. */
  readonly close: () => void;
  readonly hasExited: () => boolean;
  /** The notifications the process sends between and during turns. */
  readonly incoming: Queue.Queue<PiIncoming>;
  /** Sends a typed command and waits for the answer its id correlates; a refused answer or the process's end fails it. */
  readonly request: (command: Record<string, unknown>) => Effect.Effect<unknown, HarnessFailure>;
  /** Writes one record without waiting for an answer, such as a refused question of Pi's. */
  readonly send: (record: Record<string, unknown>) => void;
}

/** How to start one Pi RPC process. */
export interface PiProcessOptions {
  /** Pi's own arguments, after `--mode rpc`. */
  readonly args: ReadonlyArray<string>;
  readonly command: string;
  readonly cwd: string;
  readonly env: Record<string, string>;
  /** Who the process is named for in the owner's failure reasons. */
  readonly label: string;
  /** Arguments placed before Pi's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
}

/** Starts a Pi RPC process; it lives until `close`, or until it exits on its own. */
export const startPiProcess = Effect.fnUntraced(function* (options: PiProcessOptions) {
  const incoming = yield* Queue.unbounded<PiIncoming>();
  const pending = new Map<string, Deferred.Deferred<unknown, HarnessFailure>>();
  let nextId = 1;
  let hasExited = false;
  let stderrTail = "";
  const child = spawn(options.command, [...(options.prefixArgs ?? []), "--mode", "rpc", ...options.args], {
    cwd: options.cwd,
    env: reducedEnvironmentOf(options.env),
    stdio: ["pipe", "pipe", "pipe"],
  });
  const end = (reason: string) => {
    if (hasExited) return;
    hasExited = true;
    for (const deferred of pending.values()) Deferred.doneUnsafe(deferred, Effect.fail(new HarnessFailure({ reason })));
    pending.clear();
    Queue.offerUnsafe(incoming, { _tag: "Exit", reason });
  };
  child.on("error", (error: NodeJS.ErrnoException) =>
    end(error.code === "ENOENT" ? `${options.label} was not found at "${options.command}".` : error.message),
  );
  child.on("exit", (code, signal) =>
    end(
      stderrTail.trim() === ""
        ? `${options.label} stopped unexpectedly (${signal ?? `exit code ${code}`}).`
        : `${options.label} stopped: ${stderrTail.trim()}`,
    ),
  );
  // A write to a closed stdin is reported by the exit handler instead.
  child.stdin.on("error", () => void 0);
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderrTail = `${stderrTail}${chunk}`.slice(-400);
  });
  createInterface({ input: child.stdout }).on("line", (line) => {
    if (line.trim() === "") return;
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      // Pi wrote a line that is not an RPC record; it is skipped.
      return;
    }
    if (textFieldOf(record, "type") !== "response") {
      Queue.offerUnsafe(incoming, { _tag: "Record", record });
      return;
    }
    const id = textFieldOf(record, "id");
    const deferred = id === null ? undefined : pending.get(id);
    if (id === null || deferred === undefined) return;
    pending.delete(id);
    Deferred.doneUnsafe(
      deferred,
      fieldOf(record, "success") === true
        ? Effect.succeed(fieldOf(record, "data") ?? {})
        : Effect.fail(
            new HarnessFailure({
              reason:
                textFieldOf(record, "error") ??
                `${options.label} refused ${textFieldOf(record, "command") ?? "a request"}.`,
            }),
          ),
    );
  });
  const write = (record: Record<string, unknown>) => {
    if (!hasExited) child.stdin.write(`${JSON.stringify(record)}\n`);
  };
  const request = Effect.fnUntraced(function* (command: Record<string, unknown>) {
    if (hasExited) return yield* new HarnessFailure({ reason: `${options.label} is not running.` });
    const id = `outlore-${nextId++}`;
    const deferred = yield* Deferred.make<unknown, HarnessFailure>();
    pending.set(id, deferred);
    write({ ...command, id });
    return yield* Deferred.await(deferred);
  });
  return {
    close: () => {
      if (hasExited) return;
      child.kill("SIGKILL");
      end(`${options.label} was closed.`);
    },
    hasExited: () => hasExited,
    incoming,
    request,
    send: write,
  } satisfies PiProcess;
});

/** Reads the models Pi offers one provider, without a session, prompts, or any tool source. */
export const probePiModels = (options: {
  readonly command: string;
  readonly provider: PiProvider;
  readonly prefixArgs?: ReadonlyArray<string>;
  readonly configDirectory?: string;
  readonly timeoutMillis?: number;
}) =>
  Effect.gen(function* () {
    const cwd = yield* Effect.sync(() => mkdtempSync(join(tmpdir(), "outlore-pi-probe-")));
    const pi = yield* startPiProcess({
      args: ["--no-session", "--no-extensions", "--no-mcp", "--no-approve"],
      command: options.command,
      cwd,
      env: options.configDirectory === undefined ? {} : { PI_CODING_AGENT_DIR: options.configDirectory },
      label: "Pi",
      ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
    });
    return yield* pi.request({ type: "get_available_models" }).pipe(
      Effect.flatMap((listed) => {
        const models = fieldOf(listed, "models");
        return Array.isArray(models)
          ? Effect.succeed(piModelsOf(models, options.provider))
          : Effect.fail(new HarnessFailure({ reason: "Pi listed no models." }));
      }),
      Effect.timeout(Duration.millis(options.timeoutMillis ?? 20_000)),
      Effect.mapError((error) =>
        error instanceof HarnessFailure ? error : new HarnessFailure({ reason: "Pi did not list its models in time." }),
      ),
      Effect.ensuring(
        Effect.sync(() => {
          pi.close();
          rmSync(cwd, { force: true, recursive: true });
        }),
      ),
    );
  });

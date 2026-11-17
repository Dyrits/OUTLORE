import variant from "@jitl/quickjs-singlefile-mjs-release-sync";
import { Clock, Context, Effect, Layer } from "effect";
import { newQuickJSWASMModuleFromVariant } from "quickjs-emscripten-core";
import type { CodeFunctions, CodeLimits, CodeRun } from "./codeRun.ts";
import { runOnce } from "./codeRunner.ts";

// Code Mode's executor (ADR 0023): the model's JavaScript runs in QuickJS compiled to WebAssembly, one fresh runtime
// per run, so nothing a run leaves behind reaches the next.

/** Runs a thread's code with only the functions it is given. */
export class CodeExecutor extends Context.Service<
  CodeExecutor,
  {
    /** Runs the code to its end; a failure of the code is an outcome, never an error. Interrupting stops it. */
    readonly run: (code: string, functions: CodeFunctions, limits: CodeLimits) => Effect.Effect<CodeRun>;
  }
>()("outlore/CodeExecutor") {}

/** The executor, its WebAssembly module loaded once, at the first run. */
export const codeExecutorLayer = Layer.effect(
  CodeExecutor,
  Effect.gen(function* () {
    const loadModule = yield* Effect.cached(Effect.promise(() => newQuickJSWASMModuleFromVariant(variant)));
    const run = (code: string, functions: CodeFunctions, limits: CodeLimits) =>
      Effect.gen(function* () {
        const module = yield* loadModule;
        const clock = yield* Clock.Clock;
        const context = yield* Effect.context<never>();
        return yield* Effect.acquireUseRelease(
          Effect.sync(() => {
            const runtime = module.newRuntime();
            runtime.setMemoryLimit(limits.memoryBytes);
            runtime.setMaxStackSize(limits.stackBytes);
            return runtime;
          }),
          (runtime) =>
            Effect.callback<CodeRun>((resume) => {
              const dispose = runOnce(
                runtime,
                code,
                functions,
                limits,
                () => clock.currentTimeMillisUnsafe(),
                Effect.runForkWith(context),
                (done) => resume(Effect.succeed(done)),
              );
              return Effect.sync(dispose);
            }),
          (runtime) => Effect.sync(() => runtime.dispose()),
        );
      });
    return CodeExecutor.of({ run });
  }),
);

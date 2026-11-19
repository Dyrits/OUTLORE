import { execFile } from "node:child_process";
import { Context, Effect, Layer } from "effect";

/** How a command ended; `code` is null when the tool is missing or timed out. */
export type CommandResult = { readonly code: number | null; readonly stderr: string; readonly stdout: string };

/**
 * Runs a command with text on its standard input, which is how a key reaches a secret store without ever being in a
 * command line. A stand-in replaces it in checks.
 */
export class CommandRunner extends Context.Service<
  CommandRunner,
  {
    readonly run: (command: string, args: ReadonlyArray<string>, input: string) => Effect.Effect<CommandResult>;
  }
>()("outlore/vault/CommandRunner") {}

/** The real runner: a short limit, no shell, the standard input written and closed. */
export const commandRunnerLayer = Layer.succeed(CommandRunner, {
  run: (command, args, input) =>
    Effect.callback((resume) => {
      const child = execFile(command, [...args], { maxBuffer: 1_000_000, timeout: 20_000 }, (error, stdout, stderr) =>
        resume(
          Effect.succeed({
            code: error === null ? 0 : typeof error.code === "number" ? error.code : null,
            stderr: String(stderr),
            stdout: String(stdout),
          }),
        ),
      );
      // A tool that exits before reading its input closes the pipe: that is its answer, not a crash here.
      child.stdin?.on("error", () => {});
      child.stdin?.end(input);
    }),
});

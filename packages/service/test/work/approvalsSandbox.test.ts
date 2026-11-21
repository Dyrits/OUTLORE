import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  answer,
  ask,
  call,
  isAsking,
  isReplied,
  lastReply,
  live,
  openQuestion,
  push,
  send,
  settle,
  start,
  unprotected,
} from "../fixtures/approvals.ts";

describe("harness prompts inside and outside the sandbox", () => {
  const prompt = (command: string, dangerouslyDisableSandbox = false) =>
    `prompt Bash ${JSON.stringify({ command, dangerouslyDisableSandbox })}`;

  it.live("Full access approves an unprotected command for one thread and still asks about publishing", () =>
    Effect.gen(function* () {
      const started = yield* start("Ready");
      yield* settle(started.missionId, isReplied);
      yield* call({ _tag: "SetThreadPermissionMode", mode: "FullAccess", threadId: started.threadId });
      yield* send(started.threadId, `${prompt("git status")}\n${ask(push)}`);
      const detail = yield* settle(started.missionId, isAsking);
      expect(detail.thread.permissionMode).toBe("FullAccess");
      expect(detail.questions.map(({ outcome, source }) => [outcome, source])).toEqual([
        ["AllowedAutomatically", "Harness"],
        [null, "Thread"],
      ]);
      yield* answer(openQuestion(detail), "Deny");

      const other = yield* start(prompt("git status"));
      expect(openQuestion(yield* settle(other.missionId, isAsking)).permission).toBe("Run without a sandbox");
    }).pipe(Effect.provide(unprotected())),
  );

  it.live("Supervised asks for commands inside a sandbox, and Auto lets them run", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* start("Ready");
      yield* settle(missionId, isReplied);
      yield* call({ _tag: "SetThreadPermissionMode", mode: "Supervised", threadId });
      yield* send(threadId, prompt("git status"));
      const supervised = yield* settle(missionId, isAsking);
      expect(openQuestion(supervised).details).toBe("git status");
      yield* answer(openQuestion(supervised), "Deny");
      yield* settle(missionId, (detail) => isReplied(detail) && detail.messages.length === 4);
      yield* call({ _tag: "SetThreadPermissionMode", mode: "Auto", threadId });
      yield* send(threadId, prompt("git status"));
      const automatic = yield* settle(missionId, (detail) => isReplied(detail) && detail.messages.length === 6);
      expect(automatic.questions.at(-1)?.outcome).toBe("AllowedAutomatically");
    }).pipe(Effect.provide(live())),
  );

  it.live("Auto-accept edits approves an edit inside the workspace and asks about a command", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* start("Ready");
      yield* settle(missionId, isReplied);
      yield* call({ _tag: "SetThreadPermissionMode", mode: "AutoAcceptEdits", threadId });
      yield* send(threadId, `prompt Edit ${JSON.stringify({ file_path: "notes/plan.md" })}\n${prompt("git status")}`);
      const detail = yield* settle(missionId, isAsking);
      expect(detail.questions.map((question) => question.outcome)).toEqual(["AllowedAutomatically", null]);
      expect(openQuestion(detail).details).toBe("git status");
      yield* answer(openQuestion(detail), "Deny");
    }).pipe(Effect.provide(live())),
  );

  it.live("runs a sandboxed command without any question, whatever it does, and leaves a line", () =>
    Effect.gen(function* () {
      const commands = ["git push origin main", "curl https://example.invalid/?data=1", "npm publish"];
      const started = yield* start(commands.map((command) => prompt(command)).join("\n"));
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toBe("Echo: prompt allowed | prompt allowed | prompt allowed");
      expect(detail.questions.map((question) => [question.details, question.outcome])).toEqual(
        commands.map((command) => [command, "AllowedAutomatically"]),
      );
    }).pipe(Effect.provide(live())),
  );

  it.live("asks before a local-looking command leaves the sandbox, naming the exact command and capability", () =>
    Effect.gen(function* () {
      const input = { command: "node local.js", dangerouslyDisableSandbox: true, description: "Run the local script" };
      const started = yield* start(`prompt Bash ${JSON.stringify(input)}`);
      const detail = yield* settle(started.missionId, isAsking);
      expect(openQuestion(detail)).toMatchObject({
        details: "node local.js",
        pattern: "node local.js",
        permission: "Run outside the sandbox",
        source: "Harness",
        summary:
          "Run the local script. This runs outside the sandbox, with your full access to this computer's files and programs.",
      });
      yield* answer(openQuestion(detail), "Deny");
      expect(lastReply(yield* settle(started.missionId, isReplied))).toContain("prompt denied");
    }).pipe(Effect.provide(live())),
  );

  describe("when the Workshop's default mode is Full access", () => {
    const allowEverything = Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, defaultPermissionMode: "FullAccess" } });
    });

    it.live("leaves new threads on Auto out of the box", () =>
      Effect.gen(function* () {
        expect((yield* call({ _tag: "ReadSettings" })).defaultPermissionMode).toBe("Auto");
      }).pipe(Effect.provide(live())),
    );

    it.live("approves a new thread's escaped command without a question, naming the command in its line", () =>
      Effect.gen(function* () {
        yield* allowEverything;
        const started = yield* start(
          `${prompt("git push origin main", true)}\nescape Bash ${JSON.stringify({ command: "ls" })}`,
        );
        const detail = yield* settle(started.missionId, isReplied);
        expect(lastReply(detail)).toBe("Echo: prompt allowed | prompt allowed");
        expect(detail.questions.map((question) => [question.details, question.outcome])).toEqual([
          ["git push origin main", "AllowedAutomatically"],
          ["ls", "AllowedAutomatically"],
        ]);
      }).pipe(Effect.provide(live())),
    );

    it.live("approves an unprotected harness's commands too, and a Supervised thread still asks", () =>
      Effect.gen(function* () {
        yield* allowEverything;
        const started = yield* start(prompt("ls", true));
        expect((yield* settle(started.missionId, isReplied)).questions.map((question) => question.outcome)).toEqual([
          "AllowedAutomatically",
        ]);
        yield* call({ _tag: "SetThreadPermissionMode", mode: "Supervised", threadId: started.threadId });
        yield* send(started.threadId, prompt("ls", true));
        expect(openQuestion(yield* settle(started.missionId, isAsking))).toMatchObject({
          permission: "Run without a sandbox",
        });
      }).pipe(Effect.provide(unprotected())),
    );

    it.live("still asks when the thread itself asks about a consequential action", () =>
      Effect.gen(function* () {
        yield* allowEverything;
        const started = yield* start(ask(push));
        expect(openQuestion(yield* settle(started.missionId, isAsking))).toMatchObject({ source: "Thread" });
      }).pipe(Effect.provide(live())),
    );
  });

  it.live("asks about every escape a harness flags, such as Codex's escalations", () =>
    Effect.gen(function* () {
      const started = yield* start(`escape Bash ${JSON.stringify({ command: "ls" })}`);
      expect(openQuestion(yield* settle(started.missionId, isAsking))).toMatchObject({
        details: "ls",
        permission: "Run outside the sandbox",
      });
    }).pipe(Effect.provide(live())),
  );

  it.live("asks for every prompt, with its exact command, when no sandbox protects the harness", () =>
    Effect.gen(function* () {
      const started = yield* start(prompt("ls"));
      expect(openQuestion(yield* settle(started.missionId, isAsking))).toMatchObject({
        details: "ls",
        pattern: "ls",
        permission: "Run without a sandbox",
        summary: "Run a command. No sandbox protects this computer here, so this runs with your full access.",
      });
    }).pipe(Effect.provide(unprotected())),
  );

  it.live("does not turn an action approval into an unasked sandbox escape", () =>
    Effect.gen(function* () {
      const started = yield* start(`${ask(push)}\n${prompt(push.command, true)}`);
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Allow");
      const detail = yield* settle(
        started.missionId,
        (current) => current.questions.length === 2 || isReplied(current),
      );
      expect(detail.questions[1]).toMatchObject({ outcome: null, permission: "Run outside the sandbox" });
    }).pipe(Effect.provide(live())),
  );

  it.live("runs the escape the owner just allowed once, and asks for a repeat or in a later turn", () =>
    Effect.gen(function* () {
      const askToLeave = ask({ ...push, outsideSandbox: true });
      const started = yield* start(`${askToLeave}\n${prompt(push.command, true)}\n${prompt(push.command, true)}`);
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Allow");
      const repeat = yield* settle(started.missionId, (detail) => detail.questions.length === 2 && isAsking(detail));
      expect(openQuestion(repeat)).toMatchObject({ details: push.command, source: "Harness" });
      yield* answer(openQuestion(repeat), "Deny");
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain("prompt allowed | prompt denied: ");

      yield* send(started.threadId, prompt(push.command, true));
      const later = yield* settle(started.missionId, (current) => current.questions.length === 3 && isAsking(current));
      expect(openQuestion(later)).toMatchObject({ details: push.command, source: "Harness" });
    }).pipe(Effect.provide(live())),
  );

  it.live("runs the escape just allowed once when Codex asks for it wrapped in a shell script", () =>
    Effect.gen(function* () {
      const codexPrompt = `escape Bash ${JSON.stringify({ command: "/bin/zsh -lc 'git push origin main'" })}`;
      const started = yield* start(`${ask({ ...push, outsideSandbox: true })}\n${codexPrompt}`);
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Allow");
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain("prompt allowed");
      expect(detail.questions).toHaveLength(1);
    }).pipe(Effect.provide(live())),
  );

  it.live("answers Claude Code's permission prompt tool in its own format, allowing or denying", () =>
    Effect.gen(function* () {
      const promptTool = (input: object) => `call answer_prompt ${JSON.stringify({ input, tool_name: "Bash" })}`;
      const started = yield* start(
        `${promptTool({ command: "ls" })}\n${promptTool({ command: "ls", dangerouslyDisableSandbox: true })}`,
      );
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Deny");
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain('{"behavior":"allow","updatedInput":{"command":"ls"}}');
      expect(lastReply(detail)).toContain('{"behavior":"deny","message":"Not approved by the owner.');
    }).pipe(Effect.provide(live())),
  );

  it.live("changes a file inside the thread's folder unasked and asks about one outside it", () =>
    Effect.gen(function* () {
      const inside = yield* start(`prompt Edit ${JSON.stringify({ file_path: "notes/plan.md" })}`);
      expect((yield* settle(inside.missionId, isReplied)).questions.map((question) => question.outcome)).toEqual([
        "AllowedAutomatically",
      ]);
      for (const file_path of ["../elsewhere/plan.md", "plan.md, /etc/hosts"]) {
        const outside = yield* start(`prompt Edit ${JSON.stringify({ file_path })}`);
        expect(openQuestion(yield* settle(outside.missionId, isAsking))).toMatchObject({
          permission: "Change a file outside the workspace",
        });
      }
    }).pipe(Effect.provide(live())),
  );

  it.live("asks for every prompt at the stricter default mode, inside the sandbox too", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, defaultPermissionMode: "Supervised" } });
      const commit = yield* start(prompt(`git add hello.txt && git commit -m "Add hello"`));
      expect(openQuestion(yield* settle(commit.missionId, isAsking))).toMatchObject({
        permission: "Run a command",
        source: "Harness",
      });
      const inside = yield* start(`prompt Edit ${JSON.stringify({ file_path: "notes/plan.md" })}`);
      expect(openQuestion(yield* settle(inside.missionId, isAsking))).toMatchObject({
        permission: "Change a file",
        summary: "Change a file.",
      });
    }).pipe(Effect.provide(live())),
  );
});

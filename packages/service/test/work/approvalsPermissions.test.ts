import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { matchesPattern, targetOf } from "../../src/policy/patterns.ts";
import {
  answer,
  ask,
  call,
  isAsking,
  isReplied,
  live,
  openQuestion,
  push,
  send,
  settle,
  start,
} from "../fixtures/approvals.ts";

describe("standing permissions", () => {
  it.live("saves only the exact target even when the agent proposes a wildcard", () =>
    Effect.gen(function* () {
      const first = yield* start(ask({ ...push, pattern: "git push *" }));
      yield* answer(openQuestion(yield* settle(first.missionId, isAsking)), "AlwaysAllow");
      yield* settle(first.missionId, isReplied);
      const view = yield* call({ _tag: "ReadPermissions", missionId: null });
      expect(view.permissions[0]).toMatchObject({
        pattern: "git push origin main",
        sentence: "Run this exact command",
      });
      yield* send(first.threadId, ask({ ...push, command: "git push evil other" }));
      const next = yield* settle(
        first.missionId,
        (current) => isAsking(current) || (current.questions.length === 2 && isReplied(current)),
      );
      expect(next.questions[1]?.outcome).toBeNull();
    }).pipe(Effect.provide(live())),
  );

  it.live(
    "Always allow spares later matching actions in the mission, asks elsewhere, and asks again once removed",
    () =>
      Effect.gen(function* () {
        const first = yield* start(ask(push));
        yield* answer(openQuestion(yield* settle(first.missionId, isAsking)), "AlwaysAllow");
        yield* settle(first.missionId, isReplied);

        const view = yield* call({ _tag: "ReadPermissions", missionId: null });
        expect(view.permissions).toHaveLength(1);
        expect(view.permissions[0]).toMatchObject({ missionId: first.missionId, pattern: "git push origin main" });

        yield* send(first.threadId, ask(push));
        const spared = yield* settle(first.missionId, (detail) => detail.questions.length === 2 && isReplied(detail));
        expect(spared.questions[1]).toMatchObject({
          message: "Run this exact command",
          outcome: "AllowedByPermission",
        });

        const other = yield* start(ask(push));
        const asking = yield* settle(other.missionId, isAsking);
        yield* answer(openQuestion(asking), "Deny");
        yield* settle(other.missionId, isReplied);

        const permissionId = view.permissions[0]?.id ?? ("" as never);
        yield* call({ _tag: "WidenPermission", permissionId });
        yield* send(other.threadId, ask(push));
        const widened = yield* settle(other.missionId, (detail) => detail.questions.length === 2 && isReplied(detail));
        expect(widened.questions[1]?.outcome).toBe("AllowedByPermission");

        yield* call({ _tag: "RemovePermission", permissionId });
        yield* send(first.threadId, ask(push));
        const again = yield* settle(first.missionId, isAsking);
        expect(openQuestion(again).outcome).toBeNull();
      }).pipe(Effect.provide(live())),
  );

  it.live("never lets a permission for an ordinary action cover an escape with the same command", () =>
    Effect.gen(function* () {
      const build = { action: "Build the app", command: "node build.js" };
      const started = yield* start(ask(build));
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "AlwaysAllow");
      yield* settle(started.missionId, isReplied);

      yield* send(started.threadId, `prompt Bash ${JSON.stringify({ ...build, dangerouslyDisableSandbox: true })}`);
      const asking = yield* settle(started.missionId, isAsking);
      expect(openQuestion(asking)).toMatchObject({ details: "node build.js", permission: "Run outside the sandbox" });
    }).pipe(Effect.provide(live())),
  );

  it.live("lets the owner allow one exact escape always, which spares only that escape", () =>
    Effect.gen(function* () {
      const leave = (command: string) => `prompt Bash ${JSON.stringify({ command, dangerouslyDisableSandbox: true })}`;
      const started = yield* start(leave("./setup-hooks.sh"));
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "AlwaysAllow");
      yield* settle(started.missionId, isReplied);
      yield* send(started.threadId, `${leave("./setup-hooks.sh")}\n${leave("./setup-hooks.sh --force")}`);
      const next = yield* settle(started.missionId, (current) => current.questions.length === 3 && isAsking(current));
      expect(next.questions[1]?.outcome).toBe("AllowedByPermission");
      expect(openQuestion(next).details).toBe("./setup-hooks.sh --force");
    }).pipe(Effect.provide(live())),
  );

  it.live("keeps every answer in the Permissions history, filterable by mission", () =>
    Effect.gen(function* () {
      const first = yield* start(ask(push));
      yield* answer(openQuestion(yield* settle(first.missionId, isAsking)), "Allow");
      const second = yield* start(ask(push));
      yield* answer(openQuestion(yield* settle(second.missionId, isAsking)), "Deny");
      yield* settle(second.missionId, isReplied);

      const all = yield* call({ _tag: "ReadPermissions", missionId: null });
      expect(all.history.map((question) => question.outcome).sort()).toEqual(["Allowed", "Denied"]);
      const one = yield* call({ _tag: "ReadPermissions", missionId: second.missionId });
      expect(one.history.map((question) => question.outcome)).toEqual(["Denied"]);
      expect(all.level).toBe("RiskyOnly");
    }).pipe(Effect.provide(live())),
  );
});

describe("command patterns", () => {
  it("covers only the exact command it was saved for", () => {
    expect(matchesPattern("git push origin main", "git push origin main")).toBe(true);
    expect(matchesPattern("git push origin main", "git push origin dev")).toBe(false);
    expect(matchesPattern("git push origin main", "git push origin main && rm -rf ~")).toBe(false);
  });

  it("reads a literal star as an ordinary character", () => {
    expect(matchesPattern("rm -rf ./build/*", "rm -rf ./build/*")).toBe(true);
    expect(matchesPattern("rm -rf ./build/*", "rm -rf ./build/../../dummy-outside/x")).toBe(false);
  });

  it("refuses an empty or one-character pattern", () => {
    expect(matchesPattern("*", "git push origin main")).toBe(false);
    expect(matchesPattern("", "")).toBe(false);
  });

  it("names a harness target by its command, file, or address", () => {
    expect(targetOf("Bash", { command: "ls" })).toBe("ls");
    expect(targetOf("Write", { content: "x", file_path: "/etc/hosts" })).toBe("Write /etc/hosts");
    expect(targetOf("WebFetch", { url: "https://example.com" })).toBe("WebFetch https://example.com");
  });

  it("names a command Codex wraps in a shell script by the script, and keeps anything around it", () => {
    expect(targetOf("Bash", { command: "/bin/zsh -lc 'git push origin main'" })).toBe("git push origin main");
    expect(targetOf("Bash", { command: 'bash -c "npm publish"' })).toBe("npm publish");
    expect(targetOf("Bash", { command: "zsh -lc 'a' ; rm -rf ~ ; echo 'b'" })).toBe(
      "zsh -lc 'a' ; rm -rf ~ ; echo 'b'",
    );
  });
});

import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MissionDetail, Request } from "@outlore/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { fakeHarnessLayer, Service, serviceLayer } from "../../src/index.ts";
import { call } from "./service.ts";

// What the workspace and realm tests share: a service with folders to choose, requests that fail, and a mission to start.

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

/** A service with folders to choose as workspaces, and its data beside them. */
export const setUp = () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "outlore-workspaces-")));
  directories.push(base);
  const home = join(base, "home");
  const outside = join(base, "outside");
  for (const folder of [home, join(home, "app"), join(home, "app", "lib"), join(home, ".hidden"), outside]) {
    mkdirSync(folder, { recursive: true });
  }
  const layer = serviceLayer({
    filename: join(base, "outlore.sqlite"),
    harness: fakeHarnessLayer("10 millis"),
    homeFolder: home,
    scratchRoot: join(base, "data", "missions"),
  });
  return { base, home, layer, outside };
};

export const failureOf = <R extends Request>(request: R) =>
  Effect.gen(function* () {
    const service = yield* Service;
    return yield* Effect.flip(service.handle(request));
  });

/** A failure as a paired device meets it: its folder requests reach only the browsable roots (CHG-0253). */
export const failureOfPairedDevice = <R extends Request>(request: R) =>
  Effect.gen(function* () {
    const service = yield* Service;
    return yield* Effect.flip(service.handle(request, { isPairedDevice: true }));
  });

export const repliedWith = (count: number) => (detail: MissionDetail) =>
  detail.messages.filter((message) => message.sender === "agent").length === count &&
  (detail.thread.state === "Idle" || detail.thread.state === "Failed");
export const isAsking = (detail: MissionDetail) => detail.questions.some((question) => question.outcome === null);
export const lastReply = (detail: MissionDetail) => detail.messages.at(-1)?.text ?? "";

let requestCount = 0;
export const start = (text: string, workspacePath: string | null) =>
  call({
    _tag: "StartMission",
    effort: "default",
    model: "default",
    requestId: `start-${++requestCount}`,
    text,
    workspacePath,
  });

export const push = {
  action: "Push the branch",
  command: "git push origin main",
  pattern: "git push *",
  permission: "Push code",
};
export const ask = `ask ${JSON.stringify(push)}`;

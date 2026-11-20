import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MissionDetail, Question, Request, ResultOf } from "@outlore/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import type { Containment } from "../../src/core/index.ts";
import { fakeHarnessLayer, Service, serviceLayer } from "../../src/index.ts";
import { call, read, settle } from "./service.ts";

/** An approvals service on its own temporary database, removed after the test. */
const directories: string[] = [];
export const databaseFile = () => {
  const directory = mkdtempSync(join(tmpdir(), "outlore-approvals-"));
  directories.push(directory);
  return join(directory, "outlore.sqlite");
};
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

export const serviceOn = (filename: string, containment: Containment = "Sandboxed") =>
  serviceLayer({
    filename,
    harness: fakeHarnessLayer("10 millis", containment),
    homeFolder: join(filename, ".."),
    scratchRoot: join(filename, "..", "missions"),
  });
export const live = () => serviceOn(databaseFile());
/** A service whose harness runs with no enforced sandbox, as on a host where none can start. */
export const unprotected = () => serviceOn(databaseFile(), "Unprotected");

export { call, read, settle };

export const failureOf = <R extends Request>(request: R) =>
  Effect.gen(function* () {
    const service = yield* Service;
    return yield* Effect.flip(service.handle(request));
  });

export const isAsking = (detail: MissionDetail) => detail.questions.some((question) => question.outcome === null);
export const isReplied = (detail: MissionDetail) =>
  detail.thread.state === "Resting" && detail.messages.at(-1)?.sender === "agent";
export const lastReply = (detail: MissionDetail) => detail.messages.at(-1)?.text ?? "";
export const openQuestion = (detail: MissionDetail) =>
  detail.questions.find((question) => question.outcome === null) as Question;

export const push = {
  action: "Push today's commits to GitHub so the release can start",
  command: "git push origin main",
};
export const ask = (request: object) => `ask ${JSON.stringify(request)}`;

let requestCount = 0;
export const start = (text: string, workspacePath: string | null = null) =>
  call({
    _tag: "StartMission",
    effort: "default",
    model: "default",
    requestId: `start-${++requestCount}`,
    text,
    workspacePath,
  });
export const send = (threadId: ResultOf<"StartMission">["threadId"], text: string) =>
  call({ _tag: "SendMessage", delivery: null, requestId: `send-${++requestCount}`, text, threadId });

export const answer = (question: Question, given: "Allow" | "AlwaysAllow" | "Deny", message: string | null = null) =>
  call({ _tag: "AnswerQuestion", answer: given, message, questionId: question.id });

import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { type CreateRepositoryRealm, type RealmCreation, realmSlugOf } from "@outlore/contracts";
import { Effect, Exit } from "effect";
import { createFolder, type FolderAccess, invalid, type ServiceFailure } from "../core/index.ts";
import type { CommandRunner } from "./commands.ts";
import { createRealmOutcome } from "./realmCreation.ts";
import { hasActiveRealmName } from "./realmResolution.ts";

type RepositoryRequest = typeof CreateRepositoryRealm.Type;

const cloneUrlOf = (source: Exclude<RepositoryRequest["source"], { _tag: "Project" }>, access: FolderAccess) => {
  if (source._tag === "GitHub") {
    const repository = source.repository.trim();
    return /^[a-z\d][a-z\d-]*\/(?!\.{1,2}$)[a-z\d_.-]+$/i.test(repository) ? `https://github.com/${repository}` : null;
  }
  const input = source.url.trim();
  if (/^[\w.][\w.-]*@[a-z\d][a-z\d.-]*:[^\s]+$/i.test(input)) return input;
  if (!/^(https?|ssh|git|file):\/\//i.test(input)) return null;
  try {
    const url = new URL(input);
    if (url.protocol === "file:") return access === "anywhere" && url.host === "" ? url.href : null;
    if (url.hostname === "" || url.password !== "" || url.search !== "" || url.hash !== "") return null;
    if (url.protocol !== "ssh:" && url.username !== "") return null;
    return url.href;
  } catch {
    return null;
  }
};

const prepareRepository = (path: string, url: string | null, access: FolderAccess) =>
  Effect.callback<void, ServiceFailure>((resume) => {
    const args = url === null ? ["init"] : ["clone", "--no-local", "--no-recurse-submodules", "--", url, "."];
    const child = execFile(
      "git",
      args,
      {
        cwd: path,
        env: {
          ...process.env,
          // Restrict URL rewrites too. Git's local transport is only available from the host window.
          GIT_ALLOW_PROTOCOL: access === "anywhere" ? "https:http:ssh:git:file" : "https:http:ssh:git",
          GIT_TERMINAL_PROMPT: "0",
        },
        timeout: 120_000,
      },
      (error, _stdout, stderr) => {
        const detail = stderr.trim() || (error?.killed ? "Git timed out." : "Check that Git is installed.");
        resume(
          error === null
            ? Effect.void
            : invalid(`Git could not ${url === null ? "initialize" : "clone"} the repository. ${detail}`),
        );
      },
    );
    child.stdin?.on("error", () => {});
    child.stdin?.end();
  });

/** Sets up a fresh folder before attaching it, with Git outside the storage transaction. */
export const createRepositoryRealm = Effect.fn("createRepositoryRealm")(function* (
  commands: CommandRunner,
  given: RepositoryRequest,
  access: FolderAccess,
) {
  const name = given.name.trim();
  if (
    name === "" ||
    name === "." ||
    name === ".." ||
    name.toLowerCase() === ".git" ||
    name.endsWith(".") ||
    /[<>:"/\\|?*]/.test(name) ||
    [...name].some((character) => character.charCodeAt(0) < 32) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
  ) {
    return yield* invalid("Choose a realm name that can also be used as a folder name.");
  }
  const url = given.source._tag === "Project" ? null : cloneUrlOf(given.source, access);
  if (given.source._tag !== "Project" && url === null) {
    return yield* invalid(
      given.source._tag === "GitHub"
        ? "Enter a GitHub repository as owner/repo."
        : "Enter a Git repository URL without embedded credentials.",
    );
  }
  if (!given.allowDuplicateName && (yield* hasActiveRealmName(realmSlugOf(name), null))) {
    return { _tag: "NameTaken", name: realmSlugOf(name) } satisfies RealmCreation;
  }

  // The exclusive mkdir prevents Git and cleanup from touching an existing folder.
  return yield* Effect.gen(function* () {
    const { path } = yield* createFolder(given.parent, name, access);
    return yield* prepareRepository(path, url, access).pipe(
      Effect.andThen(commands.run(createRealmOutcome({ ...given, _tag: "CreateRealm", name, path }))),
      Effect.flatMap((outcome) =>
        outcome._tag === "ArchivedMatch"
          ? invalid("This destination belongs to an archived realm. Choose another name or destination.")
          : Effect.succeed(outcome),
      ),
      Effect.onExit((exit) =>
        Exit.isSuccess(exit) && exit.value._tag === "Created"
          ? Effect.void
          : Effect.promise(() => rm(path, { force: true, recursive: true })).pipe(Effect.ignoreCause),
      ),
    );
  }).pipe(Effect.uninterruptible);
});

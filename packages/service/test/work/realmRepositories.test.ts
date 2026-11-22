import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach, vi } from "vitest";
import { call } from "../fixtures/service.ts";
import { failureOf, failureOfPairedDevice, setUp } from "../fixtures/workspaces.ts";

const listed = call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null });
const projectAt = (parent: string, name: string) =>
  ({
    _tag: "CreateRepositoryRealm",
    allowDuplicateName: false,
    name,
    parent,
    source: { _tag: "Project" },
  }) as const;

describe("making a realm from a repository", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.live("initializes a new project and links its folder to the realm", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const path = join(home, "New project");
      expect(yield* call(projectAt(home, "New project"))).toEqual({ _tag: "Created" });
      expect(existsSync(join(path, ".git", "HEAD"))).toBe(true);
      expect((yield* listed).workspaces).toEqual([expect.objectContaining({ name: "New project", path })]);
    }).pipe(Effect.provide(layer));
  });

  it.live("leaves occupied destinations intact and removes the folder from a failed initialization", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      expect((yield* failureOf(projectAt(home, "app"))).message).toContain("already exist");
      expect(existsSync(join(home, "app", "lib"))).toBe(true);
      expect(existsSync(join(home, "app", ".git"))).toBe(false);
      vi.stubEnv("GIT_DEFAULT_HASH", "outlore-invalid-hash");
      expect((yield* failureOf(projectAt(home, "Bad init"))).message).toContain("Git could not initialize");
      expect(existsSync(join(home, "Bad init"))).toBe(false);
      expect((yield* listed).workspaces).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks before it creates a project with a duplicate realm name", () => {
    const { home, layer } = setUp();
    const project = projectAt(home, "Garden");
    return Effect.gen(function* () {
      yield* call({ _tag: "CreateRealm", name: "Garden", path: null, shouldAnswerOutcome: true });
      expect(yield* call(project)).toEqual({ _tag: "NameTaken", name: "Garden" });
      expect(existsSync(join(home, "Garden"))).toBe(false);
      expect(yield* call({ ...project, allowDuplicateName: true })).toEqual({ _tag: "Created" });
      expect((yield* listed).workspaces).toHaveLength(2);
    }).pipe(Effect.provide(layer));
  });

  it.live("clones a Git URL and a GitHub owner and repository without contacting a remote host", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const original = join(home, "app");
      execFileSync("git", ["init", "--bare", original]);
      const url = pathToFileURL(original).href;
      vi.stubEnv("GIT_CONFIG_COUNT", "1");
      vi.stubEnv("GIT_CONFIG_KEY_0", `url.${url}.insteadOf`);
      vi.stubEnv("GIT_CONFIG_VALUE_0", "https://github.com/test-owner/test-repo");
      expect(yield* call({ ...projectAt(home, "URL clone"), source: { _tag: "GitUrl", url } })).toEqual({
        _tag: "Created",
      });
      expect(
        yield* call({
          ...projectAt(home, "GitHub clone"),
          source: { _tag: "GitHub", repository: "test-owner/test-repo" },
        }),
      ).toEqual({ _tag: "Created" });
      expect((yield* listed).workspaces.map(({ path }) => path)).toEqual([
        join(home, "GitHub clone"),
        join(home, "URL clone"),
      ]);
      expect(
        execFileSync("git", ["config", "--local", "--get", "remote.origin.url"], {
          cwd: join(home, "GitHub clone"),
          encoding: "utf8",
        }).trim(),
      ).toBe("https://github.com/test-owner/test-repo");
    }).pipe(Effect.provide(layer));
  });

  it.live("reports a failed clone and leaves the destination available for retry", () => {
    const { home, layer } = setUp();
    const request = {
      ...projectAt(home, "Bad clone"),
      source: { _tag: "GitUrl", url: pathToFileURL(join(home, "missing")).href },
    } as const;
    return Effect.gen(function* () {
      expect((yield* failureOf(request)).message).toContain("Git could not clone");
      expect(existsSync(join(home, "Bad clone"))).toBe(false);
      expect((yield* listed).workspaces).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses to provision outside the paired device's browsable roots or clone local files from it", () => {
    const { home, layer, outside } = setUp();
    return Effect.gen(function* () {
      expect((yield* failureOfPairedDevice(projectAt(outside, "Remote project"))).message).toContain("browsable roots");
      const request = {
        ...projectAt(home, "Local clone"),
        source: { _tag: "GitUrl", url: pathToFileURL(outside).href },
      } as const;
      expect((yield* failureOfPairedDevice(request)).message).toContain("Git repository URL");
      expect((yield* listed).workspaces).toEqual([]);
    }).pipe(Effect.provide(layer));
  });
});

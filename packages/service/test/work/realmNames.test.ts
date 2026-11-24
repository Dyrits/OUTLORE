import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { call } from "../fixtures/service.ts";
import { failureOf, setUp, start } from "../fixtures/workspaces.ts";

describe("naming a realm", () => {
  const listed = call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null });

  it.live("names a new realm when its first quest starts, and ignores the name for an existing realm", () => {
    const { home, layer } = setUp();
    const app = join(home, "app");
    return Effect.gen(function* () {
      yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        realm: { name: "The Orchard" },
        requestId: crypto.randomUUID(),
        text: "Begin",
        workspacePath: app,
      });
      const first = yield* listed;
      expect(first.workspaces[0]).toMatchObject({ name: "the-orchard", path: app });
      yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        realm: { name: "Other" },
        requestId: crypto.randomUUID(),
        text: "Again",
        workspacePath: app,
      });
      expect((yield* listed).workspaces[0]).toMatchObject({ name: "the-orchard" });
    }).pipe(Effect.provide(layer));
  });

  it.live("ignores a crest an earlier version stored on a realm", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      yield* start("Fix the build", join(home, "app"));
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE workspaces SET crest = '{"plate":"Shield"}'`;
      const after = yield* listed;
      expect(after.workspaces[0]).toEqual({
        id: after.workspaces[0]?.id,
        name: "app",
        path: join(home, "app"),
      });
      expect(after.missions[0]).not.toHaveProperty("workspaceCrest");
    }).pipe(Effect.provide(layer));
  });

  it.live("renames a realm, and refuses a blank name", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      yield* start("Fix the build", join(home, "app"));
      const workspaceId = (yield* listed).workspaces[0]?.id;
      if (workspaceId === undefined) return yield* Effect.die(new Error("no realm"));
      yield* call({ _tag: "RenameRealm", name: "  The Orchard ", workspaceId });
      const after = yield* listed;
      expect(after.workspaces[0]?.name).toBe("the-orchard");
      expect(after.missions[0]?.workspaceName).toBe("the-orchard");
      const failure = yield* failureOf({ _tag: "RenameRealm", name: "   ", workspaceId });
      expect(JSON.stringify(failure)).toContain("needs a name");
    }).pipe(Effect.provide(layer));
  });

  it.live("lists a realm imported from a folder before any quest starts in it", () => {
    const { home, layer } = setUp();
    const app = join(home, "app");
    return Effect.gen(function* () {
      yield* call({ _tag: "CreateRealm", name: "The Orchard", path: app });
      const imported = yield* listed;
      expect(imported.missions).toEqual([]);
      expect(imported.workspaces[0]).toMatchObject({ name: "the-orchard", path: app });
      const failure = yield* failureOf({ _tag: "CreateRealm", name: "Nope", path: join(home, "missing") });
      expect(JSON.stringify(failure)).toContain("No folder");
    }).pipe(Effect.provide(layer));
  });
});

describe("realms with no folder", () => {
  const realms = () =>
    call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null }).pipe(
      Effect.map((list) => list.workspaces),
    );

  it.live("makes a realm with a name and no folder, and lists it among the realms", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      yield* call({ _tag: "CreateRealm", name: "  Game Design ", path: null });
      yield* call({ _tag: "CreateRealm", name: "Archive of ideas", path: null });
      yield* call({ _tag: "CreateRealm", name: "App", path: join(home, "app") });
      const listed = yield* realms();
      expect(
        listed.map(({ name, path }) => ({ name, path })).sort((current, next) => current.name.localeCompare(next.name)),
      ).toEqual([
        { name: "app", path: join(home, "app") },
        { name: "archive-of-ideas", path: null },
        { name: "game-design", path: null },
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("renames a realm with no folder", () => {
    const { layer } = setUp();
    return Effect.gen(function* () {
      yield* call({ _tag: "CreateRealm", name: "Game Design", path: null });
      const [realm] = yield* realms();
      yield* call({ _tag: "RenameRealm", name: "Level Design", workspaceId: realm?.id as never });
      expect(yield* realms()).toEqual([{ id: realm?.id, name: "level-design", path: null }]);
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses a blank name", () => {
    const { layer } = setUp();
    return Effect.gen(function* () {
      const failure = yield* failureOf({ _tag: "CreateRealm", name: "   ", path: null });
      expect(JSON.stringify(failure)).toContain("needs a name");
      expect(yield* realms()).toEqual([]);
    }).pipe(Effect.provide(layer));
  });
});

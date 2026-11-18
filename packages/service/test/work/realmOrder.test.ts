import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { call, withService } from "../fixtures/service.ts";

const names = call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null }).pipe(
  Effect.map((view) => view.workspaces.map((realm) => realm.name)),
);

describe("ordering realms", () => {
  it.live("lists realms by name until the owner orders them, then in that order, new realms last", () =>
    withService(
      Effect.gen(function* () {
        for (const name of ["Beta", "Alpha", "Gamma"]) yield* call({ _tag: "CreateRealm", name, path: null });
        expect(yield* names).toEqual(["Alpha", "Beta", "Gamma"]);
        const realms = (yield* call({
          _tag: "ListMissions",
          isArchived: false,
          search: null,
          state: null,
          workspaceId: null,
        })).workspaces;
        const id = (name: string) => realms.find((realm) => realm.name === name)?.id;
        const gamma = id("Gamma");
        const alpha = id("Alpha");
        if (gamma === undefined || alpha === undefined) return yield* Effect.die("Missing realm");
        yield* call({ _tag: "ReorderRealms", workspaceIds: [gamma, alpha] });
        expect(yield* names).toEqual(["Gamma", "Alpha", "Beta"]);
        yield* call({ _tag: "CreateRealm", name: "Aardvark", path: null });
        expect(yield* names).toEqual(["Gamma", "Alpha", "Beta", "Aardvark"]);
      }),
    ),
  );

  it.live("refuses an unknown realm and leaves the order as it was", () =>
    withService(
      Effect.gen(function* () {
        yield* call({ _tag: "CreateRealm", name: "Alpha", path: null });
        const failure = yield* Effect.flip(call({ _tag: "ReorderRealms", workspaceIds: ["missing" as never] }));
        expect(failure.kind).toBe("InvalidInput");
        expect(yield* names).toEqual(["Alpha"]);
      }),
    ),
  );
});

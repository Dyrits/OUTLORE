import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { call, withService } from "../fixtures/service.ts";

it.live("creates, acknowledges a name collision, and offers an archived folder without changing it", () =>
  withService(
    Effect.gen(function* () {
      const given = {
        _tag: "CreateRealm",
        name: "Garden",
        path: null,
        shouldAnswerOutcome: true,
      } as const;
      expect(yield* call(given)).toEqual({ _tag: "Created" });
      expect(yield* call({ ...given, name: "garden" })).toEqual({ _tag: "NameTaken", name: "garden" });
      expect(yield* call({ ...given, allowDuplicateName: true })).toEqual({ _tag: "Created" });
      const roots = yield* call({ _tag: "BrowseFolders", path: null, shouldIncludeHidden: false });
      const path = roots.folders[0]?.path;
      if (path === undefined) return yield* Effect.die("No folder");
      expect(yield* call({ ...given, name: "Folder", path })).toEqual({ _tag: "Created" });
      const listed = yield* call({
        _tag: "ListMissions",
        isArchived: false,
        search: null,
        state: null,
        workspaceId: null,
      });
      const realm = listed.workspaces.find((realm) => realm.path === path);
      if (realm === undefined) return yield* Effect.die("No realm");
      const preview = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
      yield* call({ _tag: "ArchiveRealm", snapshot: preview.snapshot, workspaceId: realm.id });
      const outcome = yield* call({ ...given, path });
      expect(outcome).toMatchObject({ _tag: "ArchivedMatch", archived: { realm: { id: realm.id, name: "Folder" } } });
      expect(yield* call({ _tag: "ListArchivedRealms" })).toHaveLength(1);
    }),
  ),
);

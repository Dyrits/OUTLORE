import { WorkspaceId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { realmLabelOf } from "../../src/realms/realmLabels";
import { comparisonOf, proposedRealmOf, recoveryAppearanceOf } from "../../src/realms/realmRecovery";

const archived = { id: WorkspaceId.make("old"), name: "Old garden", path: "/work/garden" };
const proposed = { name: "New garden" };

describe("recovering a realm's appearance", () => {
  it("compares the folder-name fallback as the actual proposed name", () => {
    expect(proposedRealmOf({ name: "  ", path: "/work/garden/" })).toEqual({
      name: "garden",
      path: "/work/garden/",
    });
  });
  it("lets the owner keep the archived name or take the proposed one", () => {
    expect(recoveryAppearanceOf(archived, proposed, { name: "proposed" })).toEqual({ name: "New garden" });
    expect(recoveryAppearanceOf(archived, proposed, { name: "old" })).toEqual({ name: "Old garden" });
  });
  it("skips an equal name", () => {
    expect(comparisonOf(archived, { name: archived.name })).toEqual({ hasNameDifference: false });
    expect(comparisonOf(archived, { name: "Other" })).toEqual({ hasNameDifference: true });
  });
});

describe("naming duplicate realms", () => {
  it("adds a folder hint only when active names collide", () => {
    const current = { ...archived, name: "app", path: "/client-a/app" };
    const other = { ...current, id: WorkspaceId.make("other"), path: "/client-b/app" };
    expect(realmLabelOf(current, [current])).toBe("app");
    expect(realmLabelOf(current, [current, other])).toBe("app · client-a");
    expect(realmLabelOf({ ...current, path: null }, [current, other])).toBe("app");
  });
});

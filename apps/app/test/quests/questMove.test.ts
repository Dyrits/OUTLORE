import type { MissionSummary, WorkspaceId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { moveConfirmationOf, noRealmDestination, sourceNameOf } from "../../src/quests/questMove";

const quest = (workspaceId: string | null, workspaceName: string | null) =>
  ({ title: "Fix the build", workspaceId: workspaceId as WorkspaceId | null, workspaceName }) satisfies Pick<
    MissionSummary,
    "title" | "workspaceId" | "workspaceName"
  >;

describe("confirming a quest move", () => {
  it("names the source and the destination of a move between realms, and both realms' lore", () => {
    const confirmation = moveConfirmationOf(quest("a", "Garden"), { id: "b" as WorkspaceId, name: "Workshop" });
    expect(confirmation?.title).toBe('Move "Fix the build" to Workshop?');
    expect(confirmation?.body).toContain("from Garden to Workshop");
    expect(confirmation?.body).toContain("lore shared in Garden will no longer be available");
    expect(confirmation?.body).toContain("lore shared in Workshop will be");
    expect(confirmation?.body).toContain("Lore is not copied");
  });

  it("asks to take a quest out of its realm, and mentions only the lore it loses", () => {
    const confirmation = moveConfirmationOf(quest("a", "Garden"), noRealmDestination);
    expect(confirmation?.title).toBe('Take "Fix the build" out of Garden?');
    expect(confirmation?.body).toContain("leave Garden and are in no realm");
    expect(confirmation?.body).toContain("lore shared in Garden will no longer be available");
    expect(confirmation?.body).not.toContain("will be.");
  });

  it("asks to put a quest with no realm in one, and mentions only the lore it gains", () => {
    expect(sourceNameOf(quest(null, null))).toBe("no realm");
    const confirmation = moveConfirmationOf(quest(null, null), { id: "a" as WorkspaceId, name: "Garden" });
    expect(confirmation?.body).toContain("from no realm to Garden");
    expect(confirmation?.body).toContain("lore shared in Garden will be");
    expect(confirmation?.body).not.toContain("no longer be available");
  });

  it("asks nothing where the quest already stands", () => {
    expect(moveConfirmationOf(quest("a", "Garden"), { id: "a" as WorkspaceId, name: "Garden" })).toBeNull();
    expect(moveConfirmationOf(quest(null, null), noRealmDestination)).toBeNull();
  });
});

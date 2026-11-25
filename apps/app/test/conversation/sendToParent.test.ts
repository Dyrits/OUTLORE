import { type MissionDetail, MissionId, ThreadId, WorkspaceId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { parentTargetLabelOf, sendToParentScopeOf } from "../../src/conversation/sendToParent";
import { detailOf } from "../fixtures/conversation";

describe("sendToParent helpers", () => {
  it("names the parent thread for an errand and the realm or Borderlands for a quest", () => {
    const base = detailOf([], "quest-top");
    const quest: MissionDetail = { ...base, thread: { ...base.thread, parentId: null } };
    expect(parentTargetLabelOf(quest)).toBe("Borderlands");

    const realmQuest: MissionDetail = {
      ...quest,
      thread: {
        ...quest.thread,
        workspace: {
          id: WorkspaceId.make("realm-1"),
          isMissing: false,
          name: "Outlore",
          path: "/repo",
        },
      },
    };
    expect(parentTargetLabelOf(realmQuest)).toBe("Outlore");

    const errand: MissionDetail = {
      ...quest,
      thread: {
        ...quest.thread,
        id: ThreadId.make("errand-1"),
        parentId: ThreadId.make("quest-top"),
        title: "Check tests",
      },
      threads: [
        {
          depth: 0,
          harness: "claude",
          id: ThreadId.make("quest-top"),
          isAside: false,
          isOpenedByAgent: false,
          lastActivityAt: 0,
          lastExchange: { owner: null, reply: null },
          model: "default",
          openedAt: 0,
          parentId: null,
          shownState: "Resting",
          state: "Resting",
          title: "Slack-like thread replies",
          waitingCount: 0,
        },
      ],
    };
    expect(parentTargetLabelOf(errand)).toBe("Slack-like thread replies");

    const ritualQuest: MissionDetail = {
      ...quest,
      mission: {
        ...quest.mission,
        id: MissionId.make("ritual-mission"),
        ritual: {
          id: "ritual-1" as never,
          isOn: true,
          lastRunAt: null,
          lastRunState: null,
          nextRunAt: null,
          originMissionId: null,
          schedule: { _tag: "Daily", time: "09:00" },
        },
      },
    };
    expect(parentTargetLabelOf(ritualQuest)).toBeNull();
  });

  it("maps checkbox and context toggle to SendToParentScope", () => {
    expect(sendToParentScopeOf(false, false)).toBeNull();
    expect(sendToParentScopeOf(false, true)).toBeNull();
    expect(sendToParentScopeOf(true, false)).toBe("MessageOnly");
    expect(sendToParentScopeOf(true, true)).toBe("FullContext");
  });
});

import type { HostId, MissionId, ThreadId } from "@outlore/contracts";
import type { OpenTransport } from "@outlore/controller";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { selectedThreadOf } from "../../src/conversation/conversation";
import { ErrandEndingButtons } from "../../src/conversation/errandHeaderActions";
import { ServiceClient } from "../../src/foundation/client";
import { HostMenuContext, type HostMenuProps } from "../../src/foundation/hostContext";
import { chronicleLabelOf, PhoneBar } from "../../src/shell/phoneBar";
import type { PhoneChoice } from "../../src/shell/phoneChoices";
import { PhoneChooser } from "../../src/shell/phoneChooser";
import { emptySelection } from "../../src/shell/phoneSelection";
import { SideMenu } from "../../src/shell/sideMenu";

// The screens are drawn with react-native, which loads only on a device or in a browser; react-native-web renders the
// same tree to static markup, and the drawn shapes of the icons are nothing this test reads.
vi.mock("react-native", async () => await import("react-native-web"));
vi.mock("react-native-svg", () => ({
  Circle: () => null,
  default: () => null,
  G: () => null,
  Line: () => null,
  Path: () => null,
  Polyline: () => null,
  Rect: () => null,
}));

const questId = "quest" as MissionId;
const errandId = "errand" as ThreadId;
const studioHostId = "studio" as HostId;
const noop = () => {};
const creation = { name: "New realm", note: "Name a folder or a repository" };

let fakeClient: ServiceClient;

beforeAll(async () => {
  const openFakeTransport: OpenTransport = (handlers) => {
    queueMicrotask(handlers.onOpen);
    return { close: noop, isOpen: true, send: noop };
  };
  fakeClient = await ServiceClient.connectThrough(openFakeTransport, "fixture-host");
});

afterAll(() => {
  fakeClient.close();
});

describe("rendering the phone's bar", () => {
  const hiddenSlots = (markup: string) => markup.match(/opacity:0;transform:scale\(0\.5\);width:0px/g)?.length ?? 0;

  it("draws the four tabs, with Quests and Errands still folded away while nothing is chosen", () => {
    const markup = renderToStaticMarkup(
      createElement(PhoneBar, {
        client: fakeClient,
        onChronicle: noop,
        onHold: noop,
        onTap: noop,
        selection: emptySelection,
        tab: "realms",
      }),
    );
    for (const name of ["Chronicle", "Realms", "Quests", "Errands"]) expect(markup).toContain(`aria-label="${name}"`);
    expect(hiddenSlots(markup)).toBe(2);
  });

  it("opens Quests once a realm is chosen, and Errands once a quest is", () => {
    const realm = { id: "realm", name: "Realm" };
    const draw = (selection: Parameters<typeof PhoneBar>[0]["selection"]) =>
      renderToStaticMarkup(
        createElement(PhoneBar, {
          client: fakeClient,
          onChronicle: noop,
          onHold: noop,
          onTap: noop,
          selection,
          tab: "realms",
        }),
      );
    expect(hiddenSlots(draw({ errand: null, quest: null, realm }))).toBe(1);
    expect(hiddenSlots(draw({ errand: null, quest: questId, realm }))).toBe(0);
  });

  it("draws with a realm, a quest and an errand chosen", () => {
    const selection = {
      errand: errandId,
      quest: questId,
      realm: { id: "realm", name: "Realm" },
    };
    const markup = renderToStaticMarkup(
      createElement(PhoneBar, {
        client: fakeClient,
        onChronicle: noop,
        onHold: noop,
        onTap: noop,
        selection,
        tab: "errands",
      }),
    );
    expect(hiddenSlots(markup)).toBe(0);
  });

  it("includes the unread count in the Chronicle tab's accessibility label", () => {
    expect(chronicleLabelOf(0)).toBe("Chronicle");
    expect(chronicleLabelOf(3)).toBe("Chronicle, 3 unread");
  });
});

describe("normalizing quest thread selection and errand header order", () => {
  it("normalizes a quest's topThreadId to null so returning from an errand lights Quests", () => {
    const topId = "top" as ThreadId;
    expect(selectedThreadOf(topId, topId)).toBeNull();
    expect(selectedThreadOf(errandId, topId)).toBe(errandId);
    expect(selectedThreadOf(null, topId)).toBeNull();
  });

  it("draws Done before Archive in errand header actions", () => {
    const markup = renderToStaticMarkup(
      createElement(ErrandEndingButtons, {
        act: noop,
        client: fakeClient,
        state: "Resting",
        threadId: errandId,
      }),
    );
    const doneIndex = markup.indexOf("Mark as done");
    const archiveIndex = markup.indexOf("Archive errand");
    expect(doneIndex).toBeGreaterThan(-1);
    expect(archiveIndex).toBeGreaterThan(doneIndex);
  });
});

describe("rendering the phone's sheet", () => {
  const choices: ReadonlyArray<PhoneChoice> = [
    {
      choice: { kind: "realm", realm: { id: "one", name: "One" } },
      isSelected: true,
      key: "one",
      name: "One",
      note: "2 quests",
      state: null,
    },
    {
      choice: { kind: "realm", realm: { id: null, name: "Borderlands" } },
      isSelected: false,
      key: "borderlands",
      name: "Borderlands",
      note: "Quests with no realm · 1 quest",
      state: null,
    },
  ];

  it("lists what can be chosen under its title, and marks the one chosen", () => {
    const markup = renderToStaticMarkup(
      createElement(PhoneChooser, {
        choices,
        creation,
        failure: null,
        onChoose: noop,
        onClose: noop,
        onCreate: noop,
        title: "Choose a realm",
      }),
    );
    expect(markup).toContain("Choose a realm");
    expect(markup).toContain("New realm");
    expect(markup).toContain("2 quests");
    expect(markup).toContain("Borderlands");
    expect(markup.match(/✓/g)).toHaveLength(1);
  });

  it("says so when there is nothing to choose", () => {
    const markup = renderToStaticMarkup(
      createElement(PhoneChooser, {
        choices: [],
        creation,
        failure: null,
        onChoose: noop,
        onClose: noop,
        onCreate: noop,
        title: "Choose a quest in One",
      }),
    );
    expect(markup).toContain("Nothing here yet.");
  });
});

describe("rendering the side menu", () => {
  it("lists the hosts, a way to add one, and the places the bar leaves out", () => {
    const hostMenu: HostMenuProps = {
      activeId: null,
      computerName: "This Mac",
      hasLocalComputer: true,
      hosts: [{ id: studioHostId, lastSeenAt: null, name: "Studio Mac", pairedAt: 0 }],
      onAdd: noop,
      onChoose: noop,
    };
    const markup = renderToStaticMarkup(
      createElement(
        HostMenuContext.Provider,
        { value: hostMenu },
        createElement(SideMenu, { isOpen: true, onClose: noop, onOpen: noop }),
      ),
    );
    for (const text of [
      "Hosts",
      "This Mac",
      "Studio Mac",
      "Add a host",
      "The Keep",
      "Lore",
      "Archive",
      "Reserves",
      "Settings",
    ])
      expect(markup).toContain(text);
    // The menu body scrolls so bottom rows stay reachable on short viewports or with many hosts.
    expect(markup).toContain("overflowY");
  });

  it("draws nothing while it is shut", () => {
    expect(renderToStaticMarkup(createElement(SideMenu, { isOpen: false, onClose: noop, onOpen: noop }))).toBe("");
  });
});

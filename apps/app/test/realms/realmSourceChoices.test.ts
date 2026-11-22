import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RealmSourceChoices } from "../../src/realms/realmSourceChoices";

vi.mock("react-native", async () => await import("react-native-web"));

describe("choosing a new realm source", () => {
  it("renders each source as a button with a description", () => {
    const markup = renderToStaticMarkup(createElement(RealmSourceChoices, { onChoose: () => {} }));
    expect(markup.match(/role="button"/g)).toHaveLength(5);
    for (const label of ["New project", "Local folder", "Git URL", "GitHub repository", "Empty realm"]) {
      expect(markup).toContain(`>${label}</`);
    }
    expect(markup).toContain("Create a realm with no linked folder");
  });
});

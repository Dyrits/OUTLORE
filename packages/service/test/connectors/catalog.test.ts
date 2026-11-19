import { describe, expect, it } from "vitest";
import {
  catalogToolOf,
  defaultAppsOf,
  isConnectorId,
  isRunnableOn,
  isToolName,
  listedNameOf,
  splitListedName,
  unnamedToolsOf,
} from "../../src/connectors/catalog.ts";
import { appleEntry, composioEntry, defaultCatalog } from "../../src/connectors/catalogEntries.ts";
import { recordedAppleToolNames } from "../fixtures/appleServerListing.ts";
import { appleLikeEntry } from "../fixtures/connectorBackend.ts";

describe("the catalog's entries", () => {
  it("have ids that split one way in a listed tool name and are unique", () => {
    const ids = defaultCatalog.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(isConnectorId(id)).toBe(true);
      expect(id).not.toContain("__");
    }
  });

  it("name an OSI-approved licence for the server they offer", () => {
    // Proves the metadata is present and consistent, not the requirement: the review that chose each server is its source.
    for (const entry of defaultCatalog) expect(entry.licence).toBe("MIT");
  });

  it("never class a Composio tool as a read, since one call runs any action", () => {
    for (const tool of Object.values(composioEntry.tools)) expect(tool.class).not.toBe("Read");
    expect(catalogToolOf(composioEntry, "COMPOSIO_MULTI_EXECUTE_TOOL")).toBeNull();
  });

  it("name every tool the pinned Apple server lists, and offer apps with Mail, Messages and Safari off by default", () => {
    expect(unnamedToolsOf(appleEntry, recordedAppleToolNames)).toEqual([]);
    expect(defaultAppsOf(appleEntry)).toEqual(["calendar", "reminders", "notes", "contacts"]);
    expect(appleEntry.apps.map((app) => app.id)).toEqual([
      "calendar",
      "reminders",
      "notes",
      "contacts",
      "mail",
      "messages",
      "safari",
    ]);
  });

  it("give every named tool the class Read or Write, a summary, and no name a hostile server could forge", () => {
    for (const entry of [...defaultCatalog, appleLikeEntry])
      for (const [name, tool] of Object.entries(entry.tools)) {
        expect(["Read", "Write"]).toContain(tool.class);
        expect(tool.summary.trim()).not.toBe("");
        expect(isToolName(name)).toBe(true);
      }
  });

  it("require a notice from Composio and Apple apps, and a Mac for Apple apps only", () => {
    expect(composioEntry.notice).toContain("stores the sign-ins");
    expect(appleEntry.notice).toContain("model provider");
    expect(isRunnableOn(appleEntry, "linux")).toBe(false);
    expect(isRunnableOn(appleEntry, "darwin")).toBe(true);
    expect(isRunnableOn(composioEntry, "linux")).toBe(true);
  });
});

describe("a server's tool names", () => {
  it("are accepted only as letters, digits, hyphens and underscores up to 64 characters", () => {
    expect(isToolName("list-events")).toBe(true);
    expect(isToolName("a".repeat(64))).toBe(true);
    expect(isToolName("a".repeat(65))).toBe(false);
    expect(isToolName("")).toBe(false);
    for (const hostile of ["a b", "a/b", "a__b/../c", "tool\n", "ü", "a.b", "../x"])
      expect(isToolName(hostile)).toBe(false);
  });

  it("split at the first double underscore into a connector and its tool", () => {
    expect(splitListedName(listedNameOf("apple", "list-events"))).toEqual({ connector: "apple", tool: "list-events" });
    expect(splitListedName(listedNameOf("apple", "a__b"))).toEqual({ connector: "apple", tool: "a__b" });
    expect(splitListedName("no_separator")).toBeNull();
    expect(splitListedName("__leading")).toBeNull();
  });

  it("are looked up by exact name, so a name like toString is not classified", () => {
    expect(catalogToolOf(appleLikeEntry, "toString")).toBeNull();
    expect(catalogToolOf(appleLikeEntry, "constructor")).toBeNull();
    expect(catalogToolOf(appleLikeEntry, "read-mail")?.class).toBe("Read");
  });

  it("name the tools a pinned version lists that the entry does not", () => {
    expect(unnamedToolsOf(appleLikeEntry, ["list-events", "send-email", "new-tool"])).toEqual(["new-tool"]);
    expect(unnamedToolsOf(appleLikeEntry, ["list-events", "read-mail", "send-email"])).toEqual([]);
  });
});

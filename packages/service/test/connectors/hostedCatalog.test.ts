import { describe, expect, it } from "vitest";
import {
  hostedServiceLicence,
  isOAuthEntry,
  isToolName,
  listedNameOf,
  oauthSecretKind,
  unnamedToolsOf,
} from "../../src/connectors/catalog.ts";
import { defaultCatalog } from "../../src/connectors/catalogEntries.ts";
import { qualifiedToolNameOf } from "../../src/harness/toolNames.ts";
import { hostedListings } from "../fixtures/hostedListings.ts";

// Wave 1's hosted connectors (connectors specification): each entry is checked against the listing recorded from a
// primary source, so a tool the server lists but the catalog does not name, or a name the catalog invented, fails here.

const hostedEntries = defaultCatalog.filter((entry) => entry.id !== "composio" && entry.backend._tag === "Http");
const openLicences = ["MIT", "Apache-2.0"];

describe("the hosted connectors of Waves 1 and 2", () => {
  it("have a recorded listing, and every catalog entry of one is a hosted connector with a listing", () => {
    expect(Object.keys(hostedListings).sort()).toEqual(hostedEntries.map((entry) => entry.id).sort());
  });

  for (const entry of hostedEntries) {
    describe(entry.id, () => {
      const listing = hostedListings[entry.id];

      it("names every tool of its recorded listing as Read or Write", () => {
        expect(unnamedToolsOf(entry, listing?.names ?? [])).toEqual([]);
      });

      it("names no tool its recorded listing does not hold", () => {
        expect(Object.keys(entry.tools).filter((name) => !(listing?.names ?? []).includes(name))).toEqual([]);
      });

      it("names tools a thread may list and call, each with a summary", () => {
        for (const [name, tool] of Object.entries(entry.tools)) {
          expect(isToolName(name)).toBe(true);
          expect(["Read", "Write"]).toContain(tool.class);
          expect(tool.summary.trim()).not.toBe("");
          expect(tool.app).toBeNull();
        }
      });

      it("lists under names Claude Code accepts, at most 64 characters with its server prefix", () => {
        for (const name of Object.keys(entry.tools))
          expect(qualifiedToolNameOf("outlore", listedNameOf(entry.id, name)).length).toBeLessThanOrEqual(64);
      });

      it("reaches an https address, with a header and a secret kind together or neither", () => {
        if (entry.backend._tag !== "Http") throw new Error("not an HTTP entry");
        expect(entry.backend.url.startsWith("https://")).toBe(true);
        expect(entry.backend.header === null).toBe(entry.secretKind === null);
        if (entry.backend.header !== null) {
          expect(entry.backend.header).toBe("authorization");
          expect(entry.backend.prefix).toBe("Bearer ");
        }
        if (isOAuthEntry(entry)) {
          expect(entry.secretKind).toBe(oauthSecretKind);
          expect(entry.backend.usesSession).toBe(true);
        }
      });

      it("states an honest licence and tells the owner another company runs the service", () => {
        expect([...openLicences, hostedServiceLicence]).toContain(entry.licence);
        expect(entry.notice).toContain("run by another company");
        expect(entry.platform).toBe("Any");
        expect(entry.apps).toEqual([]);
      });
    });
  }
});

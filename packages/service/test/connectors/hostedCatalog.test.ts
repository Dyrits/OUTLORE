import { describe, expect, it } from "vitest";
import {
  hasStaticSecret,
  hostedServiceLicence,
  isDualAuthEntry,
  isOAuthEntry,
  isToolName,
  listedNameOf,
  oauthSecretKind,
  unnamedToolsOf,
} from "../../src/connectors/catalog.ts";
import { defaultCatalog } from "../../src/connectors/catalogEntries.ts";
import { qualifiedToolNameOf } from "../../src/harness/toolNames.ts";
import { hostedListings } from "../fixtures/hostedListings.ts";

// Wave 1 and Wave 2 hosted connectors (connectors specification): each entry with classified tools is checked against
// the listing recorded from a primary source, while closed-source or dynamically scoped OAuth servers without a public
// static listing leave `tools` empty so every runtime-discovered tool is Unclassified and asks on each call.

const hostedEntries = defaultCatalog.filter((entry) => entry.id !== "composio" && entry.backend._tag === "Http");
const listedHostedEntries = hostedEntries.filter((entry) => Object.keys(entry.tools).length > 0);
const openLicences = ["MIT", "Apache-2.0"];

describe("the hosted connectors of Waves 1 and 2", () => {
  it("match recorded listings for every entry with classified tools, and have no stray fixtures", () => {
    expect(Object.keys(hostedListings).sort()).toEqual(listedHostedEntries.map((entry) => entry.id).sort());
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
        if (isOAuthEntry(entry) && !hasStaticSecret(entry)) {
          expect(entry.secretKind).toBe(oauthSecretKind);
          expect(entry.backend.shouldUseSession).toBe(true);
        }
        if (isDualAuthEntry(entry)) {
          expect(entry.secretKind).not.toBeNull();
          expect(entry.secretKind).not.toBe(oauthSecretKind);
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

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { httpMcpBackend } from "../../src/connectors/backends/httpMcp.ts";
import { unnamedToolsOf } from "../../src/connectors/catalog.ts";
import { defaultCatalog } from "../../src/connectors/catalogEntries.ts";

// A check against the real keyless servers, opt-in through OUTLORE_LIVE_CONNECTORS=1 (conventions: a check against a
// live external system is opt-in): each keyless entry lists its tools from the hosted server, and the entry must name
// every one, so a server that adds a tool is seen here and not by a thread that runs it unasked.

const isLive = process.env.OUTLORE_LIVE_CONNECTORS === "1";
const keylessEntries = defaultCatalog.filter((entry) => entry.backend._tag === "Http" && entry.secretKind === null);

describe.skipIf(!isLive)("the keyless hosted connectors against their real servers", () => {
  for (const entry of keylessEntries)
    it.live(`${entry.id} lists only tools its entry names`, () =>
      Effect.gen(function* () {
        if (entry.backend._tag !== "Http") return;
        const listed = yield* httpMcpBackend(entry.backend).listTools(null);
        const names = listed.map((tool) => tool.name);
        expect(unnamedToolsOf(entry, names)).toEqual([]);
        expect(Object.keys(entry.tools).filter((name) => !names.includes(name))).toEqual([]);
      }),
    );
});

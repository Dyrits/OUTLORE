import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The crest figures are CC BY 3.0: their credits must reach every recipient (SP-G-01, SP-H-01). Expo copies
// `apps/app/public/` into the root of every web export, so a file there ships in the installer and the relay-served app.

const app = join(import.meta.dirname, "..", "..", "app");
const shipped = readFileSync(join(app, "public", "crest-credits.txt"), "utf8");

describe("the crest credits that ship with the app", () => {
  it("are the credits of the figures, under the license they are used under", () => {
    expect(shipped).toBe(readFileSync(join(app, "src", "crest", "crest-credits.md"), "utf8"));
    expect(shipped).toContain("https://creativecommons.org/licenses/by/3.0/");
  });
});

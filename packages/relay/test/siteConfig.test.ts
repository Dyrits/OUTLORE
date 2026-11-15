import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The shared relay also serves the web app (browser access, 0019): Workers static assets answer every path but a room's,
// and a path the build does not have gets the page, so the app opens at any address.

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(root, "wrangler.jsonc"), "utf8")) as {
  assets?: { directory?: string; not_found_handling?: string; run_worker_first?: string[] | boolean };
};

describe("the relay Worker's static site", () => {
  it("serves the exported web build from public/", () => {
    expect(config.assets?.directory).toBe("./public");
  });

  it("sends only room paths to the Worker, and every other path to the site", () => {
    expect(config.assets?.run_worker_first).toEqual(["/r/*"]);
  });

  it("opens the page for a path the build does not have", () => {
    expect(config.assets?.not_found_handling).toBe("single-page-application");
  });
});

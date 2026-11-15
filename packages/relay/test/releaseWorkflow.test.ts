import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The release pipeline also puts the relay Worker and the web app online (CHG-0289), so a browser's page and the
// installed app come from the same tag. These read the workflow's text; the run itself is GitHub's.

const workflow = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".github", "workflows", "package.yml"),
  "utf8",
);
const job = workflow.slice(workflow.indexOf("\n  relay:"));

describe("the release workflow's relay job", () => {
  it("exists, and runs only for a pushed tag, after the installers are published", () => {
    expect(workflow).toContain("\n  relay:");
    expect(job).toMatch(/needs: release/);
    expect(job).toMatch(/if: github\.event_name == 'push' && github\.ref_type == 'tag'/);
  });

  it("stamps the tag into the web app's release, so the page and the installed app agree", () => {
    expect(job).toContain("apps/app/package.json");
    expect(job).toContain("RELEASE_TAG");
  });

  it("builds the site and deploys the Worker with the repository's Cloudflare secrets, from a pinned Wrangler", () => {
    expect(job).toContain("bun run site");
    expect(job).toMatch(/wrangler@\d+\.\d+\.\d+ deploy/);
    expect(job).toContain("secrets.CLOUDFLARE_API_TOKEN");
    expect(job).toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
  });

  it("checks the live address answers with the page and the relay's room route", () => {
    expect(job).toContain("https://outlore.dyrits.workers.dev");
    expect(job).toContain("<title>Outlore</title>");
  });

  it("holds no write permission and no token in the text", () => {
    expect(job).not.toMatch(/contents: write/);
    expect(job).not.toMatch(/CLOUDFLARE_API_TOKEN: [^$\s]/);
  });
});

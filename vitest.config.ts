import { defineConfig } from "vitest/config";

// These tests start real processes and wait on real time, so they fail when the machine is busy: they run one file at a time, apart from the rest.
const timing = ["packages/service/test/harness/**/*.test.ts", "packages/service/test/lore/**/*.test.ts"];

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          exclude: timing,
          include: [
            ".agents/hooks/*.test.ts",
            ".agents/vitest/*.test.ts",
            "packages/*/test/**/*.test.ts",
            "apps/app/test/**/*.test.ts",
            "apps/desktop/test/**/*.test.ts",
          ],
          name: "parallel",
        },
      },
      { extends: true, test: { fileParallelism: false, include: timing, name: "timing" } },
    ],
    // The default report, plus the tests the retry hid.
    reporters: ["default", "./.agents/vitest/retriedReporter.ts"],
    // A test that fails under load passes on a second try; one that is really broken fails every time.
    retry: 2,
    // Clears the shell's harness account folders, so no one has to start the run with `env -u`.
    setupFiles: ["vitest.setup.ts"],
    testTimeout: 20_000,
  },
});

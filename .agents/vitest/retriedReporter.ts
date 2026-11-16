import { appendFileSync } from "node:fs";
import { relative } from "node:path";
import type { Reporter, TestModule } from "vitest/node";

// vitest.config.ts retries a failing test twice, because the real-process tests fail when the machine is busy. A retry
// that passes leaves no trace in the normal output, so this reporter lists the tests that needed one: a test that
// starts needing retries is flaky, and the retry would otherwise hide it for good.

export interface RetriedTest {
  readonly file: string;
  readonly name: string;
  readonly retries: number;
  readonly state: string;
}

const counted = (count: number) => `${count} ${count === 1 ? "retry" : "retries"}`;
const describeTest = (test: RetriedTest) => `${test.name}: ${counted(test.retries)}, ${test.state}`;

export function summaryOf(tests: ReadonlyArray<RetriedTest>): string {
  if (tests.length === 0) return "";
  const lines = tests.map((test) => `- ${test.file} > ${describeTest(test)}`);
  return `${tests.length} ${tests.length === 1 ? "test needed a retry" : "tests needed a retry"}:\n${lines.join("\n")}\n`;
}

export const warningOf = (test: RetriedTest) =>
  `::warning file=${test.file},title=Test needed a retry::${describeTest(test)}`;

function retriedTestsOf(modules: ReadonlyArray<TestModule>): RetriedTest[] {
  const found: RetriedTest[] = [];
  for (const module of modules) {
    for (const test of module.children.allTests()) {
      const retries = test.diagnostic()?.retryCount ?? 0;
      if (retries > 0) {
        found.push({
          file: relative(process.cwd(), module.moduleId),
          name: test.fullName,
          retries,
          state: test.result().state,
        });
      }
    }
  }
  return found;
}

// On GitHub Actions each retried test is also a warning annotation, and the list goes into the run's summary page.
export default class RetriedReporter implements Reporter {
  onTestRunEnd(modules: ReadonlyArray<TestModule>) {
    const tests = retriedTestsOf(modules);
    const summary = summaryOf(tests);
    if (summary === "") return;
    process.stdout.write(`\n${summary}`);
    if (process.env.GITHUB_ACTIONS === "true") {
      for (const test of tests) process.stdout.write(`${warningOf(test)}\n`);
      if (process.env.GITHUB_STEP_SUMMARY)
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Retried tests\n\n${summary}`);
    }
  }
}

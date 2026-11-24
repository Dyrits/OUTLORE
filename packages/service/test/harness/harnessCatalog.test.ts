import {
  harnessLabels as contractHarnessLabels,
  harnessNames as contractHarnessNames,
  harnessDescriptors,
} from "@outlore/contracts";
import { Effect, Record } from "effect";
import { describe, expect, it } from "vitest";
import {
  approvalInstructionsOf,
  commandEnvVarOf,
  defaultCommandOf,
  harnesses,
  harnessFacts,
  harnessLabels,
  harnessNames,
  makeHarnessRouter,
} from "../../src/harness/index.ts";

describe("deriving service harness tables from one definition", () => {
  it("re-exports harnessLabels and harnessNames directly from contracts", () => {
    expect(harnessLabels).toBe(contractHarnessLabels);
    expect(harnessNames).toBe(contractHarnessNames);
  });

  it("keeps harnessFacts and harnesses aligned with every harness in contracts", () => {
    const expectedNames = [...harnessNames].toSorted();
    expect(Object.keys(harnessFacts).toSorted()).toEqual(expectedNames);
    expect(Object.keys(harnesses).toSorted()).toEqual(expectedNames);
    for (const name of harnessNames) {
      const descriptor = harnessDescriptors[name];
      expect(harnessFacts[name].label).toBe(descriptor.label);
      expect(harnessFacts[name].company).toBe(descriptor.company);
      expect(harnesses[name].label).toBe(descriptor.label);
      expect(harnesses[name].company).toBe(descriptor.company);
      expect(harnessFacts[name].defaultExecutable.trim().length).toBeGreaterThan(0);
    }
  });

  it("derives command environment variables and default executables from harnessFacts", () => {
    for (const name of harnessNames) {
      expect(commandEnvVarOf(name)).toBe(`OUTLORE_${name.toUpperCase()}_PATH`);
      expect(defaultCommandOf(name, () => false)).toBe(harnessFacts[name].defaultExecutable);
    }
    expect(defaultCommandOf("antigravity", (executable) => executable === "antigravity")).toBe("antigravity");
    expect(defaultCommandOf("antigravity", () => false)).toBe("agy");
    expect(defaultCommandOf("cursor", () => false)).toBe("cursor-agent");
    expect(defaultCommandOf("vibe", () => false)).toBe("vibe-acp");
  });

  it("reads sandbox advice for approval instructions from harnessFacts", () => {
    const sandboxedFull = {
      approvalLevel: "RiskyOnly" as const,
      areEditsUnasked: true,
      canWorkOutsideSandbox: true,
      containment: "Sandboxed" as const,
      isEverythingUnasked: true,
      permissionKinds: [],
    };
    const sandboxedAsking = {
      ...sandboxedFull,
      canWorkOutsideSandbox: false,
      isEverythingUnasked: false,
    };
    for (const name of harnessNames) {
      const advice = harnessFacts[name].sandboxAdvice;
      const fullText = approvalInstructionsOf(sandboxedFull, name);
      const askingText = approvalInstructionsOf(sandboxedAsking, name);
      if (advice !== null) {
        expect(fullText).toContain(advice.allowed);
        if (advice.asking !== null) expect(askingText).toContain(advice.asking);
      } else {
        expect(fullText).not.toContain("dangerouslyDisableSandbox");
        expect(fullText).not.toContain("per-command escalation");
      }
    }
  });

  it("builds a router covering every registered harness from harnesses", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const commands = Record.map(harnessFacts, (facts) => facts.defaultExecutable);
          const router = yield* makeHarnessRouter(commands, {
            idleTimeout: "1 minute",
            sandboxProblem: "disabled in unit test",
          });
          for (const name of harnessNames) {
            expect(["Sandboxed", "Unprotected"]).toContain(router.containmentOf?.(name, "RiskyOnly"));
          }
        }),
      ),
    ));
});

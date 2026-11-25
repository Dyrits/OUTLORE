import type { HarnessName } from "@outlore/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProviderMark } from "../../src/ui/providerMarks";

// The mark is drawn with react-native-svg, which loads only on a device; the test reads the SVG it would draw, as
// plain elements, so each provider's paths, colours and viewBox can be checked. The theme imports react-native, so
// it is served by react-native-web here, as in the other layout tests.
vi.mock("react-native", async () => await import("react-native-web"));
vi.mock("react-native-svg", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: { viewBox: string; children: unknown }) =>
      createElement("svg", { viewBox: props.viewBox }, props.children as never),
    Path: (props: { d: string; fill: string; fillRule: string }) =>
      createElement("path", { d: props.d, fill: props.fill, fillRule: props.fillRule }),
  };
});

const harnesses: HarnessName[] = [
  "antigravity",
  "claude",
  "cline",
  "codex",
  "copilot",
  "cursor",
  "devin",
  "hermes",
  "muse",
  "opencode",
  "pi",
  "vibe",
];

function markOf(harness: HarnessName): string {
  return renderToStaticMarkup(createElement(ProviderMark, { harness }));
}

describe("ProviderMark", () => {
  it.each(harnesses)("draws a non-empty mark for %s", (harness) => {
    const markup = markOf(harness);
    expect(markup).toContain('viewBox="');
    expect(markup).toMatch(/<path d="[^"]+"/);
  });

  it("draws Hermes's official wing on its own viewBox, in both of its colours with even-odd fill", () => {
    const markup = markOf("hermes");
    expect(markup).toContain('viewBox="0 0 39.1 78.5"');
    expect(markup).toContain('fill="#F2F2F2"');
    expect(markup).toContain('fill="#0000F2"');
    expect(markup).toContain('fill-rule="evenodd"');
  });

  it("draws Pi's three official blocks on the artwork's own viewBox", () => {
    const markup = markOf("pi");
    expect(markup).toContain('viewBox="165.29 165.29 469.43 469.43"');
    for (const fill of ["#F09082", "#4D9ABF", "#F1BE58"]) expect(markup).toContain(`fill="${fill}"`);
  });

  it("draws Devin in its three official brand colours", () => {
    const markup = markOf("devin");
    for (const fill of ["#3969CA", "#21C19A", "#0294DE"]) expect(markup).toContain(`fill="${fill}"`);
  });

  it("draws Muse in Meta blue", () => {
    expect(markOf("muse")).toContain('fill="#0082FB"');
  });
});

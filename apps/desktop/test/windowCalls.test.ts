import { describe, expect, it } from "vitest";
import { isTrustedSender } from "../src/windowCalls.ts";

describe("guarding the desktop window's calls", () => {
  const frame = { url: "http://localhost:8081/quest" };
  const contents = { mainFrame: frame };
  it("accepts the designated main frame", () => {
    expect(isTrustedSender({ sender: contents, senderFrame: frame }, contents, "http://localhost:8081")).toBe(true);
  });
  it("rejects another window and a same-origin subframe", () => {
    expect(isTrustedSender({ sender: { mainFrame: frame }, senderFrame: frame }, contents, frame.url)).toBe(false);
    expect(isTrustedSender({ sender: contents, senderFrame: { ...frame } }, contents, frame.url)).toBe(false);
  });
  it("rejects a missing frame and navigation away", () => {
    expect(isTrustedSender({ sender: contents, senderFrame: null }, contents, frame.url)).toBe(false);
    expect(isTrustedSender({ sender: contents, senderFrame: frame }, contents, "http://elsewhere:8081")).toBe(false);
    expect(isTrustedSender({ sender: contents, senderFrame: frame }, contents, "bad url")).toBe(false);
  });
  it("distinguishes opaque origins for the installed app scheme", () => {
    const mainFrame = { url: "outlore-app://app/index.html" };
    const target = { mainFrame };
    expect(isTrustedSender({ sender: target, senderFrame: mainFrame }, target, "outlore-app://app/")).toBe(true);
    expect(isTrustedSender({ sender: target, senderFrame: mainFrame }, target, "outlore-app://other/")).toBe(false);
    expect(isTrustedSender({ sender: target, senderFrame: mainFrame }, target, "file:///tmp/page.html")).toBe(false);
  });
});

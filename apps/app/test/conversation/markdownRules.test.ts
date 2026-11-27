import { describe, expect, it } from "vitest";
import { linkTargetOf, listMarkerOf, runnableCommandOf } from "../../src/conversation/markdownRules";

describe("a Markdown link", () => {
  it("opens a web address", () => {
    expect(linkTargetOf("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
  });

  it("opens a mail address", () => {
    expect(linkTargetOf("mailto:someone@example.com")).toBe("mailto:someone@example.com");
  });

  it("refuses a script address", () => {
    expect(linkTargetOf("javascript:alert(1)")).toBeNull();
  });

  it("refuses text that is no address", () => {
    expect(linkTargetOf("not a link")).toBeNull();
  });
});

describe("a Markdown list marker", () => {
  it("is a bullet in an unordered list", () => {
    expect(listMarkerOf({ ordered: false, start: "" }, 2)).toBe("•");
  });

  it("counts from one when an ordered list gives no start", () => {
    expect(listMarkerOf({ ordered: true, start: "" }, 1)).toBe("2.");
  });

  it("counts from the number an ordered list starts at", () => {
    expect(listMarkerOf({ ordered: true, start: 5 }, 1)).toBe("6.");
  });
});

describe("a runnable shell code block", () => {
  it("accepts recognized shell fence languages regardless of case or extra info words", () => {
    expect(runnableCommandOf("bash", "git status\n")).toBe("git status");
    expect(runnableCommandOf("SH", "ls -la")).toBe("ls -la");
    expect(runnableCommandOf("zsh title=check", "echo hi")).toBe("echo hi");
    expect(runnableCommandOf("shell", "pwd")).toBe("pwd");
    expect(runnableCommandOf("fish", "status")).toBe("status");
    expect(runnableCommandOf("console", "bun test")).toBe("bun test");
    expect(runnableCommandOf("powershell", "Get-Date")).toBe("Get-Date");
    expect(runnableCommandOf("pwsh", "Get-Location")).toBe("Get-Location");
    expect(runnableCommandOf("cmd", "dir")).toBe("dir");
    expect(runnableCommandOf("bat", "echo ok")).toBe("echo ok");
  });

  it("rejects untagged and non-shell code blocks", () => {
    expect(runnableCommandOf(void 0, "git status")).toBeNull();
    expect(runnableCommandOf("", "git status")).toBeNull();
    expect(runnableCommandOf("ts", "const count = 1;")).toBeNull();
    expect(runnableCommandOf("json", '{"ok":true}')).toBeNull();
  });

  it("rejects empty or whitespace-only shell blocks", () => {
    expect(runnableCommandOf("bash", "")).toBeNull();
    expect(runnableCommandOf("bash", "   \n\t\n  ")).toBeNull();
  });

  it("trims leading and trailing blank lines while preserving multi-line commands", () => {
    expect(runnableCommandOf("bash", "\n\necho one\necho two\n\n")).toBe("echo one\necho two");
  });
});

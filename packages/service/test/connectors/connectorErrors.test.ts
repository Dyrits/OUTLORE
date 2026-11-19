import { describe, expect, it } from "vitest";
import { cappedOf, redactedOf, warningOf } from "../../src/connectors/connectorErrors.ts";

const secret = "sk-live-7f3a9c2e/key+value==";

describe("redacting a secret from what leaves the gateway", () => {
  it("replaces the secret raw, URL-encoded, in base64 and in base64url", () => {
    const bytes = Buffer.from(secret);
    const text = [secret, encodeURIComponent(secret), bytes.toString("base64"), bytes.toString("base64url")].join(
      " | ",
    );
    const redacted = redactedOf(text, [secret]);
    expect(redacted).toBe("[redacted] | [redacted] | [redacted] | [redacted]");
    for (const spelling of [secret, encodeURIComponent(secret), bytes.toString("base64")])
      expect(redacted).not.toContain(spelling);
  });

  it("replaces every occurrence and leaves other text alone", () => {
    expect(redactedOf(`a ${secret} b ${secret} c`, [secret])).toBe("a [redacted] b [redacted] c");
    expect(redactedOf("nothing to hide", [secret])).toBe("nothing to hide");
  });

  it("does nothing for an empty secret, which would otherwise replace everything", () => {
    expect(redactedOf("kept", [""])).toBe("kept");
  });

  it("replaces a spelling that contains another whole, longest first", () => {
    expect(redactedOf("abcd abc", ["abc", "abcd"])).toBe("[redacted] [redacted]");
  });
});

describe("what a failure tells the thread", () => {
  it("warns for a refused sign-in and an unreachable server, and for no other failure", () => {
    expect(warningOf("Calendar", "Disconnected")).toContain("Calendar needs connecting");
    expect(warningOf("Calendar", "Unreachable")).toContain("could not be reached");
    expect(warningOf("Calendar", "InvalidArguments")).toBeNull();
    expect(warningOf("Calendar", "Failed")).toBeNull();
  });

  it("cuts a very long answer with a note of how much was left out", () => {
    expect(cappedOf("short")).toBe("short");
    const long = cappedOf("x".repeat(30_000));
    expect(long.length).toBeLessThan(25_000);
    expect(long).toContain("[Cut: 6000 more characters.]");
  });
});

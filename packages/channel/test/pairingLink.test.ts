import { describe, expect, it } from "vitest";
import {
  appPairingLinkOf,
  encodePairingCode,
  generateKeyPair,
  newPairingSecret,
  newRoomName,
  pairingInputOf,
  readPairingInput,
  webPairingLinkOf,
} from "../src/index.ts";

const sample = () => ({
  hostPublicKey: generateKeyPair().publicKey,
  relayOrigin: "https://relay-lab.example.workers.dev",
  room: newRoomName(),
  secret: newPairingSecret(),
});

describe("writing a pairing link", () => {
  it("puts the code in the fragment of the web app's address, never in the path or the query", () => {
    const code = encodePairingCode(sample());
    expect(webPairingLinkOf("https://outlore.example.workers.dev", code)).toBe(
      `https://outlore.example.workers.dev/#${code}`,
    );
    expect(new URL(webPairingLinkOf("https://outlore.example.workers.dev", code)).search).toBe("");
  });

  it("does not double the slash when the web app's address ends with one", () => {
    const code = encodePairingCode(sample());
    expect(webPairingLinkOf("https://outlore.example.workers.dev/", code)).toBe(
      `https://outlore.example.workers.dev/#${code}`,
    );
  });

  it("writes the app link with the outlore scheme and the code in the fragment", () => {
    const code = encodePairingCode(sample());
    expect(appPairingLinkOf(code)).toBe(`outlore://pair#${code}`);
  });
});

describe("reading what a person pastes to pair", () => {
  it("reads a raw code", () => {
    const code = sample();
    expect(readPairingInput(encodePairingCode(code))).toEqual({ ok: true, value: code });
  });

  it("reads a web link, an app link and a raw code to the same pairing", () => {
    const code = sample();
    const text = encodePairingCode(code);
    const expected = { ok: true, value: code };
    expect(readPairingInput(webPairingLinkOf("https://outlore.example.workers.dev", text))).toEqual(expected);
    expect(readPairingInput(appPairingLinkOf(text))).toEqual(expected);
  });

  it("ignores whitespace around a code or a link", () => {
    const code = sample();
    const text = encodePairingCode(code);
    expect(readPairingInput(`  \n${text}\t`)).toEqual({ ok: true, value: code });
    expect(readPairingInput(`\n ${appPairingLinkOf(text)} \n`)).toEqual({ ok: true, value: code });
  });

  it("reads a link to a page served from this computer", () => {
    const code = sample();
    const text = encodePairingCode(code);
    expect(readPairingInput(`http://localhost:8081/#${text}`)).toEqual({ ok: true, value: code });
  });

  it("reads the app link with a trailing slash in front of the fragment", () => {
    const code = sample();
    const text = encodePairingCode(code);
    expect(readPairingInput(`outlore://pair/#${text}`)).toEqual({ ok: true, value: code });
  });

  it("reports a link with no fragment, or with something else in it, as malformed", () => {
    expect(readPairingInput("https://outlore.example.workers.dev/")).toEqual({ kind: "malformed", ok: false });
    expect(readPairingInput("https://outlore.example.workers.dev/#")).toEqual({ kind: "malformed", ok: false });
    expect(readPairingInput("https://outlore.example.workers.dev/#settings")).toEqual({
      kind: "malformed",
      ok: false,
    });
    expect(readPairingInput("outlore://pair")).toEqual({ kind: "malformed", ok: false });
  });

  it("refuses a code that is only in the query, where a server would see it", () => {
    const text = encodePairingCode(sample());
    expect(readPairingInput(`https://outlore.example.workers.dev/?code=${text}`)).toEqual({
      kind: "malformed",
      ok: false,
    });
  });

  it("refuses a link of another scheme or another outlore address", () => {
    const text = encodePairingCode(sample());
    expect(readPairingInput(`ftp://outlore.example.workers.dev/#${text}`).ok).toBe(false);
    expect(readPairingInput(`javascript:alert(1)//#${text}`).ok).toBe(false);
    expect(readPairingInput(`outlore://settings#${text}`).ok).toBe(false);
    expect(readPairingInput(`http://outlore.example.workers.dev/#${text}`).ok).toBe(false);
  });

  it("passes on the reason a code in a link is bad", () => {
    expect(readPairingInput("https://outlore.example.workers.dev/#outlore2-AAAA")).toEqual({
      kind: "unsupported-version",
      ok: false,
    });
    const text = encodePairingCode(sample());
    const damaged = `${text.slice(0, -2)}${text.endsWith("AA") ? "BB" : "AA"}`;
    expect(readPairingInput(`outlore://pair#${damaged}`)).toEqual({ kind: "bad-checksum", ok: false });
  });

  it("reports empty text as malformed", () => {
    expect(readPairingInput("")).toEqual({ kind: "malformed", ok: false });
    expect(readPairingInput("   ")).toEqual({ kind: "malformed", ok: false });
  });
});

describe("finding a pairing in an address bar or a launch argument", () => {
  const text = encodePairingCode(sample());

  it("takes the code from a location hash", () => {
    expect(pairingInputOf(`#${text}`)).toBe(text);
  });

  it("takes the code from a whole link, and from an argument list of a second launch", () => {
    expect(pairingInputOf(`outlore://pair#${text}`)).toBe(text);
    expect(pairingInputOf(`https://outlore.example.workers.dev/#${text}`)).toBe(text);
  });

  it("takes nothing from a hash that is not a pairing, so a page's own fragment is left alone", () => {
    expect(pairingInputOf("")).toBeNull();
    expect(pairingInputOf("#")).toBeNull();
    expect(pairingInputOf("#settings")).toBeNull();
    expect(pairingInputOf("outlore://settings")).toBeNull();
  });
});

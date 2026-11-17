import { describe, expect, it } from "vitest";
import { arrive, noArrivals } from "../../src/foundation/pairingLinkArrivals";

const code =
  "outlore1-gVVlc7y_NpbGWZdnBPDm7RSUJouDZayE7VUgMEu_ehsM10_x9rJHYbYqmmF6eQKi5WNtrhn12PetyyVVFiAWQ2h0dHBzOi8vb3V0bG9yZS5keXJpdHMud29ya2Vycy5kZXYfdJSV";
const link = `outlore://pair#${code}`;
const otherLink = "outlore://pair#outlore1-another";

describe("links that open the phone app", () => {
  it("hands a link that started the app to pairing", () => {
    expect(arrive(noArrivals, link, 0).link).toBe(link);
  });

  it("hands a link received while the app runs to pairing", () => {
    const first = arrive(noArrivals, link, 0);
    expect(arrive(first.state, otherLink, 60_000).link).toBe(otherLink);
  });

  it("hands over a link delivered twice in a row only once: the system reports a starting link both ways", () => {
    const first = arrive(noArrivals, link, 0);
    const second = arrive(first.state, link, 300);
    expect(first.link).toBe(link);
    expect(second.link).toBeNull();
  });

  it("hands the same link over again once the delivery is over, so a link opened again after Cancel works", () => {
    const first = arrive(noArrivals, link, 0);
    expect(arrive(first.state, link, 30_000).link).toBe(link);
  });

  it("does not count a link it ignored as the one delivered before", () => {
    const ignored = arrive(noArrivals, "outlore://settings", 0);
    expect(arrive(ignored.state, link, 100).link).toBe(link);
  });

  it("ignores links that are not pairings", () => {
    for (const other of [
      "outlore://settings",
      "outlore://pair",
      "https://example.com/#settings",
      "https://example.com/?code=outlore1-x",
      "",
      "   ",
    ]) {
      expect(arrive(noArrivals, other, 0).link, other).toBeNull();
    }
  });

  it("ignores a missing link: nothing started the app", () => {
    expect(arrive(noArrivals, null, 0).link).toBeNull();
  });

  it("keeps a link that carries a bad code, so pairing says why", () => {
    expect(arrive(noArrivals, "outlore://pair#outlore1-garbage", 0).link).toBe("outlore://pair#outlore1-garbage");
  });

  it("hands over an https link of the web app too", () => {
    const web = `https://outlore.dyrits.workers.dev/#${code}`;
    expect(arrive(noArrivals, web, 0).link).toBe(web);
  });
});

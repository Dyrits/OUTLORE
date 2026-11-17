import { describe, expect, it } from "vitest";
import { createPairingLinkQueue, pairingLinkIn, protocolClientOf } from "../src/pairingLinks.ts";

const link = "outlore://pair#outlore1-AAAA";

describe("finding a pairing link in a launch's arguments", () => {
  it("takes the outlore link from the arguments a second launch gives on Windows and Linux", () => {
    expect(pairingLinkIn(["Outlore.exe", "--flag", link])).toBe(link);
    expect(pairingLinkIn(["/usr/bin/outlore", "--no-sandbox", `${link}`, "extra"])).toBe(link);
  });

  it("matches the scheme without regard to case, and keeps the link as it came", () => {
    expect(pairingLinkIn(["Outlore.exe", "OUTLORE://pair#outlore1-AAAA"])).toBe("OUTLORE://pair#outlore1-AAAA");
  });

  it("ignores arguments that are not a pairing link", () => {
    expect(pairingLinkIn([])).toBeNull();
    expect(pairingLinkIn(["Outlore.exe", "--user-data-dir=/tmp/x"])).toBeNull();
    expect(pairingLinkIn(["Outlore.exe", "outlore://settings#x"])).toBeNull();
    expect(pairingLinkIn(["Outlore.exe", "outlore-app://app/"])).toBeNull();
    expect(pairingLinkIn(["Outlore.exe", "https://outlore.dyrits.workers.dev/#outlore1-AAAA"])).toBeNull();
  });

  it("refuses a link far longer than any pairing link, so a huge argument is not passed on", () => {
    expect(pairingLinkIn(["Outlore.exe", `outlore://pair#${"A".repeat(5000)}`])).toBeNull();
  });
});

describe("handing a pairing link to the window", () => {
  const harness = () => {
    const delivered: string[] = [];
    const queue = createPairingLinkQueue((text) => delivered.push(text));
    return { delivered, queue };
  };

  it("keeps a link that arrives before the window asked for it, and gives it once", () => {
    const { delivered, queue } = harness();
    queue.receive(link);
    expect(delivered).toEqual([]);
    expect(queue.take()).toBe(link);
    expect(queue.take()).toBeNull();
    expect(delivered).toEqual([]);
  });

  it("delivers a link at once after the window has asked, and keeps nothing", () => {
    const { delivered, queue } = harness();
    expect(queue.take()).toBeNull();
    queue.receive(link);
    expect(delivered).toEqual([link]);
    expect(queue.take()).toBeNull();
  });

  it("keeps only the latest link received before the window is ready: an earlier one is likely spent", () => {
    const { queue } = harness();
    queue.receive("outlore://pair#outlore1-ONE");
    queue.receive("outlore://pair#outlore1-TWO");
    expect(queue.take()).toBe("outlore://pair#outlore1-TWO");
  });

  it("queues again when the window reloads, so a link in that gap is not lost", () => {
    const { delivered, queue } = harness();
    queue.take();
    queue.reset();
    queue.receive(link);
    expect(delivered).toEqual([]);
    expect(queue.take()).toBe(link);
  });

  it("ignores text that is not a pairing link", () => {
    const { delivered, queue } = harness();
    queue.receive("https://example.com");
    queue.take();
    queue.receive("outlore://settings");
    expect(delivered).toEqual([]);
    expect(queue.take()).toBeNull();
  });
});

describe("registering the app as the handler of outlore links", () => {
  it("registers the installed app plainly", () => {
    expect(
      protocolClientOf({
        argv1: undefined,
        environment: {},
        execPath: "/Applications/Outlore.app/Contents/MacOS/Outlore",
        isDefaultApp: false,
        isPackaged: true,
      }),
    ).toEqual({ args: [], executable: null });
  });

  it("does not register a development run, which would take the links from the installed app", () => {
    expect(
      protocolClientOf({
        argv1: "/repo/apps/desktop/dist/main.js",
        environment: {},
        execPath: "/electron",
        isDefaultApp: true,
        isPackaged: false,
      }),
    ).toBeNull();
  });

  it("registers a development run with the path of its entry when asked, so the system relaunches it with the link", () => {
    expect(
      protocolClientOf({
        argv1: "dist/main.js",
        environment: { OUTLORE_HANDLE_LINKS: "1" },
        execPath: "/electron",
        isDefaultApp: true,
        isPackaged: false,
      }),
    ).toEqual({ args: [expect.stringMatching(/dist\/main\.js$/)], executable: "/electron" });
  });

  it("does not register a throwaway instance of a check", () => {
    expect(
      protocolClientOf({
        argv1: undefined,
        environment: { OUTLORE_DATA_DIR: "/tmp/x" },
        execPath: "/e",
        isDefaultApp: false,
        isPackaged: true,
      }),
    ).toBeNull();
  });
});

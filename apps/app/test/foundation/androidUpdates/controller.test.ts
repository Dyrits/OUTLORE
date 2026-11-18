import { describe, expect, it, vi } from "vitest";
import {
  type AndroidInstaller,
  AndroidUpdateController,
  checkIntervalMilliseconds,
  type UpdateSettings,
} from "../../../src/foundation/androidUpdates/controller";

const hash = "a".repeat(128);
const apk = (version: string) => `Outlore-${version}-android.apk`;

/** A release as GitHub's list gives it, with the APK and the checksums. */
const release = (tag: string, options: { isPrerelease?: boolean; hasApk?: boolean; sums?: string } = {}) => ({
  assets: [
    ...(options.hasApk === false
      ? []
      : [{ browser_download_url: `https://example.test/${tag}.apk`, name: apk(tag), size: 34_000_000 }]),
    { browser_download_url: `https://example.test/${tag}-sums`, name: "SHA512SUMS.txt", size: 400 },
  ],
  body: `Notes of ${tag}`,
  draft: false,
  html_url: `https://example.test/releases/${tag}`,
  prerelease: options.isPrerelease ?? true,
  tag_name: tag,
});

type Harness = ReturnType<typeof harness>;

const harness = (
  options: {
    canInstall?: boolean;
    downloadedHash?: string;
    installerFails?: string;
    isDevelopment?: boolean;
    isMetered?: boolean;
    isStoreInstall?: boolean;
    listings?: unknown;
    settings?: UpdateSettings;
    sums?: string;
    version?: string;
  } = {},
) => {
  const requests: { headers: HeadersInit | undefined; url: string }[] = [];
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ headers: init?.headers, url });
    if (url.endsWith("-sums")) return new Response(options.sums ?? `${hash}  ${apk("0.1.9-Prototype")}\n`);
    return new Response(JSON.stringify(options.listings ?? [release("0.1.9-Prototype")]));
  });
  const saved = { current: options.settings ?? { isEnabled: true, lastCheckedAt: null } };
  const calls: string[] = [];
  const network = { isMetered: options.isMetered ?? false };
  const installer: AndroidInstaller = {
    allowInstalling: async () => void calls.push("allowInstalling"),
    canInstallPackages: () => options.canInstall ?? true,
    discard: async (fileName) => void calls.push(`discard ${fileName}`),
    download: async (request, onProgress) => {
      calls.push(`download ${request.fileName}`);
      onProgress(50);
      return options.downloadedHash ?? hash;
    },
    install: async (fileName) => {
      calls.push(`install ${fileName}`);
      if (options.installerFails !== undefined) throw new Error(options.installerFails);
    },
    isNetworkMetered: () => network.isMetered,
    isStoreInstall: () => options.isStoreInstall ?? false,
  };
  const repeats: { run: () => void; milliseconds: number }[] = [];
  const controller = new AndroidUpdateController({
    currentVersion: options.version ?? "0.1.8-Prototype",
    fetch: fetchFn,
    installer,
    isDevelopment: options.isDevelopment ?? false,
    now: () => 1_000,
    releasesUrl: "https://example.test/releases",
    repeat: (run, milliseconds) => {
      repeats.push({ milliseconds, run });
      return () => void repeats.pop();
    },
    settings: {
      read: () => saved.current,
      write: (next) => {
        saved.current = next;
      },
    },
  });
  return { calls, controller, fetchFn, network, repeats, requests, saved };
};

const statusOf = ({ controller }: Harness) => controller.state().status;

describe("the phone's app updates", () => {
  it("does not update a development build or a store install", () => {
    expect(statusOf(harness({ isDevelopment: true }))).toMatchObject({ _tag: "Unsupported" });
    expect(statusOf(harness({ isStoreInstall: true }))).toMatchObject({
      _tag: "Unsupported",
      reason: expect.stringContaining("store"),
    });
  });

  it("finds a newer release, downloads its APK on Wi-Fi, and checks it against the release's checksums", async () => {
    const h = harness();
    await h.controller.check();
    expect(h.calls).toEqual([`download ${apk("0.1.9-Prototype")}`]);
    expect(statusOf(h)).toEqual({
      _tag: "Ready",
      notes: "Notes of 0.1.9-Prototype",
      pageUrl: "https://example.test/releases/0.1.9-Prototype",
      version: "0.1.9-Prototype",
    });
    expect(h.controller.state().lastCheckedAt).toBe(1_000);
    expect(h.saved.current.lastCheckedAt).toBe(1_000);
  });

  it("asks GitHub with the app's name and version and nothing about the owner", async () => {
    const h = harness();
    await h.controller.check();
    expect(h.requests[0]).toEqual({
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Outlore/0.1.8-Prototype" },
      url: "https://example.test/releases",
    });
    expect(h.requests[1]?.headers).toEqual({ "User-Agent": "Outlore/0.1.8-Prototype" });
  });

  it("offers a release on mobile data without downloading it, until the owner chooses", async () => {
    const h = harness({ isMetered: true });
    await h.controller.check();
    expect(h.calls).toEqual([]);
    expect(h.requests).toHaveLength(1);
    expect(statusOf(h)).toMatchObject({ _tag: "Available", sizeBytes: 34_000_000, version: "0.1.9-Prototype" });
    await h.controller.download();
    expect(h.calls).toEqual([`download ${apk("0.1.9-Prototype")}`]);
    expect(statusOf(h)).toMatchObject({ _tag: "Ready" });
  });

  it("downloads an offered release by itself at the next check once the phone is on Wi-Fi", async () => {
    const h = harness({ isMetered: true });
    await h.controller.check();
    expect(statusOf(h)).toMatchObject({ _tag: "Available" });
    h.network.isMetered = false;
    await h.controller.check();
    expect(statusOf(h)).toMatchObject({ _tag: "Ready" });
  });

  it("deletes a download whose hash differs and reports it with the release page", async () => {
    const h = harness({ downloadedHash: "b".repeat(128) });
    await h.controller.check();
    expect(h.calls).toContain(`discard ${apk("0.1.9-Prototype")}`);
    expect(statusOf(h)).toMatchObject({
      _tag: "Failed",
      message: expect.stringContaining("does not match"),
      pageUrl: "https://example.test/releases/0.1.9-Prototype",
    });
  });

  it("skips a release without the APK, or without the APK's checksum, with the reason", async () => {
    const noApk = harness({ listings: [release("0.1.9-Prototype", { hasApk: false })] });
    await noApk.controller.check();
    expect(statusOf(noApk)).toEqual({
      _tag: "Idle",
      note: `Release 0.1.9-Prototype has no ${apk("0.1.9-Prototype")}.`,
    });
    const noSum = harness({ sums: `${hash}  something-else\n` });
    await noSum.controller.check();
    expect(statusOf(noSum)).toMatchObject({ _tag: "Failed", message: expect.stringContaining("checksum") });
  });

  it("follows the build's channel: a stable build ignores prereleases", async () => {
    const stable = harness({ listings: [release("0.2.0-Prototype")], version: "0.1.0" });
    await stable.controller.check();
    expect(statusOf(stable)).toEqual({ _tag: "Idle", note: null });
    const prerelease = harness({
      listings: [release("0.2.0", { isPrerelease: false })],
      sums: `${hash}  ${apk("0.2.0")}\n`,
      version: "0.1.8-Prototype",
    });
    await prerelease.controller.check();
    expect(statusOf(prerelease)).toMatchObject({ _tag: "Ready", version: "0.2.0" });
  });

  it("is up to date when nothing is newer, and never offers the running version to itself", async () => {
    const h = harness({ listings: [release("0.1.8-Prototype"), release("0.1.7-Prototype")] });
    await h.controller.check();
    expect(statusOf(h)).toEqual({ _tag: "Idle", note: null });
    expect(h.calls).toEqual([]);
  });

  it("shows a failed request with its reason and leaves the next check to try again", async () => {
    const h = harness();
    h.fetchFn.mockRejectedValueOnce(new Error("offline"));
    await h.controller.check();
    expect(statusOf(h)).toMatchObject({ _tag: "Failed", message: expect.stringContaining("offline") });
    await h.controller.check();
    expect(statusOf(h)).toMatchObject({ _tag: "Ready" });
  });

  it("makes no request while the switch is off, and checks at once when it is turned on", async () => {
    const h = harness({ settings: { isEnabled: false, lastCheckedAt: null } });
    h.controller.start();
    await h.controller.check();
    expect(h.fetchFn).not.toHaveBeenCalled();
    expect(h.repeats).toEqual([]);
    await h.controller.setEnabled(true);
    expect(h.fetchFn).toHaveBeenCalled();
    expect(h.saved.current.isEnabled).toBe(true);
    expect(h.repeats[0]?.milliseconds).toBe(checkIntervalMilliseconds);
  });

  it("checks at start and then on a schedule, and stops the schedule when the switch goes off", async () => {
    const h = harness();
    h.controller.start();
    await h.controller.check();
    expect(h.fetchFn).toHaveBeenCalled();
    expect(h.repeats).toHaveLength(1);
    await h.controller.setEnabled(false);
    expect(h.repeats).toHaveLength(0);
    expect(h.saved.current.isEnabled).toBe(false);
  });

  it("keeps a downloaded update ready while the switch is off and never checks again over it", async () => {
    const h = harness();
    await h.controller.check();
    h.fetchFn.mockClear();
    await h.controller.setEnabled(false);
    await h.controller.check();
    expect(h.fetchFn).not.toHaveBeenCalled();
    expect(statusOf(h)).toMatchObject({ _tag: "Ready" });
  });

  it("stops before requesting checksums if checking is disabled while the release list is loading", async () => {
    const h = harness();
    const check = h.controller.check();
    await h.controller.setEnabled(false);
    await check;
    expect(h.requests).toHaveLength(1);
    expect(h.calls).toEqual([]);
    await expect(h.controller.download()).rejects.toThrow("nothing to download");
  });

  it("installs only a ready update, and only once Android allows this app to install", async () => {
    const early = harness();
    await expect(early.controller.install()).rejects.toThrow("no update ready");
    const refused = harness({ canInstall: false });
    await refused.controller.check();
    expect(await refused.controller.canInstall()).toBe(false);
    await expect(refused.controller.install()).rejects.toThrow("allow");
    await refused.controller.allowInstalling();
    expect(refused.calls).toContain("allowInstalling");
    expect(refused.calls).not.toContain(`install ${apk("0.1.9-Prototype")}`);
    expect(statusOf(refused)).toMatchObject({ _tag: "Ready" });
    const ready = harness();
    await ready.controller.check();
    await ready.controller.install();
    expect(ready.calls).toContain(`install ${apk("0.1.9-Prototype")}`);
  });

  it("shows why Android refused an install, with the release page, and keeps the version running", async () => {
    const h = harness({ installerFails: "It is signed with another key than the installed app." });
    await h.controller.check();
    await expect(h.controller.install()).rejects.toThrow("another key");
    expect(statusOf(h)).toMatchObject({
      _tag: "Failed",
      message: "It is signed with another key than the installed app.",
      pageUrl: "https://example.test/releases/0.1.9-Prototype",
    });
  });

  it("refuses to download when nothing was offered", async () => {
    const h = harness();
    await expect(h.controller.download()).rejects.toThrow("nothing to download");
  });
});

import { EventEmitter } from "node:events";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UpdateController } from "../../src/updates/controller.ts";
import { createLibraryUpdater } from "../../src/updates/libraryUpdater.ts";

class StandIn extends EventEmitter {
  autoDownload = false;
  autoInstallOnAppQuit = true;
  autoRunAppAfterInstall = false;
  requestHeaders: Record<string, string> | null = null;
  checks = 0;
  installs: boolean[][] = [];

  async checkForUpdates() {
    this.checks++;
    return null;
  }

  quitAndInstall(silent = false, runAfter = false) {
    this.installs.push([silent, runAfter]);
  }
}

describe("the Windows and Linux updater", () => {
  it("names Outlore and its version, and never checks or installs just by starting", async () => {
    const library = new StandIn();
    const updater = await createLibraryUpdater("0.1.5-Prototype", library);
    expect(library.requestHeaders).toEqual({ "User-Agent": "Outlore/0.1.5-Prototype" });
    expect(library.autoDownload).toBe(true);
    expect(library.autoInstallOnAppQuit).toBe(false);
    expect(library.autoRunAppAfterInstall).toBe(true);
    expect(library.checks).toBe(0);
    expect(library.installs).toEqual([]);

    const settingsFile = join(mkdtempSync(join(tmpdir(), "outlore-update-off-")), "settings.json");
    writeFileSync(settingsFile, JSON.stringify({ isEnabled: false, lastCheckedAt: null }));
    const controller = new UpdateController({
      currentVersion: "0.1.5-Prototype",
      earlierFailure: null,
      now: () => 0,
      repeat: () => () => {},
      settingsFile,
      unsupportedReason: null,
      updater,
    });
    controller.start();
    await controller.check();
    expect(library.checks).toBe(0);
  });

  it("reports download progress and waits for an explicit install", async () => {
    const library = new StandIn();
    const updater = await createLibraryUpdater("0.1.5-Prototype", library);
    const progress: [number, string][] = [];
    const result = updater.check((percent, version) => progress.push([percent, version]));
    library.emit("update-available", { version: "0.1.6-Prototype" });
    library.emit("download-progress", { percent: 42.9 });
    library.emit("update-downloaded", { releaseNotes: "<p>New</p>", version: "0.1.6-Prototype" });
    expect(await result).toEqual({
      _tag: "Ready",
      update: {
        notes: "New",
        pageUrl: "https://github.com/Dyrits/OUTLORE/releases/tag/0.1.6-Prototype",
        version: "0.1.6-Prototype",
      },
    });
    expect(progress).toEqual([[42, "0.1.6-Prototype"]]);
    expect(library.installs).toEqual([]);
    await updater.install();
    expect(library.installs).toEqual([[true, true]]);
  });
});

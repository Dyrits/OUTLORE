import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The installer's build configuration names files and a version by hand; nothing else checks them (SP-H-11, SP-H-02).
// electron-builder.yml is flat, so the lines this reads need no YAML parser.

const desktop = join(import.meta.dirname, "..");
const configuration = readFileSync(join(desktop, "electron-builder.yml"), "utf8").split("\n");

const settingOf = (key: string) =>
  configuration
    .find((line) => line.startsWith(`${key}:`))
    ?.slice(key.length + 1)
    .trim();

describe("the installer's build configuration", () => {
  it("builds against the Electron the package installs", () => {
    const installed = JSON.parse(readFileSync(join(desktop, "package.json"), "utf8")).devDependencies.electron;
    expect(settingOf("electronVersion")).toBe(installed);
  });
});

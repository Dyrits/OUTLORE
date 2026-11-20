// Builds the installed app and its host-platform installer in apps/desktop/release without starting or stopping Outlore.
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { buildWhisper } from "./buildWhisper.ts";

const root = join(import.meta.dir, "..", "..", "..");
const desktop = join(root, "apps", "desktop");

const run = (command: string, args: string[], cwd: string) => {
  const result = spawnSync(command, args, { cwd, env: process.env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const args = process.argv.slice(2);
const arch = args.includes("--x64") ? "x64" : args.includes("--arm64") ? "arm64" : process.arch;
buildWhisper(desktop, arch);
run(process.execPath, ["run", "build"], desktop);
// The window's screens ship inside the app, so it needs no dev server.
const screens = join(desktop, "dist", "app");
rmSync(screens, { force: true, recursive: true });
run(
  process.execPath,
  ["x", "--no-install", "expo", "export", "--platform", "web", "--output-dir", screens],
  join(root, "apps", "app"),
);
rmSync(join(desktop, "release"), { force: true, recursive: true });
// Calling Bun directly also works on Windows, where bunx may be a command shim rather than an executable.
run(
  process.execPath,
  ["x", "--no-install", "electron-builder", "--config", "electron-builder.yml", "--publish", "never", ...args],
  desktop,
);
console.log(`Built installers in ${join(desktop, "release")}.`);

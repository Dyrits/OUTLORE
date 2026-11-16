// A stand-in parent for process-tree tests: it starts a detached child running an idling Node process (with any
// extra arguments given, such as `serve --stdio`), records the child's pid in the file named by the first argument,
// and then either exits at once (`exit`, as a service that stopped would) or keeps running (`stay`).
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const [pidFile, mode, ...childArgs] = process.argv.slice(2);
const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", ...childArgs], {
  detached: true,
  stdio: "ignore",
});
writeFileSync(pidFile, String(child.pid));
if (mode === "exit") process.exit(0);
setInterval(() => {}, 1000);

// Probes whether a process inside each harness's sandbox can read the Vault's folder and the macOS Keychain, with
// outside controls. macOS only; run outside any other sandbox, from the repository root: `bun <this file>`.
//
// It stores no real secret. The marker in the folder and the Keychain item are random disposable strings made here and
// removed at the end, and only yes/no is printed, never a value. It starts no model and no live harness turn.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vaultProfileArgsOf, vaultProfileName } from "../../../../packages/service/src/harness/codexVaultProfile.ts";
import { detectOpenCodeSandbox, wrappedCommandOf } from "../../../../packages/service/src/harness/openCodeSandbox.ts";

const codex = process.env.OUTLORE_CODEX_PATH ?? "codex";
const root = realpathSync(mkdtempSync(join(tmpdir(), "outlore-vault-probe-")));
const folder = join(root, "vault");
mkdirSync(folder, { mode: 0o700 });
const marker = randomBytes(16).toString("hex");
writeFileSync(join(folder, "marker"), marker, { mode: 0o600 });
const service = `outlore-probe-${randomBytes(6).toString("hex")}`;
const secret = randomBytes(16).toString("hex");

const run = (command: string, args: ReadonlyArray<string>, input?: string) =>
  spawnSync(command, [...args], { encoding: "utf8", input, timeout: 30_000 });
const shows = (result: ReturnType<typeof run>, value: string) => (`${result.stdout}${result.stderr}`.includes(value) ? "yes" : "no");

const opencode = detectOpenCodeSandbox({ hidden: [folder], platform: process.platform, root: join(root, "opencode"), sandboxProblem: null });
if (opencode === null) throw new Error("No Seatbelt here: this probe needs macOS and a process that may apply a profile.");
const openCodeWrap = (command: string, args: ReadonlyArray<string>) => wrappedCommandOf(opencode, [], command, args);
const codexWrap = (command: string, args: ReadonlyArray<string>) => ({
  args: ["sandbox", "-C", root, "-P", vaultProfileName, ...vaultProfileArgsOf(folder), "--", command, ...args],
  command: codex,
});
const contexts = [
  { name: "outside any sandbox (control)", wrap: (command: string, args: ReadonlyArray<string>) => ({ args: [...args], command }) },
  { name: "OpenCode's profile", wrap: openCodeWrap },
  { name: "Codex's profile (outlore)", wrap: codexWrap },
] as const;

try {
  // The item is added through `security -i`, the key on standard input and never in a command line.
  const added = run("/usr/bin/security", ["-i"], `add-generic-password -a outlore-probe -s ${service} -w ${secret} -U\n`);
  console.log(`disposable Keychain item added through "security -i" (standard input): ${added.status === 0 ? "yes" : `no (${added.stderr.trim()})`}`);
  for (const { name, wrap } of contexts) {
    const call = (command: string, args: ReadonlyArray<string>, input?: string) => {
      const wrapped = wrap(command, args);
      return run(wrapped.command, wrapped.args, input);
    };
    console.log(`${name}:`);
    console.log(`  marker in the Vault's folder readable: ${shows(call("/bin/cat", [join(folder, "marker")]), marker)}`);
    console.log(`  folder listable: ${shows(call("/bin/ls", [folder]), "marker")}`);
    console.log(`  Keychain item readable with "security find-generic-password -w": ${shows(call("/usr/bin/security", ["find-generic-password", "-s", service, "-w"]), secret)}`);
    console.log(`  Keychain item readable through "security -i" (standard input): ${shows(call("/usr/bin/security", ["-i"], `find-generic-password -s ${service} -w\n`), secret)}`);
    const wrote = call("/usr/bin/security", ["-i"], `add-generic-password -a outlore-probe -s ${service}-written -w x -U\n`);
    console.log(`  Keychain item written through "security -i": ${wrote.status === 0 ? "yes" : "no"}`);
    run("/usr/bin/security", ["delete-generic-password", "-s", `${service}-written`]);
  }
} finally {
  run("/usr/bin/security", ["delete-generic-password", "-s", service]);
  rmSync(root, { force: true, recursive: true });
  console.log(`disposable Keychain item removed: ${run("/usr/bin/security", ["find-generic-password", "-s", service]).status === 0 ? "NO, remove it by hand" : "yes"}`);
}

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "@effect/vitest";
import {
  type OpenCodeSandbox,
  sandboxDataHomeOf,
  wrappedCommandOf,
  writableRootsOf,
} from "../../src/harness/openCodeSandbox.ts";
import { copyOpenCodeConfig, seedOpenCodeSignIn } from "../../src/harness/openCodeSeed.ts";
import { temporary } from "../fixtures/service.ts";
import { canApplySeatbelt } from "../support/environment.ts";

const standIn = [join(import.meta.dirname, "..", "fixtures", "stand-in-opencode.mjs")];
const writeProbe = join(import.meta.dirname, "..", "fixtures", "stand-in-write-probe.mjs");
const credentialTable =
  "CREATE TABLE IF NOT EXISTS credential (id TEXT PRIMARY KEY, integration_id TEXT, label TEXT NOT NULL, value TEXT NOT NULL, active INTEGER)";
/** OpenCode's credential store in a data folder, as OpenCode 2.2.0 keeps it (its database's `credential` table). */
const storeOf = (dataHome: string) => {
  mkdirSync(join(dataHome, "opencode"), { recursive: true });
  const database = new DatabaseSync(join(dataHome, "opencode", "opencode.db"));
  database.exec(credentialTable);
  return database;
};
const putCredential = (dataHome: string, id: string, integration: string, value: object) => {
  const database = storeOf(dataHome);
  database
    .prepare("INSERT OR REPLACE INTO credential (id, integration_id, label, value, active) VALUES (?, ?, ?, ?, 1)")
    .run(id, integration, "Key", JSON.stringify(value));
  database.close();
};
const credentialsOf = (dataHome: string) => {
  const database = storeOf(dataHome);
  const rows = database.prepare("SELECT id, integration_id, value FROM credential ORDER BY id").all();
  database.close();
  return rows.map((row) => ({ ...row }));
};
/** Every file below a folder, by its path from there. */
const filesOf = (folder: string): Array<string> =>
  existsSync(folder)
    ? spawnSync("find", [folder, "-type", "f"], { encoding: "utf8" })
        .stdout.split("\n")
        .filter((line) => line !== "")
        .map((line) => line.slice(folder.length + 1))
        .sort()
    : [];

describe.skipIf(!canApplySeatbelt)("seeding a sandboxed OpenCode's own data copy on this Mac", () => {
  const setup = () => {
    const root = realpathSync(temporary("outlore-sandbox-"));
    const sandbox: OpenCodeSandbox = {
      caches: [],
      command: "/usr/bin/sandbox-exec",
      computerConfigHome: join(root, "config"),
      computerDataHome: join(root, "share"),
      hidden: [],
      kind: "seatbelt",
      root: join(root, "service", "opencode-sandbox"),
    };
    const run = (accountDataHome: string | null) => ({
      accountDataHome,
      command: process.execPath,
      environment: {},
      prefixArgs: standIn,
      sandbox,
    });
    return { root, run, sandbox };
  };

  it("copies the sign-in into the account's copy, and none of the data folder's files, executables included", async () => {
    const { root, run, sandbox } = setup();
    const real = join(root, "share");
    putCredential(real, "cred_1", "opencode-go", { key: "dummy-key", type: "key" });
    putCredential(real, "cred_2", "anthropic", { access: "a", expires: 1, refresh: "r", type: "oauth" });
    for (const planted of ["bin/rg", "plugins/evil.js", "plugin/evil.ts", "auth.json"]) {
      mkdirSync(join(real, "opencode", planted, ".."), { recursive: true });
      writeFileSync(join(real, "opencode", planted), "#!/bin/sh\necho planted\n");
    }
    const before = filesOf(join(real, "opencode"));
    await seedOpenCodeSignIn(run(null));
    const copy = sandboxDataHomeOf(sandbox, null);
    expect(credentialsOf(copy)).toEqual(credentialsOf(real));
    expect(filesOf(join(copy, "opencode"))).toEqual(["opencode.db"]);
    expect(filesOf(join(real, "opencode"))).toEqual(before);
  });

  it("seeds again at each start, so a revoked or changed sign-in follows, and never writes back", async () => {
    const { root, run, sandbox } = setup();
    const real = join(root, "share");
    putCredential(real, "cred_1", "opencode-go", { key: "old", type: "key" });
    putCredential(real, "cred_2", "anthropic", { key: "revoked", type: "key" });
    await seedOpenCodeSignIn(run(null));
    const copy = sandboxDataHomeOf(sandbox, null);
    // A sign-in written in the copy stays there.
    putCredential(copy, "cred_9", "xai", { key: "made inside", type: "key" });
    const database = storeOf(real);
    database.prepare("DELETE FROM credential WHERE id = 'cred_2'").run();
    database.close();
    putCredential(real, "cred_1", "opencode-go", { key: "new", type: "key" });
    putCredential(real, "cred_3", "github-copilot", { key: "added", type: "key" });
    const realNow = credentialsOf(real);
    await seedOpenCodeSignIn(run(null));
    expect(credentialsOf(copy)).toEqual(realNow);
    expect(credentialsOf(real)).toEqual(realNow);
  });

  it("keeps each account's copy apart, seeded from that account's own folder", async () => {
    const { root, run, sandbox } = setup();
    const work = join(root, "accounts", "work");
    putCredential(join(root, "share"), "cred_1", "opencode-go", { key: "computer", type: "key" });
    putCredential(work, "cred_7", "opencode-go", { key: "work", type: "key" });
    await seedOpenCodeSignIn(run(work));
    await seedOpenCodeSignIn(run(null));
    expect(credentialsOf(sandboxDataHomeOf(sandbox, work))).toEqual(credentialsOf(work));
    expect(credentialsOf(sandboxDataHomeOf(sandbox, null))).toEqual(credentialsOf(join(root, "share")));
  });

  it("copies the owner's configuration read-only, without plugins, tools, or packages, and never writes back", async () => {
    const { root, run, sandbox } = setup();
    const owner = join(root, "config", "opencode");
    const files: Record<string, string> = {
      "AGENTS.md": "Be brief.",
      "agents/review.md": "Review agent",
      "commands/ship.md": "Ship it",
      "node_modules/pkg/index.js": "module.exports = 1",
      "opencode.json": '{"model":"provider/model-a"}',
      "opencode.jsonc": "// mine\n{}",
      "package.json": "{}",
      "plugin/old.ts": "export default {}",
      "plugins/notify.js": "export default {}",
      "service.json": '{"port":1}',
      "tools/run.ts": "export default {}",
    };
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(owner, path, ".."), { recursive: true });
      writeFileSync(join(owner, path), text);
    }
    const ownerBefore = filesOf(owner);
    // A plugin planted in the sandbox's configuration by an earlier thread.
    const copy = join(sandbox.root, "config", "opencode");
    mkdirSync(join(copy, "plugins"), { recursive: true });
    writeFileSync(join(copy, "plugins", "planted.js"), "export default {}");
    await copyOpenCodeConfig(run(null));
    expect(filesOf(copy)).toEqual([
      "AGENTS.md",
      "agents/review.md",
      "commands/ship.md",
      "opencode.json",
      "opencode.jsonc",
    ]);
    for (const path of filesOf(copy)) {
      expect(readFileSync(join(copy, path), "utf8")).toBe(files[path]);
      expect(statSync(join(copy, path)).mode & 0o777).toBe(0o444);
    }
    writeFileSync(join(owner, "opencode.json"), '{"model":"provider/plain"}');
    await copyOpenCodeConfig(run(null));
    expect(readFileSync(join(copy, "opencode.json"), "utf8")).toBe('{"model":"provider/plain"}');
    expect(filesOf(owner)).toEqual(ownerBefore);
  });

  it("lets the wrapped process write its data copy, and not the real data folder", () => {
    const { root, sandbox } = setup();
    const real = join(root, "share", "opencode");
    mkdirSync(real, { recursive: true });
    const roots = writableRootsOf(sandbox, join(root, "work"), null);
    const copy = join(sandboxDataHomeOf(sandbox, null), "opencode");
    const wrapped = wrappedCommandOf(sandbox, roots, process.execPath, [
      writeProbe,
      "mkdir",
      join(copy, "bin", "rg"),
      join(real, "bin", "rg"),
      join(sandbox.root, "owner"),
    ]);
    const ran = spawnSync(wrapped.command, wrapped.args, { encoding: "utf8" });
    expect(JSON.parse(ran.stdout)).toEqual(["ok", "EPERM", "EPERM"]);
    expect(existsSync(join(real, "bin", "rg"))).toBe(false);
  });
});

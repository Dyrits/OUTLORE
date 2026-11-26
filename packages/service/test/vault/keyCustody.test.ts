import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { CommandResult } from "../../src/vault/commandRunner.ts";
import { custodiesOf } from "../../src/vault/keyCustody/index.ts";
import { keyFile } from "../../src/vault/keyCustody/keyFile.ts";
import { macKeychain } from "../../src/vault/keyCustody/macKeychain.ts";
import { secretService } from "../../src/vault/keyCustody/secretService.ts";
import { windowsDpapi } from "../../src/vault/keyCustody/windowsDpapi.ts";
import { temporary } from "../fixtures/service.ts";

type Call = { readonly args: ReadonlyArray<string>; readonly command: string; readonly input: string };

/** A runner that records every call and answers each with the next scripted result (the last one repeats). */
const scripted = (...results: ReadonlyArray<Partial<CommandResult>>) => {
  const calls: Array<Call> = [];
  return {
    calls,
    run: (command: string, args: ReadonlyArray<string>, input: string) =>
      Effect.sync(() => {
        calls.push({ args, command, input });
        const result = results[Math.min(calls.length - 1, results.length - 1)] ?? {};
        return { code: 0, stderr: "", stdout: "", ...result };
      }),
  };
};

const key = randomBytes(32);
const hex = key.toString("hex");

describe("the macOS Keychain holder", () => {
  it.effect("adds the key through `security -i` on standard input, never in a command line", () =>
    Effect.gen(function* () {
      const runner = scripted({});
      yield* macKeychain(runner.run).write("abc", key);
      expect(runner.calls).toHaveLength(1);
      expect(runner.calls[0]?.args).toEqual(["-i"]);
      expect(runner.calls[0]?.input).toContain(`-w ${hex}`);
      expect(JSON.stringify(runner.calls[0]?.args)).not.toContain(hex);
    }),
  );

  it.effect("reads the key by its item, and tells a missing item from a Keychain that cannot answer", () =>
    Effect.gen(function* () {
      const found = scripted({ stdout: `${hex}\n` });
      expect(yield* macKeychain(found.run).read("abc")).toEqual({ _tag: "Found", key });
      expect(found.calls[0]?.args).toEqual(["find-generic-password", "-a", "outlore", "-s", "outlore-vault-abc", "-w"]);
      expect(yield* macKeychain(scripted({ code: 44 }).run).read("abc")).toEqual({ _tag: "Gone" });
      expect(yield* macKeychain(scripted({ code: 36 }).run).read("abc")).toMatchObject({ _tag: "Unreachable" });
      expect(yield* macKeychain(scripted({ code: null }).run).read("abc")).toMatchObject({ _tag: "Unreachable" });
      expect(yield* macKeychain(scripted({ stdout: "not a key" }).run).read("abc")).toMatchObject({
        _tag: "Unreachable",
      });
    }),
  );

  it.effect("fails a write the Keychain refuses, and removes an item that is already gone without failing", () =>
    Effect.gen(function* () {
      expect((yield* Effect.flip(macKeychain(scripted({ code: 1 }).run).write("abc", key))).kind).toBe("WriteFailed");
      yield* macKeychain(scripted({ code: 44 }).run).remove("abc");
      expect((yield* Effect.flip(macKeychain(scripted({ code: 1 }).run).remove("abc"))).kind).toBe("WriteFailed");
    }),
  );
});

describe("the Secret Service holder", () => {
  it.effect("stores the key on standard input, and reads gone only from an answer with no message", () =>
    Effect.gen(function* () {
      const runner = scripted({});
      yield* secretService(runner.run).write("abc", key);
      expect(runner.calls[0]).toMatchObject({ command: "secret-tool", input: hex });
      expect(JSON.stringify(runner.calls[0]?.args)).not.toContain(hex);
      expect(yield* secretService(scripted({ stdout: hex }).run).read("abc")).toEqual({ _tag: "Found", key });
      expect(yield* secretService(scripted({ code: 1 }).run).read("abc")).toEqual({ _tag: "Gone" });
      expect(
        yield* secretService(scripted({ code: 1, stderr: "Cannot autolaunch D-Bus" }).run).read("abc"),
      ).toMatchObject({
        _tag: "Unreachable",
      });
      expect(yield* secretService(scripted({ code: null }).run).read("abc")).toMatchObject({ _tag: "Unreachable" });
    }),
  );
});

describe("the Windows DPAPI holder", () => {
  it.effect("sends the script, with the key in it, on standard input and not in the arguments", () =>
    Effect.gen(function* () {
      const runner = scripted({});
      yield* windowsDpapi("C:\\Users\\o'brien\\vault", runner.run).write("abc", key);
      expect(runner.calls[0]?.input).toContain(hex);
      expect(runner.calls[0]?.input).toContain("ProtectedData]::Protect");
      // A quote in a path is doubled, so it cannot end the string and start a command.
      expect(runner.calls[0]?.input).toContain("o''brien");
      expect(JSON.stringify(runner.calls[0]?.args)).not.toContain(hex);
    }),
  );

  it.effect("tells a missing key file from a failure to unprotect", () =>
    Effect.gen(function* () {
      expect(yield* windowsDpapi("v", scripted({ stdout: `${hex}\r\n` }).run).read("abc")).toEqual({
        _tag: "Found",
        key,
      });
      expect(yield* windowsDpapi("v", scripted({ code: 3 }).run).read("abc")).toEqual({ _tag: "Gone" });
      expect(yield* windowsDpapi("v", scripted({ code: 1 }).run).read("abc")).toMatchObject({ _tag: "Unreachable" });
    }),
  );
});

describe("the key file holder", () => {
  it.effect("keeps the key in a file only its owner reads, reads it back, and removes it", () =>
    Effect.gen(function* () {
      const folder = join(temporary("outlore-keyfile-"), "vault");
      const custody = keyFile(folder);
      expect(yield* custody.read("abc")).toEqual({ _tag: "Gone" });
      yield* custody.write("abc", key);
      expect(statSync(join(folder, "key-abc")).mode & 0o777).toBe(0o600);
      expect(yield* custody.read("abc")).toEqual({ _tag: "Found", key });
      yield* custody.remove("abc");
      yield* custody.remove("abc");
      expect(existsSync(join(folder, "key-abc"))).toBe(false);
    }),
  );

  it.effect("says plainly that anyone who can read the files can read the key", () =>
    Effect.sync(() => expect(keyFile("v").holder.label).toBe("Key file: anyone who can read your files can read it")),
  );
});

describe("choosing the holders to try", () => {
  it("tries the platform's secret store, then the key file", () => {
    const names = (platform: NodeJS.Platform) =>
      custodiesOf(platform, "v", scripted({}).run).map((custody) => custody.holder.name);
    expect(names("darwin")).toEqual(["keychain", "keyFile"]);
    expect(names("win32")).toEqual(["windows", "keyFile"]);
    expect(names("linux")).toEqual(["secretService", "keyFile"]);
  });
});

/** Whether this process may write a disposable item to the login Keychain: not inside a thread's sandbox. */
const canUseKeychain = (() => {
  if (process.platform !== "darwin") return false;
  const service = `outlore-test-probe-${process.pid}`;
  const added = spawnSync("/usr/bin/security", ["-i"], {
    encoding: "utf8",
    input: `add-generic-password -a outlore-test -s ${service} -w x -U\n`,
    timeout: 10_000,
  });
  spawnSync("/usr/bin/security", ["delete-generic-password", "-s", service], { timeout: 10_000 });
  return added.status === 0;
})();

describe.skipIf(!canUseKeychain)("the real macOS Keychain", () => {
  it.effect("keeps, reads back and removes a disposable key, tells a removed one from a locked Keychain", () =>
    Effect.gen(function* () {
      const { commandRunnerLayer, CommandRunner } = yield* Effect.promise(
        () => import("../../src/vault/commandRunner.ts"),
      );
      const runner = yield* Effect.service(CommandRunner).pipe(Effect.provide(commandRunnerLayer));
      const custody = macKeychain(runner.run);
      const keyId = randomBytes(8).toString("hex");
      try {
        yield* custody.write(keyId, key);
        expect(yield* custody.read(keyId)).toEqual({ _tag: "Found", key });
      } finally {
        yield* custody.remove(keyId);
      }
      expect(yield* custody.read(keyId)).toEqual({ _tag: "Gone" });
    }),
  );
});

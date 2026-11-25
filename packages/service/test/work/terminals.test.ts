import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { Request, RequestSource, ServerFrame } from "@outlore/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { wrappedFencedCommandOf } from "../../src/core/index.ts";
import { fakeHarnessLayer, Service, serviceLayer } from "../../src/index.ts";
import { answerText } from "../../src/remote/index.ts";
import {
  defaultShellOf,
  shellArgsOf,
  type TerminalHost,
  terminalSandboxOf,
  unpackedPathOf,
} from "../../src/work/terminalHost.ts";
import { type ConversationTerminals, makeConversationTerminals } from "../../src/work/terminalSessions.ts";
import { canOpenTerminal } from "../support/environment.ts";

// The conversation shells of the host service (conversation-terminal, ADR 0020): the class here, and the requests'
// admission below, over a stand-in sandbox that runs what the fence would run without applying it. The real fence is
// the harness sandbox's own, already proven by openCodeSandbox.test.ts on a host that can apply it.

const folders: string[] = [];
const managers: ConversationTerminals[] = [];
const folder = () => {
  // By its real path, the way the fence names folders: what a shell prints as its $PWD is the same string.
  const path = realpathSync(mkdtempSync(join(tmpdir(), "outlore-terminal-")));
  folders.push(path);
  return path;
};
/** A shell host over the stand-in fence, used by the checks that must actually run a warm shell. */
const hostOf = (home: string, hidden: string[] = []): TerminalHost => ({
  environment: { OUTLORE_TOKEN: "never-out-of-here", PATH: process.env.PATH },
  hidden,
  home,
  sandbox: { command: join(import.meta.dirname, "..", "fixtures", "stand-in-sandbox.sh"), hidden, kind: "seatbelt" },
  shell: "/bin/sh",
  tempRoot: join(home, ".terminal-tmp"),
});
/** The shells run to completion at once, so a check reads them as plain calls and a refusal throws. */
const synchronously = (terminals: ConversationTerminals) => ({
  close: (...given: Parameters<ConversationTerminals["close"]>) => Effect.runSync(terminals.close(...given)),
  open: (...given: Parameters<ConversationTerminals["open"]>) => Effect.runSync(terminals.open(...given)),
  openCommand: (...given: Parameters<ConversationTerminals["openCommand"]>) =>
    Effect.runSync(terminals.openCommand(...given)),
  resize: (...given: Parameters<ConversationTerminals["resize"]>) => Effect.runSync(terminals.resize(...given)),
  write: (...given: Parameters<ConversationTerminals["write"]>) => Effect.runSync(terminals.write(...given)),
});
const manager = (host: TerminalHost) => {
  const frames: ServerFrame[] = [];
  const terminals = Effect.runSync(makeConversationTerminals(host, (frame) => frames.push(frame)));
  managers.push(terminals);
  return { frames, terminals: synchronously(terminals) };
};
afterEach(() => {
  for (const terminals of managers.splice(0)) Effect.runSync(terminals.dispose);
  for (const path of folders.splice(0)) rmSync(path, { force: true, recursive: true });
});

describe.runIf(canOpenTerminal)("conversation shells", () => {
  it("starts in the home folder without a realm and keeps shell state when reopened", async () => {
    const home = folder();
    const { terminals } = manager(hostOf(home));
    terminals.open("host", "quest", null);
    terminals.write("host", "quest", "printf 'ROOT=%s\\n' \"$PWD\"; export OUTLORE_TERMINAL_TEST=kept\r");
    await expect.poll(() => terminals.open("host", "quest", null).output).toContain(`ROOT=${home}`);
    terminals.write("host", "quest", "printf 'STATE=%s\\n' \"$OUTLORE_TERMINAL_TEST\"\r");
    await expect.poll(() => terminals.open("host", "quest", null).output).toContain("STATE=kept");
  });

  it("starts at the realm root and isolates shells belonging to different conversations", async () => {
    const home = folder();
    const realm = folder();
    const { terminals } = manager(hostOf(home));
    terminals.open("host", "realm", realm);
    terminals.open("host", "home", null);
    terminals.write("host", "realm", "printf 'ROOT=%s\\n' \"$PWD\"\r");
    terminals.write("host", "home", "printf 'ROOT=%s\\n' \"$PWD\"\r");
    await expect.poll(() => terminals.open("host", "realm", realm).output).toContain(`ROOT=${realm}`);
    await expect.poll(() => terminals.open("host", "home", null).output).toContain(`ROOT=${home}`);
    expect(terminals.open("host", "home", null).output).not.toContain(`ROOT=${realm}`);
  });

  it("keeps the host window's shell and a paired device's separate, whatever asks", async () => {
    const home = folder();
    const { frames, terminals } = manager(hostOf(home));
    terminals.open("host", "quest", null);
    terminals.open("remote", "quest", null);
    terminals.write("host", "quest", "printf 'SCOPE=host\\n'\r");
    terminals.write("remote", "quest", "printf 'SCOPE=remote\\n'\r");
    await expect.poll(() => terminals.open("host", "quest", null).output).toContain("SCOPE=host");
    await expect.poll(() => terminals.open("remote", "quest", null).output).toContain("SCOPE=remote");
    expect(terminals.open("host", "quest", null).output).not.toContain("SCOPE=remote");
    expect(terminals.open("remote", "quest", null).output).not.toContain("SCOPE=host");
    // Each scope's frames carry its own key, and the other screen's shell never runs in them.
    const isData = (id: string) => (frame: ServerFrame) => frame._tag === "TerminalData" && frame.id === id;
    expect(frames.some(isData("host:quest"))).toBe(true);
    expect(frames.some(isData("remote:quest"))).toBe(true);
  });

  it("runs a paired device's shell without the loopback token and inside its temporary folder", async () => {
    const home = folder();
    const { terminals } = manager(hostOf(home));
    terminals.open("remote", "quest", null);
    terminals.write(
      "remote",
      "quest",
      'test -z "$OUTLORE_TOKEN" && echo "TOKEN=unset" || echo "TOKEN=set"; printf \'TMPDIR=%s\\n\' "$TMPDIR"\r',
    );
    await expect
      .poll(() => terminals.open("remote", "quest", null).output)
      .toContain(`TMPDIR=${join(home, ".terminal-tmp")}`);
    expect(terminals.open("remote", "quest", null).output).toContain("TOKEN=unset");
  });

  it("retains final output after the shell exits and explicitly starts a fresh shell", async () => {
    const { frames, terminals } = manager(hostOf(folder()));
    terminals.open("host", "quest", null);
    terminals.write("host", "quest", "printf 'final-output\\n'; exit\r");
    await expect.poll(() => terminals.open("host", "quest", null).isRunning).toBe(false);
    expect(terminals.open("host", "quest", null).output).toContain("final-output");
    expect(frames.some((frame) => frame._tag === "TerminalExit" && frame.id === "host:quest")).toBe(true);
    terminals.close("host", "quest");
    expect(terminals.open("host", "quest", null).isRunning).toBe(true);
  });

  it("runs a one-shot interactive command with overlaid env and reports its exit code", async () => {
    const home = folder();
    const { frames, terminals } = manager(hostOf(home));
    terminals.openCommand("host", "sign-in:opencode:own", {
      command: 'printf "ENV=%s\\n" "$SIGN_IN_VAR"; read answer; printf "GOT=%s\\n" "$answer"; exit 0',
      env: { SIGN_IN_VAR: "custom-home" },
    });
    await expect.poll(() => terminals.open("host", "sign-in:opencode:own", null).output).toContain("ENV=custom-home");
    terminals.write("host", "sign-in:opencode:own", "ok\r");
    await expect.poll(() => terminals.open("host", "sign-in:opencode:own", null).isRunning).toBe(false);
    const ended = terminals.open("host", "sign-in:opencode:own", null);
    expect(ended.output).toContain("GOT=ok");
    expect(ended.exitCode).toBe(0);
    expect(
      frames.some(
        (frame) => frame._tag === "TerminalExit" && frame.id === "host:sign-in:opencode:own" && frame.exitCode === 0,
      ),
    ).toBe(true);
    // Re-launching with the same id replaces the exited session cleanly.
    terminals.openCommand("host", "sign-in:opencode:own", { command: "exit 7" });
    await expect.poll(() => terminals.open("host", "sign-in:opencode:own", null).isRunning).toBe(false);
    expect(terminals.open("host", "sign-in:opencode:own", null).exitCode).toBe(7);
  });

  it("refuses a remote shell on a host with no sandbox, and sizes and folders it cannot take", () => {
    const home = folder();
    const { terminals } = manager({ ...hostOf(home), sandbox: null });
    expect(() => terminals.open("remote", "quest", null)).toThrow(/no sandbox/);
    terminals.open("host", "quest", null);
    // The same conversation's shell keeps its folder: a shell already open is returned whatever the new call names.
    expect(() => terminals.open("host", "other", "/no-such-outlore-terminal-folder")).toThrow();
    expect(() => terminals.resize("host", "quest", -1, 24)).toThrow();
    expect(() => terminals.write("host", "quest", "x".repeat(1000001))).toThrow();
    expect(() => terminals.write("host", "missing", "x")).toThrow(/exited/);
  });
});

describe("the fence around a paired device's shell", () => {
  it("names the conversation's folder and the terminals' temporary folder writable, and the Vault unreadable", () => {
    const wrapped = wrappedFencedCommandOf(
      { command: "/usr/bin/sandbox-exec", hidden: ["/data/vault"], kind: "seatbelt" },
      ["/work/realm", "/data/terminal-tmp"],
      "/bin/zsh",
      ["-l"],
    );
    expect(wrapped.command).toBe("/usr/bin/sandbox-exec");
    expect(wrapped.args).toContain("-D");
    expect(wrapped.args).toContain("W0=/work/realm");
    expect(wrapped.args).toContain("W1=/data/terminal-tmp");
    expect(wrapped.args).toContain("H0=/data/vault");
    const profile = String(wrapped.args[wrapped.args.indexOf("-p") + 1]);
    expect(profile).toContain("(deny file-write*)");
    expect(profile).toContain('(allow file-write* (subpath (param "W0")) (subpath (param "W1"))');
    expect(profile).toContain('(deny file-read* (subpath (param "H0")))');
    expect(wrapped.args.slice(-2)).toEqual(["/bin/zsh", "-l"]);
  });

  it("finds no sandbox where none can run, and the one the probes accept", () => {
    expect(terminalSandboxOf({ hidden: [], platform: "darwin", probe: () => false })).toBeNull();
    expect(terminalSandboxOf({ hidden: [], platform: "win32", probe: () => true, which: () => "/bwrap" })).toBeNull();
    expect(terminalSandboxOf({ hidden: [], platform: "linux", probe: () => true, which: () => null })).toBeNull();
    expect(terminalSandboxOf({ hidden: [], platform: "darwin", probe: () => true })).toMatchObject({
      command: "/usr/bin/sandbox-exec",
      kind: "seatbelt",
    });
    expect(
      terminalSandboxOf({ hidden: [], platform: "linux", probe: () => true, which: () => "/usr/bin/bwrap" }),
    ).toMatchObject({
      command: "/usr/bin/bwrap",
      kind: "bwrap",
    });
  });

  it("repairs the packaged helper path and opens the owner's login shell on Unix, Windows' command shell", () => {
    expect(unpackedPathOf("/Applications/Outlore.app/Contents/Resources/app.asar/node_modules/node-pty")).toBe(
      "/Applications/Outlore.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty",
    );
    expect(defaultShellOf("darwin", "/bin/zsh", null)).toBe("/bin/zsh");
    expect(shellArgsOf("darwin")).toEqual(["-l"]);
    expect(defaultShellOf("win32", "/bin/sh", "C:\\Windows\\System32\\cmd.exe")).toBe("C:\\Windows\\System32\\cmd.exe");
    expect(shellArgsOf("win32")).toEqual([]);
  });
});

// The requests: what a paired device may do, taught by the host's switch.

const pairedDevice: RequestSource = { deviceId: "device", isPairedDevice: true };
const hostWindow: RequestSource = { isPairedDevice: false };

/** One service over its own store, with the shell host a check chooses. */
const terminalService = (terminalHost: TerminalHost) => {
  const directory = folder();
  return serviceLayer({
    filename: join(directory, "store.sqlite"),
    harness: fakeHarnessLayer("10 millis"),
    homeFolder: directory,
    scratchRoot: join(directory, "missions"),
    terminalHost,
  });
};
const callAs = <R extends Request>(request: R, source: RequestSource) =>
  Effect.gen(function* () {
    return yield* (yield* Service).handle(request, source);
  });

describe("terminals and their requests", () => {
  it.live("keep a paired device's shells off until the host turns them on, and only the host may turn them on", () =>
    Effect.gen(function* () {
      expect(
        yield* Effect.flip(callAs({ _tag: "OpenTerminal", cwd: null, id: "quest:home" }, pairedDevice)),
      ).toMatchObject({ kind: "AccessRefused" });
      // A paired device cannot let itself in, in part or with a full save.
      expect(
        yield* Effect.flip(
          callAs({ _tag: "ChangeSettings", change: { shouldAllowRemoteTerminals: true } }, pairedDevice),
        ),
      ).toMatchObject({ kind: "AccessRefused" });
      expect(
        yield* Effect.flip(
          callAs(
            {
              _tag: "UpdateSettings",
              settings: {
                ...(yield* callAs({ _tag: "ReadSettings" }, pairedDevice)),
                shouldAllowRemoteTerminals: true,
              },
            },
            pairedDevice,
          ),
        ),
      ).toMatchObject({ kind: "AccessRefused" });
      // Other settings, and a full save that leaves the switch where it is, still work from a paired device.
      yield* callAs({ _tag: "ChangeSettings", change: { shouldStreamReplies: false } }, pairedDevice);
      yield* callAs(
        { _tag: "UpdateSettings", settings: yield* callAs({ _tag: "ReadSettings" }, pairedDevice) },
        pairedDevice,
      );
      // The host's own window changes the switch, and its shell does not need the switch at all.
      const allowed = yield* callAs(
        { _tag: "ChangeSettings", change: { shouldAllowRemoteTerminals: false } },
        hostWindow,
      );
      expect(allowed.shouldAllowRemoteTerminals).toBe(false);
      yield* callAs({ _tag: "ChangeSettings", change: { shouldAllowRemoteTerminals: true } }, hostWindow);
      // A paired device names folders as every folder request does.
      expect(
        yield* Effect.flip(
          callAs({ _tag: "OpenTerminal", cwd: "/no-such-outlore-terminal-folder", id: "quest:x" }, pairedDevice),
        ),
      ).toMatchObject({ kind: "InvalidInput" });
    }).pipe(Effect.provide(terminalService(hostOf(folder())))),
  );

  it.live("refuses a paired device's shell where the host offers no sandbox, whatever the switch says", () =>
    Effect.gen(function* () {
      yield* callAs({ _tag: "ChangeSettings", change: { shouldAllowRemoteTerminals: true } }, hostWindow);
      expect(
        yield* Effect.flip(callAs({ _tag: "OpenTerminal", cwd: null, id: "quest:home" }, pairedDevice)),
      ).toMatchObject({ kind: "Unsupported" });
    }).pipe(Effect.provide(terminalService({ ...hostOf(folder()), sandbox: null }))),
  );

  it.live.runIf(canOpenTerminal)("opens, writes into, and closes the shells of the host's window and its devices", () =>
    Effect.gen(function* () {
      // The host's own window shells without the switch.
      const own = yield* callAs({ _tag: "OpenTerminal", cwd: null, id: "quest:home" }, hostWindow);
      expect(own).toMatchObject({ isRunning: true });
      yield* callAs({ _tag: "CloseTerminal", id: "quest:home" }, hostWindow);
      yield* callAs({ _tag: "ChangeSettings", change: { shouldAllowRemoteTerminals: true } }, hostWindow);
      const opened = yield* callAs({ _tag: "OpenTerminal", cwd: null, id: "quest:home" }, pairedDevice);
      expect(opened).toMatchObject({ isRunning: true });
      yield* callAs({ _tag: "WriteTerminalInput", data: "printf 'DRIVEN\\n'\\r", id: "quest:home" }, pairedDevice);
      yield* callAs({ _tag: "ResizeTerminal", cols: 120, id: "quest:home", rows: 40 }, pairedDevice);
      let output = opened.output;
      for (let attempt = 0; attempt < 100 && !output.includes("DRIVEN"); attempt++) {
        yield* Effect.sleep(50);
        output = (yield* callAs({ _tag: "OpenTerminal", cwd: null, id: "quest:home" }, pairedDevice)).output;
      }
      expect(output).toContain("DRIVEN");
      yield* callAs({ _tag: "CloseTerminal", id: "quest:home" }, pairedDevice);
    }).pipe(Effect.provide(terminalService(hostOf(folder())))),
  );

  it.live.runIf(canOpenTerminal)(
    "opens interactive provider sign-in inside the inline terminal and gates paired devices",
    () =>
      Effect.gen(function* () {
        const refused = yield* Effect.flip(
          callAs({ _tag: "SignInAccount", accountId: null, harness: "opencode" }, pairedDevice),
        );
        expect(refused).toMatchObject({ kind: "AccessRefused" });
        const launched = yield* callAs({ _tag: "SignInAccount", accountId: null, harness: "opencode" }, hostWindow);
        expect(launched).toEqual({
          _tag: "Terminal",
          terminal: { terminalId: "sign-in:opencode:own", title: "OpenCode sign-in" },
        });
        if (launched._tag === "Terminal") {
          const session = yield* callAs(
            { _tag: "OpenTerminal", cwd: null, id: launched.terminal.terminalId },
            hostWindow,
          );
          expect(session.cwd).toBeTruthy();
          yield* callAs({ _tag: "CloseTerminal", id: launched.terminal.terminalId }, hostWindow);
        }
      }).pipe(Effect.provide(terminalService(hostOf(folder())))),
  );
});

// What every screen actually receives: each request's answer is encoded against its result schema before it is sent,
// so an answer the schema refuses reaches the screen as "The service failed unexpectedly." even though the work ran.

/** Sends one request as the wire's text frame and returns the frame the screen receives. */
const frameAnswerOf = (request: Request, source: RequestSource) =>
  Effect.gen(function* () {
    const service = yield* Service;
    const sent: ServerFrame[] = [];
    yield* answerText(service.handle, JSON.stringify({ id: "1", request }), (frame) => sent.push(frame), source);
    return sent;
  });

describe("the answers terminal requests send to a screen", () => {
  it.live("succeeds for resizing and closing a shell", () =>
    Effect.gen(function* () {
      for (const request of [
        { _tag: "ResizeTerminal", cols: 120, id: "quest:home", rows: 40 },
        { _tag: "CloseTerminal", id: "quest:home" },
      ] as const)
        expect(yield* frameAnswerOf(request, hostWindow), request._tag).toEqual([
          { _tag: "Success", id: "1", value: null },
        ]);
    }).pipe(Effect.provide(terminalService(hostOf(folder())))),
  );

  it.live.runIf(canOpenTerminal)("succeeds for typing into an open shell", () =>
    Effect.gen(function* () {
      yield* callAs({ _tag: "OpenTerminal", cwd: null, id: "quest:home" }, hostWindow);
      expect(
        yield* frameAnswerOf({ _tag: "WriteTerminalInput", data: "true\r", id: "quest:home" }, hostWindow),
      ).toEqual([{ _tag: "Success", id: "1", value: null }]);
      yield* callAs({ _tag: "CloseTerminal", id: "quest:home" }, hostWindow);
    }).pipe(Effect.provide(terminalService(hostOf(folder())))),
  );
});

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { messageOf } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, fonts } from "../foundation/theme";
import type { TerminalPanelProps } from "./terminalPanelTypes";
import { nextTerminalRunActionOf, shouldAutoRestartTerminalOf, terminalKeyOf } from "./terminalScope";
import { terminalTextOf } from "./terminalSnapshot";
import { terminalThemeOf } from "./terminalTheme";

/** The host's conversation shell, whose output can be attached to the next message from any screen (ADR 0020). */
export function TerminalPanel({
  client,
  id,
  cwd,
  height,
  shouldHideExitBar,
  scope,
  ref,
  onExit,
  onReady,
}: TerminalPanelProps) {
  const container = useRef<HTMLDivElement>(null);
  const surface = useRef<Terminal | null>(null);
  const folder = useRef("");
  const isReady = useRef(false);
  const isRestartingRef = useRef(false);
  const isRunningRef = useRef(true);
  const hasAutoRestartedRef = useRef(false);
  const hasOpenFailedRef = useRef(false);
  const pendingCommands = useRef<string[]>([]);
  const restartRef = useRef<() => void>(() => {});
  const ready = useRef(onReady);
  ready.current = onReady;
  const exited = useRef(onExit);
  exited.current = onExit;
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [generation, setGeneration] = useState(0);
  const restart = () => {
    if (isRestartingRef.current) return;
    isRestartingRef.current = true;
    void client
      .request({ _tag: "CloseTerminal", id })
      .then(() => {
        isRestartingRef.current = false;
        setError(null);
        setGeneration((value) => value + 1);
      })
      .catch((reason) => {
        isRestartingRef.current = false;
        pendingCommands.current.length = 0;
        hasAutoRestartedRef.current = false;
        setError(messageOf(reason));
      });
  };
  restartRef.current = restart;
  useImperativeHandle(ref, () => ({
    focus: () => surface.current?.focus(),
    run: (input: string) => {
      hasAutoRestartedRef.current = false;
      const action = nextTerminalRunActionOf({
        hasOpenFailed: hasOpenFailedRef.current,
        isReady: isReady.current,
        isRestarting: isRestartingRef.current,
        isRunning: isRunningRef.current,
      });
      if (action === "write") {
        void client
          .request({ _tag: "WriteTerminalInput", data: input, id })
          .catch((reason) => setError(messageOf(reason)));
        surface.current?.focus();
        return;
      }
      pendingCommands.current.push(input);
      if (action === "reopen") {
        hasOpenFailedRef.current = false;
        setError(null);
        setGeneration((value) => value + 1);
      } else if (action === "restart") {
        hasAutoRestartedRef.current = true;
        restartRef.current();
      }
    },
    snapshot: () =>
      new Promise((resolve, reject) => {
        const terminal = surface.current;
        if (terminal === null || !isReady.current) {
          reject(new Error("Wait for the terminal to open before sending."));
          return;
        }
        // xterm parses asynchronously, so a flush must finish before reading its buffer.
        terminal.write("", () => resolve({ cwd: folder.current, text: terminalTextOf(terminal.buffer.active) }));
      }),
  }));
  // A new shell deliberately recreates the emulator even when its conversation and folder stay the same.
  // biome-ignore lint/correctness/useExhaustiveDependencies: generation explicitly resets the terminal after its shell exits.
  useEffect(() => {
    const element = container.current;
    if (element === null) return;
    let isActive = true;
    let hasExited = false;
    let hasNotifiedExit = false;
    let sequence: number | null = null;
    const pending: { text: string; sequence: number }[] = [];
    const pendingInput: string[] = [];
    isReady.current = false;
    hasOpenFailedRef.current = false;
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: fonts.mono,
      fontSize: 13,
      scrollback: 3000,
      theme: terminalThemeOf(),
    });
    surface.current = terminal;
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(element);
    const onError = (reason: unknown) => {
      if (!isActive) return;
      pendingCommands.current.length = 0;
      hasAutoRestartedRef.current = false;
      setError(String(reason));
    };
    const write = (text: string, next: number) => {
      if (sequence === null) {
        pending.push({ sequence: next, text });
        return;
      }
      if (next > sequence) {
        terminal.write(text);
        sequence = next;
      }
    };
    const notifyExit = (exitCode: number | null) => {
      if (hasNotifiedExit) return;
      hasNotifiedExit = true;
      exited.current?.(exitCode);
    };
    // The shell's frames carry its full key, scope included, so a screen shows only the shells its fence covers.
    const key = terminalKeyOf(scope, id);
    const unsubscribe = client.subscribeTerminals((frame) => {
      if (!isActive || frame.id !== key) return;
      if (frame._tag === "TerminalData") write(frame.data, frame.sequence);
      else {
        hasExited = true;
        isRunningRef.current = false;
        setIsRunning(false);
        notifyExit(frame.exitCode ?? null);
      }
    });
    const input = terminal.onData((data) => {
      if (isReady.current) void client.request({ _tag: "WriteTerminalInput", data, id }).catch(onError);
      else pendingInput.push(data);
    });
    const resize = () => {
      if (!isActive || element.clientWidth === 0 || element.clientHeight === 0) return;
      fit.fit();
      void client
        .request({
          _tag: "ResizeTerminal",
          cols: Math.min(500, terminal.cols),
          id,
          rows: Math.min(200, terminal.rows),
        })
        .catch(onError);
    };
    const tryAutoRestart = (isShellRunning: boolean) => {
      if (
        shouldAutoRestartTerminalOf({
          hasAutoRestarted: hasAutoRestartedRef.current,
          hasPendingCommands: pendingCommands.current.length > 0,
          isRunning: isShellRunning,
        })
      ) {
        hasAutoRestartedRef.current = true;
        restartRef.current();
        return true;
      }
      pendingCommands.current.length = 0;
      hasAutoRestartedRef.current = false;
      return false;
    };
    const observer = new ResizeObserver(resize);
    void client
      .request({ _tag: "OpenTerminal", cwd, id })
      .then((session) => {
        if (!isActive) return;
        const isSessionRunning = session.isRunning && !hasExited;
        folder.current = session.cwd;
        isRunningRef.current = isSessionRunning;
        setIsRunning(isSessionRunning);
        if (!isSessionRunning) {
          // A queued command from a Run button restarts a previously exited shell once so it executes immediately.
          if (tryAutoRestart(false)) return;
          notifyExit(session.exitCode ?? null);
        }
        sequence = session.sequence;
        terminal.write(session.output);
        for (const chunk of pending) write(chunk.text, chunk.sequence);
        terminal.write("", () => {
          if (!isActive) return;
          if (!isRunningRef.current && pendingCommands.current.length > 0 && tryAutoRestart(false)) return;
          isReady.current = true;
          hasAutoRestartedRef.current = false;
          for (const data of [...pendingInput.splice(0), ...pendingCommands.current.splice(0)])
            void client.request({ _tag: "WriteTerminalInput", data, id }).catch(onError);
          ready.current();
        });
        resize();
        observer.observe(element);
        terminal.focus();
      })
      .catch((reason) => {
        if (!isActive) return;
        hasOpenFailedRef.current = true;
        onError(reason);
      });
    return () => {
      isActive = false;
      isReady.current = false;
      surface.current = null;
      observer.disconnect();
      input.dispose();
      unsubscribe();
      terminal.dispose();
    };
  }, [id, cwd, generation, client, scope]);
  return (
    <View style={{ backgroundColor: colors.accentSoft, borderRadius: 8, gap: 4, padding: 8 }}>
      {!isRunning && !shouldHideExitBar && (
        <View style={styles.row}>
          <Text style={{ color: colors.textSecondary }}>Shell exited</Text>
          <Pressable onPress={restart}>
            <Text style={{ color: colors.textSecondary }}>New shell</Text>
          </Pressable>
        </View>
      )}
      {error !== null && (
        <Text accessibilityRole="alert" style={{ color: colors.marker }}>
          {error}
        </Text>
      )}
      <section aria-label="Interactive terminal" ref={container} style={{ height: height ?? 160, width: "100%" }} />
    </View>
  );
}

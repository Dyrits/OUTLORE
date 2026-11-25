import { type Ref, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { useIsRemoteHost } from "../foundation/hostContext";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, radii, round } from "../foundation/theme";
import { TerminalPanel } from "./terminalPanel";
import type { TerminalPanelHandle } from "./terminalPanelTypes";
import {
  clampTerminalHeight,
  commandTerminalStatusOf,
  defaultCommandHeight,
  defaultShellHeight,
  type TerminalScope,
} from "./terminalScope";

// The pointer shows the bottom edge can be dragged up or down to resize the terminal.
const resizeCursor = { cursor: "row-resize" } as object;

/** Props for the single inline terminal component shared by conversation shells and launched interactive commands. */
export type InlineTerminalProps = {
  readonly client: ServiceClient;
  /** Label for the close action button; defaults to "Close shell" for shells and "Close" for commands. */
  readonly closeLabel?: string;
  /** Starting folder for a shell session, or null for the host home or an already-open command session. */
  readonly cwd?: string | null;
  /** Initial height in pixels before the owner drags the resize handle. */
  readonly defaultHeight?: number;
  /** Whether the terminal body is currently expanded; defaults to true. */
  readonly isVisible?: boolean;
  /** "shell" for an interactive conversation shell; "command" for a service-launched one-shot command such as sign-in. */
  readonly mode: "command" | "shell";
  readonly onClose: () => void;
  readonly onExit?: (exitCode: number | null) => void;
  readonly onReady?: () => void;
  /** When provided, shows a Hide/Show toggle in the header that keeps the PTY mounted while collapsed. */
  readonly onToggleVisible?: () => void;
  readonly panelRef?: Ref<TerminalPanelHandle>;
  readonly terminalId: string;
  readonly title: string;
};

/**
 * Single inline terminal card shared by conversation shells and launched commands (such as provider sign-in).
 * Renders the header, status, close/collapse actions, xterm surface, and a live bottom drag-to-resize handle.
 */
export function InlineTerminal({
  client,
  closeLabel,
  cwd = null,
  defaultHeight,
  isVisible = true,
  mode,
  onClose,
  onExit,
  onReady,
  onToggleVisible,
  panelRef,
  terminalId,
  title,
}: InlineTerminalProps) {
  const isRemote = useIsRemoteHost();
  const scope: TerminalScope = isRemote ? "remote" : "host";
  const initialHeight = defaultHeight ?? (mode === "command" ? defaultCommandHeight : defaultShellHeight);
  const [height, setHeight] = useState(initialHeight);
  const [error, setError] = useState<string | null>(null);
  const [commandStatus, setCommandStatus] = useState<
    { readonly _tag: "Running" } | { readonly _tag: "Exited"; readonly exitCode: number | null }
  >({ _tag: "Running" });
  const dragStart = useRef(height);
  const latestHeight = useRef(height);
  latestHeight.current = height;
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStart.current = latestHeight.current;
        // Prevent accidental text selection while dragging the resize handle.
        if (typeof document !== "undefined") document.body.style.userSelect = "none";
      },
      onPanResponderMove: (_, gesture) => setHeight(clampTerminalHeight(dragStart.current + gesture.dy)),
      onPanResponderRelease: () => {
        if (typeof document !== "undefined") document.body.style.userSelect = "";
      },
      onPanResponderTerminate: () => {
        if (typeof document !== "undefined") document.body.style.userSelect = "";
      },
      onStartShouldSetPanResponder: () => true,
    }),
  ).current;
  const close = () => {
    void client.request({ _tag: "CloseTerminal", id: terminalId }).then(
      () => {
        setError(null);
        onClose();
      },
      (reason) => {
        setError(messageOf(reason));
        if (mode === "command") onClose();
      },
    );
  };
  const handleExit = (exitCode: number | null) => {
    if (mode === "command") setCommandStatus({ _tag: "Exited", exitCode });
    onExit?.(exitCode);
  };
  const isNative = typeof window === "undefined";
  const resolvedCloseLabel = closeLabel ?? (mode === "command" ? "Close" : "Close shell");
  return (
    <View style={local.card}>
      <View style={local.head}>
        <Text style={local.title}>{title}</Text>
        <Text style={[styles.muted, styles.flex]}>
          {mode === "command" ? commandTerminalStatusOf(commandStatus) : ""}
        </Text>
        {onToggleVisible !== undefined && (
          <Pressable accessibilityRole="button" onPress={onToggleVisible}>
            <Text style={styles.link}>{isVisible ? "Hide" : "Show"}</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={close}>
          <Text style={styles.link}>{resolvedCloseLabel}</Text>
        </Pressable>
      </View>
      {error !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {isNative ? (
        <Text style={styles.muted}>Interactive terminals are available in the desktop or web app.</Text>
      ) : (
        <View style={{ display: isVisible ? "flex" : "none" }}>
          <TerminalPanel
            client={client}
            cwd={cwd}
            height={height}
            hideExitBar={mode === "command"}
            id={terminalId}
            key={terminalId}
            onExit={handleExit}
            onReady={() => onReady?.()}
            ref={panelRef}
            scope={scope}
          />
          <View
            accessibilityLabel={`Resize ${title} terminal`}
            {...responder.panHandlers}
            style={[local.handle, resizeCursor]}
          >
            <View style={local.grip} />
          </View>
        </View>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  card: { ...outline, ...round, backgroundColor: colors.surface, flex: 1, gap: 8, padding: 10 },
  grip: { backgroundColor: colors.edge, borderRadius: radii.pill, height: 3, width: 36 },
  handle: { alignItems: "center", justifyContent: "center", marginBottom: -4, paddingVertical: 4 },
  head: { alignItems: "center", flexDirection: "row", gap: 10 },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "700" },
});

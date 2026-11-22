import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { useIsRemoteHost } from "../foundation/hostContext";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { TerminalPanel } from "./terminalPanel";
import type { TerminalPanelHandle } from "./terminalPanelTypes";
import { bareTerminalIdOf, isTerminalAvailable, type TerminalScope } from "./terminalScope";
import { messageWithTerminal } from "./terminalSnapshot";

/** Attaches the owner's shell transcript to messages from either kind of conversation. */
export function useTerminal(client: ServiceClient, id: string, cwd: string | null) {
  const [hasTerminal, setHasTerminal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<TerminalPanelHandle>(null);
  const isRemote = useIsRemoteHost();
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  // The native app has no shell surface yet (mobile terminals stay in the backlog); a paired device's screens open
  // one only while the host's "Allow terminals from paired devices" switch is on (conversation-terminal, ADR 0020).
  const isAvailable = isTerminalAvailable(
    { isNativeApp: typeof window === "undefined", isRemoteHost: isRemote },
    settings,
  );
  const scope: TerminalScope = isRemote ? "remote" : "host";
  const sessionId = bareTerminalIdOf(id, cwd);
  const open = () => {
    setHasTerminal(true);
    setIsVisible(true);
    requestAnimationFrame(() => panel.current?.focus());
  };
  const close = () => {
    void client
      .request({ _tag: "CloseTerminal", id: sessionId })
      .then(() => {
        setHasTerminal(false);
        setIsVisible(false);
        setIsReady(false);
        setError(null);
      })
      .catch((reason) => setError(messageOf(reason)));
  };
  return {
    hasContent: hasTerminal && isReady,
    onBang: isAvailable ? open : null,
    panel: !hasTerminal ? null : (
      <View style={[styles.messageRow, styles.messageRowUser, { width: "88%" }]}>
        <View style={[styles.messageCard, styles.messageCardUser, { flex: 1, gap: 4, padding: 8 }]}>
          <View style={styles.row}>
            <Text style={[styles.muted, styles.flex, { color: colors.textSecondary }]}>Terminal</Text>
            <Pressable onPress={isVisible ? () => setIsVisible(false) : open}>
              <Text style={[styles.link, { color: colors.textSecondary }]}>{isVisible ? "Hide" : "Show"}</Text>
            </Pressable>
            <Pressable onPress={close}>
              <Text style={[styles.link, { color: colors.textSecondary }]}>Close shell</Text>
            </Pressable>
          </View>
          {error !== null && <Text style={styles.error}>{error}</Text>}
          <View style={{ display: isVisible ? "flex" : "none" }}>
            <TerminalPanel
              client={client}
              cwd={cwd}
              id={sessionId}
              key={sessionId}
              onReady={() => setIsReady(true)}
              ref={panel}
              scope={scope}
            />
          </View>
        </View>
      </View>
    ),
    prepare: async (text: string) => {
      if (!hasTerminal) return text;
      if (panel.current === null) throw new Error("The terminal is not ready.");
      const snapshot = await panel.current.snapshot();
      return messageWithTerminal(text, snapshot.cwd, snapshot.text);
    },
    sent: () => {
      setHasTerminal(false);
      setIsVisible(false);
      setIsReady(false);
    },
  };
}

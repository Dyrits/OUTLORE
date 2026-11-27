import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { useIsRemoteHost } from "../foundation/hostContext";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { InlineTerminal } from "./inlineTerminal";
import type { TerminalPanelHandle } from "./terminalPanelTypes";
import { bareTerminalIdOf, isTerminalAvailable, terminalCommandInputOf } from "./terminalScope";
import { messageWithTerminal } from "./terminalSnapshot";

/** Attaches the owner's shell transcript to messages from either kind of conversation. */
export function useTerminal(client: ServiceClient, id: string, cwd: string | null) {
  const [hasTerminal, setHasTerminal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const panel = useRef<TerminalPanelHandle>(null);
  const queuedInput = useRef<string | null>(null);
  const isRemote = useIsRemoteHost();
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  // The native app has no shell surface yet (mobile terminals stay in the backlog); a paired device's screens open one only while the host's "Allow terminals from paired devices" switch is on (conversation-terminal, ADR 0020).
  const isAvailable = isTerminalAvailable(
    { isNativeApp: typeof window === "undefined", isRemoteHost: isRemote },
    settings,
  );
  const sessionId = bareTerminalIdOf(id, cwd);
  const focusPanel = useCallback(() => requestAnimationFrame(() => panel.current?.focus()), []);
  const dispatchToPanel = useCallback(
    (input: string) => {
      panel.current?.run(input);
      focusPanel();
    },
    [focusPanel],
  );
  const open = () => {
    setHasTerminal(true);
    setIsVisible(true);
    focusPanel();
  };
  const run = (command: string) => {
    const input = terminalCommandInputOf(command);
    if (hasTerminal && panel.current !== null) {
      setIsVisible(true);
      dispatchToPanel(input);
      return;
    }
    queuedInput.current = input;
    setHasTerminal(true);
    setIsVisible(true);
  };
  useEffect(() => {
    if (!hasTerminal || queuedInput.current === null || panel.current === null) return;
    const input = queuedInput.current;
    queuedInput.current = null;
    dispatchToPanel(input);
  }, [dispatchToPanel, hasTerminal]);
  const reset = () => {
    queuedInput.current = null;
    setHasTerminal(false);
    setIsVisible(false);
    setIsReady(false);
  };
  return {
    hasContent: hasTerminal && isReady,
    onBang: isAvailable ? open : null,
    panel: !hasTerminal ? null : (
      <View style={[styles.messageRow, styles.messageRowUser, { width: "100%" }]}>
        <InlineTerminal
          client={client}
          cwd={cwd}
          isVisible={isVisible}
          mode="shell"
          onClose={reset}
          onReady={() => setIsReady(true)}
          onToggleVisible={() => (isVisible ? setIsVisible(false) : open())}
          panelRef={panel}
          terminalId={sessionId}
          title="Terminal"
        />
      </View>
    ),
    prepare: async (text: string) => {
      if (!hasTerminal) return text;
      if (panel.current === null) throw new Error("The terminal is not ready.");
      const snapshot = await panel.current.snapshot();
      return messageWithTerminal(text, snapshot.cwd, snapshot.text);
    },
    run: isAvailable ? run : null,
    sent: reset,
  };
}

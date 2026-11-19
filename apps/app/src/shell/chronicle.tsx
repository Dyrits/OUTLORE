import { createContext, type ReactNode, useContext, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { colors } from "../foundation/theme";
import { EdgeResizer } from "./edgeResizer";
import { PaneButton, PaneStrip } from "./paneStrip";
import { chroniclerWidthKey, clampPaneWidth, readPaneWidth, rememberPaneWidth } from "./railStorage";

// The Chronicle is Chronicler's permanent conversation, the first pane of the window (CHG-0564). The frame owns it, since it
// stays through every screen; beside a quest the pane chain holds it as its first slot, and beside any other screen
// `ChronicleBeside` does.

/** The id of the Chronicle among the panes of a chain: no thread has it, so a chain can hold it as its first slot. */
export const chronicleId = "chronicle" as const;

/** How wide the Chronicle is as it opens beside a screen, and the least the owner can drag it to. */
export const chronicleWidth = 380;

/**
 * Whether the Chronicle shows and how to fold or unfold it, as the frame offers it to the panes. The value changes only
 * when the Chronicle is folded or unfolded: the frame draws again whenever a pane hands it a panel, and a pane host that
 * read anything newer on each of those would draw its panes again each time, and so loop.
 */
export type Chronicle = { isOpen: boolean; setOpen: (isOpen: boolean) => void };

export const ChronicleContext = createContext<Chronicle | null>(null);

/** How the conversation is drawn, with `chrome` (fold) among the buttons of its header; read only by the pane that draws it. */
export const ChronicleView = createContext<(chrome: ReactNode) => ReactNode>(() => null);

/** The Chronicle's conversation, in whatever pane holds it. */
export function ChroniclePane({ chrome }: { chrome: ReactNode }) {
  return useContext(ChronicleView)(chrome);
}

/**
 * The Chronicle beside a screen that is not a quest, at the window's left of the content, as wide as the owner dragged it,
 * or a strip when folded. `isShown` is false where the screen takes the whole content area (the Workshop); the screen
 * stays in the same place of the tree either way, so showing or hiding the Chronicle does not restart it.
 */
export function ChronicleBeside({
  chronicle,
  children,
  isShown,
}: {
  chronicle: Chronicle | null;
  children: ReactNode;
  isShown: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [stored, setStored] = useState(() => readPaneWidth(chroniclerWidthKey, chronicleWidth));
  const width = clampPaneWidth(stored, windowWidth, chronicleWidth);
  const pane =
    chronicle === null || !isShown ? null : chronicle.isOpen ? (
      <View accessibilityLabel="Chronicle" style={[local.pane, { width }]}>
        <ChroniclePane
          chrome={<PaneButton glyph="‹" label="Fold the Chronicle" onPress={() => chronicle.setOpen(false)} />}
        />
        <EdgeResizer
          label="Resize the Chronicle"
          leastWidth={chronicleWidth}
          onChange={setStored}
          onRelease={(next) => rememberPaneWidth(chroniclerWidthKey, next)}
          side="end"
          width={width}
          windowWidth={windowWidth}
        />
      </View>
    ) : (
      <PaneStrip onReveal={() => chronicle.setOpen(true)} state="Idle" title="Chronicle" />
    );
  return (
    <View style={local.row}>
      {pane}
      <View style={local.content}>{children}</View>
    </View>
  );
}

const local = StyleSheet.create({
  content: { flex: 1 },
  pane: { backgroundColor: colors.page },
  row: { flex: 1, flexDirection: "row" },
});

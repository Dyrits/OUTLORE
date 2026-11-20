import { useRef } from "react";
import { PanResponder, StyleSheet, View } from "react-native";

// The pointer shows it can be dragged sideways.
const resizeCursor = { cursor: "col-resize" } as object;

/**
 * The strip on the edge between two open panes that the owner drags to move room from one to the other. It reports how
 * far the drag has gone from where it started; the caller works out the shares from the widths it had then.
 */
export function PaneResizer({
  label,
  left,
  onDrag,
  onEnd,
  onStart,
}: {
  label: string;
  /** Where the edge is, in pixels from the row's left: the strip is drawn on the row, above the panes, not inside one. */
  left: number;
  /** Called as the pointer moves, with the pixels dragged since the start, to the right positive. */
  onDrag: (dx: number) => void;
  /** Called when the drag ends, to remember what it made. */
  onEnd: () => void;
  /** Called when a drag begins, to take the widths it moves from. */
  onStart: () => void;
}) {
  const latest = useRef({ onDrag, onEnd, onStart });
  latest.current = { onDrag, onEnd, onStart };
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        latest.current.onStart();
        // No text is picked up by the pointer while the pane is dragged.
        if (typeof document !== "undefined") document.body.style.userSelect = "none";
      },
      onPanResponderMove: (_, gesture) => latest.current.onDrag(gesture.dx),
      onPanResponderRelease: () => {
        if (typeof document !== "undefined") document.body.style.userSelect = "";
        latest.current.onEnd();
      },
      onPanResponderTerminate: () => {
        if (typeof document !== "undefined") document.body.style.userSelect = "";
      },
      onStartShouldSetPanResponder: () => true,
    }),
  ).current;
  return (
    <View
      accessibilityLabel={label}
      {...responder.panHandlers}
      style={[local.resizer, { left: left - 4 }, resizeCursor]}
    />
  );
}

const local = StyleSheet.create({
  resizer: { bottom: 0, position: "absolute", top: 0, width: 8, zIndex: 3 },
});

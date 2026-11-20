import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { countedOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import type { CommentableProps } from "./commentable";
import { excerptOf, selectionQuoteOf } from "./comments";
import { CommentBox } from "./commentViews";
import { useReplies } from "./replies";
import { useComments } from "./useComments";

// The same column a React Native view is on the web, so wrapping a card in a plain element changes no layout.
const column = {
  alignItems: "stretch",
  display: "flex",
  flexDirection: "column",
  flexShrink: 1,
  minWidth: 0,
  position: "relative",
} as const;

const buttonLook = {
  background: colors.control,
  border: `1px solid ${colors.edge}`,
  borderRadius: radii.md,
  color: colors.text,
  cursor: "pointer",
  fontFamily: fonts.sans,
  fontSize: fontSizes.sm,
  fontWeight: 600,
  padding: "2px 8px",
  position: "absolute",
  zIndex: 2,
} as const;

// Plain elements hold their words as values: the React Native rules refuse text written inside a tag.
const labels = { message: "Comment", reply: "Reply", selection: "Comment on selection" } as const;

/** A passage the owner selected inside the card, and where its button goes, measured from the card's corner. */
type Selected = { left: number; quote: string; top: number };

/**
 * A message's card that can be commented on and replied to: buttons on its corner while the pointer is on it or it has
 * focus — Comment where comments are offered, Reply where a Reply starts something (a quest in the Chronicle, an errand
 * in a quest) — and a button beside any passage the owner selects in it. A comment opens a small field under the card;
 * a Reply opens the reply composer in place of the message box. Without either, the card is drawn as it is.
 */
export function Commentable({ about, children, messageId, text }: CommentableProps) {
  const comments = useComments();
  const replies = useReplies();
  const container = useRef<HTMLDivElement>(null);
  const [isShown, setIsShown] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [writing, setWriting] = useState<{ isSelection: boolean; quote: string } | null>(null);
  const hasSelection = selected !== null;
  useEffect(() => {
    if (!hasSelection) return;
    // The button follows the selection away: once nothing is selected, there is no passage to comment on.
    const onChange = () => {
      if (window.getSelection()?.isCollapsed === true) setSelected(null);
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, [hasSelection]);
  if (comments === null && replies === null) return <>{children}</>;
  const waiting = comments?.countOf(messageId) ?? 0;
  const readSelection = () => {
    const selection = window.getSelection();
    const card = container.current;
    if (selection === null || card === null || selection.isCollapsed || selection.rangeCount === 0) return;
    // A selection that began or ended outside this card is another card's, or a mix of several.
    if (!card.contains(selection.anchorNode) || !card.contains(selection.focusNode)) return;
    const quote = selectionQuoteOf(selection.toString());
    if (quote === "") return;
    const range = selection.getRangeAt(0).getBoundingClientRect();
    const box = card.getBoundingClientRect();
    setSelected({ left: Math.max(0, range.left - box.left), quote, top: range.bottom - box.top + 6 });
  };
  const open = (isSelection: boolean, quote: string) => {
    setWriting({ isSelection, quote });
    setSelected(null);
    window.getSelection()?.removeAllRanges();
  };
  const isCornerShown = isShown && writing === null;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hovering and selecting have no semantic element; the buttons inside are the way to comment, with the keyboard too.
    <div
      onBlur={() => setIsShown(false)}
      onFocus={() => setIsShown(true)}
      onMouseEnter={() => setIsShown(true)}
      onMouseLeave={() => setIsShown(false)}
      onMouseUp={readSelection}
      ref={container}
      style={column}
    >
      {children}
      {/* The corner holds both buttons in a row, so Reply stands beside Comment where both are offered. */}
      {(comments !== null || replies !== null) && (
        <div
          style={{
            ...buttonLook,
            background: colors.control,
            display: "flex",
            gap: 6,
            opacity: isCornerShown ? 1 : 0,
            // Unseen, it must not catch the pointer: it hangs over the neighbouring card's edge.
            pointerEvents: isCornerShown ? "auto" : "none",
            right: 10,
            top: -12,
          }}
        >
          {replies !== null && (
            <button
              aria-label="Reply to this message"
              onClick={() => replies.start({ id: messageId, text })}
              style={{ ...buttonLook, background: "transparent", border: "none", padding: 0, position: "static" }}
              type="button"
            >
              {labels.reply}
            </button>
          )}
          {comments !== null && (
            <button
              aria-label="Comment on this message"
              onClick={() => open(false, excerptOf(text))}
              style={{ ...buttonLook, background: "transparent", border: "none", padding: 0, position: "static" }}
              type="button"
            >
              {labels.message}
            </button>
          )}
        </div>
      )}
      {selected !== null && (
        <button
          // The selection must outlive the press, so the pointer going down on the button does not clear it.
          onClick={() => open(true, selected.quote)}
          onMouseDown={(event) => event.preventDefault()}
          style={{ ...buttonLook, left: selected.left, top: selected.top, zIndex: 3 }}
          type="button"
        >
          {labels.selection}
        </button>
      )}
      {writing !== null && (
        <CommentBox
          onCancel={() => setWriting(null)}
          onSave={(note) => {
            comments?.add({ about, isSelection: writing.isSelection, messageId, note, quote: writing.quote });
            setWriting(null);
          }}
          quote={writing.quote}
          saveLabel="Add comment"
        />
      )}
      {waiting > 0 && <Text style={styles.link}>{countedOf(waiting, "comment")} waiting</Text>}
    </div>
  );
}

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { spacedTranscriptOf } from "../dictation/dictation";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { bulkPasteLength, insertBulkText } from "./bulkPaste";
import { chipElementOf, textAroundOf, textOf, triggerBeforeCaret } from "./chipEditorDom";
import type { ChipEditorProps } from "./chipEditorTypes";

// The message box's text field on the web: an editable element where a chosen skill or path is a chip inside the text, as in OpenBot.
// The message is read back as plain text, each chip as its token; the element's content is kept by hand, never by React.

/** The message field of the web app: text and chips in one editable line, reporting its trigger at the caret. */
export function ChipEditor({
  initialText = "",
  onChange,
  onFiles,
  onKeyDown,
  onBang,
  placeholder,
  ref,
}: ChipEditorProps) {
  const root = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(initialText === "");
  // The trigger as last read, kept because choosing from the list takes the focus and the caret with it.
  const triggered = useRef<ReturnType<typeof triggerBeforeCaret>>(null);
  // The caret as last placed in the field, kept because pressing the microphone takes the focus and the caret with it.
  const caret = useRef<Range | null>(null);
  const handlers = useRef({ onChange, onFiles, onKeyDown });
  handlers.current = { onChange, onFiles, onKeyDown };

  const report = () => {
    const element = root.current;
    if (element === null) return;
    triggered.current = triggerBeforeCaret(element);
    const selection = window.getSelection();
    if (selection !== null && selection.rangeCount > 0 && element.contains(selection.anchorNode))
      caret.current = selection.getRangeAt(0).cloneRange();
    const text = textOf(element);
    setIsEmpty(text === "" && element.querySelector("[data-token]") === null);
    handlers.current.onChange(text, triggered.current?.trigger ?? null);
  };

  useImperativeHandle(ref, () => ({
    clear: () => {
      if (root.current !== null) root.current.textContent = "";
      report();
    },
    insertChip: (chip) => {
      const element = root.current;
      const at = triggered.current;
      if (element === null || at === null || !element.contains(at.node)) return;
      const range = document.createRange();
      range.setStart(at.node, at.start);
      range.setEnd(at.node, at.end);
      range.deleteContents();
      const after = document.createTextNode(" ");
      range.insertNode(after);
      range.insertNode(chipElementOf(chip));
      element.focus();
      const caret = document.createRange();
      caret.setStart(after, 1);
      caret.collapse(true);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(caret);
      report();
    },
    insertText: (spoken) => {
      const element = root.current;
      if (element === null) return;
      element.focus();
      const kept = caret.current;
      // Where the caret was when the field last had it; at the end when it never had one or the text under it is gone.
      const range = kept !== null && element.contains(kept.startContainer) ? kept : document.createRange();
      if (range !== kept) {
        range.selectNodeContents(element);
        range.collapse(false);
      }
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      const { after, before } = textAroundOf(element, range);
      // The browser's own insertion, so the owner can undo it like typing.
      document.execCommand("insertText", false, spacedTranscriptOf(before, after, spoken));
      report();
    },
  }));

  // The content is kept by hand, so what was left unsent goes in as the field opens (the composer fixes it for the field's life).
  useEffect(() => {
    if (initialText !== "" && root.current !== null) root.current.textContent = initialText;
  }, [initialText]);

  // Moving the caret with the keys or the mouse changes the trigger without changing the text.
  useEffect(() => {
    const element = root.current;
    if (element === null) return;
    const follow = () => {
      if (document.activeElement === element) report();
    };
    document.addEventListener("selectionchange", follow);
    return () => document.removeEventListener("selectionchange", follow);
  });

  return (
    <div style={{ position: "relative" }}>
      {isEmpty && (
        <div
          style={{
            color: colors.placeholder,
            fontFamily: fonts.sans,
            fontSize: fontSizes.base,
            left: 8,
            lineHeight: "20px",
            pointerEvents: "none",
            position: "absolute",
            top: 6,
          }}
        >
          {placeholder}
        </div>
      )}
      {/* biome-ignore lint/a11y/useSemanticElements: a textarea cannot hold chips inside its text. */}
      <div
        aria-multiline="true"
        contentEditable
        onDragOver={(event) => {
          if (handlers.current.onFiles !== undefined && event.dataTransfer.types.includes("Files"))
            event.preventDefault();
        }}
        onDrop={(event) => {
          const files = Array.from(event.dataTransfer.files);
          if (handlers.current.onFiles === undefined || files.length === 0) return;
          event.preventDefault();
          handlers.current.onFiles(files);
        }}
        onInput={report}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (
            event.key === "!" &&
            !event.altKey &&
            !event.metaKey &&
            !event.ctrlKey &&
            onBang !== undefined &&
            root.current !== null
          ) {
            const selection = window.getSelection();
            if (
              selection !== null &&
              selection.anchorNode !== null &&
              selection.isCollapsed &&
              selection.rangeCount > 0 &&
              root.current.contains(selection.anchorNode)
            ) {
              const range = selection.getRangeAt(0).cloneRange();
              range.selectNodeContents(root.current);
              range.setEnd(selection.anchorNode, selection.anchorOffset);
              const before = textOf(range.cloneContents(), true);
              range.selectNodeContents(root.current);
              range.setStart(selection.anchorNode, selection.anchorOffset);
              const after = textOf(range.cloneContents(), true);
              if (before.split("\n").at(-1) === "" && after.split("\n")[0] === "") {
                event.preventDefault();
                onBang();
                return;
              }
            }
          }
          if (handlers.current.onKeyDown({ key: event.key, shiftKey: event.shiftKey })) {
            event.preventDefault();
          } else if (event.key === "Enter" && event.shiftKey) {
            event.preventDefault();
            document.execCommand("insertLineBreak");
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          const files = Array.from(event.clipboardData.files);
          // A copied image comes with no text; a copied table or web page comes with both, and stays text.
          if (text === "" && files.length > 0 && handlers.current.onFiles !== undefined) {
            handlers.current.onFiles(files);
          } else if (text.length > bulkPasteLength && root.current !== null) {
            insertBulkText(root.current, text);
            report();
          } else {
            document.execCommand("insertText", false, text);
          }
        }}
        ref={root}
        role="textbox"
        style={{
          boxSizing: "border-box",
          color: colors.text,
          fontFamily: fonts.sans,
          fontSize: fontSizes.base,
          lineHeight: "20px",
          maxHeight: 200,
          minHeight: 32,
          outline: "none",
          overflowWrap: "anywhere",
          overflowY: "auto",
          padding: "6px 8px",
          whiteSpace: "pre-wrap",
        }}
        suppressContentEditableWarning
        tabIndex={0}
      />
    </div>
  );
}

import { colors, radii } from "../foundation/theme";
import type { Chip, Trigger } from "./chipEditorTypes";
import { chipIcons } from "./chips";

// The web message field's document work, apart from the component: chips as elements, the field's text read back,
// and what is typed before the caret. Imported only by the web field, as it needs a document.

const SVG = "http://www.w3.org/2000/svg";

/** The chip as it sits in the text: not editable, so the caret moves across it and Backspace removes it whole. */
export const chipElementOf = (chip: Chip) => {
  const element = document.createElement("span");
  element.contentEditable = "false";
  element.dataset.token = chip.token;
  Object.assign(element.style, {
    alignItems: "center",
    background: colors.accentSoft,
    borderRadius: `${radii.sm}px`,
    color: colors.accentText,
    display: "inline-flex",
    gap: "4px",
    height: "18px",
    lineHeight: "18px",
    margin: "0 1px",
    padding: "0 5px",
    verticalAlign: "middle",
  });
  const { paths, viewBox } = chipIcons[chip.kind];
  const icon = document.createElementNS(SVG, "svg");
  for (const [name, value] of Object.entries({
    fill: "none",
    height: "12",
    stroke: colors.accentText,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "stroke-width": "1.5",
    viewBox,
    width: "12",
  })) {
    icon.setAttribute(name, value);
  }
  for (const path of paths) {
    const element = document.createElementNS(SVG, "path");
    element.setAttribute("d", path);
    icon.appendChild(element);
  }
  const label = document.createElement("span");
  label.textContent = chip.label;
  element.append(icon, label);
  return element;
};

/** The message as plain text: chips as their tokens, kept apart from the words around them by a space. */
export const textOf = (root: Node, shouldKeepLastBreak = false): string => {
  let text = "";
  const add = (piece: string) => {
    text += piece;
  };
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child instanceof HTMLElement && child.dataset.token !== undefined) {
        add(`${text === "" || /\s$/.test(text) ? "" : " "}${child.dataset.token}`);
        const next = child.nextSibling?.textContent ?? "";
        if (next !== "" && !/^\s/.test(next)) add(" ");
      } else if (child instanceof HTMLBRElement) {
        // The last break of a block only holds the line open, as the browser leaves one after a deletion.
        if (child.nextSibling !== null || shouldKeepLastBreak) add("\n");
      } else if (child instanceof HTMLElement) {
        if (text !== "" && !text.endsWith("\n")) add("\n");
        walk(child);
      } else {
        add((child.textContent ?? "").replace(/ /g, " "));
      }
    }
  };
  walk(root);
  return text;
};

/** What is typed just before the caret that a list can complete: where it is, and the trigger it reads as. */
export const triggerBeforeCaret = (root: HTMLElement) => {
  const selection = window.getSelection();
  const node = selection?.anchorNode;
  if (selection === null || !selection.isCollapsed || node?.nodeType !== Node.TEXT_NODE || !root.contains(node))
    return null;
  const before = (node.textContent ?? "").slice(0, selection.anchorOffset);
  const match = /(^|\s)([/@])(\S*)$/.exec(before);
  if (match === null) return null;
  const query = match[3] ?? "";
  const trigger: Trigger = { character: match[2] === "@" ? "@" : "/", query };
  return { end: selection.anchorOffset, node, start: before.length - query.length - 1, trigger };
};

/** The field's text on each side of a caret placed in it, chips as their tokens. */
export const textAroundOf = (root: HTMLElement, caret: Range) => {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(caret.startContainer, caret.startOffset);
  const before = textOf(range.cloneContents(), true);
  range.selectNodeContents(root);
  range.setStart(caret.endContainer, caret.endOffset);
  return { after: textOf(range.cloneContents(), true), before };
};

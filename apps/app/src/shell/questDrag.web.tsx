import { type DragEvent, useState } from "react";
import { colors, radii } from "../foundation/theme";
import {
  type DragSourceProps,
  type DropTargetProps,
  questDragType,
  type RealmDragSourceProps,
  realmDragType,
} from "./questDragTypes";

// The same column a React Native view is on the web, so wrapping rows in a plain element changes no layout.
const column = {
  alignItems: "stretch",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  position: "relative",
} as const;

/** A quest row the owner can pick up and drop on a realm or the Borderlands. */
export function DragSource({ children, missionId }: DragSourceProps) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drag has no semantic element; the row inside stays a button.
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(questDragType, missionId);
        event.dataTransfer.effectAllowed = "move";
      }}
      style={column}
    >
      {children}
    </div>
  );
}

/** A realm's heading the owner can pick up and drop on another realm to put it in that place. */
export function RealmDragSource({ children, realmId }: RealmDragSourceProps) {
  const [isDragged, setIsDragged] = useState(false);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drag has no semantic element; the heading inside stays a button.
    <div
      draggable
      onDragEnd={() => setIsDragged(false)}
      onDragStart={(event) => {
        event.dataTransfer.setData(realmDragType, realmId);
        event.dataTransfer.effectAllowed = "move";
        setIsDragged(true);
      }}
      style={{ ...column, opacity: isDragged ? 0.45 : 1 }}
    >
      {children}
    </div>
  );
}

/**
 * A realm or the Borderlands, ringed while a quest is dragged over it and calling `onDropQuest` when one is dropped.
 * A realm also hears another realm dropped on it, through `onDropRealm`; a dragged realm is shown differently from a
 * dragged quest: not a ring around the place, but a line at its top or bottom edge, where the realm would land.
 */
export function DropTarget({ children, onDropQuest, onDropRealm }: DropTargetProps) {
  const [over, setOver] = useState<"quest" | "before" | "after" | null>(null);
  const sideOf = (event: DragEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return event.clientY < box.top + box.height / 2 ? "before" : "after";
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drop place has no semantic element; its rows stay buttons.
    <div
      onDragLeave={(event) => {
        // Moving between this place's own rows is not leaving it.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null);
      }}
      onDragOver={(event) => {
        const isRealm = event.dataTransfer.types.includes(realmDragType);
        if (isRealm && onDropRealm !== undefined) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setOver(sideOf(event));
          return;
        }
        if (!event.dataTransfer.types.includes(questDragType)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver("quest");
      }}
      onDrop={(event) => {
        setOver(null);
        const realmId = event.dataTransfer.getData(realmDragType);
        if (realmId !== "" && onDropRealm !== undefined) {
          event.preventDefault();
          onDropRealm(realmId, sideOf(event));
          return;
        }
        const missionId = event.dataTransfer.getData(questDragType);
        if (missionId === "") return;
        event.preventDefault();
        onDropQuest(missionId);
      }}
      style={{
        ...column,
        borderRadius: radii.md,
        boxShadow: over === "quest" ? `inset 0 0 0 1px ${colors.accent}` : "none",
      }}
    >
      {children}
      {(over === "before" || over === "after") && (
        <div
          style={{
            backgroundColor: colors.accent,
            borderRadius: 1,
            height: 2,
            left: 0,
            pointerEvents: "none",
            position: "absolute",
            right: 0,
            [over === "before" ? "top" : "bottom"]: -1,
          }}
        />
      )}
    </div>
  );
}

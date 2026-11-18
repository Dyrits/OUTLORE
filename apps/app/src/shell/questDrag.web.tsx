import { useState } from "react";
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
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drag has no semantic element; the heading inside stays a button.
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(realmDragType, realmId);
        event.dataTransfer.effectAllowed = "move";
      }}
      style={column}
    >
      {children}
    </div>
  );
}

/**
 * A realm or the Borderlands, ringed while a quest is dragged over it and calling `onDropQuest` when one is dropped; a
 * realm also hears another realm dropped on it, through `onDropRealm`.
 */
export function DropTarget({ children, onDropQuest, onDropRealm }: DropTargetProps) {
  const [isOver, setIsOver] = useState(false);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drop place has no semantic element; its rows stay buttons.
    <div
      onDragLeave={(event) => {
        // Moving between this place's own rows is not leaving it.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOver(false);
      }}
      onDragOver={(event) => {
        const isRealm = event.dataTransfer.types.includes(realmDragType);
        if (!event.dataTransfer.types.includes(questDragType) && !(isRealm && onDropRealm !== undefined)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setIsOver(true);
      }}
      onDrop={(event) => {
        setIsOver(false);
        const realmId = event.dataTransfer.getData(realmDragType);
        if (realmId !== "" && onDropRealm !== undefined) {
          event.preventDefault();
          onDropRealm(realmId);
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
        boxShadow: isOver ? `inset 0 0 0 1px ${colors.accent}` : "none",
      }}
    >
      {children}
    </div>
  );
}

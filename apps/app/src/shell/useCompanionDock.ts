import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { CompanionPickerProps } from "../editors/companionPicker";
import type { CompanionDock } from "../foundation/shellContext";
import type { RightPanel } from "../foundation/useRightPanel";
import { createCompanionRegistry } from "./companionRegistry";

/** Binds the plain picker registry to the window's panel and React redraws. */
export function useCompanionDock(panel: RightPanel, isChroniclerFull: boolean, isChroniclerOpen: boolean) {
  const [registry] = useState(createCompanionRegistry);
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  const selected = registry.selected(panel.content, isChroniclerFull, isChroniclerOpen);
  const latest = useRef({ ...selected, panel });
  latest.current = { ...selected, panel };
  const dock = useMemo(() => {
    const choose = (id: string) => {
      const content = registry.choose(id);
      if (content !== null) latest.current.panel.show(content);
    };
    return {
      choose,
      open: (id: string) => {
        if (latest.current.isCompanionShown && latest.current.pillId === id) latest.current.panel.show(null);
        else choose(id);
      },
      publish: (id: string, picker: CompanionPickerProps, rank: number) => {
        if (registry.publish(id, picker, rank)) redraw();
      },
      register: registry.register,
      unregister: (id: string) => {
        registry.unregister(id);
        const selection = latest.current.panel.content;
        if (selection?.tab === "companion" && selection.id === id && !selection.isChronicler)
          latest.current.panel.show(null);
        redraw();
      },
    } satisfies CompanionDock & { choose: (id: string) => void };
  }, [registry]);
  const content = panel.content;
  useEffect(() => {
    if (!isChroniclerOpen && content?.tab === "companion" && content.isChronicler) panel.show(null);
  }, [isChroniclerOpen, content, panel.show]);
  return { ...selected, dock };
}

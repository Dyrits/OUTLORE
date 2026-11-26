import { createContext, useContext } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollViewProps } from "react-native";

/**
 * What the narrow window's floating pill asks of a screen that scrolls beneath it (CHG-0760): `clearance` is the room
 * the foot of its content keeps so the last row stays reachable, and `report` hears where the screen is scrolled to,
 * so the pill can shrink to a circle while the owner scrolls down.
 */
export type PillScrollContract = { clearance: number; report: (offset: number) => void };

export const PillScrollContext = createContext<PillScrollContract | null>(null);

const none: {
  contentStyle: { paddingBottom?: number } | undefined;
  scrollProps: Pick<ScrollViewProps, "onScroll" | "scrollEventThrottle">;
} = {
  contentStyle: undefined,
  scrollProps: {},
};

/**
 * The properties a scrolling screen adds to its ScrollView to work with the pill: spread `scrollProps` onto it and add
 * `contentStyle` to its content container. Outside the narrow window both are empty.
 */
export function usePillScroll() {
  const pill = useContext(PillScrollContext);
  if (pill === null) return none;
  return {
    contentStyle: { paddingBottom: pill.clearance },
    scrollProps: {
      onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => pill.report(event.nativeEvent.contentOffset.y),
      scrollEventThrottle: 16,
    } satisfies Pick<ScrollViewProps, "onScroll" | "scrollEventThrottle">,
  };
}

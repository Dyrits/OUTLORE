import Svg, { Path, Rect } from "react-native-svg";
import { colors } from "../foundation/theme";

/** The stop icon: a filled square, in the same ink as the send arrow. */
export function StopSquare() {
  return (
    <Svg fill={colors.onAccent} height={16} viewBox="0 0 16 16" width={16}>
      <Rect height={9} rx={1.5} width={9} x={3.5} y={3.5} />
    </Svg>
  );
}

/** The send icon: an arrow drawn in paper ink, pointing up and away from the box. */
export function SendArrow() {
  return (
    <Svg
      fill="none"
      height={16}
      stroke={colors.onAccent}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 16 16"
      width={16}
    >
      <Path d="M8 13.5 L 8.2 3" />
      <Path d="M3.5 7.2 L 8.2 2.6 L 12.6 7" />
    </Svg>
  );
}

/** The branch that marks an errand, drawn on a 20 by 20 grid. */
export const errandIconPath = "M5 3v14M5 7h5a5 5 0 0 0 5-5M12 3l3-1 1 3";

/** The errand icon in dim ink. */
export function SideQuestBranch() {
  return (
    <Svg
      fill="none"
      height={18}
      stroke={colors.textDim}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 20 20"
      width={18}
    >
      <Path d={errandIconPath} />
    </Svg>
  );
}

/** The Steer icon: an arrow bending into the line it joins, the running turn. */
export function SteerIcon({ tint }: { tint: string }) {
  return (
    <Svg
      fill="none"
      height={14}
      stroke={tint}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 16 16"
      width={14}
    >
      <Path d="M2.5 13.5 V8 a3 3 0 0 1 3-3 H13" />
      <Path d="M9.5 1.5 L 13.2 5 L 9.5 8.5" />
    </Svg>
  );
}

/** The Interrupt icon: a bar and a triangle, skipping the running turn to the queued message. */
export function InterruptIcon({ tint }: { tint: string }) {
  return (
    <Svg
      fill="none"
      height={14}
      stroke={tint}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 16 16"
      width={14}
    >
      <Path d="M3 3 L 11 8 L 3 13 Z" />
      <Path d="M13.5 3 V13" />
    </Svg>
  );
}

/** A small chevron that points down when expanded and right when collapsed. */
export function ChevronIcon({ isExpanded, tint }: { isExpanded: boolean; tint: string }) {
  return (
    <Svg
      fill="none"
      height={14}
      stroke={tint}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 16 16"
      width={14}
    >
      <Path d={isExpanded ? "M4 6l4 4 4-4" : "M6 4l4 4-4 4"} />
    </Svg>
  );
}

/** Three stacked lines representing queued messages waiting for delivery. */
export function QueueIcon({ tint }: { tint: string }) {
  return (
    <Svg
      fill="none"
      height={14}
      stroke={tint}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 16 16"
      width={14}
    >
      <Path d="M3 4.5h10M3 8h10M3 11.5h6" />
    </Svg>
  );
}

/** A trash can icon for removing a queued message. */
export function TrashIcon({ tint }: { tint: string }) {
  return (
    <Svg
      fill="none"
      height={14}
      stroke={tint}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 16 16"
      width={14}
    >
      <Path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5M7 7v4M9 7v4" />
    </Svg>
  );
}

/** A pencil icon for editing a queued message in place. */
export function EditPencilIcon({ tint }: { tint: string }) {
  return (
    <Svg
      fill="none"
      height={14}
      stroke={tint}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 16 16"
      width={14}
    >
      <Path d="M10.5 3.5l2 2L6 12l-2.8.8L4 10z" />
    </Svg>
  );
}

import Svg, { Circle, Path, Rect } from "react-native-svg";

/** The phone shell's line drawings on a 24 by 24 grid, as the mobile shell page draws them. */
const drawings = {
  archive: <Path d="M4 5h16v4H4zM6 9v10h12V9M10 13h4" />,
  chronicle: <Path d="M5 5h14M5 10h14M5 15h9M5 20h6" />,
  chronicler: <Path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
  gauge: <Path d="M4 17a8 8 0 1116 0M12 17l4-5" />,
  gear: (
    <>
      <Circle cx={12} cy={12} r={3} />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  grid: (
    <>
      <Rect height={7} rx={1.5} width={7} x={4} y={4} />
      <Rect height={7} rx={1.5} width={7} x={13} y={4} />
      <Rect height={7} rx={1.5} width={7} x={4} y={13} />
      <Rect height={7} rx={1.5} width={7} x={13} y={13} />
    </>
  ),
  lore: <Path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11" />,
  quests: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
} as const;

/** The names of the icons the phone shell draws: the three tabs, the Menu's button, and the Menu's places. */
export type PhoneIconName = keyof typeof drawings;

/** One phone shell icon as a stroked line drawing. */
export function PhoneIcon({ color, name, size = 22 }: { color: string; name: PhoneIconName; size?: number }) {
  return (
    <Svg
      fill="none"
      height={size}
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      width={size}
    >
      {drawings[name]}
    </Svg>
  );
}

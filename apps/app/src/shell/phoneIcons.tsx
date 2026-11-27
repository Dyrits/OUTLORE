import Svg, { Circle, G, Path } from "react-native-svg";
import { emblemPaths } from "../foundation/emblems";
import { chipIcons } from "../ui/chips";

/** The quest's sword, the app's own emblem. */
const swordPaths = emblemPaths.sword.map((path) => <Path d={path} key={path} />);

/** The realm's keep, the same drawing the desktop's chips and pane strip give a realm. */
const keepPaths = chipIcons.realm.paths.map((path) => <Path d={path} key={path} />);

/** The phone shell's line drawings on a 24 by 24 grid, as the mobile shell pages draw them. */
const drawings = {
  archive: <Path d="M4 5h16v4H4zM6 9v10h12V9M10 13h4" />,
  chronicle: <Path d="M5 5h14M5 10h14M5 15h9M5 20h6" />,
  errands: (
    <G transform="translate(2 2)">
      <Path d="M5 3v14M5 7h5a5 5 0 0 0 5-5M12 3l3-1 1 3" />
    </G>
  ),
  gauge: <Path d="M4 17a8 8 0 1116 0M12 17l4-5" />,
  gear: (
    <>
      <Circle cx={12} cy={12} r={3} />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  lore: <Path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11" />,
  menu: <Path d="M4 7h16M4 12h16M4 17h16" />,
  realms: keepPaths,
  sword: swordPaths,
  swords: (
    <>
      <G transform="translate(-1 0)">{swordPaths}</G>
      <G transform="matrix(-1 0 0 1 25 0)">{swordPaths}</G>
    </>
  ),
} as const;

/** The names of the icons the phone shell draws: the bar's four tabs, the top bar's menu button, and the side menu's places. */
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

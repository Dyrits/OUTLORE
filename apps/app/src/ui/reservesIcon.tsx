import { Image } from "react-native";
import { colorScheme } from "../foundation/colorScheme";

/** The treasure chest that marked the Reserves place, in the set of each look: ivory on a dark page, slate blue on a light one. */
const sources = {
  dark: require("../../assets/nav/dark/reserves.png"),
  light: require("../../assets/nav/light/reserves.png"),
} as const;

/** The Reserves chest at a square size; decoration, the button around it carries the label. */
export function ReservesIcon({ size = 22 }: { size?: number }) {
  return <Image accessibilityElementsHidden source={sources[colorScheme]} style={{ height: size, width: size }} />;
}

import { StatusBar } from "react-native";
import { colorScheme } from "../foundation/colorScheme";

/** The phone's status bar: dark clock and icons over a light app, light ones over a dark app, as the app's look decides. */
export function AppStatusBar() {
  return <StatusBar barStyle={colorScheme === "light" ? "dark-content" : "light-content"} />;
}

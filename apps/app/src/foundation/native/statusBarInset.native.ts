import { StatusBar } from "react-native";

/**
 * The height of Android's status bar. The Android app draws edge to edge, under the status bar, so the whole app is
 * pushed down by this much or its top bar sits beneath the clock and icons. iOS reports none.
 */
export const statusBarInset = StatusBar.currentHeight ?? 0;

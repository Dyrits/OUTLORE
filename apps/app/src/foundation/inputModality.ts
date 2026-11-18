import { Platform } from "react-native";
import { type InputModality, modalityAfter } from "./inputModalityRules";

// The browser's `:focus-visible` has no React Native Web equivalent, so the web build follows the events itself, before
// any focus they cause. Native builds have no pointer hover, so their focus always counts as the keyboard's.
let modality: InputModality = Platform.OS === "web" ? "pointer" : "keyboard";
if (Platform.OS === "web" && typeof document !== "undefined") {
  for (const type of ["keydown", "pointerdown", "mousedown", "touchstart"]) {
    document.addEventListener(
      type,
      (event) => {
        modality = modalityAfter(modality, event.type);
      },
      { capture: true },
    );
  }
}

/** Whether a focus happening now came from the keyboard, as `:focus-visible` would say. */
export const isKeyboardFocus = (): boolean => modality === "keyboard";

/**
 * Whether the device's main pointer can hover: a mouse or trackpad, not a finger. A phone, the native builds, and a
 * touch screen in a browser cannot, so what a row shows only on hover is shown there all the time (CHG-0497).
 */
export const canHover: boolean =
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(hover: hover)").matches;

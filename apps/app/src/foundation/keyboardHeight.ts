import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * The height of the software keyboard, 0 while it is hidden. Expo apps are edge-to-edge on Android, so the window no
 * longer resizes for the keyboard (adjustResize does nothing there) and a view without a bottom inset stays under it.
 * The app pads its outermost view by this height instead, which is the resize adjustResize used to do. iOS announces
 * the change before it moves (keyboardWill*), Android after it has (keyboardDid*), as React Native's own
 * KeyboardAvoidingView listens. On the web the Keyboard module reports nothing, so the height stays 0.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const isIos = Platform.OS === "ios";
    const show = Keyboard.addListener(isIos ? "keyboardWillShow" : "keyboardDidShow", (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(isIos ? "keyboardWillHide" : "keyboardDidHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

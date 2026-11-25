import { useEffect, useState } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { colors } from "../foundation/theme";

/** How long the check mark stays after a copy before the button shows the copy icon again. */
const confirmationMilliseconds = 1500;

/**
 * A small icon button that copies text to the clipboard and shows a check mark for a moment, as a reply's Copy and a
 * code block's Copy do.
 */
export function CopyButton({ label, style, text }: { label: string; style?: StyleProp<ViewStyle>; text: string }) {
  const [isCopied, setIsCopied] = useState(false);
  useEffect(() => {
    if (!isCopied) return;
    const timer = setTimeout(() => setIsCopied(false), confirmationMilliseconds);
    return () => clearTimeout(timer);
  }, [isCopied]);
  const color = isCopied ? colors.success : colors.textMuted;
  return (
    <Pressable
      accessibilityLabel={isCopied ? "Copied" : label}
      accessibilityRole="button"
      hitSlop={6}
      onPress={() =>
        void navigator.clipboard?.writeText(text).then(
          () => setIsCopied(true),
          () => setIsCopied(false),
        )
      }
      style={style}
    >
      <Svg
        fill="none"
        height={16}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
        width={16}
      >
        {isCopied ? (
          <Path d="M5 12.5l4.5 4.5L19 7.5" />
        ) : (
          <>
            <Rect height={13} rx={2} width={13} x={9} y={9} />
            <Path d="M5 15V6a2 2 0 0 1 2-2h9" />
          </>
        )}
      </Svg>
    </Pressable>
  );
}

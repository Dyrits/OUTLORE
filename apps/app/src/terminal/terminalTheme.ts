import type { ITheme } from "@xterm/xterm";
import { colors } from "../foundation/theme";

/** Builds the xterm color palette from the active guild theme. */
export const terminalThemeOf = (): ITheme => ({
  background: colors.accentSoft,
  black: colors.text,
  blue: colors.accentText,
  brightBlack: colors.textMuted,
  brightBlue: colors.accentText,
  brightCyan: colors.accent,
  brightGreen: colors.successText,
  brightMagenta: colors.violet,
  brightRed: colors.danger,
  brightWhite: colors.text,
  brightYellow: colors.warningText,
  cursor: colors.text,
  cyan: colors.accent,
  foreground: colors.text,
  green: colors.successText,
  magenta: colors.violet,
  red: colors.danger,
  white: colors.textSecondary,
  yellow: colors.warningText,
});

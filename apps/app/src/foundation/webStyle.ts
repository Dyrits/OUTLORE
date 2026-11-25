/** A style only the web understands, such as `outlineStyle` or an inline `display`, which React Native's own style types leave out. */
export const webStyleOf = (style: Readonly<Record<string, string | number>>): object => style;

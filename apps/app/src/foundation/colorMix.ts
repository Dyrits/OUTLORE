// Small arithmetic on `#rrggbb` colors, for the tints a layout derives from a palette (the Islands canvas and shadow).

const channelsOf = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

const hexOf = (channels: ReadonlyArray<number>): string =>
  `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;

/** The color `share` of the way from `base` to `tint`: 0 is `base`, 1 is `tint`. */
export function mixColors(base: string, tint: string, share: number): string {
  const from = channelsOf(base);
  const to = channelsOf(tint);
  return hexOf(from.map((channel, index) => channel + ((to[index] ?? channel) - channel) * share));
}

/** The relative luminance of a color, from 0 for black to 1 for white (WCAG). */
export function luminanceOf(hex: string): number {
  const [red = 0, green = 0, blue = 0] = channelsOf(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The contrast ratio of two colors, from 1 for the same to 21 for black on white (WCAG). */
export function contrastOf(first: string, second: string): number {
  const [high = 0, low = 0] = [luminanceOf(first), luminanceOf(second)].sort((current, next) => next - current);
  return (high + 0.05) / (low + 0.05);
}

/** The `r g b` channels of a color, as CSS's space-separated color syntax takes them. */
export function channelTextOf(hex: string): string {
  return channelsOf(hex).join(" ");
}

/** A count with its noun, in the singular for one and the plural otherwise, for example "1 step" or "3 steps". */
export const countedOf = (count: number, noun: string) => `${count} ${count === 1 ? noun : `${noun}s`}`;

/** A number with thousands separators, for example "12,000". */
export const countOf = (value: number) => value.toLocaleString("en-US");

/** A token count rounded, with thousands separators, for example "12,000". */
export const tokenCountOf = (tokens: number) => countOf(Math.round(tokens));

/** A share as a short percentage, "<0.1" for a share too small to show but not nothing. */
export const percentOf = (part: number, whole: number) => {
  const percent = (part * 100) / whole;
  if (percent === 0) return "0";
  if (percent < 0.1) return "<0.1";
  return percent.toFixed(1);
};

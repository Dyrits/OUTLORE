/** A folder path without a trailing separator or the `/private` that macOS puts in front of a resolved link. */
const normalizedPath = (path: string) => path.replace(/[\\/]+$/, "").replace(/^\/private(?=\/)/, "");

/** Whether two folder paths name the same folder; a link the service resolved differently is not recognised here. */
export const samePath = (first: string | null, second: string | null) =>
  first !== null && second !== null && normalizedPath(first) === normalizedPath(second);

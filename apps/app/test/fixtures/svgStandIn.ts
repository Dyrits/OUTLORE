/** Stands in for `react-native-svg` in tests: the vector drawing renders nothing, so a screen renders as plain markup. */
// biome-ignore lint/style/noDefaultExport: the library the code imports has a default export, which this module replaces.
export default () => null;
export const Path = () => null;

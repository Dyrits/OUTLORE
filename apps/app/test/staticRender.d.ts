/** react-dom's server renderer, used by the layout tests to draw a component tree to static markup; the app itself never imports it, so no types arrive with it. */
declare module "react-dom/server" {
  export function renderToStaticMarkup(element: import("react").ReactElement): string;
}

/** Stands in for react-native at test time (see the tests that mock it); its shapes are not read there. */
declare module "react-native-web";

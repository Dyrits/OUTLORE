import type { PageSettings } from "@outlore/controller";
import { version } from "../../../package.json";

/** The release of this web app, the same as the desktop app's when both are built from one tag. */
const appRelease: string = version;

/** Whether the app runs in a plain browser: no desktop bridge, so no local service, and a host is all there is to use. */
export const isBrowserPage = () => typeof window !== "undefined" && window.outlore === undefined;

/** What the page tells the link: its release, and whether it is served from this computer (a local relay is for those). */
export const pageSettings = (): PageSettings => ({
  allowLocalRelay: ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname),
  release: appRelease,
});

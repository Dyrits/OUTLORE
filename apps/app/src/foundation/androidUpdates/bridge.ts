import type { AndroidUpdatesBridge } from "../updateState";
import type { AndroidUpdateController } from "./controller";

/** The controller as the screens use it; opening a web page is the platform's to give. */
export const androidBridgeOf = (
  controller: AndroidUpdateController,
  openUrl: (url: string) => Promise<void>,
): AndroidUpdatesBridge => ({
  allowInstalling: () => controller.allowInstalling(),
  canInstall: () => controller.canInstall(),
  check: () => controller.check(),
  download: () => controller.download(),
  install: () => controller.install(),
  listen: (onState) => controller.subscribe(onState),
  openReleasePage: openUrl,
  platform: "android",
  setEnabled: (isEnabled) => controller.setEnabled(isEnabled),
  state: () => Promise.resolve(controller.state()),
});

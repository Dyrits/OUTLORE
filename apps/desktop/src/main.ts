import { randomBytes } from "node:crypto";
import { homedir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell, utilityProcess } from "electron";
import { appFileOf } from "./appFiles.ts";
import { iconFileOf } from "./appIcon.ts";
import { appVersionOf } from "./appVersion.ts";
import { moveFormerData } from "./formerData.ts";
import { instanceOf } from "./instance.ts";
import { createPairingLinkQueue, pairingLinkIn, protocolClientOf } from "./pairingLinks.ts";
import { answerServiceUpdates, type ServiceUpdates } from "./serviceUpdates.ts";
import { mergedPathOf, readLoginPath } from "./shellPath.ts";
import { Terminals } from "./terminals.ts";
import { setUpUpdates } from "./updateSetup.ts";
import { createWindowHandlers } from "./windowCalls.ts";

const here = dirname(fileURLToPath(import.meta.url));
/** The app's icons, beside `dist` in the desktop app's own `assets`: Outlore's. */
const iconPathOf = (theme: unknown) => join(here, "..", "assets", iconFileOf(theme));
const iconPath = iconPathOf("one");
/** The installed app carries its screens and loads them from its own scheme; a development run loads the dev server. */
const appScheme = "outlore-app";
const appUrl = app.isPackaged ? `${appScheme}://app/` : (process.env.OUTLORE_APP_URL ?? "http://localhost:8081");
// Lets checks run against a throwaway folder instead of the owner's data.
const dataDirectory = () => process.env.OUTLORE_DATA_DIR ?? app.getPath("userData");
// Only the installed app is plain "Outlore" on the default profile and data folder; dev and checks run as "Outlore Dev".
const instance = instanceOf({
  appData: app.getPath("appData"),
  dataDirectory: process.env.OUTLORE_DATA_DIR,
  hasProfileSwitch: app.commandLine.hasSwitch("user-data-dir"),
  isPackaged: app.isPackaged,
});
app.setName(instance.name);
if (instance.profileFolder !== null) app.setPath("userData", instance.profileFolder);
// A scheme with a stable origin keeps the installed app's local storage from one launch to the next.
protocol.registerSchemesAsPrivileged([
  { privileges: { secure: true, standard: true, stream: true, supportFetchAPI: true }, scheme: appScheme },
]);
// One instance per profile: a second launch on the owner's data would run two services on one database.
const isFirstInstance = app.requestSingleInstanceLock();
if (!isFirstInstance) app.quit();
// A stop signal quits through the usual path, so will-quit stops the service too (dev.ts relaunches with it).
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => app.quit());

// Runs before Electron creates the new user-data folder at ready, so an install from before the rename keeps its data.
const formerDataMoved = Promise.resolve().then(() => {
  if (!isFirstInstance || !app.isPackaged || process.env.OUTLORE_DATA_DIR !== undefined) return;
  const claudeFolder = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
  moveFormerData(app.getPath("appData"), app.getPath("userData"), claudeFolder);
});

/** The updates of this app, once set up; the service's calls about updating the host wait for them. */
let updatesReady: (updates: ServiceUpdates) => void = () => undefined;
const updatesOfService = new Promise<ServiceUpdates>((resolve) => {
  updatesReady = resolve;
});

/** Starts the local service on Electron's Node and resolves its loopback endpoint. */
const startService = (token: string) => {
  const service = utilityProcess.fork(join(here, "service.js"), [], {
    env: {
      ...process.env,
      OUTLORE_DATA_DIR: dataDirectory(),
      OUTLORE_RELEASE: appVersionOf(),
      OUTLORE_TOKEN: token,
      // The vendored connector servers, shipped as a resource in the installed app and vendored in the repo in dev.
      OUTLORE_VENDOR_DIR: app.isPackaged
        ? join(process.resourcesPath, "vendor")
        : join(here, "..", "..", "..", "packages", "service", "vendor"),
    },
    serviceName: "Outlore service",
    stdio: "inherit",
  });
  app.on("will-quit", () => service.kill());
  // A paired device may ask this host to update; the service cannot reach the updater, so it asks here.
  const answerUpdates = answerServiceUpdates(updatesOfService, (message) => service.postMessage(message));
  return new Promise<string>((resolve, reject) => {
    service.once("exit", (code) => reject(new Error(`The service exited with code ${code}`)));
    service.on("message", (message: { type?: string; port?: number }) => {
      answerUpdates(message);
      if (message.type === "ready") resolve(`ws://127.0.0.1:${message.port}/?token=${token}`);
    });
  });
};

/** The dev server may still be starting; waits for it, then loads the app. Resolves false when it never answers. */
const load = async (window: BrowserWindow) => {
  if (app.isPackaged) {
    await window.loadURL(appUrl);
    return true;
  }
  for (let attempt = 0; attempt < 120; attempt++) {
    const isReachable = await fetch(appUrl).then(
      (response) => response.ok,
      () => false,
    );
    if (isReachable) {
      await window.loadURL(appUrl);
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
};

/** Startup failures end here: the owner sees why, and the app quits instead of leaving an empty window. */
const quitWith = (reason: string) => {
  dialog.showErrorBox("Outlore could not start", reason);
  app.quit();
};

let mainWindow: BrowserWindow | undefined;
const bringWindowForward = () => {
  if (mainWindow === undefined || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
};
// Pairing links (`outlore://pair#<code>`) go to the window alone: never logged, never in a title or a command line of
// ours. The link is as secret as the code in it.
const pairingLinks = createPairingLinkQueue((link) => {
  if (mainWindow !== undefined && !mainWindow.isDestroyed()) mainWindow.webContents.send("outlore:pairingLink", link);
});
// A second launch on this profile brings the running window forward instead of starting another service; on Windows and
// Linux a link opened while the app runs arrives as that launch's arguments.
app.on("second-instance", (_event, argv) => {
  const link = pairingLinkIn(argv);
  if (link !== null) pairingLinks.receive(link);
  bringWindowForward();
});
// macOS hands the link to the running app (or to the one it starts), before ready as well as after.
app.on("open-url", (event, url) => {
  event.preventDefault();
  pairingLinks.receive(url);
  bringWindowForward();
});
if (isFirstInstance) {
  const protocolClient = protocolClientOf({
    argv1: process.argv[1],
    environment: process.env,
    execPath: process.execPath,
    isDefaultApp: process.defaultApp === true,
    isPackaged: app.isPackaged,
  });
  if (protocolClient !== null) {
    app.setAsDefaultProtocolClient("outlore", protocolClient.executable ?? void 0, protocolClient.args);
  }
  // Windows and Linux start the app with the link as an argument.
  const firstLink = pairingLinkIn(process.argv);
  if (firstLink !== null) pairingLinks.receive(firstLink);
}

app
  .whenReady()
  .then(() => formerDataMoved)
  .then(async () => {
    if (!isFirstInstance) return;
    if (app.isPackaged) {
      const root = join(here, "app");
      protocol.handle(appScheme, (request) => {
        const file = appFileOf(root, new URL(request.url).pathname);
        return file === null ? new Response("Not found", { status: 404 }) : net.fetch(pathToFileURL(file).toString());
      });
    }
    // A Finder or Dock launch on macOS gives only the system folders, where the harness tools are not; the service and
    // the shells inherit this path. Windows has no login shell to ask, and its launcher already carries its `;`-separated path.
    if (app.isPackaged && process.platform !== "win32") {
      const loginPath = readLoginPath(userInfo().shell || process.env.SHELL || "/bin/sh");
      process.env.PATH = mergedPathOf({ home: homedir(), launchPath: process.env.PATH, loginPath });
    }
    const token = randomBytes(32).toString("base64url");
    const endpoint = await startService(token);

    // macOS shows the dock icon of the running app; the packaged build carries its own icon file.
    app.dock?.setIcon(iconPath);
    const window = new BrowserWindow({
      height: 800,
      icon: iconPath,
      title: instance.name,
      // On macOS the app's top bar is the title bar: the system's is hidden and its buttons stay.
      ...(process.platform === "darwin" ? { titleBarStyle: "hidden", trafficLightPosition: { x: 14, y: 12 } } : {}),
      webPreferences: { contextIsolation: true, preload: join(here, "preload.cjs"), sandbox: true },
      width: 1200,
    });
    mainWindow = window;
    // The owner token travels in the endpoint: only the app's own main frame may read it (audit SA-12).
    const handleWindow = createWindowHandlers(ipcMain, window.webContents, appUrl);
    handleWindow("outlore:endpoint", () => endpoint);
    // The window takes the link that came before it listened, then gets the later ones as events; a reload starts over.
    handleWindow("outlore:pairingLinkTake", () => pairingLinks.take());
    window.webContents.on("did-start-loading", () => pairingLinks.reset());
    // A link in a reply opens in the system's browser, never in a window of its own that could receive the bridge, and
    // the app's window never navigates away from the app.
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (/^(?:https?|mailto):/i.test(url)) void shell.openExternal(url);
      return { action: "deny" };
    });
    window.webContents.on("will-navigate", (event, url) => {
      if (new URL(url).origin !== new URL(appUrl).origin) event.preventDefault();
    });
    const terminals = new Terminals(
      (id, data, sequence) => {
        if (!window.isDestroyed()) window.webContents.send("outlore:terminalData", id, data, sequence);
      },
      (id) => {
        if (!window.isDestroyed()) window.webContents.send("outlore:terminalExit", id);
      },
    );
    // Terminal execution is a desktop capability; embedded frames cannot call it.
    handleWindow("outlore:terminalOpen", (id: string, cwd: string | null) => {
      return terminals.open(id, cwd);
    });
    handleWindow("outlore:terminalWrite", (id: string, data: string) => {
      terminals.write(id, data);
    });
    handleWindow("outlore:terminalResize", (id: string, cols: number, rows: number) => {
      terminals.resize(id, cols, rows);
    });
    handleWindow("outlore:terminalClose", (id: string) => {
      terminals.close(id);
    });
    window.on("closed", () => terminals.dispose());
    // The theme chosen in the app sets the Dock's and the window's icon; the installed file's own icon stays Outlore's.
    handleWindow("outlore:setTheme", (theme: unknown) => {
      app.dock?.setIcon(iconPathOf(theme));
      window.setIcon(iconPathOf(theme));
    });
    // A summons bounces the Dock icon until the owner comes back; with the window in front there is nothing to call them to.
    let bounce: number | null = null;
    const stopBounce = () => {
      if (bounce !== null) app.dock?.cancelBounce(bounce);
      bounce = null;
    };
    window.on("focus", stopBounce);
    handleWindow("outlore:requestAttention", () => {
      if (window.isDestroyed() || window.isFocused() || bounce !== null) return;
      bounce = app.dock?.bounce("critical") ?? null;
    });
    // The installed app looks for a newer release once its window is up; the owner decides when it installs.
    const updates = await setUpUpdates(window, handleWindow);
    updatesReady({
      check: () => updates.check({ isForced: true }),
      install: () => updates.install(),
      state: () => updates.state(),
    });
    if (!(await load(window))) quitWith(`Could not load ${appUrl}`);
    else updates.start();
  })
  .catch((error: Error) => quitWith(error.message));

app.on("window-all-closed", () => app.quit());

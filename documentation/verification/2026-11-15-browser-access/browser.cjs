// electron browser.cjs <url> <debugging port>: Chromium with no preload and no desktop bridge, as a browser tab has.
const { app, BrowserWindow } = require("electron");
app.commandLine.appendSwitch("remote-debugging-port", process.argv[3]);
app.setPath("userData", require("node:fs").mkdtempSync(require("node:path").join(require("node:os").tmpdir(), "outlore-browser-")));
app.whenReady().then(() => {
  const window = new BrowserWindow({ height: 800, show: true, width: 1280, webPreferences: { contextIsolation: true } });
  window.loadURL(process.argv[2]);
});
app.on("window-all-closed", () => app.quit());

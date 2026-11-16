// The Electron fuses the installed app ships with (ST-H-09). `scripts/afterPack.cjs` applies them; the packaging test
// pins this list, and `scripts/check-package.ts` reads them back from the built app.
// Each one is off because the app and its service do not use it:
// - RunAsNode: the service runs on `utilityProcess.fork`, so nothing starts the binary as plain Node.
// - EnableNodeOptionsEnvironmentVariable: no start path reads NODE_OPTIONS.
// - EnableNodeCliInspectArguments: only `--remote-debugging-port` is used, which is Chromium's, not Node's inspector.
const fusePolicy = {
  EnableNodeCliInspectArguments: false,
  EnableNodeOptionsEnvironmentVariable: false,
  RunAsNode: false,
};

module.exports = { fusePolicy };

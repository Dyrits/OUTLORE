// Turns off the Electron fuses the installed app does not need, before electron-builder signs it (ST-H-09).
// electron-builder runs this from `apps/desktop`, so `@electron/fuses` resolves from the workspace's devDependencies.
const { join } = require("node:path");
const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");
const { fusePolicy } = require("./fusePolicy.cjs");

/** The bundle on macOS, the executable elsewhere; @electron/fuses finds the fuse wire inside either. */
const pathOf = ({ appOutDir, electronPlatformName, packager }) => {
  const filename = `${packager.appInfo.productFilename}${electronPlatformName === "darwin" ? ".app" : ""}`;
  return join(appOutDir, filename);
};

exports.default = async (context) => {
  const states = Object.fromEntries(
    Object.entries(fusePolicy).map(([fuse, enabled]) => [FuseV1Options[fuse], enabled]),
  );
  await flipFuses(pathOf(context), { version: FuseVersion.V1, ...states });
};

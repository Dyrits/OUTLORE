// Turns off the Electron fuses the installed app does not need, before electron-builder signs it (ST-H-09).
// electron-builder runs this from `apps/desktop`, so `@electron/fuses` resolves from the workspace's devDependencies.
const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");
const { fusePolicy } = require("./fusePolicy.cjs");
const { packedPath } = require("./packedPath.cjs");

exports.default = async (context) => {
  const states = Object.fromEntries(
    Object.entries(fusePolicy).map(([fuse, enabled]) => [FuseV1Options[fuse], enabled]),
  );
  await flipFuses(packedPath(context), { version: FuseVersion.V1, ...states });
};

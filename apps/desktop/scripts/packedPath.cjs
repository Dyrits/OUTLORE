const { join } = require("node:path");

/**
 * The file `afterPack.cjs` flips the fuses of: the bundle on macOS, the executable elsewhere. @electron/fuses finds the
 * fuse wire inside either. electron-builder names the executable `<productFilename>.exe` on Windows and the lowercase
 * `packager.executableName` on Linux (`outlore`), which is not the product name: the first 0.1.6-Prototype tag failed
 * on both. Kept apart from the hook so a test can run it without `@electron/fuses`.
 */
const packedPath = ({ appOutDir, electronPlatformName, packager }) => {
  if (electronPlatformName === "darwin") return join(appOutDir, `${packager.appInfo.productFilename}.app`);
  if (electronPlatformName === "win32") return join(appOutDir, `${packager.appInfo.productFilename}.exe`);
  return join(appOutDir, packager.executableName);
};

exports.packedPath = packedPath;

import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { whisperExecutable } from "../src/whisper.ts";

const revision = "8302b819fc3096c03cedbc91ef1fe982cc6ebb77";

const run = (command: string, args: string[], cwd: string) => {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed while building the voice engine.`);
};

const macMinimumVersionOf = (desktop: string) =>
  execFileSync(
    "/usr/libexec/PlistBuddy",
    [
      "-c",
      "Print LSMinimumSystemVersion",
      join(desktop, "node_modules/electron/dist/Electron.app/Contents/Info.plist"),
    ],
    { encoding: "utf8" },
  ).trim();

/** Builds the pinned, self-contained Whisper CLI and stages it with its license for electron-builder. */
export function buildWhisper(desktop: string, arch: string) {
  const destination = join(desktop, "dist", "whisper");
  const executable = join(destination, whisperExecutable);
  const windows = process.platform === "win32";
  const architecture =
    process.platform === "darwin"
      ? [
          // Match the installed Electron's LSMinimumSystemVersion so the app and engine run on the same Macs.
          `-DCMAKE_OSX_DEPLOYMENT_TARGET=${macMinimumVersionOf(desktop)}`,
          `-DCMAKE_OSX_ARCHITECTURES=${arch === "x64" ? "x86_64" : arch}`,
        ]
      : windows
        ? [
            "-G",
            "Visual Studio 17 2022",
            "-A",
            arch === "arm64" ? "ARM64" : "x64",
            "-DCMAKE_POLICY_DEFAULT_CMP0091=NEW",
            "-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded",
          ]
        : [];

  // Upstream enables AVX2 and related extensions on x64 when native tuning is off.
  const portableCpu =
    arch === "x64"
      ? [
          "-DGGML_AVX=OFF",
          "-DGGML_AVX2=OFF",
          "-DGGML_BMI2=OFF",
          "-DGGML_FMA=OFF",
          "-DGGML_F16C=OFF",
          "-DGGML_SSE42=OFF",
        ]
      : [];

  const source = mkdtempSync(join(tmpdir(), "outlore-whisper-"));
  try {
    run("cmake", ["--version"], source);
    run("git", ["init", "--quiet"], source);
    run("git", ["fetch", "--depth=1", "https://github.com/ggml-org/whisper.cpp.git", revision], source);
    run("git", ["checkout", "--quiet", "--detach", "FETCH_HEAD"], source);
    run(
      "cmake",
      [
        "-S",
        ".",
        "-B",
        "build",
        "-DCMAKE_BUILD_TYPE=Release",
        "-DBUILD_SHARED_LIBS=OFF",
        "-DGGML_METAL=OFF",
        "-DGGML_NATIVE=OFF",
        "-DGGML_OPENMP=OFF",
        "-DWHISPER_BUILD_TESTS=OFF",
        ...architecture,
        ...portableCpu,
      ],
      source,
    );
    run("cmake", ["--build", "build", "--config", "Release", "--target", "whisper-cli", "--parallel", "4"], source);
    mkdirSync(destination, { recursive: true });
    const bin = join(source, "build", "bin");
    copyFileSync(join(windows ? join(bin, "Release") : bin, whisperExecutable), executable);
    copyFileSync(join(source, "LICENSE"), join(destination, "LICENSE"));
    run(executable, ["--version"], desktop);
  } finally {
    rmSync(source, { force: true, recursive: true });
  }
}

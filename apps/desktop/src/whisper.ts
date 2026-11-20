/** The executable name shared by desktop packaging and the service launcher. */
export const whisperExecutable = process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli";

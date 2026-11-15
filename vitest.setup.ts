// A test run starts from the same environment wherever it runs. A harness's account folder variable inherited from
// the shell, as in a thread that itself runs on Claude Code, would reach the stand-in harnesses and fail the tests
// that check which account folder a process gets. Each test that needs one sets it.
for (const variable of ["CLAUDE_CONFIG_DIR", "CODEX_HOME"]) delete process.env[variable];

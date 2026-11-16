// A stand-in probe for sandbox write tests: it tries to write "x" to each path given and prints a JSON array of the
// outcome per path ("ok" or the error's code), so a test can assert exactly which writes went through. The first
// argument names the mode: "mkdir" creates each path's folder first (for writes into new folders), "plain" does not.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const [mode, ...paths] = process.argv.slice(2);
const outcome = (path) => {
  try {
    if (mode === "mkdir") mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "x");
    return "ok";
  } catch (error) {
    return error.code;
  }
};
process.stdout.write(JSON.stringify(paths.map(outcome)));

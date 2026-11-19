import type { Effect } from "effect";
import type { CommandResult } from "../commandRunner.ts";
import type { KeyCustody } from "../keyCustody.ts";
import { keyFile } from "./keyFile.ts";
import { macKeychain } from "./macKeychain.ts";
import { secretService } from "./secretService.ts";
import { windowsDpapi } from "./windowsDpapi.ts";

/**
 * The adapters this host can try, in the order a new Vault tries them: the secret store of the platform, then the key
 * file (ADR 0022). The holder is chosen once, at creation, and never again by trying.
 */
export const custodiesOf = (
  platform: NodeJS.Platform,
  folder: string,
  run: (command: string, args: ReadonlyArray<string>, input: string) => Effect.Effect<CommandResult>,
): ReadonlyArray<KeyCustody> => [
  ...(platform === "darwin" ? [macKeychain(run)] : []),
  ...(platform === "win32" ? [windowsDpapi(folder, run)] : []),
  ...(platform === "linux" ? [secretService(run)] : []),
  keyFile(folder),
];

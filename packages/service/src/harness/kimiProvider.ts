import { singleVarIsolation } from "./accountIsolation.ts";
import { type AcpProviderDefinition, majorVersionAtLeast } from "./acpProviderDefinition.ts";

// Current-generation kimi-code only (2.x): the archived Python kimi-cli reports 1.x and does
// not implement the configOptions and reverse-RPC approval surface this definition was audited on.
// The execution adapter stays unexposed (blocked) on the config-level yolo keys: kimi-code's config can carry
// `yolo` (node-sdk/src/config/toml.ts keeps the scalar while deleting legacy `default_yolo`/`defaultYolo`),
// ConfigResponse exposes `yolo` and `default_permission_mode` (agent-core-v2 configEvents.ts), and the VS Code
// runtime applies a global yolo mode on resume (vscode kimi-runtime.ts). ACP sessions do start in the manual
// "default" mode (acp-server session.ts), but nothing proves every engine path ignores a config-set yolo, so
// registration waits for proof on a live 2.x binary; probing models with an isolated KIMI_CODE_HOME is safe.

/** The audited provider, not registered as a harness: it is the one place its audited facts are kept until registration is proven. */
export const kimi: AcpProviderDefinition = {
  argv: () => ["acp"],
  executable: "kimi",
  isolation: singleVarIsolation("KIMI_CODE_HOME"),
  label: "Kimi",
  signedOutCode: null,
  signIn: null,
  spawnEnv: {
    KIMI_CLI_NO_AUTO_UPDATE: "1",
    KIMI_CODE_DANGEROUS_COMMAND_GUARD: "true",
    KIMI_CODE_NO_AUTO_UPDATE: "1",
  },
  version: majorVersionAtLeast(2),
};

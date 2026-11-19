import { join } from "node:path";
import type { HarnessName } from "@outlore/contracts";

/**
 * Where the Vault keeps its records below the service's data directory (ADR 0022). It is in `core/` because the harness
 * adapters, which come before the Vault, hide this folder from their sandboxes.
 */
export const vaultFolderOf = (dataDirectory: string) => join(dataDirectory, "vault");

/**
 * Whether a harness's sandbox hides the Vault's folder, as its probe found (ADR 0022, Protected, or no secrets):
 * `Verified` when a marker in the folder could not be read from inside the sandbox while an outside control could,
 * `Unverified` when it was readable or the probe could not run (it fails closed), `NotInstalled` when the harness is
 * not on this host, and `AsksFirst` for a harness that runs no enforced sandbox, where every action already asks.
 */
export type VaultDenial = {
  readonly harness: HarnessName;
  /** One plain sentence: what the probe saw, or why it could not run. */
  readonly reason: string;
  readonly status: "Verified" | "Unverified" | "NotInstalled" | "AsksFirst";
};

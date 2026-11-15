import { hostname } from "node:os";
import { Context } from "effect";
import type { DeployResult } from "./ownRelay.ts";

/**
 * The shared relay on the owner's free Cloudflare account (decision record 0016). One place names it, so the address
 * can change in a release; a pairing code carries the address it was made with.
 */
export const defaultRelayOrigin = "https://outlore.dyrits.workers.dev";

/**
 * Where the web app opens: the shared relay serves it (CHG-0287), whichever relay a host uses; an own relay carries
 * the Worker alone.
 */
export const webAppOrigin = defaultRelayOrigin;

/** What device pairing needs from outside the database. */
export interface RemoteSettings {
  /** The computer's own name, offered as the host's name until the owner chooses one. */
  readonly computerName: string;
  /** Deploys the relay to the Cloudflare account a token reaches; never rejects, and never keeps the token. */
  readonly deployOwnRelay: (token: string) => Promise<DeployResult>;
  /** The relay a new pairing code names, unless the owner's host record names another. */
  readonly relayOrigin: string;
  /** The release this host runs, told to every device that connects so a browser can refuse a host of another release. */
  readonly release: string;
}

export class RemoteConfig extends Context.Service<RemoteConfig, RemoteSettings>()("outlore/RemoteConfig") {}

/** The computer's name without its network suffix: `Studio.local` and `Studio.lan` read as `Studio`. */
export const computerNameOf = (raw: string = hostname()) => raw.split(".")[0]?.trim() || "This computer";

export { isLocalOrigin } from "@outlore/controller";

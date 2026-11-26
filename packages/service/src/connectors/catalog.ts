// The connector catalog (connectors blueprint, `catalog.ts`): data, one entry per connector Outlore offers. The catalog
// alone classifies a connector's tools; a server's own labels (an MCP `readOnlyHint`) are never read.

/** How the catalog classifies a tool: a read runs unasked, a write asks. A tool it does not name is unclassified and asks. */
export type ToolClass = "Read" | "Write";

/**
 * The licence an entry states for a hosted service whose server code is not published: not an OSI licence, said as it is
 * (connectors specification, Wave 1). An entry whose server code is published names that repository's SPDX identifier instead.
 */
export const hostedServiceLicence = "Hosted service, server code not published";

/** The Vault secret kind used to store an OAuth 2.1 session (access token, refresh token and client metadata). */
export const oauthSecretKind = "OAuth session";

/** Configuration for a remote MCP server that authenticates with MCP OAuth 2.1 browser sign-in. */
export type HttpOAuthConfig = {
  /** Client name sent during RFC 7591 dynamic client registration; defaults to "Outlore". */
  readonly clientName?: string;
  /** Optional scopes to request; when omitted, scopes come from the server's challenge or metadata. */
  readonly scopes?: ReadonlyArray<string>;
};

/** One tool the catalog names, by its exact name at the server, after reading what it does. */
export type CatalogTool = {
  /** The app a tool of an app-based connector belongs to, or null. */
  readonly app: string | null;
  readonly class: ToolClass;
  /** What the tool does, in plain words, for the owner's card and question; never taken from the server. */
  readonly summary: string;
};

/** One app an app-based connector can drive, and whether it is chosen at install. */
export type CatalogApp = {
  readonly id: string;
  readonly isDefault: boolean;
  readonly name: string;
};

/** How the host reaches a connector's server; the real adapters come with the backends (blueprint, Order step 4). */
export type CatalogBackend =
  | {
      readonly _tag: "Http";
      /** The one header that carries the connector's secret, or null for a keyless server that is sent no secret. */
      readonly header: string | null;
      /** When set, the connector authenticates via MCP OAuth 2.1 browser sign-in and stores its session in the Vault. */
      readonly oauth?: HttpOAuthConfig;
      /** Text put before the secret in the header's value, such as "Bearer "; absent, the header carries the secret alone. */
      readonly prefix?: string;
      readonly url: string;
      /** When true, the adapter performs MCP initialize and sends Mcp-Session-Id; OAuth entries always use a session. */
      readonly shouldUseSession?: boolean;
    }
  | {
      readonly _tag: "Stdio";
      /** Extra environment for the child, such as forcing the pinned server's local mode. */
      readonly env?: Record<string, string>;
      /**
       * The pinned server package, by its npm name; the backend resolves it to the copy vendored with the service
       * (`packages/service/vendor/`) in dev and tests, or bundled into the packaged app, and runs that file with a
       * system Node, since a packaged Outlore cannot run its own binary as one.
       */
      readonly server: string;
      readonly version: string;
    };

/** One connector the owner can install. */
export type CatalogEntry = {
  /** The apps the owner chooses among, empty for a connector that has none. */
  readonly apps: ReadonlyArray<CatalogApp>;
  readonly backend: CatalogBackend;
  readonly description: string;
  /** Letters and digits, single underscores between: it forms the tool names and the permissions' identity. */
  readonly id: string;
  /** The licence of the server the entry names, as the review that chose it found it. */
  readonly licence: string;
  readonly name: string;
  /** What installing tells the owner, who confirms it; null for none. */
  readonly notice: string | null;
  /** Where the connector runs: every host, or a Mac only. */
  readonly platform: "Any" | "macOS";
  /** The kind of secret the connector needs in the Vault, such as "API key", or null for none. */
  readonly secretKind: string | null;
  /** The tools the catalog names, by exact server name; any other tool is unclassified. */
  readonly tools: Readonly<Record<string, CatalogTool>>;
};

/** A connector id: letters and digits, with single underscores between them, so `<connector>__<tool>` splits one way. */
const connectorIdPattern = /^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*$/;
/** A tool name a server may give: letters, digits, `-` and `_`, at most 64 characters, so a hostile name stays harmless. */
const toolNamePattern = /^[A-Za-z0-9_-]{1,64}$/;

/** Whether a name from a server is acceptable as a tool name. */
export const isToolName = (name: string) => toolNamePattern.test(name);

/** Whether an id is acceptable as a connector id. */
export const isConnectorId = (id: string) => connectorIdPattern.test(id);

/** The separator between a connector's id and its tool in the name a thread lists and calls. */
export const toolNameSeparator = "__";

/** The name a thread lists and calls for a connector's tool. */
export const listedNameOf = (connector: string, tool: string) => `${connector}${toolNameSeparator}${tool}`;

/** The connector and tool a listed name stands for, or null when it has no separator. */
export const splitListedName = (name: string) => {
  const at = name.indexOf(toolNameSeparator);
  if (at <= 0) return null;
  return { connector: name.slice(0, at), tool: name.slice(at + toolNameSeparator.length) };
};

/** The catalog's entry for the exact name, or null. */
export const catalogToolOf = (entry: CatalogEntry, tool: string) =>
  Object.hasOwn(entry.tools, tool) ? (entry.tools[tool] ?? null) : null;

/** The entry with this id in the catalog, or null; compared with `Object.hasOwn`, never `in`. */
export const entryOf = (catalog: ReadonlyArray<CatalogEntry>, id: string) =>
  catalog.find((entry) => entry.id === id) ?? null;

/** The apps chosen when the owner gives no choice: the entry's default apps. */
export const defaultAppsOf = (entry: CatalogEntry) => entry.apps.filter((app) => app.isDefault).map((app) => app.id);

/** Whether a host of this platform can run the connector. */
export const isRunnableOn = (entry: CatalogEntry, platform: NodeJS.Platform) =>
  entry.platform === "Any" || platform === "darwin";

/** Whether an entry authenticates through the generic MCP OAuth 2.1 browser sign-in flow. */
export const isOAuthEntry = (entry: CatalogEntry) => entry.backend._tag === "Http" && entry.backend.oauth !== undefined;

/** Whether an entry accepts a static secret (such as an API key or personal access token) stored in the Vault. */
export const hasStaticSecret = (entry: CatalogEntry) =>
  entry.secretKind !== null && entry.secretKind !== oauthSecretKind;

/** Whether an entry offers both generic MCP OAuth 2.1 browser sign-in and a static Vault secret. */
export const isDualAuthEntry = (entry: CatalogEntry) => isOAuthEntry(entry) && hasStaticSecret(entry);

/**
 * The tools a server lists that the entry does not name: they are asked about on every call, and a test of the pinned
 * version's listing fails on one so a version bump cannot slip a new write in unseen.
 */
export const unnamedToolsOf = (entry: CatalogEntry, listed: ReadonlyArray<string>) =>
  listed.filter((tool) => catalogToolOf(entry, tool) === null);

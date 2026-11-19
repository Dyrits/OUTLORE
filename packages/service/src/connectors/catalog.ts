// The connector catalog (connectors blueprint, `catalog.ts`): data, one entry per connector Outlore offers. The catalog
// alone classifies a connector's tools; a server's own labels (an MCP `readOnlyHint`) are never read.

/** How the catalog classifies a tool: a read runs unasked, a write asks. A tool it does not name is unclassified and asks. */
export type ToolClass = "Read" | "Write";

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
  | { readonly _tag: "Http"; readonly header: string; readonly url: string }
  | { readonly _tag: "Stdio"; readonly command: ReadonlyArray<string>; readonly version: string };

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

/**
 * The tools a server lists that the entry does not name: they are asked about on every call, and a test of the pinned
 * version's listing fails on one so a version bump cannot slip a new write in unseen.
 */
export const unnamedToolsOf = (entry: CatalogEntry, listed: ReadonlyArray<string>) =>
  listed.filter((tool) => catalogToolOf(entry, tool) === null);

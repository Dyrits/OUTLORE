import type {
  ApplePermissionStatus,
  ConnectorCard,
  ConnectorState,
  ConnectorToolCard,
  ConnectorToolClass,
} from "@outlore/contracts";

// The words and small decisions of the Charter's connector cards (connectors specification: Install, connect, enable;
// A connector's tools; Apple apps). Plain code, unit-tested; the screens only draw them.

/** Where a connector stands, in a few words. */
export const connectorStateLabels = {
  NeedsConnecting: "Needs connecting",
  NeedsMac: "Needs a Mac",
  NotInstalled: "Not installed",
  Ready: "Ready",
  Removing: "Being removed",
} satisfies Record<ConnectorState, string>;

/** Whether a tool runs unasked or asks: the catalog's classification, never the server's own claim. */
export const toolClassLabels = {
  Read: "Runs without asking",
  Unclassified: "Asks first · not classified",
  Write: "Asks first",
} satisfies Record<ConnectorToolClass, string>;

/** Whether the connector is installed, so it has switches, tools and a Remove. */
export const isInstalledCard = (card: Pick<ConnectorCard, "state">) =>
  card.state !== "NotInstalled" && card.state !== "NeedsMac";

/** Whether the connector can be installed here: it is offered and not waiting on a Mac this host is not. */
export const canInstallCard = (card: Pick<ConnectorCard, "state">) => card.state === "NotInstalled";

/** The tools a card lists: all of them, or for a connector with apps, those of the apps chosen. */
export const toolsShownOf = (card: Pick<ConnectorCard, "apps" | "tools">): ReadonlyArray<ConnectorToolCard> => {
  if (card.apps.length === 0) return card.tools;
  const chosen = new Set(card.apps.filter((app) => app.isChosen).map((app) => app.id));
  return card.tools.filter((tool) => tool.app !== null && chosen.has(tool.app));
};

/** A group of tools under one heading: an app's, or the whole connector's when it has no apps. */
export type ToolGroup = { readonly heading: string | null; readonly tools: ReadonlyArray<ConnectorToolCard> };

/** The tools shown, grouped by app in the order the apps are offered; one group with no heading when there are no apps. */
export const toolGroupsOf = (card: Pick<ConnectorCard, "apps" | "tools">): ReadonlyArray<ToolGroup> => {
  const shown = toolsShownOf(card);
  if (card.apps.length === 0) return shown.length === 0 ? [] : [{ heading: null, tools: shown }];
  return card.apps
    .map((app) => ({ heading: app.name, tools: shown.filter((tool) => tool.app === app.id) }))
    .filter((group) => group.tools.length > 0);
};

/** What the Tools fold says it holds: how many tools, and how many of them are switched off. */
export const toolsSummaryOf = (tools: ReadonlyArray<ConnectorToolCard>) => {
  const offCount = tools.filter((tool) => !tool.isOn).length;
  const count = `${tools.length} ${tools.length === 1 ? "tool" : "tools"}`;
  return offCount === 0 ? count : `${count} · ${offCount} off`;
};

/** The apps the owner has chosen, by id, in the order they are offered. */
export const chosenAppsOf = (card: Pick<ConnectorCard, "apps">) =>
  card.apps.filter((app) => app.isChosen).map((app) => app.id);

/** The apps after one is switched on or off, in the order they are offered, for `ChooseAppleApps`. */
export const appsAfterToggle = (card: Pick<ConnectorCard, "apps">, appId: string, isChosen: boolean) =>
  card.apps.filter((app) => (app.id === appId ? isChosen : app.isChosen)).map((app) => app.id);

/** What one app's macOS permission says, and where to change a refusal. */
export const permissionLabels = {
  Allowed: "Allowed",
  NotAllowed: "Not allowed by macOS. Change it in System Settings, Privacy & Security, Automation.",
  NotAskedYet: "Not asked yet.",
} satisfies Record<ApplePermissionStatus, string>;

/** The words in place of the button that asks macOS, on a paired device: only the host's own window may ask. */
export const remotePermissionNote =
  "Permission needed on the computer. Only that computer's own window can ask macOS; the switches above work from here.";

/** The line that asks the owner to confirm the notice before installing. */
export const noticeConfirmLabel = "I have read this";

/** What removing a connector forgets, said before the owner confirms. */
export const removalWarning =
  "Removing it forgets its switches, its secret in the Vault and its standing permissions. Calls underway stop at once.";

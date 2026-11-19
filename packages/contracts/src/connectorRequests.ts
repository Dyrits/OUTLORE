import { Schema } from "effect";
import { MissionId, WorkspaceId } from "./ids.ts";

// Connectors (connectors specification): what the owner reads of them and the requests that install, switch and remove
// them. All are the owner's: no thread tool reaches them, and a secret never crosses them (the Vault's own requests
// come with the Vault).

/** The owner's explicit choice of a connector for a realm, the Borderlands or a quest; no choice means Inherit. */
export const ConnectorChoice = Schema.Literals(["On", "Off"]);
export type ConnectorChoice = typeof ConnectorChoice.Type;

/** How a connector's tool is classified: reads run unasked, writes ask, and a tool the catalog does not name asks too. */
export const ConnectorToolClass = Schema.Literals(["Read", "Write", "Unclassified"]);
export type ConnectorToolClass = typeof ConnectorToolClass.Type;

/** One tool of a connector as its card lists it. */
export const ConnectorToolCard = Schema.Struct({
  /** The app of an Apple apps tool, or null. */
  app: Schema.NullOr(Schema.String),
  class: ConnectorToolClass,
  /** In plain words, what the tool does; the tool's name when the catalog says nothing more. */
  description: Schema.String,
  /** The switch of the tool, on by default. */
  isOn: Schema.Boolean,
  name: Schema.String,
});
export type ConnectorToolCard = typeof ConnectorToolCard.Type;

/** One app of Apple apps and whether the owner chose it. */
export const ConnectorAppCard = Schema.Struct({
  id: Schema.String,
  isChosen: Schema.Boolean,
  name: Schema.String,
});
export type ConnectorAppCard = typeof ConnectorAppCard.Type;

/** Where a connector stands for the owner. */
export const ConnectorState = Schema.Literals(["NotInstalled", "NeedsMac", "NeedsConnecting", "Removing", "Ready"]);
export type ConnectorState = typeof ConnectorState.Type;

/** A connector as the Charter shows it: what it does, where it stands, its switches and its tools. */
export const ConnectorCard = Schema.Struct({
  /** The apps of Apple apps; empty for a connector that has none. */
  apps: Schema.Array(ConnectorAppCard),
  /** The Borderlands' choice, or null for Inherit. */
  borderlandsChoice: Schema.NullOr(ConnectorChoice),
  description: Schema.String,
  id: Schema.String,
  /** The global switch, on once installed. */
  isEnabled: Schema.Boolean,
  name: Schema.String,
  /** What it needs before a thread is given its tools, in plain words, or null. */
  needs: Schema.NullOr(Schema.String),
  /** The notice installing it shows, or null for none. */
  notice: Schema.NullOr(Schema.String),
  /** The kinds of secret it needs in the Vault, such as "API key". */
  secretKinds: Schema.Array(Schema.String),
  state: ConnectorState,
  tools: Schema.Array(ConnectorToolCard),
});
export type ConnectorCard = typeof ConnectorCard.Type;

/** Every connector the catalog offers, installed or not, as cards. */
export const ListConnectors = Schema.TaggedStruct("ListConnectors", {});

/**
 * Installs a connector: it is then on this computer, global and enabled everywhere. A connector with a notice needs
 * `hasConfirmedNotice`; Apple apps takes the apps to chose, or its default apps when `apps` is absent.
 */
export const InstallConnector = Schema.TaggedStruct("InstallConnector", {
  apps: Schema.optionalKey(Schema.Array(Schema.String)),
  connectorId: Schema.String,
  hasConfirmedNotice: Schema.Boolean,
});

/**
 * Removes a connector: it stops at once, then its secrets and its choices, tool switches and standing permissions are
 * forgotten. A removal that stopped halfway is resumed by sending this again.
 */
export const RemoveConnector = Schema.TaggedStruct("RemoveConnector", { connectorId: Schema.String });

/** What a connector's switch belongs to. */
export const ConnectorSwitchLevel = Schema.Union([
  Schema.TaggedStruct("Global", {}),
  Schema.TaggedStruct("Borderlands", {}),
  Schema.TaggedStruct("Realm", { realmId: WorkspaceId }),
  Schema.TaggedStruct("Quest", { missionId: MissionId }),
]);
export type ConnectorSwitchLevel = typeof ConnectorSwitchLevel.Type;

/** Where a panel reads the choices: the Borderlands, a realm or a quest (an errand follows its quest). */
export const ConnectorChoiceLevel = Schema.Union([
  Schema.TaggedStruct("Borderlands", {}),
  Schema.TaggedStruct("Realm", { realmId: WorkspaceId }),
  Schema.TaggedStruct("Quest", { missionId: MissionId }),
]);
export type ConnectorChoiceLevel = typeof ConnectorChoiceLevel.Type;

/** An installed connector's choice at one level, as the realm's and the quest's panels show it. */
export const ConnectorChoiceCard = Schema.Struct({
  /** The level's own choice, or null for Inherit. */
  choice: Schema.NullOr(ConnectorChoice),
  connectorId: Schema.String,
  /** What Inherit gives at this level, ignoring the global switch: the placement's choice, else On. */
  inherited: ConnectorChoice,
  /** Where an inherited choice comes from when one is stored there, or null when nothing is stored above and it is On. */
  inheritedFrom: Schema.NullOr(Schema.Literals(["Borderlands", "Realm"])),
  /** The global switch: off, the connector is unavailable everywhere whatever the level says. */
  isEnabled: Schema.Boolean,
  name: Schema.String,
  /** Ready, or Needs connecting: a choice can be made for a connector that is not yet connected. */
  state: ConnectorState,
});
export type ConnectorChoiceCard = typeof ConnectorChoiceCard.Type;

/**
 * Reads every installed connector's choice at one level: what a realm's panel and a quest's panel list. A connector being
 * removed is left out.
 */
export const ReadConnectorChoices = Schema.TaggedStruct("ReadConnectorChoices", { level: ConnectorChoiceLevel });

/**
 * Sets a connector's switch at one level: On or Off, or Reset to Inherit. The global switch has no Inherit. Off stops
 * the connector's calls at once; On and Reset apply from a thread's next turn.
 */
export const SetConnectorSwitch = Schema.TaggedStruct("SetConnectorSwitch", {
  choice: Schema.Literals(["On", "Off", "Reset"]),
  connectorId: Schema.String,
  level: ConnectorSwitchLevel,
});

/**
 * Switches one tool of a connector on or off, for every thread everywhere. Off stops its calls at once; on applies from
 * a thread's next turn. The switch never changes how the tool is classified.
 */
export const SetConnectorTool = Schema.TaggedStruct("SetConnectorTool", {
  connectorId: Schema.String,
  isOn: Schema.Boolean,
  tool: Schema.String,
});

/** Chooses which apps of Apple apps are on; an app turned off stops its calls at once. */
export const ChooseAppleApps = Schema.TaggedStruct("ChooseAppleApps", {
  apps: Schema.Array(Schema.String),
  connectorId: Schema.String,
});

/** One app's macOS Automation permission, as asked through the connector's own child process. */
export const ApplePermissionStatus = Schema.Literals(["Allowed", "NotAllowed", "NotAskedYet"]);
export type ApplePermissionStatus = typeof ApplePermissionStatus.Type;

/** What asking for Apple apps' permission answers: each chosen app and its status. */
export const ApplePermissionReport = Schema.Struct({
  apps: Schema.Array(Schema.Struct({ app: Schema.String, status: ApplePermissionStatus })),
});
export type ApplePermissionReport = typeof ApplePermissionReport.Type;

/**
 * Asks macOS, through the connector's own child process, whether each chosen app of Apple apps allows Automation.
 * Only the host's own window may ask: a paired device gets the report's statuses, never the asking.
 */
export const RequestApplePermission = Schema.TaggedStruct("RequestApplePermission", { connectorId: Schema.String });

/** The requests that read or change connectors. */
export const connectorRequests = [
  ListConnectors,
  ReadConnectorChoices,
  InstallConnector,
  RemoveConnector,
  SetConnectorSwitch,
  SetConnectorTool,
  ChooseAppleApps,
  RequestApplePermission,
] as const;

/** What each connector request answers: the connector's card after the change, or every card. */
export const connectorResults = {
  ChooseAppleApps: ConnectorCard,
  InstallConnector: ConnectorCard,
  ListConnectors: Schema.Array(ConnectorCard),
  ReadConnectorChoices: Schema.Array(ConnectorChoiceCard),
  RemoveConnector: ConnectorCard,
  RequestApplePermission: ApplePermissionReport,
  SetConnectorSwitch: ConnectorCard,
  SetConnectorTool: ConnectorCard,
} as const;

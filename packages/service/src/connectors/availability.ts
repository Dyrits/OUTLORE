// Who may use what (connectors blueprint, `availability.ts`; connectors specification, Where a connector is available).
// Pure: the store reads the facts and this decides.

/** An explicit choice of a connector at one level; Inherit is no choice. */
export type SwitchChoice = "On" | "Off";

/**
 * Who asks: a quest (an errand and a Ritual's quest are quests of their own, and an errand's subject is its quest's), with the realm its top thread is in at the time of asking, or Chronicler, which follows the global switch alone.
 */
export type Subject =
  | { readonly _tag: "Chronicler" }
  | { readonly _tag: "Quest"; readonly missionId: string; readonly realmId: string | null };

/** The explicit choices stored for one connector. */
export type ConnectorChoices = {
  readonly borderlands: SwitchChoice | null;
  readonly quests: ReadonlyMap<string, SwitchChoice>;
  readonly realms: ReadonlyMap<string, SwitchChoice>;
};

/** What the store holds of one connector that decides whether a thread may be given its tools. */
export type Standing = {
  readonly choices: ConnectorChoices;
  /** Whether the owner has given it what it needs: no refused sign-in is recorded and every secret it needs is held. */
  readonly isConnected: boolean;
  /** The global switch. */
  readonly isEnabled: boolean;
  readonly isInstalled: boolean;
  /** A removal is under way: the connector is unusable from the first step. */
  readonly isRemoving: boolean;
};

/** No choice anywhere. */
export const noChoices: ConnectorChoices = { borderlands: null, quests: new Map(), realms: new Map() };

/**
 * Whether the connector is usable by the subject: installed, connected, not being removed and switched on globally, and then the quest's own choice, else the choice of its placement (its realm, or the Borderlands only for a quest with no realm: they are alternatives, never a chain), else On.
 * A realm's or the Borderlands' Inherit means the global switch.
 */
export const isUsableBy = (standing: Standing, subject: Subject) => {
  if (!standing.isInstalled || standing.isRemoving || !standing.isConnected || !standing.isEnabled) return false;
  if (subject._tag === "Chronicler") return true;
  const own = standing.choices.quests.get(subject.missionId);
  if (own !== undefined) return own === "On";
  const placement =
    subject.realmId === null ? standing.choices.borderlands : (standing.choices.realms.get(subject.realmId) ?? null);
  return placement === null || placement === "On";
};

/** A tool as availability needs to know it: its exact name, and its app when the connector has apps. */
export type OfferedTool = {
  readonly app: string | null;
  readonly name: string;
};

/** The extra facts that decide one tool, beyond its connector. */
export type ToolStanding = {
  /** The apps the owner chose, or null for a connector with no apps. */
  readonly chosenApps: ReadonlySet<string> | null;
  /** The tools switched off, by exact name. */
  readonly offTools: ReadonlySet<string>;
};

/**
 * Whether the thread is offered the tool: its connector is usable by the subject, the tool is not switched off, and for a connector with apps the tool's app is known and chosen.
 * A tool whose app the catalog does not name is not offered: its app cannot be checked, so the choice of apps could not be kept.
 */
export const isToolOffered = (standing: Standing, tools: ToolStanding, tool: OfferedTool, subject: Subject) => {
  if (!isUsableBy(standing, subject)) return false;
  if (tools.offTools.has(tool.name)) return false;
  if (tools.chosenApps === null) return true;
  return tool.app !== null && tools.chosenApps.has(tool.app);
};

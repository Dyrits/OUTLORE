import type { ConnectorChoice, ConnectorChoiceCard, ConnectorChoiceLevel } from "@outlore/contracts";

// What a connector's switch shows at the Borderlands, a realm or a quest (connectors specification, Where a connector
// is available): an ordinary switch with an "inherited" mark and a Reset that goes back to Inherit. Decided here, in
// plain code, so the screens only draw it.

/** What one switch shows. */
export type ChoiceView = {
  /** Whether Reset is offered: the level has a choice of its own to take back. */
  readonly canReset: boolean;
  /** Whether the switch cannot be turned: the connector is off everywhere, whatever this level says. */
  readonly isDisabled: boolean;
  /** What the switch shows now: its own choice, else what it inherits. */
  readonly isOn: boolean;
  /** The words under the label (inherited, or why it is locked), or null when the level's own choice shows. */
  readonly note: string | null;
};

/** Where an inherited choice comes from, in the words of the note. */
const originNotes = {
  Borderlands: "Inherited from the Borderlands",
  Realm: "Inherited from the realm",
} as const;

/** The note on a switch that follows the level above. */
const inheritedNoteOf = (inheritedFrom: ConnectorChoiceCard["inheritedFrom"]) =>
  inheritedFrom === null ? "Inherited" : originNotes[inheritedFrom];

/** The words when the connector's own switch, on its card, is off: no level can turn it on. */
export const globalOffNote = "Off everywhere: the connector's own switch is off";

/** What a switch shows, from the level's own choice, what it inherits and the connector's global switch. */
export const choiceViewOf = (
  card: Pick<ConnectorChoiceCard, "choice" | "inherited" | "inheritedFrom" | "isEnabled">,
): ChoiceView => {
  const canReset = card.choice !== null;
  if (!card.isEnabled) return { canReset, isDisabled: true, isOn: false, note: globalOffNote };
  if (card.choice !== null) return { canReset, isDisabled: false, isOn: card.choice === "On", note: null };
  return {
    canReset,
    isDisabled: false,
    isOn: card.inherited === "On",
    note: inheritedNoteOf(card.inheritedFrom),
  };
};

/** The choice a turned switch stores: the switch's new position, made explicit. */
export const choiceOfSwitch = (isOn: boolean): ConnectorChoice => (isOn ? "On" : "Off");

/** The key a level's read is kept under, so each panel reads its own level once and again after a change. */
export const levelKeyOf = (level: ConnectorChoiceLevel) =>
  `connector-choices:${level._tag}:${level._tag === "Realm" ? level.realmId : level._tag === "Quest" ? level.missionId : ""}`;

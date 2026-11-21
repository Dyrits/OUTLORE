import type { MissionId, RitualCompanion, RitualSchedule, RitualScope } from "@outlore/contracts";

/**
 * The request that makes a Ritual (CHG-0616): its realm comes from the origin quest — whose realm and folder it then
 * works in — or from the folder chosen in the form. Nothing runs until it is due or run by hand.
 */
export const createRequestOf = (form: {
  fallbacks: ReadonlyArray<RitualCompanion>;
  instruction: string;
  /** The quest the Ritual is scheduled from, which its realm is taken from; null when there is none. */
  originMissionId: MissionId | null;
  primary: RitualCompanion;
  /** The request's id, from `newRequestId`. */
  requestId: string;
  schedule: RitualSchedule;
  /** The owner's reviewed scope, as the form built it; empty when none was set. */
  scope: RitualScope;
  title: string;
  workspacePath: string | null;
}) => ({
  _tag: "CreateRitual" as const,
  fallbacks: form.fallbacks,
  instruction: form.instruction,
  // The origin quest names the realm the Ritual lives in; a folder chosen in the form is ignored when there is one.
  ...(form.originMissionId === null ? {} : { originMissionId: form.originMissionId }),
  primary: form.primary,
  requestId: form.requestId,
  schedule: form.schedule,
  scope: form.scope,
  title: form.title,
  workspacePath: form.originMissionId === null ? form.workspacePath : null,
});

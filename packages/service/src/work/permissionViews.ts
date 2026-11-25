import { Effect } from "effect";
import { readSettings, sandboxProblem } from "../core/index.ts";
import { listPermissions, listQuestionHistory } from "../policy/index.ts";

/** The owner's permission page, including the host's available sandbox. */
export const readPermissionsView = Effect.fnUntraced(function* (missionId: string | null) {
  const settings = yield* readSettings;
  return {
    defaultMode: settings.defaultPermissionMode,
    history: yield* listQuestionHistory(missionId),
    permissions: yield* listPermissions,
    sandboxProblem: yield* sandboxProblem,
  };
});

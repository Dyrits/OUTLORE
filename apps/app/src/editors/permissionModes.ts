import { ThreadPermissionMode as PermissionModes, type ThreadPermissionMode } from "@outlore/contracts";

// The four permission modes, named alike wherever the owner chooses them (action-approval, Permission modes; CHG-0617):
// the Workshop's default and the composer's per-thread choice.

/** The labels of the four permission modes, shared by the Workshop and the composer. */
export const permissionModeLabels = {
  Auto: "Auto",
  AutoAcceptEdits: "Auto-accept edits",
  FullAccess: "Full access",
  Supervised: "Supervised",
} as const satisfies Record<ThreadPermissionMode, string>;

/** The four modes, in the order the pickers list them. */
export const permissionModeOptions = PermissionModes.literals;

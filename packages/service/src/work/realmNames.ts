import { Effect } from "effect";
import { invalid } from "../core/index.ts";
import { hasActiveRealmName } from "./realmResolution.ts";

/** Names are labels: an active collision needs acknowledgement, never a uniqueness constraint. */
export const validateRealmName = Effect.fn("validateRealmName")(function* (
  name: string,
  exceptId: string | null,
  shouldAllowDuplicateName: boolean,
) {
  const trimmed = name.trim();
  if (trimmed === "" || trimmed.length > 80) return yield* invalid("A realm needs a name of 1 to 80 characters.");
  if (!shouldAllowDuplicateName) {
    if (yield* hasActiveRealmName(trimmed, exceptId))
      return yield* invalid(`Another active realm is named "${trimmed}". Confirm to use this name.`);
  }
  return trimmed;
});

import { realmSlugOf } from "@outlore/contracts";
import { Effect } from "effect";
import { invalid } from "../core/index.ts";
import { hasActiveRealmName } from "./realmResolution.ts";

/**
 * Names are labels written like a Slack channel (lowercase words joined by hyphens), so the name asked for is kept as its
 * slug. An active collision needs acknowledgement, never a uniqueness constraint.
 */
export const validateRealmName = Effect.fn("validateRealmName")(function* (
  name: string,
  exceptId: string | null,
  shouldAllowDuplicateName: boolean,
) {
  const trimmed = realmSlugOf(name);
  if (trimmed === "" || trimmed.length > 80)
    return yield* invalid("A realm needs a name of 1 to 80 characters, with letters or digits.");
  if (!shouldAllowDuplicateName) {
    if (yield* hasActiveRealmName(trimmed, exceptId))
      return yield* invalid(`Another active realm is named "${trimmed}". Confirm to use this name.`);
  }
  return trimmed;
});

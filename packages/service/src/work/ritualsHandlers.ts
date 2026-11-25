import { Effect } from "effect";
import type { HandlerDependencies, OwnerHandlers } from "./requestContext.ts";
import { validateScope } from "./ritualScope.ts";
import { createRitual, deleteRitual, listRituals, readRitual, updateRitual } from "./ritualStore.ts";
import { runRitual } from "./rituals.ts";
/** Requests for rituals share the service request context. */
export const ritualsHandlers = ({ commands }: Pick<HandlerDependencies, "commands">) =>
  ({
    CreateRitual: (create) =>
      commands.run(
        commands.once(
          create.requestId,
          create._tag,
          Effect.flatMap(validateScope(create.scope ?? []), (scope) =>
            createRitual({
              fallbacks: create.fallbacks,
              instruction: create.instruction,
              // The origin quest, when there is one, names the realm the Ritual lives in (rituals, Creation).
              originMissionId: create.originMissionId ?? null,
              primary: create.primary,
              realm: create.realm ?? null,
              schedule: create.schedule,
              scope,
              title: create.title,
              workspacePath: create.workspacePath,
            }),
          ),
        ),
      ),
    // The deletion erases the Ritual's whole tree and posts its own follow-ups; no outer wrap, or it would nest.
    DeleteRitual: (given) => deleteRitual(given.ritualId),
    ListRituals: () => listRituals,
    ReadRitual: (read) => readRitual(read.missionId),
    RunRitual: (given) => commands.run(runRitual(given.ritualId)),
    UpdateRitual: (update) =>
      commands.run(
        Effect.flatMap(validateScope(update.scope ?? []), (scope) =>
          updateRitual({
            fallbacks: update.fallbacks,
            instruction: update.instruction,
            isOn: update.isOn,
            primary: update.primary,
            ritualId: update.ritualId,
            schedule: update.schedule,
            // Left out, the reviewed scope stays; given, it replaces it, and empty revokes it.
            ...(update.scope === undefined ? {} : { scope }),
            title: update.title,
          }),
        ),
      ),
  }) satisfies OwnerHandlers<
    "CreateRitual" | "DeleteRitual" | "ListRituals" | "ReadRitual" | "RunRitual" | "UpdateRitual"
  >;

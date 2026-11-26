import type { HarnessName } from "@outlore/contracts";
import { Effect, Record } from "effect";
import { routeHarnesses } from "../core/index.ts";
import {
  antigravityDefinition,
  clineDefinition,
  copilotDefinition,
  cursorDefinition,
  devinDefinition,
  hermesDefinition,
} from "./acpHarnessDefinitions.ts";
import type { AdapterOptions, HarnessDefinition, LaunchOverride } from "./harnessDefinition.ts";
import {
  claudeDefinition,
  codexDefinition,
  museDefinition,
  opencodeDefinition,
  piDefinition,
  vibeDefinition,
} from "./nativeHarnessDefinitions.ts";

// The harness registry (provider-accounts): each harness defined once, by its facts, its turn adapter, and what Outlore asks its own tool about sign-in and models.
// `makeHarnessRouter` derives its entries from `harnesses`.

export type { AdapterOptions, HarnessDefinition, LaunchOverride } from "./harnessDefinition.ts";

/** Every harness, by name. */
export const harnesses = {
  antigravity: antigravityDefinition,
  claude: claudeDefinition,
  cline: clineDefinition,
  codex: codexDefinition,
  copilot: copilotDefinition,
  cursor: cursorDefinition,
  devin: devinDefinition,
  hermes: hermesDefinition,
  muse: museDefinition,
  opencode: opencodeDefinition,
  pi: piDefinition,
  vibe: vibeDefinition,
} satisfies Record<HarnessName, HarnessDefinition>;

/**
 * The adapter the app runs turns through: each harness's own, started from its definition (provider-accounts).
 * A check passes `launches` to run stand-ins in the executables' place; it is the only way a test builds the router, so the registration glue runs in the suite.
 */
export const makeHarnessRouter = (
  commands: Record<HarnessName, string>,
  options: Omit<AdapterOptions, "command" | "launch">,
  launches: Partial<Record<HarnessName, LaunchOverride>> = {},
) =>
  Effect.all(
    Record.map(harnesses, (definition, name) => {
      const launch = launches[name];
      return definition.makeAdapter({
        ...options,
        command: commands[name],
        ...(launch === undefined ? {} : { launch }),
      });
    }),
  ).pipe(Effect.map(routeHarnesses));

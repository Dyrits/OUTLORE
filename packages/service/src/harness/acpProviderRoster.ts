import type { HarnessName } from "@outlore/contracts";
import type { AcpProviderDefinition } from "./acpProviderDefinition.ts";
import { antigravity } from "./antigravityProvider.ts";
import { cline } from "./clineProvider.ts";
import { copilot } from "./copilotProvider.ts";
import { cursor } from "./cursorProvider.ts";
import { devin } from "./devinProvider.ts";
import { hermes } from "./hermesProvider.ts";

/**
 * The harnesses that run through the generic ACP adapter, each with the one definition its launch, model probe, sign-in and inspection read.
 * A harness absent here has its own adapter and keeps its own facts in the catalog.
 */
export const acpProviders: Partial<Readonly<Record<HarnessName, AcpProviderDefinition>>> = {
  antigravity,
  cline,
  copilot,
  cursor,
  devin,
  hermes,
};

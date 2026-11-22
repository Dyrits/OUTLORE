import { Effect } from "effect";
import { HarnessFailure, textFieldOf } from "../core/index.ts";
import type { PiProcess } from "./piRpc.ts";

// Pi's tool sources stay denied until Outlore-side mediation of what Pi would run is proven: a Pi harness starts
// with piDenialArgs, refuses every question Pi asks the user, and ends any turn in which Pi runs a tool anyway,
// rather than let a tool run that Outlore never approved (fail-closed; OpenBot provider-parity batch).

/** The flags that deny Pi every tool source of its own; a Pi harness starts no turn without them. */
export const piDenialArgs: ReadonlyArray<string> = ["--no-tools", "--no-extensions", "--no-mcp", "--no-approve"];

/** Refuses one of Pi's questions to the user (`extension_ui_request`): cancelled, never answered. */
export const denyPiUiRequest = (pi: PiProcess, record: unknown): Effect.Effect<void> =>
  Effect.sync(() => {
    const id = textFieldOf(record, "id");
    if (id !== null) pi.send({ cancelled: true, id, type: "extension_ui_response" });
  });

/** Whether Pi started or ended a tool execution, which the denial flags should have kept from ever running. */
export const isPiToolExecution = (record: unknown): boolean =>
  ["tool_execution_end", "tool_execution_start"].includes(textFieldOf(record, "type") ?? "");

/** The breach a tool execution under denial reads as: the turn ends rather than run what Outlore never approved. */
export const piToolBreachOf = (record: unknown): HarnessFailure =>
  new HarnessFailure({
    reason: `Pi ran a tool ("${textFieldOf(record, "toolName") ?? "unknown"}") although its tools are denied; the turn was ended.`,
  });

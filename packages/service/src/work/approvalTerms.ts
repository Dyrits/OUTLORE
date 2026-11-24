import type { HarnessName, StandingPermission } from "@outlore/contracts";
import { Effect } from "effect";
import { type ApprovalTerms, Harness } from "../core/index.ts";
import { approvalInstructionsOf } from "../harness/index.ts";
import { listThreadPermissions } from "../policy/index.ts";
import { readModeOfTurn, termsOfMode } from "./threadPermissionMode.ts";

// A thread's approval terms (CHG-0301): read once here for its turn and for the preview of its starting context, so
// what a thread is told and what the owner is shown before opening one cannot drift apart.

/** Each kind of standing permission once, sorted so that removing one of several of a kind changes nothing. */
export const permissionKindsOf = (permissions: ReadonlyArray<StandingPermission>) =>
  [...new Set(permissions.map((permission) => permission.sentence))].toSorted();

/**
 * How the thread's actions are approved on this harness now: the mode of the turn it runs (its admitted mode, which
 * an in-turn change leaves alone; between turns the thread's and the Workshop's choice), whether the harness's
 * adapter runs it in an enforced sandbox here, and the kinds of standing permission that apply to it.
 */
export const readApprovalTerms = Effect.fnUntraced(function* (threadId: string, harnessName: HarnessName) {
  const harness = yield* Harness;
  const modeTerms = termsOfMode(yield* readModeOfTurn(threadId));
  const permissions = yield* listThreadPermissions(threadId);
  return {
    ...modeTerms,
    // A harness whose adapter reports nothing counts as unprotected, as Approvals judges it (approvals.ts).
    containment: harness.containmentOf?.(harnessName, modeTerms.approvalLevel) ?? "Unprotected",
    permissionKinds: permissionKindsOf(permissions),
  } satisfies ApprovalTerms;
});

/** The approval rules the thread's harness appends to its system part (harness/instructions.ts), from its terms. */
export const readApprovalInstructions = (threadId: string, harnessName: HarnessName) =>
  readApprovalTerms(threadId, harnessName).pipe(Effect.map((terms) => approvalInstructionsOf(terms, harnessName)));

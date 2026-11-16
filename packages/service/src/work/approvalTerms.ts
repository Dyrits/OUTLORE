import type { HarnessName, StandingPermission } from "@outlore/contracts";
import { Effect } from "effect";
import { type ApprovalTerms, Harness, readSettings } from "../core/index.ts";
import { approvalInstructionsOf } from "../harness/index.ts";
import { listThreadPermissions } from "../policy/index.ts";

// A thread's approval terms (CHG-0301): read once here for its turn and for the preview of its starting context, so
// what a thread is told and what the owner is shown before opening one cannot drift apart.

/** Each kind of standing permission once, sorted so that removing one of several of a kind changes nothing. */
export const permissionKindsOf = (permissions: ReadonlyArray<StandingPermission>) =>
  [...new Set(permissions.map((permission) => permission.sentence))].toSorted();

/**
 * How the thread's actions are approved on this harness now: the owner's level and escape setting, whether the
 * harness's adapter runs it in an enforced sandbox here, and the kinds of standing permission that apply to it.
 */
export const readApprovalTerms = Effect.fnUntraced(function* (threadId: string, harnessName: HarnessName) {
  const harness = yield* Harness;
  const { approvalLevel, shouldAllowOutsideSandbox } = yield* readSettings;
  const permissions = yield* listThreadPermissions(threadId);
  return {
    approvalLevel,
    canWorkOutsideSandbox: shouldAllowOutsideSandbox,
    // A harness whose adapter reports nothing counts as unprotected, as Approvals judges it (approvals.ts).
    containment: harness.containmentOf?.(harnessName, approvalLevel) ?? "Unprotected",
    permissionKinds: permissionKindsOf(permissions),
  } satisfies ApprovalTerms;
});

/** The approval rules the thread's harness appends to its system part (harness/instructions.ts), from its terms. */
export const readApprovalInstructions = (threadId: string, harnessName: HarnessName) =>
  readApprovalTerms(threadId, harnessName).pipe(Effect.map((terms) => approvalInstructionsOf(terms, harnessName)));

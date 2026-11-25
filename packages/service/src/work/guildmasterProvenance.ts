import { Context, Effect, Match } from "effect";
import type { SqlClient } from "effect/sql";
import { type ToolAnswer, toolRefusal } from "../core/index.ts";
import { isNamedByOwner } from "../policy/index.ts";
import type { Approvals } from "./approvals.ts";
import { type DerivedAction, deriveAction, readRitualOfThread, type StructuralTool } from "./guildmasterDerivation.ts";
import { clip } from "./guildmasterText.ts";
import { isRitualRunTurn, readOwnerTexts } from "./messageProvenance.ts";
import { coveringEntryOf } from "./ritualScope.ts";
import type { ArgumentsOf } from "./threadTools.ts";
import { readRunningTurnId } from "./turnAdmission.ts";

// Structural actions by provenance (CHG-0208), replacing the quoted-words check and the one-click guards. The service
// derives the operation, its resolved target and its new value from the tool call. The authority comes from the owner:
// their own message of the current turn naming that action exactly, or a Ritual's reviewed scope during one of its
// runs; otherwise one exact question, Allow or Deny. The model supplies no evidence, and agent-written text (thread
// messages, reports, a Ritual's run message) is never the owner's.

/** Where the authority for a derived action comes from, or that the owner must be asked. */
type Authority =
  | { readonly _tag: "Owner"; readonly evidence: string }
  | { readonly _tag: "Scope"; readonly evidence: string }
  | { readonly _tag: "Ask" };

/** The owner's own words of this turn naming the action exactly, or the Ritual's reviewed scope in a run; else ask. */
const readAuthority = Effect.fnUntraced(function* (callerId: string, derived: DerivedAction) {
  const turnId = yield* readRunningTurnId(callerId);
  if (turnId === null || derived.shouldAsk) return { _tag: "Ask" } satisfies Authority;
  const named = (yield* readOwnerTexts(callerId, turnId)).find((text) => isNamedByOwner(text, derived.named));
  if (named !== undefined) return { _tag: "Owner", evidence: clip(named, 400) } satisfies Authority;
  if (derived.scoped !== null) {
    const ritual = yield* readRitualOfThread(callerId);
    if (ritual !== null && (yield* isRitualRunTurn(callerId, turnId))) {
      const entry = coveringEntryOf(ritual.scope, derived.scoped);
      if (entry !== null)
        return {
          _tag: "Scope",
          evidence: `The Ritual's reviewed scope: ${entry.operation} ${entry.target}${entry.payload === null ? "" : ` → ${entry.payload}`}`,
        } satisfies Authority;
    }
  }
  return { _tag: "Ask" } satisfies Authority;
});

/** The one-use proof, handed only to this invocation, that its exact action was authorized. */
type Receipt = {
  readonly fingerprint: string;
  isUsed: boolean;
  readonly key: string;
};

// Only the fiber that ran the authorization holds it; tool arguments cannot make one.
const receiptReference = Context.Reference<Receipt | null>("outlore/StructuralReceipt", { defaultValue: () => null });
const keyOf = (callerId: string, tool: StructuralTool, args: object) => JSON.stringify([callerId, tool, args]);

/**
 * Spends this invocation's receipt inside the mutation's transaction, after deriving the action again: a changed turn,
 * target, value, or set of threads at work means it no longer matches what was authorized, and nothing runs.
 */
export const consumeReceipt = Effect.fnUntraced(function* <Tool extends StructuralTool>(
  callerId: string,
  tool: Tool,
  args: ArgumentsOf<Tool>,
) {
  const receipt = yield* receiptReference;
  if (receipt === null || receipt.isUsed || receipt.key !== keyOf(callerId, tool, args)) return false;
  receipt.isUsed = true;
  const now = yield* deriveAction(callerId, tool, args).pipe(Effect.orDie);
  return now !== null && now.fingerprint === receipt.fingerprint;
});

/** What a structural tool says when its action was not authorized, or changed before it could run. */
export const notAuthorizedText =
  "Not done: the owner did not authorize this exact action, or its quest, realm, setting, turn, or threads at work changed meanwhile. Nothing was changed.";

/**
 * Authorizes one structural tool call by provenance, outside any transaction, then runs it with a one-use receipt.
 * A call whose action cannot be derived runs without one, so the tool's own checks refuse it with their reason.
 */
export const withProvenance = Effect.fnUntraced(function* <Tool extends StructuralTool>(
  approvals: Approvals["Service"],
  read: <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) => Effect.Effect<A>,
  callerId: string,
  tool: Tool,
  args: ArgumentsOf<Tool>,
  run: (authorize: <A, E, R>(work: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>) => Effect.Effect<ToolAnswer>,
) {
  const derived = yield* read(deriveAction(callerId, tool, args));
  if (derived === null) return yield* run((work) => work);
  const authority = yield* read(readAuthority(callerId, derived));
  const refusal = yield* Match.valueTags(authority, {
    Ask: () =>
      approvals
        .confirmAction(callerId, derived.summary, derived.details)
        .pipe(Effect.map((decision) => (decision.isAllowed ? null : toolRefusal(decision.text)))),
    Owner: () => Effect.succeed(null),
    Scope: () => Effect.succeed(null),
  });
  if (refusal !== null) return refusal;
  const receipt: Receipt = { fingerprint: derived.fingerprint, isUsed: false, key: keyOf(callerId, tool, args) };
  const answer = yield* run((work) => Effect.provideService(work, receiptReference, receipt));
  // A tool that reports success without spending the receipt changed something its authorization never covered: a
  // defect in the tool, which no caller can recover from.
  if (!answer.isError && !receipt.isUsed)
    return yield* Effect.die(new Error(`${tool} succeeded without spending its authorization receipt.`));
  if (answer.isError) return answer;
  // The owner already answered a question that was asked; otherwise the allowance is recorded with its evidence.
  yield* Match.valueTags(authority, {
    Ask: () => Effect.void,
    Owner: ({ evidence }) =>
      approvals.recordDecision(callerId, derived.summary, derived.details, "AllowedByMessage", evidence),
    Scope: ({ evidence }) =>
      approvals.recordDecision(callerId, derived.summary, derived.details, "AllowedByPermission", evidence),
  });
  return answer;
});

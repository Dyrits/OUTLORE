import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { OwnerHandlers } from "../../src/work/requestContext.ts";

// These are checked by the typechecker: an unused @ts-expect-error is itself an error, so each case fails to compile
// when the handler table stops refusing the answer its result schema cannot encode (CHG-0677 shipped such a bug).
describe("The request table answers what each result schema says", () => {
  it("refuses a handler that answers undefined where the result is Null", () => {
    // @ts-expect-error RunRitual's result is Schema.Null, and an undefined answer fails encoding after the work ran.
    const refused = { RunRitual: () => Effect.void } satisfies OwnerHandlers<"RunRitual">;
    expect(refused.RunRitual).toBeTypeOf("function");
  });

  it("accepts a handler that answers null where the result is Null", () => {
    const accepted = { RunRitual: () => Effect.succeed(null) } satisfies OwnerHandlers<"RunRitual">;
    expect(accepted.RunRitual).toBeTypeOf("function");
  });

  it("refuses a handler that answers another request's result", () => {
    // @ts-expect-error ReadHostName answers a name, not null.
    const refused = { ReadHostName: () => Effect.succeed(null) } satisfies OwnerHandlers<"ReadHostName">;
    expect(refused.ReadHostName).toBeTypeOf("function");
  });
});

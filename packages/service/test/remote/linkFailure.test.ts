import { LinkFailure, pairWithCode } from "@outlore/controller";
import { Effect } from "effect";
import { expect, it } from "vitest";

it("reports an invalid pairing code as a typed failure without touching storage", async () => {
  const unused = async (): Promise<never> => {
    throw new Error("storage was called");
  };
  const failure = await Effect.runPromise(
    Effect.flip(
      pairWithCode(
        "not a pairing code",
        "browser",
        { link: unused, save: unused, touch: unused },
        {
          allowLocalRelay: false,
          kind: "browser",
          release: "test",
        },
      ),
    ),
  );
  expect(failure).toBeInstanceOf(LinkFailure);
  expect(failure.kind).toBe("invalid");
});

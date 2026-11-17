import { Effect } from "effect";

/** A fresh random id, read inside Effect so tests and callers see it as an effect, not a hidden side effect. */
export const newId: Effect.Effect<string> = Effect.sync(() => crypto.randomUUID());

import { Schema } from "effect";

/** A count or duration of at least one: days, tokens, or a lore half-life. */
export const PositiveInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

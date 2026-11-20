import { Schema } from "effect";

/**
 * A sample of a conversation's last exchange, shown on its reply line: the owner's latest message and the companion's
 * latest reply, each cut short; null while there is none (conversation panes, reply lines).
 */
export const LastExchange = Schema.Struct({
  owner: Schema.NullOr(Schema.String),
  reply: Schema.NullOr(Schema.String),
});
export type LastExchange = typeof LastExchange.Type;

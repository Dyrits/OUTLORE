import { Context, Effect, Layer, Schema } from "effect";

// The Vault as the connectors use it (connectors blueprint, `vault/`).
// The Vault is built apart, in `vault/`, which this folder does not import: this port says what the gateway needs of it, and the service's composition supplies it.

/** The Vault holds no secret of that kind for the connector. */
export class SecretMissing extends Schema.TaggedError<SecretMissing>()("SecretMissing", {
  connector: Schema.String,
  kind: Schema.String,
}) {}

/** The Vault cannot answer now: locked, its key lost, a record corrupt, invalid input, not protected, or a failed read or write. */
export class VaultUnavailable extends Schema.TaggedError<VaultUnavailable>()("VaultUnavailable", {
  reason: Schema.Literals(["Locked", "Lost", "Corrupt", "Failed", "Invalid", "NotProtected"]),
}) {}

/** What the connectors need of the Vault: whether a secret is held, the one read, storing OAuth sessions, and removing secrets. */
export class VaultPort extends Context.Service<
  VaultPort,
  {
    /** Whether the Vault holds a secret of this kind for the connector; never its value. */
    readonly holds: (connector: string, kind: string) => Effect.Effect<boolean, VaultUnavailable>;
    /** Stores or replaces a secret of this kind for the connector, used for OAuth sessions and token refreshes. */
    readonly putOrReplace: (connector: string, kind: string, secret: string) => Effect.Effect<void, VaultUnavailable>;
    /** Removes one secret kind of the connector; removing a missing secret succeeds so switching auth modes is safe. */
    readonly remove: (connector: string, kind: string) => Effect.Effect<void, VaultUnavailable>;
    /** Removes every secret of the connector; removing none is not a failure, so a resumed removal repeats it safely. */
    readonly removeAllOf: (connector: string) => Effect.Effect<void, VaultUnavailable>;
    /** Hands the secret to the callback and keeps nothing: the only read of a secret. */
    readonly withSecret: <A, E, R>(
      connector: string,
      kind: string,
      use: (secret: string) => Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E | SecretMissing | VaultUnavailable, R>;
  }
>()("outlore/connectors/VaultPort") {}

/** A Vault that holds nothing, for a service built before the Vault is wired in: a connector that needs a key never connects. */
export const emptyVaultLayer = Layer.succeed(VaultPort, {
  holds: () => Effect.succeed(false),
  putOrReplace: () => Effect.fail(new VaultUnavailable({ reason: "Failed" })),
  remove: () => Effect.void,
  removeAllOf: () => Effect.void,
  withSecret: (connector, kind) => Effect.fail(new SecretMissing({ connector, kind })),
});

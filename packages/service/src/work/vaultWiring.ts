import { Effect, Layer } from "effect";
import * as Secret from "effect/Redacted";
import { SecretMissing, VaultPort, VaultUnavailable } from "../connectors/index.ts";
import { Vault, type VaultFailure, type VaultState } from "../vault/index.ts";

// The real Vault behind the gateway's VaultPort (connectors blueprint, Order step 3's seam): `work/` is the first
// folder that may import both `connectors/` and `vault/`, so the adapter lives here and the service's composition
// supplies it as `connectorVault`.

/** The Vault's state as the port's failure reason: its own word when there is one, else a plain failure. */
const reasons: Record<VaultState["_tag"], VaultUnavailable["reason"]> = {
  Absent: "Failed",
  Corrupt: "Corrupt",
  Locked: "Locked",
  Lost: "Lost",
  Ready: "Failed",
};

/** The VaultUnavailable the gateway sees for a Vault failure, reading the Vault's state when the failure names one. */
const unavailableOf = (vault: Vault["Service"], failure: VaultFailure): Effect.Effect<VaultUnavailable> =>
  failure.kind === "NotProtected"
    ? Effect.succeed(new VaultUnavailable({ reason: "NotProtected" }))
    : failure.kind === "Invalid"
      ? Effect.succeed(new VaultUnavailable({ reason: "Invalid" }))
      : failure.kind === "Unavailable"
        ? Effect.map(vault.state, (state) => new VaultUnavailable({ reason: reasons[state._tag] }))
        : Effect.succeed(new VaultUnavailable({ reason: "Failed" }));

/** The port's failure for one Vault failure: a missing secret is SecretMissing, anything else VaultUnavailable. */
const portFailureOf = (
  vault: Vault["Service"],
  connector: string,
  kind: string,
  failure: VaultFailure,
): Effect.Effect<never, SecretMissing | VaultUnavailable> =>
  failure.kind === "Missing"
    ? Effect.fail(new SecretMissing({ connector, kind }))
    : Effect.flatMap(unavailableOf(vault, failure), Effect.fail);

/** The real Vault as the connectors read it: holds, the one lending read, and removing a connector's secrets. */
export const vaultPortOf = (vault: Vault["Service"]): VaultPort["Service"] => ({
  holds: (connector, kind) =>
    vault
      .withSecret(connector, kind, () => Effect.succeed(true))
      .pipe(
        Effect.map(() => true),
        Effect.catchTag("VaultFailure", (failure) =>
          failure.kind === "Missing"
            ? Effect.succeed(false)
            : Effect.flatMap(unavailableOf(vault, failure), Effect.fail),
        ),
      ),
  putOrReplace: (connector, kind, secret) =>
    vault
      .replace({ connectorId: connector, kind, secret: Secret.make(secret) })
      .pipe(
        Effect.catchTag("VaultFailure", (failure) =>
          failure.kind === "Missing"
            ? vault
                .put({ connectorId: connector, kind, secret: Secret.make(secret) })
                .pipe(
                  Effect.catchTag("VaultFailure", (putFailure) =>
                    Effect.flatMap(unavailableOf(vault, putFailure), Effect.fail),
                  ),
                )
            : Effect.flatMap(unavailableOf(vault, failure), Effect.fail),
        ),
      ),
  remove: (connector, kind) =>
    vault
      .remove(connector, kind)
      .pipe(
        Effect.catchTag("VaultFailure", (failure) =>
          failure.kind === "Missing" ? Effect.void : Effect.flatMap(unavailableOf(vault, failure), Effect.fail),
        ),
      ),
  removeAllOf: (connector) =>
    vault
      .removeAllOf(connector)
      .pipe(Effect.catchTag("VaultFailure", (failure) => Effect.flatMap(unavailableOf(vault, failure), Effect.fail))),
  withSecret: (connector, kind, use) =>
    Effect.gen(function* () {
      // Read through the Vault first, so only its failure is mapped here and the callback's own error passes through.
      const secret = yield* vault
        .withSecret(connector, kind, (redacted) => Effect.succeed(Secret.value(redacted)))
        .pipe(Effect.catchTag("VaultFailure", (failure) => portFailureOf(vault, connector, kind, failure)));
      return yield* use(secret);
    }),
});

/** The VaultPort layer over the Vault service, so the connectors read the real Vault when no stand-in is given. */
export const vaultPortLayer = Layer.effect(VaultPort, Effect.map(Vault, vaultPortOf));

import { Redacted, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  ClientFrameJson,
  hostOnlyRequestTags,
  PutSecret,
  type Request,
  Results,
  requestSourceRules,
  VaultView,
} from "../src/index.ts";

// The Vault's requests (connectors blueprint, Owner requests and the app): the secret travels wrapped, and nothing
// that answers, records or announces a change ever carries it.

const secret = "sk-outlore-contracts-9f8e7d6c";

describe("a secret request on the wire", () => {
  it("round-trips through the frame codec wrapped in Redacted, so the service stores what was typed", () => {
    const frame = {
      id: "1",
      request: {
        _tag: "PutSecret",
        connectorId: "composio",
        kind: "API key",
        secret: Redacted.make(secret),
      } satisfies Request,
    };
    const wire = Schema.encodeSync(ClientFrameJson)(frame);
    const decoded = Schema.decodeSync(ClientFrameJson)(wire);
    expect(decoded.request._tag).toBe("PutSecret");
    if (decoded.request._tag !== "PutSecret") throw new Error("narrowed");
    expect(Redacted.value(decoded.request.secret)).toBe(secret);
  });

  it("never leaks the value when a request is stringified or formatted plainly", () => {
    const request = {
      _tag: "PutSecret",
      connectorId: "composio",
      kind: "API key",
      secret: Redacted.make(secret),
    } as const;
    expect(JSON.stringify(request)).not.toContain(secret);
    expect(String(request.secret)).not.toContain(secret);
    expect(`${request.secret}`).not.toContain(secret);
  });

  it("answers with a view that has no field for a value, and encodes without one", () => {
    const view: typeof VaultView.Type = {
      entries: [{ addedAt: "2026-11-19T00:00:00.000Z", connectorId: "composio", holder: "Keychain", kind: "API key" }],
      holder: { isReadableFromSandbox: true, label: "Keychain" },
      protection: { isAllowed: true, reason: null, unverified: [] },
      state: "Ready",
      stateReason: null,
    };
    expect(Schema.encodeSync(VaultView)(view)).not.toContain(secret);
    expect(Object.keys(VaultView.fields).sort()).toEqual(["entries", "holder", "protection", "state", "stateReason"]);
  });
});

describe("the Vault's requests as owner requests", () => {
  it("are all five in the request union and the result table, and shared with paired devices, like the connectors'", () => {
    for (const tag of ["ReadVault", "PutSecret", "ReplaceSecret", "RemoveSecret", "VerifyClaudeVaultDenial"] as const) {
      expect(Object.keys(Results), tag).toContain(tag);
      expect(Object.keys(requestSourceRules), tag).toContain(tag);
      expect(hostOnlyRequestTags, tag).not.toContain(tag);
      expect(requestSourceRules[tag].isHostOnly, tag).toBe(false);
    }
    expect(
      Schema.is(PutSecret)({ _tag: "PutSecret", connectorId: "composio", kind: "API key", secret: Redacted.make("x") }),
    ).toBe(true);
  });
});

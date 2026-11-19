import { describe, expect, it } from "@effect/vitest";
import { newKey, openRecord, sealRecord } from "../../src/vault/records.ts";

const fields = { addedAt: "2026-11-19T00:00:00.000Z", connectorId: "composio", id: "record-1", kind: "API key" };

describe("sealing a secret in a record", () => {
  it("opens with the key it was sealed with, and holds the secret in no readable form", () => {
    const { id, key } = newKey();
    const record = sealRecord(key, id, fields, "sk-secret-value");
    expect(openRecord(key, record)).toBe("sk-secret-value");
    expect(JSON.stringify(record)).not.toContain("sk-secret-value");
    expect(JSON.stringify(record)).not.toContain(Buffer.from("sk-secret-value").toString("base64"));
  });

  it("uses a fresh nonce for each record, so one secret sealed twice differs", () => {
    const { id, key } = newKey();
    const first = sealRecord(key, id, fields, "same");
    const second = sealRecord(key, id, fields, "same");
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("does not open with another key", () => {
    const record = sealRecord(newKey().key, "k", fields, "secret");
    expect(openRecord(newKey().key, record)).toBeNull();
  });

  it("does not open when moved to another connector or given another identifier", () => {
    const { id, key } = newKey();
    const record = sealRecord(key, id, fields, "secret");
    expect(openRecord(key, { ...record, connectorId: "apple" })).toBeNull();
    expect(openRecord(key, { ...record, id: "record-2" })).toBeNull();
  });

  it("does not open when the ciphertext or tag was changed", () => {
    const { id, key } = newKey();
    const record = sealRecord(key, id, fields, "secret");
    const flipped = Buffer.from(record.ciphertext, "base64");
    flipped[0] = (flipped[0] ?? 0) ^ 1;
    expect(openRecord(key, { ...record, ciphertext: flipped.toString("base64") })).toBeNull();
    expect(openRecord(key, { ...record, tag: Buffer.alloc(16).toString("base64") })).toBeNull();
  });
});

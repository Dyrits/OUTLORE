import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  hostOnlyRequestTags,
  pairedOnlyRequestTags,
  Request,
  Results,
  ServerFrame,
  sourceRulesOf,
} from "../src/index.ts";

const decodeFrame = Schema.decodeUnknownSync(ServerFrame);
const decodeRequest = Schema.decodeUnknownSync(Request);

describe("the phone call on the wire", () => {
  it("carries a PhoneCall frame among the server frames", () => {
    const call = { _tag: "PhoneCall", args: {}, callId: "c1", deviceId: "d1", tool: "phone_info" };
    expect(decodeFrame(call)).toEqual(call);
  });

  it("still decodes the frames and requests that existed before it", () => {
    expect(decodeFrame({ _tag: "Changed", sequence: 3 })).toEqual({ _tag: "Changed", sequence: 3 });
    expect(decodeFrame({ _tag: "Success", id: "1", value: null })).toMatchObject({ _tag: "Success" });
    expect(decodeRequest({ _tag: "ReadHostName" })).toEqual({ _tag: "ReadHostName" });
    expect(decodeRequest({ _tag: "SetPhoneTools", groups: ["Clipboard"] })).toEqual({
      _tag: "SetPhoneTools",
      groups: ["Clipboard"],
    });
    expect(decodeRequest({ _tag: "AnswerPhoneCall", callId: "c1", outcome: { _tag: "Done", value: 7 } })).toMatchObject(
      { _tag: "AnswerPhoneCall" },
    );
  });

  // A client that cannot decode a frame must drop it, as it does any frame of a later release: the schema rejects it.
  it("rejects a frame of a kind it does not know, so a client drops it", () => {
    expect(() => decodeFrame({ _tag: "ToolFromTheFuture", callId: "c1" })).toThrow();
  });

  it("answers both phone requests with nothing", () => {
    expect(Object.keys(Results)).toEqual(expect.arrayContaining(["SetPhoneTools", "AnswerPhoneCall"]));
    expect(Schema.decodeUnknownSync(Results.SetPhoneTools)(null)).toBeNull();
    expect(Schema.decodeUnknownSync(Results.AnswerPhoneCall)(null)).toBeNull();
  });
});

describe("who may send the phone requests", () => {
  it("limits both to a paired device and neither to the host", () => {
    expect([...pairedOnlyRequestTags].sort()).toEqual(["AnswerPhoneCall", "SetPhoneTools"]);
    expect(hostOnlyRequestTags).not.toContain("SetPhoneTools");
    expect(sourceRulesOf({ _tag: "SetPhoneTools", groups: [] }).isPairedOnly).toBe(true);
    expect(sourceRulesOf({ _tag: "ReadHostName" }).isPairedOnly).toBe(false);
  });
});

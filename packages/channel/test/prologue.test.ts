import { describe, expect, it } from "vitest";
import { roomPrologue } from "../src/index.ts";

describe("building the room prologue", () => {
  it("names the room, so another room's handshake does not fit", () => {
    expect(new TextDecoder().decode(roomPrologue("abc"))).toBe("outlore/1 abc");
    expect(roomPrologue("abc")).not.toEqual(roomPrologue("abd"));
  });
});

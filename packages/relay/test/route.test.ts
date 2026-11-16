import { expect, it } from "vitest";
import { parseConnect } from "../src/route.ts";

it("accepts only a canonical base64url host claim", () => {
  const path = "/r/abcdefghijklmnop?role=host&claim=";
  expect(parseConnect(`${path}AAAAAAAAAAAAAAAAAAAAAA`)?.claim).toEqual(new Uint8Array(16));
  expect(parseConnect(`${path}AAAAAAAAAAAAAAAAAAAAAB`)).toBeNull();
});

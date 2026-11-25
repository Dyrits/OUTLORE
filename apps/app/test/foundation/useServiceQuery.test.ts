import type { OpenTransport, TransportHandlers } from "@outlore/controller";
import { expect, it, vi } from "vitest";
import { ServiceClient } from "../../src/foundation/client";
import { useServiceQuery } from "../../src/foundation/useServiceQuery";

const { setSnapshot } = vi.hoisted(() => ({ setSnapshot: vi.fn() }));

vi.mock("react", () => ({
  useEffect: (start: () => () => void) => start(),
  useState: (initial: unknown) => [typeof initial === "function" ? initial() : initial, setSnapshot],
}));

const shownBy = (update: unknown) =>
  (update as (previous: { data: unknown; error: string | null }) => unknown)({ data: null, error: null });

it("shows completed reads during host changes, queues one follow-up, and ignores an unchanged answer", async () => {
  const sent = vi.fn();
  let receive: TransportHandlers["onText"] = () => {};
  const open: OpenTransport = (handlers) => {
    receive = handlers.onText;
    queueMicrotask(handlers.onOpen);
    return { close: () => {}, isOpen: true, send: sent };
  };
  const client = await ServiceClient.connectThrough(open, "fixture-host");
  useServiceQuery(client, { _tag: "ReadChronicle" }, "chronicle");
  receive(JSON.stringify({ _tag: "Changed", sequence: 1 }));
  receive(JSON.stringify({ _tag: "Changed", sequence: 2 }));
  receive(JSON.stringify({ _tag: "Success", id: "1", value: [] }));
  await Promise.resolve();
  expect(setSnapshot.mock.calls.map(([update]) => shownBy(update))).toContainEqual({ data: [], error: null });
  expect(sent).toHaveBeenCalledTimes(2);
  const shownSoFar = setSnapshot.mock.calls.length;

  receive(JSON.stringify({ _tag: "Success", id: "2", value: [] }));
  await Promise.resolve();
  expect(setSnapshot).toHaveBeenCalledTimes(shownSoFar);
  expect(sent).toHaveBeenCalledTimes(2);
  client.close();
});

import type { OpenTransport, TransportHandlers } from "@outlore/controller";
import { expect, it, vi } from "vitest";
import { ServiceClient } from "../../src/foundation/client";
import { useServiceQuery } from "../../src/foundation/useServiceQuery";

const { setters } = vi.hoisted(() => ({ setters: [vi.fn(), vi.fn()] }));

vi.mock("react", () => ({
  useEffect: (start: () => () => void) => start(),
  useState: (initial: null) => [initial, setters.shift()],
}));

it("shows completed reads during host changes and only queues one follow-up", async () => {
  const sent = vi.fn();
  let receive: TransportHandlers["onText"] = () => {};
  const open: OpenTransport = (handlers) => {
    receive = handlers.onText;
    queueMicrotask(handlers.onOpen);
    return { close: () => {}, isOpen: true, send: sent };
  };
  const client = await ServiceClient.connectThrough(open, "fixture-host");
  const setData = vi.fn();
  setters.splice(0, setters.length, setData, vi.fn());
  useServiceQuery(client, { _tag: "ReadChronicle" }, "chronicle");
  receive(JSON.stringify({ _tag: "Changed", sequence: 1 }));
  receive(JSON.stringify({ _tag: "Changed", sequence: 2 }));
  receive(JSON.stringify({ _tag: "Success", id: "1", value: [] }));
  await Promise.resolve();
  expect(setData).toHaveBeenCalledWith([]);
  expect(sent).toHaveBeenCalledTimes(2);

  receive(JSON.stringify({ _tag: "Success", id: "2", value: [] }));
  await Promise.resolve();
  expect(setData).toHaveBeenCalledTimes(2);
  expect(sent).toHaveBeenCalledTimes(2);
  client.close();
});

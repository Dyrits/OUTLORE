import type { OpenTransport, TransportHandlers } from "@outlore/controller";
import { expect, it, vi } from "vitest";
import { ServiceClient } from "../../src/foundation/client";
import { useServiceQuery } from "../../src/foundation/useServiceQuery";

const { cleanups, setSnapshot } = vi.hoisted(() => ({ cleanups: [] as Array<() => void>, setSnapshot: vi.fn() }));

vi.mock("react", () => ({
  useEffect: (start: () => (() => void) | undefined) => {
    const cleanup = start();
    if (cleanup !== undefined) cleanups.push(cleanup);
  },
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

const connected = async () => {
  const sent = vi.fn();
  let receive: TransportHandlers["onText"] = () => {};
  const open: OpenTransport = (handlers) => {
    receive = handlers.onText;
    queueMicrotask(handlers.onOpen);
    return { close: () => {}, isOpen: true, send: sent };
  };
  const client = await ServiceClient.connectThrough(open, "fixture-host");
  return { client, receive: (text: string) => receive(text), sent };
};

it("asks nothing for a null request", async () => {
  const { client, sent } = await connected();
  const shown = setSnapshot.mock.calls.length;
  useServiceQuery(client, null, "nothing");
  await Promise.resolve();
  expect(sent).not.toHaveBeenCalled();
  expect(setSnapshot.mock.calls.slice(shown).map(([update]) => shownBy(update))).toEqual([{ data: null, error: null }]);
  client.close();
});

it("keeps the shared subscription through Strict Mode's cleanup and remount, and releases it once nobody listens", async () => {
  const { client, receive, sent } = await connected();
  cleanups.length = 0;
  useServiceQuery(client, { _tag: "ReadChronicle" }, "strict");
  expect(sent).toHaveBeenCalledTimes(1);
  // Strict Mode runs the cleanup and then the effect again before anything else happens.
  for (const cleanup of cleanups.splice(0)) cleanup();
  useServiceQuery(client, { _tag: "ReadChronicle" }, "strict");
  await Promise.resolve();
  expect(sent).toHaveBeenCalledTimes(1);
  // The subscription survived: a change still reads again.
  receive(JSON.stringify({ _tag: "Success", id: "1", value: [] }));
  await Promise.resolve();
  receive(JSON.stringify({ _tag: "Changed", sequence: 1 }));
  expect(sent).toHaveBeenCalledTimes(2);
  receive(JSON.stringify({ _tag: "Success", id: "2", value: [] }));
  await Promise.resolve();
  // Once the last hook leaves, the next change reads nothing.
  for (const cleanup of cleanups.splice(0)) cleanup();
  await Promise.resolve();
  receive(JSON.stringify({ _tag: "Changed", sequence: 2 }));
  expect(sent).toHaveBeenCalledTimes(2);
  client.close();
});

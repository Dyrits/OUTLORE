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

it("reads again only when a change touched a topic the read follows", async () => {
  const { client, receive, sent } = await connected();
  useServiceQuery(client, { _tag: "ReadChronicle" }, "topics-work");
  useServiceQuery(client, { _tag: "ReadSettings" }, "topics-settings");
  expect(sent).toHaveBeenCalledTimes(2);
  receive(JSON.stringify({ _tag: "Success", id: "1", value: [] }));
  receive(JSON.stringify({ _tag: "Success", id: "2", value: {} }));
  await Promise.resolve();
  // A turn's progress touches the work: the chronicle is read again, the settings are not.
  receive(JSON.stringify({ _tag: "Changed", sequence: 1, topics: ["work"] }));
  expect(sent).toHaveBeenCalledTimes(3);
  expect(JSON.parse(String(sent.mock.calls[2]?.[0])).request._tag).toBe("ReadChronicle");
  receive(JSON.stringify({ _tag: "Success", id: "3", value: [] }));
  await Promise.resolve();
  // A change that names no topics may have touched anything.
  receive(JSON.stringify({ _tag: "Changed", sequence: 2 }));
  expect(sent).toHaveBeenCalledTimes(5);
  client.close();
});

it("shares one request between equal queries asked together, and asks again after a change", async () => {
  const { client, receive, sent } = await connected();
  const first = client.request({ _tag: "ReadChronicle" });
  const second = client.request({ _tag: "ReadChronicle" });
  client.request({ _tag: "ReadSettings" }).catch(() => void 0);
  expect(sent).toHaveBeenCalledTimes(2);
  receive(JSON.stringify({ _tag: "Success", id: "1", value: [] }));
  await expect(Promise.all([first, second])).resolves.toEqual([[], []]);
  // Answered, so the next one is a new request.
  client.request({ _tag: "ReadChronicle" }).catch(() => void 0);
  expect(sent).toHaveBeenCalledTimes(3);
  // A change, or a command, ends the sharing: what is asked after it must not take an answer that may predate it.
  receive(JSON.stringify({ _tag: "Changed", sequence: 1 }));
  client.request({ _tag: "ReadChronicle" }).catch(() => void 0);
  expect(sent).toHaveBeenCalledTimes(4);
  client.request({ _tag: "ReadChronicle" }).catch(() => void 0);
  expect(sent).toHaveBeenCalledTimes(4);
  client.request({ _tag: "RefreshPrices" }).catch(() => void 0);
  client.request({ _tag: "ReadChronicle" }).catch(() => void 0);
  expect(sent).toHaveBeenCalledTimes(6);
  client.close();
});

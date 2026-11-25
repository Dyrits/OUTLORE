import { mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MessageId, ThreadId } from "@outlore/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { fakeHarnessLayer, serviceLayer } from "../../src/index.ts";
import { prepareStartingContext } from "../../src/work/startingContext.ts";
import { guildmaster, isIdle, say, startIdle } from "../fixtures/guildmaster.ts";
import { call, fixture, read, settle, start, tool } from "../fixtures/service.ts";
import { answer, proposeCard } from "./guildmasterHelpers.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

/** The reply to a message, on the default Companion. */
const reply = (messageId: MessageId, text = "Take it from here", realmPath: string | null = null) =>
  call({
    _tag: "ReplyToMessage",
    effort: "default",
    messageId,
    model: "default",
    ...(realmPath === null ? {} : { realmPath }),
    requestId: crypto.randomUUID(),
    text,
  });

const anchorsOf = (threadId: ThreadId) => call({ _tag: "ReadThreadAnchors", threadId });

/** A quest whose top thread opened errands with these titles in one turn, and the quest read once they have settled. */
const questWithErrands = (titles: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const script = titles.map(
      (title) => `call open_thread ${JSON.stringify({ request: `Brief for ${title}`, title })}`,
    );
    const started = yield* start(script.join("\n"));
    yield* settle(started.missionId, (detail) => detail.threads.length === titles.length + 1 && isIdle(detail));
    return started;
  });

describe("Chronicler channels", () => {
  it.live("keeps a folderless realm, the Borderlands and the legacy conversation distinct", () => {
    const f = setup();
    return Effect.gen(function* () {
      yield* call({ _tag: "CreateRealm", name: "Ideas", path: null });
      const {
        workspaces: [realm],
      } = yield* call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null });
      if (realm === undefined) return yield* Effect.die("Missing realm");
      const request = { _tag: "ReadGuildmaster", channelId: realm.id } as const;
      const channel = yield* call(request);
      expect(yield* call(request)).toEqual(channel);
      const borderlands = yield* call({ _tag: "ReadGuildmaster", channelId: null });
      const legacy = yield* call({ _tag: "ReadGuildmaster" });
      expect(new Set([channel.threadId, borderlands.threadId, legacy.threadId]).size).toBe(3);
      const detail = yield* read(channel.missionId);
      expect(detail.mission.workspaceId).toBe(realm.id);
      const lore = "The blue folio belongs to the realm.";
      yield* tool(channel.threadId, "save_intel", { kind: "fact", scope: "workspace", text: lore });
      expect((yield* prepareStartingContext(channel.threadId)).note).toContain(lore);
      expect((yield* prepareStartingContext(borderlands.threadId)).note).not.toContain(lore);
      yield* call({ _tag: "SetThreadPermissionMode", mode: "Supervised", threadId: channel.threadId });
      yield* say(channel.threadId, "Hello");
      const chat = yield* settle(channel.missionId, isIdle);
      const message = chat.messages.find((candidate) => candidate.sender === "user");
      if (message === undefined) return yield* Effect.die("Missing channel message");
      const quest = yield* reply(message.id, "Investigate the folio");
      const started = yield* settle(quest.missionId, isIdle);
      expect(started.mission.workspaceId).toBe(realm.id);
      expect(started.thread.permissionMode).toBe("Supervised");
      yield* call({ _tag: "MoveQuest", missionId: quest.missionId, realmId: null });
      expect(yield* anchorsOf(channel.threadId)).toEqual([]);
      expect(yield* anchorsOf(borderlands.threadId)).toEqual([
        expect.objectContaining({ messageId: message.id, missionId: quest.missionId }),
      ]);
      const activity = yield* call({ _tag: "ReadChronicle" });
      expect(activity).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "RealmOpened", realmId: realm.id }),
          expect.objectContaining({ kind: "QuestOpened", missionId: quest.missionId }),
        ]),
      );
    }).pipe(Effect.provide(f.layer));
  });
});

describe("what hangs from a message", () => {
  it.live("splits multiple agent errands in one turn into separate agent replies tied to the triggering message", () =>
    Effect.gen(function* () {
      const started = yield* questWithErrands(["Design", "Build", "Test"]);
      const detail = yield* read(started.missionId);
      const cards = detail.messages.filter(
        (message) => message.sender === "agent" && message.text.startsWith("Brief for "),
      );
      expect(cards.map((card) => card.text)).toEqual(["Brief for Design", "Brief for Build", "Brief for Test"]);
      const anchors = yield* anchorsOf(started.threadId);
      expect(anchors.map((anchor) => anchor.messageId)).toEqual(cards.map((card) => card.id));
      const errands = detail.threads.filter((thread) => thread.parentId === started.threadId);
      expect(anchors.map((anchor) => anchor.threadId).sort()).toEqual(errands.map((thread) => thread.id).sort());
      const trigger = detail.messages.find((message) => message.sender === "user");
      expect(cards.map((card) => card.replyToMessageId)).toEqual([trigger?.id, trigger?.id, trigger?.id]);
      for (const errand of errands) {
        const child = yield* read(started.missionId, errand.id);
        expect(child.messages[0]?.text).toBe(`Brief for ${errand.title}`);
      }
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("anchors a single agent errand directly to the triggering message with no extra bubble", () =>
    Effect.gen(function* () {
      const started = yield* questWithErrands(["Design"]);
      const detail = yield* read(started.missionId);
      const trigger = detail.messages.find((message) => message.sender === "user");
      expect(detail.messages.some((message) => message.sender === "agent" && message.text === "Brief for Design")).toBe(
        false,
      );
      const [anchor] = yield* anchorsOf(started.threadId);
      expect(anchor?.messageId).toBe(trigger?.id);
      // Nothing waits for the thread and its state is not Waiting or Running because of the anchor.
      expect(detail.thread.state).toBe("Resting");
      expect(detail.threads.find((thread) => thread.id === started.threadId)?.waitingCount).toBe(0);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("anchors directly to the message named by the agent without changing the tree parent", () =>
    Effect.gen(function* () {
      const started = yield* startIdle("The first request");
      const detail = yield* read(started.missionId);
      const trigger = detail.messages.find((message) => message.sender === "user");
      if (trigger === undefined) return yield* Effect.die("No trigger");
      yield* tool(started.threadId, "open_thread", { replyToMessageId: trigger.id, request: "Explicit brief" });
      const after = yield* read(started.missionId);
      const anchor = (yield* anchorsOf(started.threadId))[0];
      expect(anchor?.messageId).toBe(trigger.id);
      expect(after.threads.find((item) => item.id === anchor?.threadId)?.parentId).toBe(started.threadId);
      expect(
        JSON.stringify(yield* tool(started.threadId, "open_thread", { replyToMessageId: "missing", request: "Bad" })),
      ).toContain("No such message");
      expect((yield* read(started.missionId)).threads).toHaveLength(2);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("anchors an owner-opened errand when OpenThread names a quest message", () =>
    Effect.gen(function* () {
      const started = yield* startIdle("Check the logs");
      const detail = yield* read(started.missionId);
      const trigger = detail.messages.find((message) => message.sender === "user");
      if (trigger === undefined) return yield* Effect.die("No trigger");
      const opened = yield* call({
        _tag: "OpenThread",
        anchorMessageId: trigger.id,
        effort: "default",
        model: "default",
        parentThreadId: started.threadId,
        requestId: crypto.randomUUID(),
        shouldStartAnyway: false,
        text: "Investigate timeout",
      });
      const anchors = yield* anchorsOf(started.threadId);
      expect(anchors).toEqual([expect.objectContaining({ messageId: trigger.id, threadId: opened.threadId })]);
      const settled = yield* settle(started.missionId, isIdle, opened.threadId);
      const errandSummary = settled.threads.find((thread) => thread.id === opened.threadId);
      // The anchor is the root, so the errand's own opening message is a reply: the owner's text and the agent's answer.
      expect(errandSummary?.replyCount).toBe(2);
      // The errand's pane pins the anchor message of the quest's conversation above its own messages.
      const errandPane = yield* call({ _tag: "ReadMission", missionId: started.missionId, threadId: opened.threadId });
      expect(errandPane.thread.root).toEqual(
        expect.objectContaining({ id: trigger.id, sender: "user", text: trigger.text }),
      );
      // A quest started from the dashboard leaves a copy of its text in its channel: its first message is its own root.
      const firstMessage = detail.messages.find((message) => message.sender !== "system");
      expect(detail.thread.root).toEqual(expect.objectContaining({ id: firstMessage?.id, text: firstMessage?.text }));
      expect(settled.mission.replyCount).toBe(1);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("inherits the quest mode for owner and agent errands", () =>
    Effect.gen(function* () {
      const started = yield* startIdle("Hello");
      yield* call({ _tag: "SetThreadPermissionMode", mode: "AutoAcceptEdits", threadId: started.threadId });
      const opened = yield* call({
        _tag: "OpenThread",
        effort: "default",
        model: "default",
        parentThreadId: started.threadId,
        requestId: crypto.randomUUID(),
        shouldStartAnyway: false,
        text: "An errand",
      });
      expect(yield* anchorsOf(started.threadId)).toEqual([]);
      expect((yield* read(started.missionId, opened.threadId)).thread.permissionMode).toBe("AutoAcceptEdits");
      yield* tool(started.threadId, "open_thread", { request: "Agent errand" });
      const [anchor] = yield* anchorsOf(started.threadId);
      if (anchor === undefined) return yield* Effect.die("Missing agent errand");
      expect((yield* read(started.missionId, anchor.threadId)).thread.permissionMode).toBe("AutoAcceptEdits");
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("persisting anchors", () => {
  it.live("retains the direct trigger anchor and child brief after a service restart", () =>
    Effect.gen(function* () {
      const value = setup();
      const saved = yield* Effect.gen(function* () {
        const started = yield* questWithErrands(["Design"]);
        const detail = yield* read(started.missionId);
        const trigger = detail.messages.find((message) => message.sender === "user");
        const anchor = (yield* anchorsOf(started.threadId))[0];
        if (anchor === undefined || trigger === undefined) return yield* Effect.die("Missing anchor");
        expect(anchor.messageId).toBe(trigger.id);
        return { anchor, started, trigger: trigger.id };
      }).pipe(Effect.provide(value.layer));
      const restarted = serviceLayer({
        filename: join(value.directory, "store.sqlite"),
        harness: fakeHarnessLayer("10 millis"),
        homeFolder: value.directory,
        scratchRoot: join(value.directory, "missions"),
      });
      yield* Effect.gen(function* () {
        expect(yield* anchorsOf(saved.started.threadId)).toEqual([saved.anchor]);
        const child = yield* read(saved.started.missionId, saved.anchor.threadId);
        expect(child.thread.parentId).toBe(saved.started.threadId);
        expect(child.messages[0]?.text).toBe("Brief for Design");
      }).pipe(Effect.provide(restarted));
    }),
  );
});

describe("Chronicler proposals", () => {
  it.live("anchors the confirmed quest to the proposal reply and preserves its triggering message", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const card = yield* proposeCard(place, { text: "Investigate this", title: "Investigation" });
      const before = yield* read(place.missionId, place.threadId);
      const trigger = before.messages.find((message) => message.sender === "user");
      const proposal = before.messages.find(
        (message) => message.sender === "agent" && message.text === "Investigate this",
      );
      expect(proposal?.replyToMessageId).toBe(trigger?.id);
      yield* answer(card, { _tag: "NewMission", effort: "default", model: "default" });
      const anchors = yield* anchorsOf(place.threadId);
      expect(anchors).toHaveLength(1);
      expect(anchors[0]?.messageId).toBe(proposal?.id);
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("replying to a message", () => {
  it.live("starts a quest from a message of the Chronicle, which hangs from it", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      yield* say(place.threadId, "Hello Chronicler");
      const chronicle = yield* settle(
        place.missionId,
        (detail) => isIdle(detail) && detail.messages.length > 1,
        place.threadId,
      );
      const message = chronicle.messages.find((candidate) => candidate.sender === "agent");
      if (message === undefined) return yield* Effect.die("Chronicler wrote nothing");
      const started = yield* reply(message.id, "Add dark mode");
      expect(started.isNew).toBe(true);
      expect(started.missionId).not.toBe(place.missionId);
      const anchors = yield* anchorsOf(place.threadId);
      expect(anchors).toEqual([
        { messageId: message.id, missionId: started.missionId, threadId: started.threadId, title: "Quest" },
      ]);
      const quest = yield* settle(started.missionId, isIdle);
      expect(quest.threads).toHaveLength(1);
      expect(quest.messages[0]?.text).toBe("Add dark mode");
      // The Chronicle's message is the root; the quest's own opening message and its answer are both replies.
      expect(quest.thread.root).toEqual(
        expect.objectContaining({ id: message.id, sender: "agent", text: message.text }),
      );
      expect(quest.mission.replyCount).toBe(quest.messages.length);
      expect(quest.mission.replyCount).toBeGreaterThanOrEqual(2);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("opens an errand beneath the quest from a message of the quest, with the message in its context", () =>
    Effect.gen(function* () {
      const started = yield* startIdle("Plan the trip");
      const quest = yield* read(started.missionId);
      const message = quest.messages.find((candidate) => candidate.sender === "agent");
      if (message === undefined) return yield* Effect.die("The quest's agent wrote nothing");
      const opened = yield* reply(message.id, "Check the flights");
      expect(opened.isNew).toBe(true);
      expect(opened.missionId).toBe(started.missionId);
      const detail = yield* read(started.missionId, opened.threadId);
      expect(detail.thread.parentId).toBe(started.threadId);
      expect(detail.messages[0]?.text).toBe("Check the flights");
      expect(detail.thread.root).toEqual(expect.objectContaining({ id: message.id, sender: "agent" }));
      expect(detail.threads.find((thread) => thread.id === opened.threadId)?.replyCount).toBe(detail.messages.length);
      expect(yield* anchorsOf(started.threadId)).toEqual([
        { messageId: message.id, missionId: started.missionId, threadId: opened.threadId, title: "Errand" },
      ]);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("places a quest a Reply starts in the realm the Chronicle's menu chose", () => {
    const value = setup();
    const realm = join(value.directory, "atlas");
    mkdirSync(realm);
    return Effect.gen(function* () {
      const place = yield* guildmaster;
      yield* say(place.threadId, "Hello Chronicler");
      const chronicle = yield* settle(
        place.missionId,
        (detail) => isIdle(detail) && detail.messages.length > 1,
        place.threadId,
      );
      const message = chronicle.messages.find((candidate) => candidate.sender === "agent");
      if (message === undefined) return yield* Effect.die("Chronicler wrote nothing");
      const started = yield* reply(message.id, "Add dark mode", realm);
      const quest = yield* settle(started.missionId, isIdle);
      expect(quest.thread.workspace?.path).toBe(realpathSync(realm));
    }).pipe(Effect.provide(value.layer));
  });

  it.live("answers a second reply to a message with the thread it already started, and starts nothing", () =>
    Effect.gen(function* () {
      const started = yield* startIdle("Plan the trip");
      const quest = yield* read(started.missionId);
      const message = quest.messages.find((candidate) => candidate.sender === "agent");
      if (message === undefined) return yield* Effect.die("The quest's agent wrote nothing");
      const first = yield* reply(message.id, "First");
      const second = yield* reply(message.id, "Second");
      expect(second).toEqual({ isNew: false, missionId: first.missionId, threadId: first.threadId });
      expect((yield* read(started.missionId)).threads).toHaveLength(2);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("takes no Reply in an errand's conversation: the owner starts errands from a quest only", () =>
    Effect.gen(function* () {
      const started = yield* questWithErrands(["Design"]);
      const detail = yield* read(started.missionId);
      const errand = detail.threads.find((thread) => thread.parentId === started.threadId);
      if (errand === undefined) return yield* Effect.die("No errand");
      const inside = yield* settle(started.missionId, (read) => read.messages.length > 0, errand.id);
      const message = inside.messages[0];
      if (message === undefined) return yield* Effect.die("The errand has no message");
      const failure = yield* Effect.flip(reply(message.id));
      expect(failure).toMatchObject({ kind: "InvalidInput" });
      expect((yield* read(started.missionId)).threads).toHaveLength(2);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("refuses a message that does not exist, and a reply that is empty", () =>
    Effect.gen(function* () {
      const started = yield* startIdle("Plan the trip");
      const message = (yield* read(started.missionId)).messages[0];
      if (message === undefined) return yield* Effect.die("No message");
      expect(yield* Effect.flip(reply("00000000-0000-0000-0000-000000000000" as MessageId))).toMatchObject({
        kind: "NotFound",
      });
      expect(yield* Effect.flip(reply(message.id, "   "))).toMatchObject({ kind: "InvalidInput" });
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("replays one request identifier to the same thread", () =>
    Effect.gen(function* () {
      const started = yield* startIdle("Plan the trip");
      const message = (yield* read(started.missionId)).messages.find((candidate) => candidate.sender === "agent");
      if (message === undefined) return yield* Effect.die("No reply");
      const requestId = crypto.randomUUID();
      const input = {
        _tag: "ReplyToMessage",
        effort: "default",
        messageId: message.id,
        model: "default",
        requestId,
        text: "Go",
      } as const;
      const first = yield* call(input);
      const again = yield* call(input);
      expect(again.threadId).toBe(first.threadId);
      expect((yield* read(started.missionId)).threads).toHaveLength(2);
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("errand follow-ups", () => {
  it.live("posts an attributed quest message and lets the owner's Reply start a sibling", () =>
    Effect.gen(function* () {
      const quest = yield* questWithErrands(["Investigate"]);
      const before = yield* read(quest.missionId);
      const errand = before.threads.find((thread) => thread.parentId === quest.threadId);
      if (errand === undefined) return yield* Effect.die("No errand");
      const text = "I noticed a missing validation while investigating.";
      expect(JSON.stringify(yield* tool(errand.id, "open_thread", { request: text }))).toContain(
        "Posted your follow-up",
      );
      const after = yield* read(quest.missionId);
      expect(after.threads).toHaveLength(2);
      const message = after.messages.find((candidate) => candidate.text === text);
      if (message === undefined) return yield* Effect.die("No follow-up");
      expect(message.sender).toBe("thread");
      expect(message.fromThreadId).toBe(errand.id);
      const opened = yield* reply(message.id);
      const sibling = yield* read(quest.missionId, opened.threadId);
      expect(sibling.thread.parentId).toBe(quest.threadId);
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("realm channels open quests directly", () => {
  it.live("opens a quest directly under the owner's message with the channel's Companion and no second bubble", () => {
    const f = setup();
    return Effect.gen(function* () {
      yield* call({ _tag: "CreateRealm", name: "Workshop", path: null });
      const {
        workspaces: [realm],
      } = yield* call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null });
      if (realm === undefined) return yield* Effect.die("Missing realm");
      const channel = yield* call({ _tag: "ReadGuildmaster", channelId: realm.id });
      yield* call({
        _tag: "ChangeThreadRunner",
        accountId: null,
        effort: "high",
        harness: "claude",
        model: "claude-sonnet-4-6",
        threadId: channel.threadId,
      });
      yield* call({ _tag: "SetThreadPermissionMode", mode: "AutoAcceptEdits", threadId: channel.threadId });
      yield* say(channel.threadId, "Fix the login redirect");
      const chat = yield* settle(channel.missionId, isIdle);
      const ownerMessage = chat.messages.find((candidate) => candidate.sender === "user");
      if (ownerMessage === undefined) return yield* Effect.die("Missing owner message");
      const countBefore = chat.messages.length;
      const result = yield* tool(channel.threadId, "suggest_mission", {
        missions: [],
        text: "Fix the login redirect",
        title: "Fix login redirect",
      });
      expect(JSON.stringify(result)).toContain("directly as replies under the owner's message");
      const afterChannel = yield* read(channel.missionId);
      // No second proposal bubble and no pending suggestion card in the channel.
      expect(afterChannel.messages).toHaveLength(countBefore);
      expect(afterChannel.suggestions).toHaveLength(0);
      const [anchor] = yield* anchorsOf(channel.threadId);
      if (anchor === undefined) return yield* Effect.die("Missing quest anchor");
      expect(anchor.messageId).toBe(ownerMessage.id);
      const quest = yield* settle(anchor.missionId, isIdle);
      expect(quest.mission.workspaceId).toBe(realm.id);
      expect(quest.mission.title).toBe("Fix login redirect");
      expect(quest.thread.harness).toBe("claude");
      expect(quest.thread.model).toBe("claude-sonnet-4-6");
      expect(quest.thread.effort).toBe("high");
      expect(quest.thread.permissionMode).toBe("AutoAcceptEdits");
      // The quest's opening message repeats the owner's message in the channel, so that message is its own root.
      expect(quest.mission.replyCount).toBe(1);
      expect(quest.thread.root).toEqual(
        expect.objectContaining({ id: quest.messages.find((message) => message.sender !== "system")?.id }),
      );
    }).pipe(Effect.provide(f.layer));
  });
});

describe("the tool still opens errands", () => {
  it.live("opens a single errand by the tool anchored directly to the latest message with no extra bubble", () =>
    Effect.gen(function* () {
      const started = yield* startIdle("Hello");
      const before = yield* read(started.missionId);
      const latest = before.messages.at(-1);
      const result = yield* tool(started.threadId, "open_thread", { request: "Brief", title: "Errand" });
      expect(JSON.stringify(result)).toContain("Opened");
      const after = yield* read(started.missionId);
      expect(after.messages).toHaveLength(before.messages.length);
      const [anchor] = yield* anchorsOf(started.threadId);
      expect(anchor?.messageId).toBe(latest?.id);
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("Batch 2: parent echoes and one-message reporting", () => {
  it.live("echoes an errand message to its parent quest with MessageOnly or FullContext and wakes the parent", () =>
    Effect.gen(function* () {
      const started = yield* startIdle("Coordinate the release");
      const opened = yield* call({
        _tag: "OpenThread",
        effort: "default",
        model: "default",
        parentThreadId: started.threadId,
        requestId: crypto.randomUUID(),
        shouldStartAnyway: false,
        text: "Check changelog entries",
      });
      yield* settle(started.missionId, isIdle, opened.threadId);
      const parentBefore = (yield* read(started.missionId)).messages.length;
      yield* call({
        _tag: "SendMessage",
        delivery: null,
        requestId: crypto.randomUUID(),
        sendToParent: "MessageOnly",
        text: "Changelog looks clean",
        threadId: opened.threadId,
      });
      const parentAfterOnly = yield* settle(started.missionId, (detail) =>
        detail.messages.some((message) => message.sender === "thread" && message.text === "Changelog looks clean"),
      );
      expect(parentAfterOnly.messages.length).toBeGreaterThan(parentBefore);
      yield* settle(started.missionId, isIdle);
      yield* settle(started.missionId, isIdle, opened.threadId);
      yield* call({
        _tag: "SendMessage",
        delivery: null,
        requestId: crypto.randomUUID(),
        sendToParent: "FullContext",
        text: "Ready to tag",
        threadId: opened.threadId,
      });
      const parentAfterFull = yield* settle(started.missionId, (detail) =>
        detail.messages.some(
          (message) =>
            message.sender === "thread" &&
            message.text.includes("Ready to tag") &&
            message.text.includes("Thread context") &&
            message.text.includes("Check changelog entries"),
        ),
      );
      const echoed = parentAfterFull.messages.find(
        (message) => message.sender === "thread" && message.text.includes("Ready to tag"),
      );
      expect(echoed?.fromThreadId).toBe(opened.threadId);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("echoes a quest message to its realm channel feed without waking Chronicler", () =>
    Effect.gen(function* () {
      yield* call({ _tag: "CreateRealm", name: "Studio", path: null });
      const {
        workspaces: [realm],
      } = yield* call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null });
      if (realm === undefined) return yield* Effect.die("Missing realm");
      const channel = yield* call({ _tag: "ReadGuildmaster", channelId: realm.id });
      const quest = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: crypto.randomUUID() });
      yield* call({
        _tag: "SendMessage",
        delivery: null,
        requestId: crypto.randomUUID(),
        sendToParent: "MessageOnly",
        text: "Status update for the realm",
        threadId: quest.threadId,
      });
      yield* settle(quest.missionId, isIdle);
      const channelDetail = yield* read(channel.missionId);
      const echoed = channelDetail.messages.find(
        (message) => message.sender === "thread" && message.text === "Status update for the realm",
      );
      expect(echoed?.fromMissionId).toBe(quest.missionId);
      expect(echoed?.fromThreadId).toBe(quest.threadId);
      // Channel echo is conversation-only: Chronicler took no turn in the channel.
      expect(channelDetail.messages.filter((message) => message.sender === "agent")).toHaveLength(0);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("report_result posts one reply in the errand and echoes it to the parent with optional context", () =>
    Effect.gen(function* () {
      const started = yield* startIdle("Audit the API");
      const opened = yield* call({
        _tag: "OpenThread",
        effort: "default",
        model: "default",
        parentThreadId: started.threadId,
        requestId: crypto.randomUUID(),
        shouldStartAnyway: false,
        text: "Inspect auth middleware",
      });
      yield* settle(started.missionId, isIdle, opened.threadId);
      const reported = yield* tool(opened.threadId, "report_result", {
        includeContext: true,
        journal: "Verified auth middleware tokens.",
        result: "Auth middleware checks signatures and expiry.",
      });
      expect(JSON.stringify(reported)).toContain("posted as your reply here");
      const errand = yield* read(started.missionId, opened.threadId);
      expect(
        errand.messages.some(
          (message) => message.sender === "agent" && message.text === "Auth middleware checks signatures and expiry.",
        ),
      ).toBe(true);
      const parent = yield* read(started.missionId);
      const resultMessage = parent.messages.find(
        (message) => message.sender === "thread" && message.isResult && message.fromThreadId === opened.threadId,
      );
      expect(resultMessage?.text).toContain("Auth middleware checks signatures and expiry.");
      expect(resultMessage?.text).toContain("Thread context");
      expect(resultMessage?.text).toContain("Inspect auth middleware");
    }).pipe(Effect.provide(setup().layer)),
  );
});

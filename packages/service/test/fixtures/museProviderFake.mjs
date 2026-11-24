// A scripted stand-in for `muse serve`, shaped after the Muse Session Protocol as @muse-code/sdk 1.4.25
// speaks it (NDJSON JSON-RPC 2.0 on the standard streams). MUSE_FAKE_LOG receives one JSON line per frame
// the client sent ({ method, params }). The first argument names the scenario:
//   basic    — a turn: an agent message streamed by revision and completed, with usage and a context report.
//   approval — a tool call gated by an approval offering Allow-always, Allow-once and Deny: the decide's
//               choice decides whether the call completes or is rejected, and the turn ends either way.
//   unmediatable — an approval offering only session-scoped approvals and no deny or abort, so a refusing
//               client cannot close it; the turn only ends after a turn/interrupt, as cancelled.
//   gap      — the turn's item updates are dropped from the live stream and named by view/gap, so the client
//               must splice them back through view/page before the buffered live turn/completed frame applies.
//   malformed — one line that is not JSON mid-turn, then the turn carries on.
//   steer    — the turn streams its answer and then ends only when a turn/steer arrives, whose folded user
//               message names the steered text.
// A session/resume is allowed only for the session id MUSE_FAKE_RESUMABLE names; every other id is refused
// with SS -32011 notFound, so the adapter's resume path and its handover fallback can both be checked.
// model/list answers a small catalog.
import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

const scenario = process.argv[2] ?? "basic";
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

const log = (entry) => {
  if (process.env.MUSE_FAKE_LOG) appendFileSync(process.env.MUSE_FAKE_LOG, `${JSON.stringify(entry)}\n`);
};

// What the host started with: the registry's update suppression is a launch fact no frame carries.
log({ noAutoUpdate: process.env.MUSE_NO_AUTO_UPDATE ?? null });

const send = (frame) => process.stdout.write(`${JSON.stringify(frame)}\n`);
// Notifications carry no id and are never answered.
const reply = (id, result) => {
  if (id !== undefined) send({ id, jsonrpc: "2.0", result });
};
const refuse = (id, code, message, data) => {
  if (id !== undefined) send({ error: { code, data, message }, id, jsonrpc: "2.0" });
};

// The stable-surface fingerprint @muse-code/sdk 1.4.25 was stamped against, so its handshake reports no tier.
const FINGERPRINT = "sha256:6bf518067b065a503ea7d4f081a44fc056b532cf4b362a1894024863b25fb2aa";

let cursorCount = 0;
const cursor = () => `c${String(++cursorCount).padStart(6, "0")}`;
const range = () => ({
  first: { id: `r${cursorCount}`, sequence: cursorCount },
  last: { id: `r${cursorCount}`, sequence: cursorCount },
  stream: { runId: stamp },
});

let sessionCount = 0;
const newSessionId = () => `s-${++sessionCount}-${stamp}`;
let turnCount = 0;
let itemCount = 0;

/** The session object every lifecycle method returns (tdd SS2.4), with the members the SDK reads. */
const sessionOf = (id, modelId = null) => ({
  activeTurnId: null,
  createdAt: new Date().toISOString(),
  forkedFrom: null,
  modelId,
  path: `/nonexistent/muse/${id}`,
  sessionId: id,
  status: modelId === null ? "idle" : "running",
});

/** One view notification, logged and stamped with the next cursor. */
const view = (method, params) =>
  send({ jsonrpc: "2.0", method, params: { sourceRange: range(), viewCursor: cursor(), ...params } });

/** One event of a view/page result, with the cursor it was dropped from the live stream at. */
const pageEvent = (method, params, viewCursor) => ({
  method,
  params: { sourceRange: range(), viewCursor, ...params },
});

const usageOf = () => ({
  cachedTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  inputTokens: 120,
  outputTokens: 7,
  reasoningTokens: 3,
});

const reportContext = (id) =>
  view("session/contextUsage", { pressure: "normal", sessionId: id, usedTokens: 144, windowTokens: 1000 });

const streamAnswer = (id, turn, text) => {
  const item = `msg-${++itemCount}`;
  view("item/started", {
    item: { itemId: item, kind: "agentMessage", revision: 1, status: "inProgress", text: "", turnId: turn },
    sessionId: id,
  });
  view("item/updated", {
    item: { itemId: item, kind: "agentMessage", revision: 2, status: "inProgress", text, turnId: turn },
    sessionId: id,
  });
  // The terminal event is its own revision: the fold replaces an item only at a higher one.
  view("item/completed", {
    item: {
      itemId: item,
      kind: "agentMessage",
      messagePhase: "finalAnswer",
      revision: 3,
      status: "completed",
      text,
      turnId: turn,
    },
    sessionId: id,
  });
};

const complete = (id, turn, terminal) =>
  view("turn/completed", { durationMs: 12, sessionId: id, terminal, turnId: turn, usage: usageOf() });

const approvalChoices = [
  { choiceId: "allow-always", decision: "approved", label: "Always allow", scope: "localPersistent" },
  { choiceId: "allow-once", decision: "approved", label: "Allow once", scope: "once" },
  { choiceId: "deny-once", decision: "denied", label: "Deny", scope: "once" },
];
const unmediatableChoices = [
  { choiceId: "allow-always", decision: "approved", label: "Always allow", scope: "localPersistent" },
  { choiceId: "allow-session", decision: "approvedForSession", label: "Allow for this session", scope: "session" },
];

/** The approval the fake asks with, on the tool call it grafted. */
const askApproval = (id, turn, choices) => {
  const item = `tool-${++itemCount}`;
  const args = '{"command": "echo hi"}';
  view("item/started", {
    item: {
      approvalId: "approval-1",
      args,
      itemId: item,
      kind: "toolCall",
      revision: 1,
      status: "inProgress",
      tool: "run_command",
      turnId: turn,
    },
    sessionId: id,
  });
  view("approval/requested", {
    approvalId: "approval-1",
    availableChoices: choices,
    currentRequirementId: { sourceIndex: 0 },
    itemId: item,
    judgeEscalated: false,
    protectedWrite: false,
    rawArgs: args,
    sessionId: id,
    subject: { command: "echo hi", kind: "shell" },
    taskId: "task-1",
    toolCallId: "call-1",
    toolName: "run_command",
    turnId: turn,
  });
};

/** The turn the fake ends when a decision arrives; set by each turn's start. */
let currentTurn = "";

/** What a started turn does before its first wait, by scenario. */
const startTurn = (id, turn) => {
  view("turn/started", { commandId: `cmd-${turn}`, sessionId: id, turnId: turn });
  if (scenario === "approval" || scenario === "unmediatable") {
    askApproval(id, turn, scenario === "unmediatable" ? unmediatableChoices : approvalChoices);
    return; // The turn continues when the approval/decide arrives.
  }
  if (scenario === "gap") {
    const after = cursor();
    view("item/started", {
      item: {
        itemId: `msg-${++itemCount}`,
        kind: "agentMessage",
        revision: 1,
        status: "inProgress",
        text: "",
        turnId: turn,
      },
      sessionId: id,
    });
    // The item writes are dropped from the live stream: their cursors only ever leave through view/page.
    const updated = cursor();
    const done = cursor();
    gapPage = [
      {
        at: updated,
        frame: pageEvent(
          "item/updated",
          {
            item: {
              itemId: `msg-${itemCount}`,
              kind: "agentMessage",
              revision: 2,
              status: "inProgress",
              text: "Recovered whole",
              turnId: turn,
            },
            sessionId: id,
          },
          updated,
        ),
      },
      {
        at: done,
        frame: pageEvent(
          "item/completed",
          {
            item: {
              itemId: `msg-${itemCount}`,
              kind: "agentMessage",
              messagePhase: "finalAnswer",
              revision: 3,
              status: "completed",
              text: "Recovered whole",
              turnId: turn,
            },
            sessionId: id,
          },
          done,
        ),
      },
    ];
    const next = cursor();
    _gapAfter = after;
    gapTail = {
      at: next,
      event: pageEvent(
        "turn/completed",
        { durationMs: 12, sessionId: id, terminal: "completed", turnId: turn, usage: usageOf() },
        next,
      ),
    };
    // The bracket first: the live far-end frame after it is buffered by the client while the fill runs,
    // and refused as the page's twin once the splice reaches it.
    send({ jsonrpc: "2.0", method: "view/gap", params: { after, next, sessionId: id } });
    send({ jsonrpc: "2.0", method: "turn/completed", params: { ...gapTail.event.params, viewCursor: next } });
    return;
  }
  if (scenario === "malformed") process.stdout.write("this line is not json\n");
  streamAnswer(id, turn, scenario === "steer" ? "Steered reply" : "Hello from Muse");
  reportContext(id);
  if (scenario !== "steer") complete(id, turn, "completed");
};

let _gapAfter = "";
let gapPage = [];
let gapTail = null;
const steeredTextOf = (input) =>
  (input ?? [])
    .filter((part) => part?.type === "text")
    .map((part) => part.text ?? "")
    .join("");

const handlers = {
  "approval/decide": (id, params) => {
    const approved = params.choiceId === "allow-once";
    reply(id, { approvalId: params.approvalId, commandId: params.commandId, status: "accepted", terminal: true });
    setTimeout(() => {
      view("approval/resolved", {
        approvalId: params.approvalId,
        decision: approved ? "approved" : "denied",
        sessionId: params.sessionId,
      });
      view("item/completed", {
        item: {
          approvalId: params.approvalId,
          args: '{"command": "echo hi"}',
          itemId: `tool-${itemCount}`,
          kind: "toolCall",
          revision: 2,
          status: approved ? "completed" : "rejected",
          tool: "run_command",
          turnId: currentTurn,
        },
        sessionId: params.sessionId,
      });
      streamAnswer(params.sessionId, currentTurn, approved ? "Allowed answer" : "Denied answer");
      reportContext(params.sessionId);
      complete(params.sessionId, currentTurn, "completed");
    }, 25);
  },
  initialize: (id, _params) =>
    reply(id, {
      experimentalApi: false,
      grantedCapabilities: ["sessionMcp"],
      museHome: "/nonexistent/muse-home",
      platformFamily: "macOS",
      platformOs: "darwin",
      schema: { compatibilityEpoch: 0, fingerprint: FINGERPRINT, version: 1 },
      serverInfo: { name: "muse-fake", version: "1.4.25" },
      sessionDurability: "durable",
      userAgent: "muse-fake/1.4.25",
    }),
  "model/list": (id) =>
    reply(id, {
      models: [
        {
          contextLimit: 1000,
          cost: null,
          defaultReasoningEffort: "low",
          description: null,
          displayLabel: "Muse One",
          isActive: true,
          isDefault: true,
          modelId: "muse-one",
          outputLimit: null,
          profileId: null,
          providerId: "fake-lab",
          releaseDate: "2026-11-01",
          variants: ["low", "medium", "high"],
        },
        {
          contextLimit: 2000,
          cost: null,
          description: null,
          displayLabel: "Muse Two",
          isActive: false,
          isDefault: false,
          modelId: "muse-two",
          outputLimit: null,
          profileId: null,
          providerId: "fake-lab",
          releaseDate: "2026-11-02",
          variants: [],
        },
      ],
      profileId: null,
      providerId: "fake-lab",
      source: "fakeCatalog",
    }),
  "session/resume": (id, params) => {
    if (params.sessionId !== process.env.MUSE_FAKE_RESUMABLE) {
      refuse(id, -32011, "notFound", { reason: "missingAnchor" });
      return;
    }
    reply(id, {
      history: { mode: "none", noneReason: "cursorSuffix" },
      pendingRequests: [],
      session: sessionOf(params.sessionId, null),
      viewCursor: cursor(),
    });
  },
  "session/setModel": (id, params) => reply(id, { commandId: params.commandId, status: "accepted" }),
  "session/setReasoningEffort": (id, params) => reply(id, { commandId: params.commandId, status: "accepted" }),
  "session/start": (id, params) => {
    const session = sessionOf(newSessionId(), params.modelId ?? null);
    reply(id, { session, viewCursor: cursor() });
  },
  "turn/interrupt": (id, params) => {
    const turn = params.turnId ?? currentTurn;
    reply(id, { commandId: params.commandId, status: "accepted", turnId: turn });
    complete(params.sessionId, turn, "cancelled");
  },
  "turn/start": (id, params) => {
    const turn = `t-${++turnCount}-${stamp}`;
    currentTurn = turn;
    reply(id, {
      commandId: params.commandId,
      disposition: "started",
      startedNewTurn: true,
      status: "accepted",
      turnId: turn,
    });
    // The events stream after the ack, as a real host's do, so the client reads them live.
    setTimeout(() => startTurn(params.sessionId, turn), 25);
  },
  "turn/steer": (id, params) => {
    reply(id, { commandId: params.commandId, status: "accepted" });
    const turn = params.expectedTurnId ?? currentTurn;
    const text = steeredTextOf(params.input);
    // The steered submission's echo: its user message carries the steer's own command id.
    setTimeout(() => {
      view("item/started", {
        item: {
          commandId: params.commandId,
          itemId: `steer-${++itemCount}`,
          kind: "userMessage",
          revision: 1,
          status: "completed",
          text,
          turnId: turn,
        },
        sessionId: params.sessionId,
      });
      complete(params.sessionId, turn, "completed");
    }, 25);
  },
  "usage/read": (id) => reply(id, {}),
  "view/page": (id, _params) => {
    if (scenario !== "gap" || gapPage === null) {
      reply(id, { events: [], nextCursor: null });
      return;
    }
    // The first page serves the dropped item writes; the second the live frame's own twin, so the walk
    // reaches the hole's far end by order, never by comparing cursors.
    if (gapPage.length > 0) {
      const served = gapPage;
      gapPage = [];
      reply(id, { events: served.map((entry) => entry.frame), nextCursor: served[served.length - 1].at });
      return;
    }
    reply(id, { events: [gapTail.event], nextCursor: gapTail.at });
    gapPage = null;
    gapTail = null;
  },
};

createInterface({ input: process.stdin }).on("line", (line) => {
  if (line.trim() === "") return;
  let frame;
  try {
    frame = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params = {} } = frame;
  log({ method, params });
  (
    handlers[method] ??
    ((_replyId, callParams) => reply(_replyId, { commandId: callParams.commandId, status: "accepted" }))
  )(id, params);
});

// Drives a throwaway Electron window (fake harness, temporary data folder, never the owner's profile) through dictation:
// the microphone is Chromium's fake capture device playing a WAV file, and the host transcribes with whisper.cpp.
// Usage, from apps/desktop after `bun run build` and a web export of apps/app:
//   bun ../../documentation/verification/2026-11-18-dictation/drive.ts <web export folder> <speech WAV> <screenshot folder> [unconfigured]
// The engine comes from OUTLORE_WHISPER_CLI and OUTLORE_WHISPER_MODEL; `unconfigured` starts the window without them.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [webFolder, speech, shots, mode] = process.argv.slice(2);
if (!webFolder || !speech || !shots) throw new Error("Give the web export folder, a speech WAV, and a screenshot folder");
const isUnconfigured = mode === "unconfigured";

// The exported app, served the way the dev server would: every unknown path is the app's page.
const server = Bun.serve({
  fetch: async (request) => {
    const path = new URL(request.url).pathname;
    const file = Bun.file(join(webFolder, path === "/" ? "index.html" : path));
    return (await file.exists()) ? new Response(file) : new Response(Bun.file(join(webFolder, "index.html")));
  },
  port: 0,
});
const debugPort = 9400 + Math.floor(Math.random() * 400);
const dataFolder = mkdtempSync(join(tmpdir(), "outlore-dictation-drive-"));
const electron = createRequire(join(process.cwd(), "package.json"))("electron") as string;
const environment: Record<string, string | undefined> = {
  ...process.env,
  OUTLORE_APP_URL: `http://localhost:${server.port}`,
  OUTLORE_DATA_DIR: dataFolder,
  OUTLORE_HARNESS: "fake",
  OUTLORE_WHISPER_GPU: "false",
};
if (isUnconfigured) {
  delete environment.OUTLORE_WHISPER_CLI;
  delete environment.OUTLORE_WHISPER_MODEL;
}
const app = spawn(
  electron,
  [
    "dist/main.js",
    `--remote-debugging-port=${debugPort}`,
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    // Chromium's audio sandbox cannot read the speech file for the fake device; this window is throwaway.
    "--no-sandbox",
    `--use-file-for-fake-audio-capture=${speech}`,
  ],
  { env: environment, stdio: "inherit" },
);
const finish = (code: number) => {
  app.kill();
  server.stop(true);
  process.exit(code);
};

const waitForTarget = async () => {
  for (let attempt = 0; attempt < 120; attempt++) {
    const targets = await fetch(`http://127.0.0.1:${debugPort}/json`)
      .then((response) => response.json() as Promise<Array<{ type: string; url: string; webSocketDebuggerUrl: string }>>)
      .catch(() => []);
    const page = targets.find((target) => target.type === "page" && target.url.startsWith("http://localhost"));
    if (page) return page;
    await Bun.sleep(500);
  }
  throw new Error("No Electron page");
};
const target = await waitForTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
let sequence = 0;
type Reply = { id?: number; result?: { data?: string; exceptionDetails?: unknown; result?: { value?: unknown } } };
const pending = new Map<number, (reply: Reply) => void>();
socket.onmessage = ({ data }) => {
  const reply = JSON.parse(String(data));
  if (reply.id) {
    pending.get(reply.id)?.(reply);
    pending.delete(reply.id);
  }
};
const send = (method: string, params: object = {}) =>
  new Promise<Reply>((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => reject(new Error(`Timed out: ${method}`)), 60000);
    pending.set(id, (reply) => {
      clearTimeout(timer);
      resolve(reply);
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression: string) => {
  const reply = await send("Runtime.evaluate", { awaitPromise: true, expression, returnByValue: true });
  if (reply.result?.exceptionDetails) throw new Error(JSON.stringify(reply.result.exceptionDetails));
  return reply.result?.result?.value;
};
const waitFor = async (expression: string, seconds = 20) => {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await Bun.sleep(100);
  }
  throw new Error(`Condition did not become true: ${expression}`);
};
const control = (label: string) => `[...document.querySelectorAll('[role="button"]')].find(e => e.getAttribute('aria-label') === ${JSON.stringify(label)})`;
const click = (label: string) =>
  evaluate(`(() => { const item = ${control(label)}; if (!item) throw new Error('Missing control: ${label}'); item.click(); })()`);
const box = () => evaluate(`document.querySelector('[role="textbox"]')?.innerText ?? null`);
const page = () => evaluate("document.body.innerText") as Promise<string>;
const shoot = async (name: string) => {
  const reply = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(shots, `${name}.png`), Buffer.from(reply.result?.data ?? "", "base64"));
};

try {
  await send("Runtime.enable");
  await send("Page.enable");
  // An empty data folder opens on the home screen; a new quest in the Borderlands has a message box.
  const startQuest = `[...document.querySelectorAll('[role="button"],button')].filter(e => e.textContent.trim() === 'Start a quest').at(-1)`;
  await waitFor(`${startQuest} !== undefined`, 60);
  await evaluate(`${startQuest}.click()`);
  await waitFor(`document.querySelector('[role="textbox"]') !== null`, 30);
  await waitFor(`${control("Dictate")} !== undefined`);
  if (isUnconfigured) {
    await click("Dictate");
    await waitFor(`document.body.innerText.includes('Voice input is not set up')`);
    await shoot("not-set-up");
    console.log("not set up: the reason shows and the button stays Dictate:", await evaluate(`${control("Dictate")} !== undefined`));
    finish(0);
  }
  // Chromium's echo cancellation and noise suppression treat the played-back file as noise and mute it, so the
  // fake microphone is opened without them; a real microphone keeps the app's own settings.
  await evaluate(`(() => {
    const open = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (constraints) =>
      open({ ...constraints, audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  })()`);
  await evaluate(`document.querySelector('[role="textbox"]').focus()`);
  await send("Input.insertText", { text: "Typed first:" });
  await waitFor(`document.querySelector('[role="textbox"]').innerText.includes('Typed first')`);

  // Cancel drops the dictation and leaves the typed text alone.
  await click("Dictate");
  await waitFor(`${control("Stop dictating")} !== undefined`);
  await shoot("listening");
  await click("Cancel dictation");
  await waitFor(`${control("Dictate")} !== undefined`);
  assert.equal(await box(), "Typed first:");
  console.log("cancel: box unchanged:", JSON.stringify(await box()));

  // A full dictation: the fake microphone plays the speech file; about 11 seconds of it are recorded.
  await click("Dictate");
  await waitFor(`${control("Stop dictating")} !== undefined`);
  await Bun.sleep(11500);
  await click("Stop dictating");
  await waitFor(`${control("Transcribing")} !== undefined || document.querySelector('[role="textbox"]').innerText.length > 20`);
  await shoot("transcribing");
  await waitFor(`${control("Dictate")} !== undefined`, 120);
  const text = String(await box());
  await shoot("transcribed");
  console.log("transcribed box:", JSON.stringify(text));
  console.log("errors under the box:", JSON.stringify((await page()).match(/No words were heard\.|could not|cannot/g)));
  assert.ok(text.startsWith("Typed first: "), "the words go after the typed text, apart from it");
  assert.ok(/ask not what your country/i.test(text), "the words of the speech file are in the box");
  finish(0);
} catch (error) {
  console.error(error);
  await shoot("failure").catch(() => void 0);
  finish(1);
}

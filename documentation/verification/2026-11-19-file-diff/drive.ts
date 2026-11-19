// Drives a throwaway Electron window (fake harness, temporary data folder, never the owner's profile) through a modified
// file's diff: a turn reports an Edit and a Write over a real file, and the script opens its steps and the diff's fold.
// Usage, from apps/desktop after `bun run build` and a web export of apps/app:
//   bun ../../documentation/verification/2026-11-19-file-diff/drive.ts <web export folder> <screenshot folder>
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [webFolder, shots] = process.argv.slice(2);
if (!webFolder || !shots) throw new Error("Give the web export folder and a screenshot folder");

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
const dataFolder = mkdtempSync(join(tmpdir(), "outlore-diff-drive-"));
const electron = createRequire(join(process.cwd(), "package.json"))("electron") as string;
const environment: Record<string, string | undefined> = {
  ...process.env,
  OUTLORE_APP_URL: `http://localhost:${server.port}`,
  OUTLORE_DATA_DIR: dataFolder,
  OUTLORE_HARNESS: "fake",
};
const app = spawn(
  electron,
  [
    "dist/main.js",
    `--remote-debugging-port=${debugPort}`,
    // This window is throwaway and starts outside Claude Code's sandbox.
    "--no-sandbox",
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

const notes = join(dataFolder, "notes.txt");
writeFileSync(notes, "one\ntwo\nthree\nfour\n");
const sendLine = async (text: string) => {
  await evaluate(`document.querySelector('[role="textbox"]').focus()`);
  await send("Input.insertText", { text });
  await Bun.sleep(200);
  await click("Send");
};
const stepsButton = `[...document.querySelectorAll('[role="button"]')].find(e => /^\\d+ steps?, /.test(e.getAttribute('aria-label') ?? ''))`;
const stepLine = (word: string) => `[...document.querySelectorAll('[role="button"]')].find(e => (e.getAttribute('aria-label') ?? '').includes(${JSON.stringify(word)}) && (e.getAttribute('aria-label') ?? '').includes('the changes'))`;

try {
  await send("Runtime.enable");
  await send("Page.enable");
  const startQuest = `[...document.querySelectorAll('[role="button"],button')].filter(e => e.textContent.trim() === 'Start a new quest').at(-1)`;
  await waitFor(`${startQuest} !== undefined`, 60);
  await evaluate(`${startQuest}.click()`);
  await waitFor(`document.querySelector('[role="textbox"]') !== null`, 30);
  const edit = { file_path: "/work/entries.ts", new_string: "const total = prices.length;\nreturn total;", old_string: "const total = 0;\nreturn total;" };
  await sendLine(`tooluse Edit ${JSON.stringify(edit)}`);
  await waitFor(`${stepsButton} !== undefined`, 30);
  await waitFor(`document.body.innerText.includes('Echo: reported Edit')`, 30);
  await evaluate(`${stepsButton}.click()`);
  await waitFor(`${stepLine("entries.ts")} !== undefined`);
  console.log("step line text:", await evaluate(`${stepLine("entries.ts")}.innerText`));
  await shoot("1-steps-open");
  await evaluate(`${stepLine("entries.ts")}.click()`);
  await waitFor(`document.body.innerText.includes('const total = prices.length;')`);
  console.log("edit diff shown:", await evaluate(`document.body.innerText.includes('const total = 0;')`));
  await shoot("2-edit-diff-wide");
  // A Write over a real file, in a second turn.
  await sendLine(`tooluse Write ${JSON.stringify({ content: "one\n2\nthree\nfour\nfive\n", file_path: notes })}`);
  await waitFor(`document.body.innerText.includes('Echo: reported Write')`, 30);
  await Bun.sleep(1500);
  // The feed is drawn newest first, so the second turn's group is the first in the page.
  for (let attempt = 0; attempt < 10 && !(await evaluate(`${stepLine("notes.txt")} !== undefined`)); attempt++) {
    await evaluate(`[...document.querySelectorAll('[role="button"]')].filter(e => /^\\d+ steps?, /.test(e.getAttribute('aria-label') ?? '')).at(0).click()`);
    await Bun.sleep(500);
  }
  await waitFor(`${stepLine("notes.txt")} !== undefined`);
  await evaluate(`${stepLine("notes.txt")}.click()`);
  await waitFor(`document.body.innerText.includes('five')`);
  console.log("write diff text:", JSON.stringify(await evaluate(`document.body.innerText.slice(-400)`)));
  await shoot("3-write-diff-wide");
  // The same page on a phone's width.
  await send("Emulation.setDeviceMetricsOverride", { deviceScaleFactor: 2, height: 780, mobile: false, width: 390 });
  await Bun.sleep(1000);
  // The narrow layout draws the feed anew, with its folds shut: open the second turn's step and its diff again.
  for (let attempt = 0; attempt < 10 && !(await evaluate(`${stepLine("notes.txt")} !== undefined`)); attempt++) {
    await evaluate(`[...document.querySelectorAll('[role="button"]')].filter(e => /^\\d+ steps?, /.test(e.getAttribute('aria-label') ?? '')).at(0).click()`);
    await Bun.sleep(500);
  }
  await evaluate(`${stepLine("notes.txt")}.click()`);
  await waitFor(`document.body.innerText.includes('\\n+\\n2\\n')`);
  await shoot("4-write-diff-phone");
  finish(0);
} catch (error) {
  console.error(error);
  await shoot("failure").catch(() => void 0);
  finish(1);
}

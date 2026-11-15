// node drive.mjs <exported web build> <output folder>
// Drives a browser with no desktop bridge against a real host through a real local relay: pairing with a code, a reload,
// steering the host, the host restarting, the host disconnecting this browser, and a host of another release.
// Needs /tmp/outlore-drive/host.js and relay.js (bun build, see host.mjs) and the electron binary of the repository.
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [webBuild, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const here = import.meta.dirname;
const electron = resolve(here, "../../../node_modules/electron/dist/Electron.app/Contents/MacOS/Electron");
const ports = { debug: 9333, host: 18788, relay: 18787, web: 18790 };
const relayOrigin = `http://127.0.0.1:${ports.relay}`;
const dataDirectory = "/tmp/outlore-drive-data";
rmSync(dataDirectory, { force: true, recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const children = [];
const start = (command, args, env = {}) => {
  const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  child.stderr.on("data", (d) => process.stderr.write(`[${args[0].split("/").pop()}] ${d}`));
  return new Promise((r) => {
    child.stdout.on("data", (d) => String(d).includes("ready") && r(child));
    setTimeout(() => r(child), 4000);
  });
};
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const stop = () => children.forEach((c) => c.kill());
process.on("exit", stop);

await start("node", ["/tmp/outlore-drive/relay.js", String(ports.relay)]);
await start("node", [resolve(here, "serve.mjs"), webBuild, String(ports.web)]);
let host = await start("node", ["/tmp/outlore-drive/host.js", dataDirectory, relayOrigin, String(ports.host), "0.1.3-Prototype"]);

// The owner's own loopback socket on the host: pairing switch, codes, disconnecting a device, reading quests.
const hostSocket = async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${ports.host}/?token=drive-token`);
  const pending = new Map();
  let n = 0;
  ws.onmessage = (e) => { const f = JSON.parse(e.data); if (f.id && pending.has(f.id)) { pending.get(f.id)(f); pending.delete(f.id); } };
  await new Promise((r) => (ws.onopen = r));
  return (request) => new Promise((r) => { const id = String(++n); pending.set(id, r); ws.send(JSON.stringify({ id, request })); });
};
let ask = await hostSocket();
const value = async (request) => { const f = await ask(request); if (f._tag !== "Success") throw new Error(JSON.stringify(f)); return f.value; };
const untilHost = async (check, tries = 100) => { for (let i = 0; i < tries; i++) { const v = await check(); if (v) return v; await wait(100); } throw new Error("host condition timed out"); };
await wait(500);
await value({ _tag: "SetRemoteAccess", isEnabled: true });
await untilHost(async () => (await value({ _tag: "ReadRemoteAccess" })).status === "Connected");
const newCode = async () => (await value({ _tag: "CreatePairingCode" })).code;

// The browser: Chromium with no desktop bridge, on the page the web build is served at.
start(electron, [resolve(here, "browser.cjs"), `http://localhost:${ports.web}/`, String(ports.debug)]);
let target;
for (let i = 0; i < 60 && !target; i++) { await wait(500); target = await fetch(`http://127.0.0.1:${ports.debug}/json`).then((r) => r.json()).then((t) => t.find((x) => x.type === "page")).catch(() => null); }
const cdp = new WebSocket(target.webSocketDebuggerUrl);
let cid = 0; const cpending = new Map();
cdp.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && cpending.has(m.id)) { cpending.get(m.id)(m); cpending.delete(m.id); } };
await new Promise((r) => (cdp.onopen = r));
const send = (method, params = {}) => new Promise((r) => { const id = ++cid; cpending.set(id, r); cdp.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { awaitPromise: true, expression, returnByValue: true })).result.result?.value;
const shot = async (name) => writeFileSync(`${out}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png" })).result.data, "base64"));
const text = () => ev("document.body.innerText");
const untilText = async (pattern, tries = 60) => { for (let i = 0; i < tries; i++) { const t = await text(); if (pattern.test(t)) return t; await wait(250); } return await text(); };
const clickText = (label) => ev(`(() => { const e = [...document.querySelectorAll('[role="button"],button,[role="menuitem"],div')].filter((x) => x.innerText?.trim() === ${JSON.stringify(label)}).sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0]; e?.click(); return !!e; })()`);
const typeInto = async (label, content) => {
  await ev(`document.querySelector('[aria-label=${JSON.stringify(label)}]').focus()`);
  await ev(`document.execCommand('selectAll')`);
  await send("Input.insertText", { text: content });
};
await wait(3000);

// 1. A browser with no pairing shows the pairing dialog and nothing behind it to use.
let page = await text();
check("no bridge", (await ev("typeof window.outlore")) === "undefined");
check("pairing dialog shown first", /Pairing code/.test(page) && /Add a host/.test(page));
check("dialog cannot be cancelled", !/Cancel/.test(page));
await shot("1-pairing-dialog");

// 2. Pairing with a code.
const code = await newCode();
await typeInto("Pairing code", code);
await clickText("Pair");
page = await untilText(/Drive Host/);
check("paired host shown by name", /Drive Host/.test(page));
check("no dialog after pairing", !/Pairing code/.test(page));
await shot("2-paired");
const devices = (await value({ _tag: "ReadRemoteAccess" })).devices;
check("host lists this browser as a paired device", devices.length === 1, JSON.stringify(devices.map((d) => d.name)));
const stored = await ev("JSON.parse(localStorage.getItem('outlore.browserHosts') ?? '[]').length");
check("pairing kept in the browser's storage", stored === 1);

// 3. The host's changes reach the browser, and the browser steers the host.
await value({ _tag: "StartMission", effort: "default", model: "default", requestId: crypto.randomUUID(), text: "Quest started on the host", workspacePath: null });
page = await untilText(/Quest started on the host/, 80);
check("a quest made on the host appears in the browser", /Quest started on the host/.test(page));
await shot("3-host-quest-visible");

// 4. A reload keeps the pairing: no dialog, the same host.
await send("Page.reload");
await wait(3000);
page = await untilText(/Drive Host/);
check("reload resumes without a new code", /Drive Host/.test(page) && !/Pairing code/.test(page));
check("reloaded page still lists the quest", /Quest started on the host/.test(await untilText(/Quest started on the host/, 60)));
await shot("4-after-reload");

// 5. The browser steers the host: a message typed in the quest reaches the host's thread and its reply comes back.
await clickText("Quest started on the host");
await wait(1500);
await ev(`document.querySelector('[contenteditable]').focus()`);
await send("Input.insertText", { text: "Message typed in the browser" });
for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { code: "Enter", key: "Enter", text: "\r", type, windowsVirtualKeyCode: 13 });
page = await untilText(/Echo: Message typed in the browser/, 80);
check("a message typed in the browser is answered by the host", /Echo: Message typed in the browser/.test(page));
await shot("5-steered-from-browser");

// 5b. The host's folder picker, through the browser: a folder on the host's computer, found and chosen.
mkdirSync(`${dataDirectory}/Atlas`, { recursive: true });
await ev(`document.querySelector('[aria-label="Open Realms overview"]')?.click()`);
await wait(1200);
await clickText("New realm");
await wait(1000);
await clickText("Choose folder…");
await wait(1200);
await typeInto("Search folders", "Atlas");
await wait(2000);
page = await text();
check("the host's folder is found by search in the browser", /Atlas/.test(page));
await shot("5b-folder-search");
await ev(`document.querySelector('[aria-label="Use Atlas"]')?.click()`);
await wait(1000);
await shot("5c-folder-chosen");
check("the chosen folder is the host's", (await text()).includes("/outlore-drive-data/Atlas"));
await clickText("Create the realm");
page = await untilText(/Atlas/, 40);
await wait(1000);
check("a realm made from the host's folder appears", /Atlas/.test(await text()) && !/Travel to a new realm/.test(await text()));
await shot("5d-realm-created");
await clickText("Quest started on the host");
await wait(1500);

// 6. The host restarts: the browser says so, tries again by itself and carries on with the same pairing.
const restartHost = async (release) => {
  host.kill();
  await wait(800);
  host = await start("node", ["/tmp/outlore-drive/host.js", dataDirectory, relayOrigin, String(ports.host), release]);
  ask = await hostSocket();
};
host.kill();
page = await untilText(/(disconnected|not connected)/i, 40);
check("the browser says when the host goes away", /Drive Host: .*(disconnected|not connected)/i.test(page), (page.match(/Drive Host: [^\n]*/) ?? [""])[0]);
await shot("6a-host-away");
host = await start("node", ["/tmp/outlore-drive/host.js", dataDirectory, relayOrigin, String(ports.host), "0.1.3-Prototype"]);
ask = await hostSocket();
page = await untilText(/^(?![\s\S]*Trying again)[\s\S]*Echo: Message typed in the browser/, 160);
check("the browser reconnects by itself when the host returns", !/Trying again/.test(page) && /Echo: Message typed in the browser/.test(page));
await shot("6b-host-back");

// 7. The host disconnects this browser: it says so for good and offers to pair again.
const [device] = (await value({ _tag: "ReadRemoteAccess" })).devices;
await value({ _tag: "DisconnectDevice", deviceId: device.id });
page = await untilText(/no longer knows this computer/, 60);
check("a disconnected browser is told to pair again", /no longer knows this computer\. Pair with it again\./.test(page));
check("it stops trying", !/Trying again/.test(page));
check("it offers Pair again", /Pair again/.test(page));
await shot("7-disconnected");
await clickText("Pair again");
await wait(800);
await typeInto("Pairing code", await newCode());
await clickText("Pair");
page = await untilText(/^(?![\s\S]*no longer knows)[\s\S]*Drive Host/, 80);
check("pairing again restores it", !/no longer knows/.test(page) && !/Pairing code/.test(page));
check("one pairing kept, not two", (await ev("JSON.parse(localStorage.getItem('outlore.browserHosts')).length")) === 1);
await shot("7b-paired-again");

// 8. A host of another release is refused, with the two releases named.
host.kill();
await wait(800);
host = await start("node", ["/tmp/outlore-drive/host.js", dataDirectory, relayOrigin, String(ports.host), "0.1.9-Prototype"]);
ask = await hostSocket();
page = await untilText(/This web app is release/, 160);
check("another release is refused and named", /This web app is release 0\.1\.3-Prototype, but the host runs 0\.1\.9-Prototype/.test(page));
check("it does not keep trying", !/Trying again/.test(page));
check("it does not offer Pair again, which would not help", !/Pair again/.test(page));
await shot("8-release-mismatch");

writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
console.log(`${results.filter((r) => r.ok).length}/${results.length} checks passed`);
stop();
process.exit(results.every((r) => r.ok) ? 0 : 1);

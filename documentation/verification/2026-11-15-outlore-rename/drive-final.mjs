// node drive-final.mjs <page websocket url> <output folder>
// Reads the Outlore window through the debugging port: name, bridge, default theme, assistant labels, the Theme choice
// and its order, then chooses the Iskios theme and reads what the reload keeps.
import { writeFileSync } from "node:fs";
const [url, out] = process.argv.slice(2);
const ws = new WebSocket(url);
let id = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
await new Promise((r) => (ws.onopen = r));
const ev = async (expression) => (await send("Runtime.evaluate", { awaitPromise: true, expression, returnByValue: true })).result.result.value;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => writeFileSync(`${out}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png" })).result.data, "base64"));
const clickText = (text) => ev(`[...document.querySelectorAll('[role="button"],button,div')].find((e) => e.innerText?.trim() === ${JSON.stringify(text)} && e.children.length < 3)?.click()`);
const state = () => ev(`({
  title: document.title,
  bridge: typeof window.outlore + "/" + typeof window.iskios,
  keys: Object.keys(localStorage).sort(),
  theme: localStorage.getItem("outlore.theme"),
  ground: document.documentElement.style.backgroundColor,
  labels: [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).filter((l) => /Chronicler|Outlore|Iskios/.test(l)),
  oldBrand: /Iskios|Guildmaster/.test(document.body.innerText),
})`);
await wait(3000);
console.log("start", JSON.stringify(await state()));
await shot("1-default");
await clickText("Workshop"); await wait(1500);
await clickText("Look and feel"); await wait(1500);
console.log("themes", JSON.stringify(await ev(`[...document.querySelectorAll('[role="radiogroup"]')].filter((g) => g.getAttribute('aria-label') === 'Theme').map((g) => [...g.querySelectorAll('[role="radio"]')].map((r) => r.innerText.trim()))`)));
await ev(`[...document.querySelectorAll('[role="radio"]')].find((r) => r.innerText.trim() === "Iskios")?.click()`);
await wait(4000);
console.log("after Iskios", JSON.stringify(await state()));
await shot("2-iskios-theme");
ws.close();

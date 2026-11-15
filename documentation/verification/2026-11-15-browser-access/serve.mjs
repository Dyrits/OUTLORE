// node serve.mjs <folder> <port>: the exported web build over plain HTTP on this computer, with the page for any path.
import { readFileSync, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
const [folder, port] = process.argv.slice(2);
const types = { ".css": "text/css", ".html": "text/html", ".ico": "image/x-icon", ".js": "text/javascript", ".png": "image/png", ".ttf": "font/ttf", ".json": "application/json" };
createServer((request, response) => {
  const path = join(folder, decodeURIComponent(new URL(request.url, "http://x").pathname));
  const file = existsSync(path) && statSync(path).isFile() ? path : join(folder, "index.html");
  response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
}).listen(Number(port), "127.0.0.1", () => console.log(JSON.stringify({ ready: true, port: Number(port) })));

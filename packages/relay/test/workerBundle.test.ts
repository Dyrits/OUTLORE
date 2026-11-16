import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { workerSourceHash } from "../scripts/workerSources.ts";
import { relayWorkerBundle, relayWorkerSourceHash } from "../src/workerBundle.generated.ts";

// The relay Worker shipped inside the app, for a user who deploys it to their own Cloudflare account. It is built from
// the Worker's sources by `bun run bundle` and committed, so these tests say when it no longer matches them.

describe("the Worker bundle the app deploys", () => {
  it("was built from the Worker's current sources", () => {
    expect(relayWorkerSourceHash, "run `bun run bundle` in packages/relay").toBe(workerSourceHash());
  });

  it("imports nothing but the Workers runtime, and is small", () => {
    const imports = [...relayWorkerBundle.matchAll(/^import .*? from ["']([^"']+)["']/gm)].map((match) => match[1]);
    expect(imports).toEqual(["cloudflare:workers"]);
    expect(relayWorkerBundle.length).toBeGreaterThan(2_000);
    expect(relayWorkerBundle.length).toBeLessThan(200_000);
  });

  it("exports the Room object the migration names, and a handler that answers like the relay", async () => {
    const folder = mkdtempSync(join(tmpdir(), "outlore-bundle-"));
    try {
      // Stands in for the Workers runtime, which is not there to run the bundle.
      const stub = `export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }`;
      writeFileSync(join(folder, "stub.mjs"), stub);
      const file = join(folder, "worker.mjs");
      writeFileSync(file, relayWorkerBundle.replace(/from ["']cloudflare:workers["']/, 'from "./stub.mjs"'));
      const loaded = (await import(pathToFileURL(file).href)) as {
        Room: unknown;
        default: { fetch(request: Request, env: unknown): Promise<Response> };
      };
      expect(typeof loaded.Room).toBe("function");
      const room = "abcdefghijklmnopqrstuvwxyz012345";
      expect((await loaded.default.fetch(new Request("https://relay.test/"), {})).status).toBe(404);
      expect((await loaded.default.fetch(new Request(`https://relay.test/r/${room}?role=client`), {})).status).toBe(
        426,
      );
    } finally {
      rmSync(folder, { force: true, recursive: true });
    }
  });

  it("refuses a source over its attempt limit with 429 before waking a room, and leaves the others alone", async () => {
    const folder = mkdtempSync(join(tmpdir(), "outlore-bundle-"));
    try {
      const stub = `export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }`;
      writeFileSync(join(folder, "stub.mjs"), stub);
      const file = join(folder, "worker.mjs");
      writeFileSync(file, relayWorkerBundle.replace(/from ["']cloudflare:workers["']/, 'from "./stub.mjs"'));
      const loaded = (await import(pathToFileURL(file).href)) as {
        default: { fetch(request: Request, env: unknown): Promise<Response> };
      };
      let woken = 0;
      const env = {
        ROOM: {
          get: () => ({
            fetch: () => {
              woken += 1;
              return Promise.resolve(new Response("room"));
            },
          }),
          idFromName: (name: string) => name,
        },
      };
      const attempt = (source: string | null) =>
        loaded.default.fetch(
          new Request("https://relay.test/r/abcdefghijklmnopqrstuvwxyz012345?role=client", {
            headers: { Upgrade: "websocket", ...(source === null ? {} : { "CF-Connecting-IP": source }) },
          }),
          env,
        );
      for (let index = 0; index < 60; index++) expect((await attempt("203.0.113.7")).status).toBe(200);
      const refused = await attempt("203.0.113.7");
      expect(refused.status).toBe(429);
      expect(refused.headers.get("Retry-After")).toBe("60");
      expect(woken).toBe(60);
      expect((await attempt("203.0.113.8")).status).toBe(200);
      // No address to count (never so on Cloudflare): not limited, rather than all sharing one count.
      expect((await attempt(null)).status).toBe(200);
    } finally {
      rmSync(folder, { force: true, recursive: true });
    }
  });
});

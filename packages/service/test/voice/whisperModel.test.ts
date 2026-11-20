import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { bundledModelPath, ensureBundledModel } from "../../src/voice/whisperModel.ts";

const content = "test model";
const source = {
  bytes: Buffer.byteLength(content),
  sha256: createHash("sha256").update(content).digest("hex"),
  url: "https://example.test/model",
};

describe("setting up the bundled dictation model", () => {
  it("shares the first download and uses the verified file on later presses", async () => {
    const folder = await mkdtemp(`${tmpdir()}/outlore-voice-`);
    try {
      const path = bundledModelPath(folder);
      const urls: string[] = [];
      const fakeFetch: typeof fetch = async (url) => {
        urls.push(String(url));
        return new Response(content);
      };
      await Promise.all([ensureBundledModel(path, source, fakeFetch), ensureBundledModel(path, source, fakeFetch)]);
      await ensureBundledModel(path, source, fakeFetch);
      expect(urls).toEqual([source.url]);
      expect(await readFile(path, "utf8")).toBe(content);
    } finally {
      await rm(folder, { force: true, recursive: true });
    }
  });

  it("discards a corrupt response and retries on the next press", async () => {
    const folder = await mkdtemp(`${tmpdir()}/outlore-voice-`);
    try {
      const path = bundledModelPath(folder);
      await expect(ensureBundledModel(path, source, async () => new Response("fake model"))).rejects.toThrow(
        "failed verification",
      );
      expect(await readdir(`${folder}/voice`)).toEqual([]);
      await ensureBundledModel(path, source, async () => new Response(content));
      expect(await readFile(path, "utf8")).toBe(content);
    } finally {
      await rm(folder, { force: true, recursive: true });
    }
  });
});

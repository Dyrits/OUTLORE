import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";

const model = {
  bytes: 147_951_465,
  sha256: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe",
  url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
};

const downloads = new Map<string, Promise<void>>();

/** The bundled engine's multilingual model lives alongside the host's other local data. */
export const bundledModelPath = (dataDirectory: string) => join(dataDirectory, "voice", "ggml-base.bin");

const download = async (path: string, source: typeof model, fetchModel: typeof fetch) => {
  await mkdir(dirname(path), { mode: 0o700, recursive: true });
  const partial = `${path}.download`;
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10 * 60_000)]);
  try {
    const response = await fetchModel(source.url, { signal });
    if (!response.ok || response.body === null) throw new Error("The voice model download request failed.");
    const reader = response.body.getReader();
    const hash = createHash("sha256");
    let bytes = 0;
    const chunks = async function* () {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        bytes += value.byteLength;
        if (bytes > source.bytes) throw new Error("The voice model download is larger than expected.");
        hash.update(value);
        yield value;
      }
    };
    await pipeline(chunks(), createWriteStream(partial, { mode: 0o600 }), { signal });
    if (bytes !== source.bytes || hash.digest("hex") !== source.sha256)
      throw new Error("The voice model download failed verification.");
    await rename(partial, path);
  } finally {
    controller.abort();
    await rm(partial, { force: true });
  }
};

/** Installs the verified model once, sharing an in-flight download between simultaneous dictations. */
export async function ensureBundledModel(path: string, source = model, fetchModel = fetch): Promise<void> {
  const cached = await stat(path).catch(() => null);
  if (cached?.isFile() && cached.size === source.bytes) return;
  const current = downloads.get(path);
  if (current !== undefined) return current;
  const pending = download(path, source, fetchModel).finally(() => downloads.delete(path));
  downloads.set(path, pending);
  return pending;
}

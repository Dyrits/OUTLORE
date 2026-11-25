import { describe, expect, it, vi } from "vitest";
import { imageCache } from "../../src/attachments/imageCache";

const loaded = async (cache: ReturnType<typeof imageCache>, id: string, data: string) => {
  const fetch = vi.fn(async () => data);
  await cache.load(id, fetch);
  await Promise.resolve();
  return fetch;
};

describe("the fetched image cache", () => {
  it("fetches an image once while it is held", async () => {
    const cache = imageCache(100);
    const fetch = await loaded(cache, "a", "x".repeat(10));
    await cache.load("a", fetch);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("shares one fetch between two requests made before it settles", () => {
    const cache = imageCache(100);
    const fetch = vi.fn(() => new Promise<string>(() => undefined));
    cache.load("a", fetch);
    cache.load("a", fetch);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("drops the least recently shown images past the limit", async () => {
    const cache = imageCache(25);
    await loaded(cache, "a", "x".repeat(10));
    await loaded(cache, "b", "x".repeat(10));
    await cache.load("a", async () => "unused");
    await loaded(cache, "c", "x".repeat(10));
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
    expect(cache.size).toBe(20);
  });
  it("keeps an image larger than the limit while it is the newest", async () => {
    const cache = imageCache(5);
    await loaded(cache, "a", "x".repeat(10));
    expect(cache.has("a")).toBe(true);
  });
  it("forgets a failed fetch so it is tried again", async () => {
    const cache = imageCache(100);
    await cache.load("a", () => Promise.reject(new Error("down"))).catch(() => undefined);
    await Promise.resolve();
    expect(cache.has("a")).toBe(false);
  });
  it("exposes a resolved image synchronously through peek and returns null while loading or uncached", async () => {
    const cache = imageCache(100);
    expect(cache.peek("a")).toBeNull();
    let resolve: (data: string) => void = () => {};
    const pending = cache.load(
      "a",
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    expect(cache.peek("a")).toBeNull();
    resolve("data:image/png;base64,abc");
    await pending;
    await Promise.resolve();
    expect(cache.peek("a")).toBe("data:image/png;base64,abc");
  });
});

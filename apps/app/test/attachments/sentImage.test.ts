import { describe, expect, it, vi } from "vitest";
import { imageCache } from "../../src/attachments/imageCache";
import { dataAddressOf, loadSentImage } from "../../src/attachments/sentImage";

const content = { data: "AAAA", mediaType: "image/png" };

describe("loading the image of a sent message", () => {
  it("gives the image as a data address once it is read", async () => {
    const image = await loadSentImage(imageCache(100), "a", async () => content);
    expect(image).toEqual({ status: "ready", uri: "data:image/png;base64,AAAA" });
  });
  it("shows the reason when the image cannot be read, instead of staying silent", async () => {
    const image = await loadSentImage(imageCache(100), "a", () => Promise.reject(new Error("The file is gone.")));
    expect(image).toEqual({ message: "The file is gone.", status: "failed" });
  });
  it("shows a thrown non-error as text", async () => {
    const image = await loadSentImage(imageCache(100), "a", () => Promise.reject("offline"));
    expect(image).toEqual({ message: "offline", status: "failed" });
  });
  it("reads again on a retry after a failure", async () => {
    const cache = imageCache(100);
    const read = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue(content);
    expect((await loadSentImage(cache, "a", read)).status).toBe("failed");
    await Promise.resolve();
    expect((await loadSentImage(cache, "a", read)).status).toBe("ready");
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("shows an image the app uploaded without reading it back", async () => {
    const cache = imageCache(100);
    cache.put("a", dataAddressOf("image/png", "AAAA"));
    const read = vi.fn().mockResolvedValue(content);
    expect(await loadSentImage(cache, "a", read)).toEqual({ status: "ready", uri: "data:image/png;base64,AAAA" });
    expect(read).not.toHaveBeenCalled();
  });
  it("writes a data address from a media type and base64 data", () => {
    expect(dataAddressOf("image/webp", "QQ==")).toBe("data:image/webp;base64,QQ==");
  });
});

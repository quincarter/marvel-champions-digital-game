import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onPreviewArtArrived, previewArtKey, previewPictureFor, resetPreviewArt } from "./preview-art.js";

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 150));

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:picture");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => {
  resetPreviewArt();
  vi.restoreAllMocks();
});

describe("previewPictureFor", () => {
  it("is null at first, fetches once, then answers with a blob source and announces the arrival", async () => {
    let calls = 0;
    resetPreviewArt(async () => (calls++, new Response(new Blob(["webp"]))));
    const arrived = vi.fn();
    onPreviewArtArrived(arrived);
    expect(previewPictureFor("https://h/c.webp")).toBeNull();
    expect(previewPictureFor("https://h/c.webp")).toBeNull();
    await tick();
    expect(previewPictureFor("https://h/c.webp")).toEqual({
      key: previewArtKey("https://h/c.webp"),
      url: "blob:picture",
    });
    expect(calls).toBe(1);
    expect(arrived).toHaveBeenCalledTimes(1);
  });

  it("stays null for good on a 404 (the generated face is the answer) and never refetches", async () => {
    let calls = 0;
    resetPreviewArt(async () => (calls++, new Response("", { status: 404 })));
    previewPictureFor("https://h/none.webp");
    await tick();
    expect(previewPictureFor("https://h/none.webp")).toBeNull();
    expect(calls).toBe(1);
  });

  it("fetches at most four at a time", async () => {
    let live = 0;
    let peak = 0;
    resetPreviewArt(async () => {
      live++;
      peak = Math.max(peak, live);
      await new Promise((resolve) => setTimeout(resolve, 10));
      live--;
      return new Response(new Blob(["x"]));
    });
    for (let i = 0; i < 12; i++) previewPictureFor(`https://h/${i}.webp`);
    await tick();
    await tick();
    expect(peak).toBeLessThanOrEqual(4);
  });
});

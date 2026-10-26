import { afterEach, describe, expect, it, vi } from "vitest";

import { ArtBitmaps, EVICTED_ART_CLOSE_DELAY_MS } from "./card-face-bake.js";
import type { CardFaceSpec } from "./card-face.js";

const spec = (n: number) =>
  ({
    artUrl: `/art/${n}.webp`,
    width: 400,
    height: 600,
    resolution: 1,
    artFit: "cover",
    artOnly: true,
  }) as unknown as CardFaceSpec;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ArtBitmaps eviction", () => {
  it("keeps an evicted bitmap open a while, so a bake already holding it can still paint from it", async () => {
    vi.useFakeTimers();
    const made: { close: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: true, blob: () => Promise.resolve({ size: 1, type: "" }) }));
    vi.stubGlobal("createImageBitmap", () => {
      const bitmap = { width: 10, height: 10, close: vi.fn() };
      made.push(bitmap);
      return Promise.resolve(bitmap);
    });
    const art = new ArtBitmaps();
    const first = await art.get(spec(0));
    for (let n = 1; n <= 33; n++) await art.get(spec(n));
    await vi.advanceTimersByTimeAsync(0);
    expect(first?.source).toBe(made[0]);
    expect(made[0]!.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(EVICTED_ART_CLOSE_DELAY_MS + 1);
    expect(made[0]!.close).toHaveBeenCalledOnce();
  });
});

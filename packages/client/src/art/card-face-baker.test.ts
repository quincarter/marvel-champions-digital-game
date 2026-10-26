import type Phaser from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CardFaceBaker } from "./card-face-baker.js";
import type { CardFaceSpec } from "./card-face.js";

vi.mock("./card-face-bake.js", () => ({
  ArtBitmaps: class {},
  // 4000 x 1500 x 4 = 24 MB a face: four fill the 96 MB budget.
  bakeCardFace: () => Promise.resolve({ width: 4000, height: 1500, close() {} }),
}));
vi.mock("./bitmap-canvas.js", () => ({
  // As the real thing does, leaves the bitmap detached: width and height read 0 afterwards.
  canvasOf: (bitmap: { width: number; height: number }) => {
    bitmap.width = 0;
    bitmap.height = 0;
    return { width: 0, height: 0 };
  },
}));

const spec = (n: number) => ({ id: n }) as unknown as CardFaceSpec;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeGame() {
  const keys = new Set<string>();
  const textures = {
    exists: (key: string) => keys.has(key),
    remove: (key: string) => keys.delete(key),
    addImage: (key: string) => keys.add(key),
    get: () => ({ getSourceImage: () => ({ width: 1, height: 1 }) }),
  };
  return { game: { textures } as unknown as Phaser.Game, keys };
}

function holder() {
  return { once: () => undefined } as unknown as Phaser.GameObjects.GameObject;
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => setTimeout(fn, 0));
});

describe("CardFaceBaker budget", () => {
  it("never evicts the face just accepted when held faces fill the budget", async () => {
    const { game, keys } = fakeGame();
    const baker = new CardFaceBaker(game);
    for (let n = 1; n <= 5; n++) {
      baker.request(spec(n));
      await settle();
      baker.hold(baker.request(spec(n))!, holder());
      await settle();
    }
    baker.request(spec(6));
    await settle();
    const key = baker.request(spec(6));
    expect(key).not.toBeNull();
    expect(keys.has(key!)).toBe(true);
    // Still there after the notice a scene would draw and hold it on.
    await settle();
    expect(baker.request(spec(6))).toBe(key);
  });

  it("evicts the coldest drawn face by its real size once over budget (the detached bitmap reads 0 x 0)", async () => {
    const { game } = fakeGame();
    const baker = new CardFaceBaker(game);
    for (let n = 1; n <= 4; n++) {
      baker.request(spec(n));
      await settle();
    }
    await settle(); // the notice: nobody holds them, nobody has asked again
    baker.request(spec(5));
    await settle();
    expect(baker.mode).toBe("inline");
    expect(baker.request(spec(5))).not.toBeNull();
    // 1 was the coldest, so it went (asking for it again queues a re-bake and answers null).
    expect(baker.request(spec(1))).toBeNull();
  });
});

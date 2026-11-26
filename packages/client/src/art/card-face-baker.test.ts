import type Phaser from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CardFaceBaker, inlineFontBytes } from "./card-face-baker.js";
import type { CardFaceSpec } from "./card-face.js";

const gate = vi.hoisted(() => ({
  hold: false,
  started: [] as { id: number; finish: () => void }[],
}));
vi.mock("./card-face-bake.js", () => ({
  ArtBitmaps: class {},
  // 4000 x 1500 x 4 = 24 MB a face: four fill the 96 MB budget.
  bakeCardFace: (spec: { id: number }) => {
    const bitmap = { width: 4000, height: 1500, close() {} };
    if (!gate.hold) return Promise.resolve(bitmap);
    return new Promise((resolve) => gate.started.push({ id: spec.id, finish: () => resolve(bitmap) }));
  },
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
  gate.hold = false;
  gate.started.length = 0;
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

describe("CardFaceBaker queue (inline path)", () => {
  const startedIds = () => gate.started.map((job) => job.id);

  it("bakes at most IN_FLIGHT at a time, most urgent first, and the rest as slots free up", async () => {
    gate.hold = true;
    const { game } = fakeGame();
    const baker = new CardFaceBaker(game);
    for (const [n, priority] of [
      [1, 900],
      [2, 800],
      [3, 0],
      [4, 10],
    ] as const) {
      baker.track(priority, () => baker.request(spec(n)));
    }
    await settle();
    expect(startedIds()).toEqual([1, 2]); // the worker-less baker went inline before anything was queued
    gate.started.shift()!.finish();
    await settle();
    expect(startedIds()).toEqual([2, 3]);
    gate.started.shift()!.finish();
    await settle();
    expect(startedIds()).toEqual([3, 4]);
    expect(baker.queued).toBe(0);
  });

  it("drops a queued face whose tile was released, but not one already baking", async () => {
    gate.hold = true;
    const { game } = fakeGame();
    const baker = new CardFaceBaker(game);
    const tickets = [1, 2, 3, 4].map((n) => baker.track(n, () => baker.request(spec(n))).tickets);
    await settle();
    expect(startedIds()).toEqual([1, 2]);
    for (const t of tickets) baker.release(t);
    expect(baker.queued).toBe(0);
    gate.started.shift()!.finish();
    gate.started.shift()!.finish();
    await settle();
    expect(startedIds()).toEqual([]);
    // 3 was dropped, so asking again starts a fresh bake.
    expect(baker.request(spec(3))).toBeNull();
    await settle();
    expect(startedIds()).toEqual([3]);
  });

  it("keeps a face another tile still waits on, and re-prioritises a queued one", async () => {
    gate.hold = true;
    const { game } = fakeGame();
    const baker = new CardFaceBaker(game);
    baker.request(spec(1));
    baker.request(spec(2));
    const shared1 = baker.track(500, () => baker.request(spec(3))).tickets;
    const shared2 = baker.track(500, () => baker.request(spec(3))).tickets;
    const other = baker.track(100, () => baker.request(spec(4))).tickets;
    baker.release(shared1);
    expect(baker.queued).toBe(2);
    baker.reprioritize(shared2, 0);
    gate.started.shift()!.finish();
    await settle();
    expect(startedIds()).toEqual([2, 3]);
    expect(other).toHaveLength(1);
  });
});

describe("CardFaceBaker queue (untracked and tracked wants)", () => {
  it("keeps a face an untracked caller asked for when a tracked ticket on it is released, at the better priority", async () => {
    gate.hold = true;
    const { game } = fakeGame();
    const baker = new CardFaceBaker(game);
    baker.request(spec(1));
    baker.request(spec(2));
    baker.request(spec(3)); // untracked: wanted as if on screen
    const { tickets } = baker.track(800, () => baker.request(spec(3)));
    baker.release(tickets);
    expect(baker.queued).toBe(1);
    baker.request(spec(4)); // untracked, queued behind 3? same priority, later
    baker.track(0, () => baker.request(spec(5)));
    gate.started.shift()!.finish();
    await settle();
    expect(gate.started.map((job) => job.id)).toEqual([2, 3]);
  });
});

describe("CardFaceBaker with a worker that fails a face", () => {
  it("bakes it inline exactly once, then marks it failed, and other faces still bake", async () => {
    const posted: { id: number; spec: { id: number } }[] = [];
    let worker: { onmessage: (e: { data: unknown }) => void };
    vi.stubGlobal(
      "Worker",
      class {
        onmessage: ((e: { data: unknown }) => void) | null = null;
        onerror = null;
        constructor() {
          worker = this as never;
        }
        postMessage(m: { type: string; id: number; spec: { id: number } }) {
          if (m.type === "bake") posted.push(m);
        }
        terminate() {}
      },
    );
    vi.stubGlobal("document", { styleSheets: [], baseURI: "http://x/" });
    const { game } = fakeGame();
    const baker = new CardFaceBaker(game);
    worker!.onmessage({ data: { type: "ready", ok: true } });
    expect(baker.mode).toBe("worker");
    baker.request(spec(1));
    baker.request(spec(2));
    baker.request(spec(3));
    expect(posted.map((m) => m.spec.id)).toEqual([1, 2]);
    gate.hold = true;
    worker!.onmessage({ data: { type: "failed", id: posted[0]!.id, reason: "x" } });
    await settle();
    // Not posted to the worker again: baked here, in the slot it freed.
    expect(posted.map((m) => m.spec.id)).toEqual([1, 2]);
    expect(gate.started.map((job) => job.id)).toEqual([1]);
    gate.started.shift()!.finish();
    await settle();
    // The slot comes back, and the next face goes to the worker.
    expect(posted.map((m) => m.spec.id)).toEqual([1, 2, 3]);
    expect(baker.request(spec(1))).not.toBeNull();
    expect(gate.started).toEqual([]);
    vi.unstubAllGlobals();
  });
});

describe("inlineFontBytes (#932: WebView2 158 crashes on a data: font in a worker)", () => {
  const bytesOf = (buffer: ArrayBuffer | null): number[] => (buffer ? [...new Uint8Array(buffer)] : []);

  it("turns a build's inlined base64 font into its bytes", () => {
    // "wOF2" plus one byte, as Vite writes a small woff2.
    const src = 'url("data:font/woff2;base64,d09GMgA=") format("woff2")';
    expect(bytesOf(inlineFontBytes(src))).toEqual([0x77, 0x4f, 0x46, 0x32, 0x00]);
  });

  it("reads an unquoted data: URL without a format", () => {
    expect(bytesOf(inlineFontBytes("url(data:font/woff2;base64,AAE=)"))).toEqual([0, 1]);
  });

  it("reads a percent-encoded data: URL as bytes, not text", () => {
    expect(bytesOf(inlineFontBytes("url(data:font/woff2,w%FF%00)"))).toEqual([0x77, 0xff, 0x00]);
  });

  it("leaves a font file's URL to the worker", () => {
    expect(
      inlineFontBytes('url("http://tauri.localhost/assets/bangers-latin-400-normal.woff2") format("woff2")'),
    ).toBeNull();
  });

  it("leaves a src with several sources alone", () => {
    const src = 'url("data:font/woff2;base64,AAE=") format("woff2"), url("http://x/a.woff") format("woff")';
    expect(inlineFontBytes(src)).toBeNull();
  });

  it("gives up on a broken data: URL rather than throwing", () => {
    expect(inlineFontBytes('url("data:font/woff2;base64,%%%")')).toBeNull();
  });
});

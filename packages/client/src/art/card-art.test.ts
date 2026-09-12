/**
 * Regression coverage for the resident-texture budget (see the file header on
 * `card-art.ts` for the 3.5 GB report this fixes).
 *
 * These fakes model exactly the slice of the Phaser API `CardArt` touches —
 * `scene.load`, `scene.textures`, `scene.events`, `scene.time` — rather than
 * pulling in the real `phaser` package, which throws on import outside a
 * browser (`window` is referenced at module scope). That's also why
 * `card-art.ts` only imports `phaser` for types: this file is the payoff,
 * proving the eviction and listener-cleanup logic without a DOM.
 */

import { describe, expect, it } from "vitest";
import { CardArt } from "./card-art.js";
import { CARD_BACKS, type ArtSource } from "./art-source.js";

type Size = { readonly width: number; readonly height: number };
type Listener = (...args: unknown[]) => void;

class FakeEmitter {
  readonly #listeners = new Map<string, Set<Listener>>();
  on(event: string, fn: Listener): void {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event)!.add(fn);
  }
  off(event: string, fn: Listener): void {
    this.#listeners.get(event)?.delete(fn);
  }
  once(event: string, fn: Listener): void {
    const wrapped: Listener = (...args) => {
      this.off(event, wrapped);
      fn(...args);
    };
    this.on(event, wrapped);
  }
  emit(event: string, ...args: unknown[]): void {
    for (const fn of [...(this.#listeners.get(event) ?? [])]) fn(...args);
  }
  count(event: string): number {
    return this.#listeners.get(event)?.size ?? 0;
  }
}

class FakeTextures {
  readonly #existing = new Map<string, Size>();
  readonly #staged = new Map<string, Size>();
  readonly removed: string[] = [];
  /** Declares what size a key will decode to once loaded. */
  stage(key: string, size: Size): void {
    this.#staged.set(key, size);
  }
  /** Moves a staged key into "loaded", as the real loader would after a fetch. */
  materialize(key: string): void {
    this.#existing.set(key, this.#staged.get(key) ?? { width: 300, height: 419 });
  }
  exists(key: string): boolean {
    return this.#existing.has(key);
  }
  get(key: string): { getSourceImage(): Size } {
    const size = this.#existing.get(key);
    if (!size) throw new Error(`fake texture manager has no "${key}"`);
    return { getSourceImage: () => size };
  }
  remove(key: string): void {
    this.#existing.delete(key);
    this.removed.push(key);
  }
}

class FakeLoader {
  readonly #events = new FakeEmitter();
  readonly #queue: { key: string; url: string }[] = [];
  #loading = false;
  constructor(private readonly textures: FakeTextures) {}
  image(key: string, url: string): void {
    this.#queue.push({ key, url });
  }
  isLoading(): boolean {
    return this.#loading;
  }
  /** Synchronously "completes" every queued file, firing the same events the real loader would. */
  start(): void {
    this.#loading = true;
    const batch = this.#queue.splice(0, this.#queue.length);
    for (const { key } of batch) {
      this.textures.materialize(key);
      this.#events.emit("filecomplete", key, "image", null);
    }
    this.#loading = false;
  }
  on(event: string, fn: Listener): void {
    this.#events.on(event, fn);
  }
  off(event: string, fn: Listener): void {
    this.#events.off(event, fn);
  }
  listenerCount(event: string): number {
    return this.#events.count(event);
  }
}

class FakeScene {
  readonly textures = new FakeTextures();
  readonly load = new FakeLoader(this.textures);
  readonly events = new FakeEmitter();
  readonly game = {};
  readonly time = {
    // Real Phaser defers to the next tick; running synchronously here just
    // compresses that gap, which the flush/notify guards already tolerate.
    delayedCall: (_delay: number, callback: () => void): void => callback(),
  };
  shutdown(): void {
    this.events.emit("shutdown");
  }
}

const source = (key: string, url = `/card-art/${key}.png`): ArtSource => ({ key, url });

describe("CardArt residency budget", () => {
  it("evicts the coldest textures once decoded bytes cross the budget", () => {
    const art = new CardArt();
    const scene = new FakeScene() as unknown as import("phaser").Scene;
    const raw = scene as unknown as FakeScene;

    // Three ~100 MB (5000x5000) scans: the second request pushes residency
    // over the 256 MB budget, so the coldest (the first) should be evicted.
    const big: Size = { width: 5000, height: 5000 }; // 100 MB decoded
    for (const key of ["a", "b", "c"]) raw.textures.stage(key, big);

    art.request(scene, source("a"));
    raw.load.start();
    expect(scene.textures.exists("a")).toBe(true);

    art.request(scene, source("b"));
    raw.load.start();
    // a + b = 200 MB, still under budget.
    expect(scene.textures.exists("a")).toBe(true);
    expect(scene.textures.exists("b")).toBe(true);

    art.request(scene, source("c"));
    raw.load.start();
    // a + b + c = 300 MB > 256 MB budget: "a" is coldest (least recently
    // requested) and is evicted; "b" and "c" survive.
    expect(scene.textures.exists("a")).toBe(false);
    expect(scene.textures.exists("b")).toBe(true);
    expect(scene.textures.exists("c")).toBe(true);
    expect(raw.textures.removed).toEqual(["a"]);
  });

  it("never evicts a key re-requested more recently than colder keys", () => {
    const art = new CardArt();
    const scene = new FakeScene() as unknown as import("phaser").Scene;
    const raw = scene as unknown as FakeScene;
    const big: Size = { width: 5000, height: 5000 };
    for (const key of ["a", "b", "c"]) raw.textures.stage(key, big);

    art.request(scene, source("a"));
    raw.load.start();
    art.request(scene, source("b"));
    raw.load.start();
    // Touch "a" again — it's on screen this redraw, so it's no longer the
    // coldest even though it loaded first.
    art.request(scene, source("a"));

    art.request(scene, source("c"));
    raw.load.start();

    expect(scene.textures.exists("a")).toBe(true);
    expect(scene.textures.exists("b")).toBe(false);
    expect(scene.textures.exists("c")).toBe(true);
  });

  it("reloads a key transparently after it's evicted", () => {
    const art = new CardArt();
    const scene = new FakeScene() as unknown as import("phaser").Scene;
    const raw = scene as unknown as FakeScene;
    const big: Size = { width: 5000, height: 5000 };
    for (const key of ["a", "b", "c"]) raw.textures.stage(key, big);

    art.request(scene, source("a"));
    raw.load.start();
    art.request(scene, source("b"));
    raw.load.start();
    art.request(scene, source("c"));
    raw.load.start();
    expect(scene.textures.exists("a")).toBe(false); // evicted, over budget

    // Asked for again: the ordinary thing that happens when a redraw wants a
    // card that's no longer resident. It must actually reload, not return
    // null forever because `#requested` still thinks it's in flight.
    const result = art.request(scene, source("a"));
    expect(result).toBeNull(); // not yet loaded — the caller draws a fallback frame
    raw.load.start();
    expect(scene.textures.exists("a")).toBe(true);
  });

  it("never evicts the pinned card-back textures", () => {
    const art = new CardArt();
    const scene = new FakeScene() as unknown as import("phaser").Scene;
    const raw = scene as unknown as FakeScene;
    const big: Size = { width: 5000, height: 5000 };
    const back = CARD_BACKS.player;
    raw.textures.stage(back.key, { width: 300, height: 419 });
    for (const key of ["a", "b", "c"]) raw.textures.stage(key, big);

    art.request(scene, back);
    raw.load.start();
    for (const key of ["a", "b", "c"]) {
      art.request(scene, source(key));
      raw.load.start();
    }

    expect(scene.textures.exists(back.key)).toBe(true);
  });

  it("removes its loader listeners on scene shutdown, not just the resize handler", () => {
    const art = new CardArt();
    const scene = new FakeScene() as unknown as import("phaser").Scene;
    const raw = scene as unknown as FakeScene;
    raw.textures.stage("a", { width: 300, height: 419 });

    art.request(scene, source("a"));
    expect(raw.load.listenerCount("filecomplete")).toBe(1);
    expect(raw.load.listenerCount("loaderror")).toBe(1);

    raw.shutdown();

    expect(raw.load.listenerCount("filecomplete")).toBe(0);
    expect(raw.load.listenerCount("loaderror")).toBe(0);
  });

  it("stays under budget indefinitely across a long run of distinct cards", () => {
    const art = new CardArt();
    const scene = new FakeScene() as unknown as import("phaser").Scene;
    const raw = scene as unknown as FakeScene;
    const typical: Size = { width: 710, height: 1030 }; // ~2.9 MB decoded, a real Core scan's size

    for (let i = 0; i < 500; i++) {
      const key = `card-${i}`;
      raw.textures.stage(key, typical);
      art.request(scene, source(key));
      raw.load.start();
    }

    // 500 distinct scans at ~2.9 MB each is ~1.4 GB unbounded; capped residency
    // must stay at or under budget regardless of how many keys were ever asked for.
    expect(art.residentBytes()).toBeLessThanOrEqual(256 * 1024 * 1024);
  });
});

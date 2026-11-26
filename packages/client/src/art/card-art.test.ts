/**
 * Regression coverage for the resident-texture budget (see the file header on
 * `card-art.ts` for the 3.5 GB report this fixes) and for the table-sized copies
 * of scans (the 3.9 GB WebKit report).
 *
 * These fakes model exactly the slice of the Phaser API `CardArt` touches —
 * `scene.textures` and `scene.scale` — rather than pulling in the real `phaser`
 * package, which throws on import outside a browser (`window` is referenced at
 * module scope). Decoding is injected: each scan decodes to the size staged for
 * it, scaled down to the slot asked for, as `picture-bake-client.ts` does.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CardArt, type ScanDecoder } from "./card-art.js";
import { releasePackArt } from "./pack-art.js";

vi.mock("./pack-art.js", () => ({ releasePackArt: vi.fn() }));
import { CARD_BACKS, type ArtSource } from "./art-source.js";

type Size = { readonly width: number; readonly height: number };
const MB = 1024 * 1024;
const BUDGET = 256 * MB;

class FakeTextures {
  readonly #existing = new Map<string, Size>();
  readonly removed: string[] = [];
  exists(key: string): boolean {
    return this.#existing.has(key);
  }
  get(key: string): { getSourceImage(): Size } {
    const size = this.#existing.get(key);
    if (!size) throw new Error(`fake texture manager has no "${key}"`);
    return { getSourceImage: () => size };
  }
  addImage(key: string, source: Size): void {
    this.#existing.set(key, { width: source.width, height: source.height });
  }
  remove(key: string): void {
    this.#existing.delete(key);
    this.removed.push(key);
  }
}

class FakeScene {
  readonly textures = new FakeTextures();
  readonly game = {};
  constructor(readonly scale: { height: number } = { height: 900 }) {}
}

/** Native scan sizes by url; a url with none staged is a 404. Records every decode asked for. */
class FakeDecoder {
  readonly #sizes = new Map<string, Size>();
  readonly asked: { url: string; slot: Size }[] = [];
  stage(url: string, size: Size): void {
    this.#sizes.set(url, size);
  }
  readonly decode: ScanDecoder = async (url, slot) => {
    this.asked.push({ url, slot });
    const size = this.#sizes.get(url);
    if (!size) return null;
    const scale = Math.min(1, Math.max(slot.width / size.width, slot.height / size.height));
    return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) } as HTMLCanvasElement;
  };
}

const source = (key: string): ArtSource => ({ key, url: `/card-art/${key}.png` });
const urlOf = (key: string): string => `/card-art/${key}.png`;

/** Lets every pending decode settle. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

function setup(options: { screenHeight?: number; renderScale?: number; budget?: number; decode?: ScanDecoder } = {}) {
  const decoder = new FakeDecoder();
  const art = new CardArt({
    decode: options.decode ?? decoder.decode,
    budgetBytes: options.budget ?? BUDGET,
    renderScale: () => options.renderScale ?? 1,
  });
  const raw = new FakeScene({ height: options.screenHeight ?? 900 });
  const scene = raw as unknown as import("phaser").Scene;
  return { art, raw, scene, decoder };
}

/** A scan that decodes to `size` at the table's slot too: a square much wider than the slot is tall, as big as asked. */
const huge = (decoder: FakeDecoder, key: string): void => decoder.stage(urlOf(key), { width: 5000, height: 5000 });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("CardArt residency budget", () => {
  it("evicts the coldest textures once decoded bytes cross the budget", async () => {
    // A table slot as tall as these scans: each is 100 MB decoded.
    const { art, raw, scene, decoder } = setup({ screenHeight: 5000 / 0.34 });
    for (const key of ["a", "b", "c"]) huge(decoder, key);

    art.request(scene, source("a"));
    await settle();
    art.request(scene, source("b"));
    await settle();
    expect(scene.textures.exists("a")).toBe(true);
    expect(scene.textures.exists("b")).toBe(true);

    art.request(scene, source("c"));
    await settle();
    // 300 MB > 256 MB: "a" is coldest (least recently requested) and goes.
    expect(scene.textures.exists("a")).toBe(false);
    expect(scene.textures.exists("b")).toBe(true);
    expect(scene.textures.exists("c")).toBe(true);
    expect(raw.textures.removed).toEqual(["a"]);
  });

  it("never evicts a key re-requested more recently than colder keys", async () => {
    const { art, scene, decoder } = setup({ screenHeight: 5000 / 0.34 });
    for (const key of ["a", "b", "c"]) huge(decoder, key);
    art.request(scene, source("a"));
    await settle();
    art.request(scene, source("b"));
    await settle();
    // On screen again this redraw: no longer the coldest though it loaded first.
    art.request(scene, source("a"));
    art.request(scene, source("c"));
    await settle();
    expect(scene.textures.exists("a")).toBe(true);
    expect(scene.textures.exists("b")).toBe(false);
    expect(scene.textures.exists("c")).toBe(true);
  });

  it("reloads a key transparently after it's evicted", async () => {
    const { art, scene, decoder } = setup({ screenHeight: 5000 / 0.34 });
    for (const key of ["a", "b", "c"]) huge(decoder, key);
    for (const key of ["a", "b", "c"]) {
      art.request(scene, source(key));
      await settle();
    }
    expect(scene.textures.exists("a")).toBe(false);
    // Asked for again, it must actually reload rather than read as in flight forever.
    expect(art.request(scene, source("a"))).toBeNull();
    await settle();
    expect(scene.textures.exists("a")).toBe(true);
  });

  it("never evicts the pinned card-back textures", async () => {
    const { art, scene, decoder } = setup({ screenHeight: 5000 / 0.34 });
    const back = CARD_BACKS.player;
    decoder.stage(back.url, { width: 300, height: 419 });
    for (const key of ["a", "b", "c"]) huge(decoder, key);
    art.request(scene, back);
    await settle();
    for (const key of ["a", "b", "c"]) {
      art.request(scene, source(key));
      await settle();
    }
    expect(scene.textures.exists(back.key)).toBe(true);
  });

  it("asks for a missing scan once, and answers null for it after", async () => {
    const { art, scene, decoder } = setup();
    expect(art.request(scene, source("gone"))).toBeNull();
    await settle();
    expect(art.isMissing("gone")).toBe(true);
    expect(art.request(scene, source("gone"))).toBeNull();
    await settle();
    expect(decoder.asked.filter((a) => a.url === urlOf("gone"))).toHaveLength(1);
  });

  it("asks for a scan once while its decode is out", async () => {
    const { art, scene, decoder } = setup();
    decoder.stage(urlOf("a"), { width: 627, height: 900 });
    art.request(scene, source("a"));
    art.request(scene, source("a"));
    await settle();
    expect(decoder.asked).toHaveLength(1);
    expect(art.request(scene, source("a"))).toBe("a");
  });

  it("tells the screens once for a run of arrivals", async () => {
    const { art, scene, decoder } = setup();
    const heard = vi.fn();
    art.onArrived(heard);
    for (const key of ["a", "b", "c"]) {
      decoder.stage(urlOf(key), { width: 627, height: 900 });
      art.request(scene, source(key));
    }
    await settle();
    expect(heard).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("stays under budget indefinitely across a long run of distinct cards", async () => {
    const { art, scene, decoder } = setup({ screenHeight: 2000 / 0.34 });
    for (let i = 0; i < 500; i++) {
      decoder.stage(urlOf(`card-${i}`), { width: 1400, height: 2000 });
      art.request(scene, source(`card-${i}`));
      await settle();
    }
    expect(art.residentBytes()).toBeLessThanOrEqual(BUDGET);
  });
});

describe("CardArt table copies (the WebKit memory report)", () => {
  it("decodes a scan to the table's share of the screen's height, in device pixels", async () => {
    const { art, scene, decoder } = setup({ screenHeight: 900, renderScale: 2 });
    decoder.stage(urlOf("a"), { width: 627, height: 900 });
    art.request(scene, source("a"));
    await settle();
    // 900 game units at 2x is 1800 device pixels; a third of that is 612.
    expect(decoder.asked[0]?.slot.height).toBe(612);
    expect(scene.textures.get("a").getSourceImage().height).toBe(612);
  });

  it("never decodes a table copy below the floor, however small the window", async () => {
    const { art, scene, decoder } = setup({ screenHeight: 500 });
    decoder.stage(urlOf("a"), { width: 627, height: 900 });
    art.request(scene, source("a"));
    await settle();
    expect(decoder.asked[0]?.slot.height).toBe(360);
  });

  it("draws a table-sized slot from the table copy and asks for nothing more", async () => {
    const { art, scene, decoder } = setup();
    decoder.stage(urlOf("a"), { width: 627, height: 900 });
    art.request(scene, source("a"));
    await settle();
    expect(art.upgrade(scene, "a", 300)).toBe("a");
    await settle();
    expect(decoder.asked).toHaveLength(1);
  });

  it("draws a bigger slot (the hover, Inspect) from the full scan once it lands", async () => {
    const { art, scene, decoder } = setup();
    decoder.stage(urlOf("a"), { width: 627, height: 900 });
    art.request(scene, source("a"));
    await settle();
    // The table copy until the full scan arrives, then the full scan.
    expect(art.upgrade(scene, "a", 700)).toBe("a");
    await settle();
    expect(art.upgrade(scene, "a", 700)).toBe("a#full");
    expect(scene.textures.get("a#full").getSourceImage().height).toBe(900);
    expect(decoder.asked).toHaveLength(2);
  });

  it("does not ask again for a full scan no bigger than its table copy", async () => {
    const { art, scene, decoder } = setup();
    decoder.stage(urlOf("small"), { width: 200, height: 280 });
    art.request(scene, source("small"));
    await settle();
    art.upgrade(scene, "small", 700);
    await settle();
    art.upgrade(scene, "small", 700);
    await settle();
    expect(decoder.asked).toHaveLength(2);
    // Not kept either: a second copy of the same pixels would only count against the budget.
    expect(scene.textures.exists("small#full")).toBe(false);
    expect(art.fullOnTheWay("small")).toBeNull();
  });

  it("says which full scan is on its way, so the hover preview waits for it", async () => {
    const { art, scene, decoder } = setup();
    decoder.stage(urlOf("a"), { width: 627, height: 900 });
    art.request(scene, source("a"));
    await settle();
    expect(art.fullOnTheWay("a")).toBeNull();
    art.upgrade(scene, "a", 700);
    expect(art.fullOnTheWay("a")).toBe("a#full");
    await settle();
    expect(art.fullOnTheWay("a")).toBeNull();
  });

  it("leaves a key it never loaded alone (a picture, not a scan)", () => {
    const { art, scene } = setup();
    expect(art.upgrade(scene, "title-art:wallpaper", 2000)).toBe("title-art:wallpaper");
  });

  it("evicts full scans by the same budget as table copies", async () => {
    const { art, scene, decoder } = setup({ screenHeight: 900 });
    for (let i = 0; i < 200; i++) {
      decoder.stage(urlOf(`c${i}`), { width: 1400, height: 2000 });
      art.request(scene, source(`c${i}`));
      await settle();
      art.upgrade(scene, `c${i}`, 2000);
      await settle();
    }
    expect(art.residentBytes()).toBeLessThanOrEqual(BUDGET);
  });

  it("asks for a full scan again after its table copy is decoded smaller (a smaller window)", async () => {
    // A big window: the table copy is the scan's own 900 px, so a full copy has nothing more to give.
    const { art, raw, scene, decoder } = setup({
      screenHeight: 3000,
      budget: 627 * 900 * 4 + 2 * 251 * 360 * 4 + 1000,
    });
    decoder.stage(urlOf("a"), { width: 627, height: 900 });
    art.request(scene, source("a"));
    await settle();
    art.upgrade(scene, "a", 2000);
    await settle();
    expect(scene.textures.exists("a#full")).toBe(false);
    // The window shrinks; other cards push the table copy out; it comes back at 360 px.
    raw.scale.height = 500;
    for (const key of ["b", "c", "d"]) {
      decoder.stage(urlOf(key), { width: 627, height: 900 });
      art.request(scene, source(key));
      await settle();
    }
    expect(scene.textures.exists("a")).toBe(false);
    art.request(scene, source("a"));
    await settle();
    expect(scene.textures.get("a").getSourceImage().height).toBe(360);
    expect(art.upgrade(scene, "a", 700)).toBe("a");
    await settle();
    expect(art.upgrade(scene, "a", 700)).toBe("a#full");
  });

  it("caps a full copy's height, so one huge picture can't take the budget", async () => {
    const { art, scene, decoder } = setup();
    decoder.stage(urlOf("stage"), { width: 4000, height: 3000 });
    art.request(scene, source("stage"));
    await settle();
    art.upgrade(scene, "stage", 5000);
    await settle();
    expect(scene.textures.get("stage#full").getSourceImage().height).toBe(1400);
  });

  it("settles when the full and table copies can't both fit: the full copy alone draws the card", async () => {
    // Room for the full copy (627x900) and little else.
    const { art, scene, decoder } = setup({ budget: 627 * 900 * 4 + 1000 });
    decoder.stage(urlOf("a"), { width: 627, height: 900 });
    for (let i = 0; i < 10; i++) {
      const key = art.request(scene, source("a"));
      if (key) art.upgrade(scene, key, 700);
      await settle();
    }
    // Table copy, then the full copy, then nothing more: the full copy answers the table's request too.
    expect(decoder.asked).toHaveLength(2);
    expect(art.request(scene, source("a"))).toBe("a#full");
  });
});

describe("CardArt decoding", () => {
  it("runs at most four decodes at once, and drains its queue through failures", async () => {
    let running = 0;
    let most = 0;
    const waiting: (() => void)[] = [];
    const decode: ScanDecoder = (url) =>
      new Promise((resolve, reject) => {
        running++;
        most = Math.max(most, running);
        waiting.push(() => {
          running--;
          if (url.includes("bad")) reject(new Error("decode failed"));
          else resolve({ width: 100, height: 140 } as HTMLCanvasElement);
        });
      });
    const { art, scene } = setup({ decode });
    for (let i = 0; i < 20; i++) art.request(scene, source(i % 3 === 0 ? `bad-${i}` : `c${i}`));
    expect(art.stats).toMatchObject({ decoding: 4, queued: 16 });
    while (waiting.length > 0) {
      waiting.shift()!();
      await settle();
    }
    expect(most).toBe(4);
    expect(art.stats).toMatchObject({ decoding: 0, queued: 0 });
    expect(scene.textures.exists("c1")).toBe(true);
    // A failed decode is asked for again on the next draw.
    expect(art.request(scene, source("bad-0"))).toBeNull();
    expect(art.stats.decoding).toBe(1);
  });

  it("forgets the sources of evicted cards over a long run", async () => {
    const { art, scene, decoder } = setup({ budget: 20 * 360 * 500 * 4 });
    for (let i = 0; i < 300; i++) {
      decoder.stage(urlOf(`card-${i}`), { width: 627, height: 900 });
      art.request(scene, source(`card-${i}`));
      await settle();
    }
    // About forty cards fit the budget; the other 260 are forgotten.
    expect(art.stats.sources).toBeLessThanOrEqual(45);
  });

  it("keeps a pack picture's URL until a full copy that reads it has landed, and retries a full copy that failed", async () => {
    const release = vi.mocked(releasePackArt);
    release.mockClear();
    let fail = false;
    let hold: (() => void) | null = null;
    const decoder = new FakeDecoder();
    const decode: ScanDecoder = (url, slot) =>
      slot.height === 1400
        ? new Promise((resolve) => {
            hold = () => resolve(fail ? null : decoder.decode(url, slot));
          })
        : decoder.decode(url, slot);
    const { art, scene } = setup({ decode, budget: 2 * 360 * 251 * 4 });
    decoder.stage(urlOf("p"), { width: 627, height: 900 });
    art.request(scene, source("p"));
    await settle();
    art.upgrade(scene, "p", 700);
    // Two other cards push the table copy out while the full copy is on its way.
    for (const key of ["x", "y"]) {
      decoder.stage(urlOf(key), { width: 627, height: 900 });
      art.request(scene, source(key));
      await settle();
    }
    expect(scene.textures.exists("p")).toBe(false);
    expect(release).not.toHaveBeenCalledWith("p");
    fail = true;
    hold!();
    await settle();
    expect(release).toHaveBeenCalledWith("p");
    // The failed full copy is not a missing scan: the next hover asks again.
    expect(art.isMissing("p#full")).toBe(false);
  });
});

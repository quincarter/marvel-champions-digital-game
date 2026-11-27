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
import { currentPackArt, isPackArtKey, leasePackUrl, releasePackArt } from "./pack-art.js";

vi.mock("./pack-art.js", () => ({
  releasePackArt: vi.fn(),
  currentPackArt: vi.fn((held: ArtSource) => held),
  leasePackUrl: vi.fn(() => null),
  isPackArtKey: vi.fn(() => false),
}));
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

  it("retries a full copy that failed after its table copy was evicted", async () => {
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
    // The eviction asks pack-art to release; its lease for the running decode defers the revoke.
    fail = true;
    hold!();
    await settle();
    expect(release).toHaveBeenCalledWith("p");
    // The failed full copy is not a missing scan: the next hover asks again.
    expect(art.isMissing("p#full")).toBe(false);
  });
});

describe("CardArt with a pack picture held across an eviction", () => {
  it("loads the fresh blob URL, not the revoked one a slot still holds", async () => {
    const resolve = vi.mocked(currentPackArt);
    const { art, scene, decoder } = setup();
    const held: ArtSource = { key: "art:pack:demo", url: "blob:old" };
    decoder.stage("blob:new", { width: 627, height: 900 });
    // The store is reading the fresh URL: nothing to ask for yet, and nothing decoded from the revoked one.
    resolve.mockImplementation((s) => (s.key === held.key ? null : s));
    expect(art.request(scene, held)).toBeNull();
    await settle();
    expect(decoder.asked).toEqual([]);
    expect(art.isMissing(held.key)).toBe(false);
    // The fresh URL arrived.
    resolve.mockImplementation((s) => (s.key === held.key ? { key: s.key, url: "blob:new" } : s));
    expect(art.request(scene, held)).toBeNull();
    await settle();
    expect(decoder.asked.map((ask) => ask.url)).toEqual(["blob:new"]);
    expect(art.request(scene, held)).toBe(held.key);
    resolve.mockImplementation((s) => s);
  });

  it("does not decode a queued job whose pack URL was released while it waited, and asks again later", async () => {
    const resolve = vi.mocked(currentPackArt);
    const decoder = new FakeDecoder();
    const gates: (() => void)[] = [];
    const decode: ScanDecoder = (url, slot) => new Promise((done) => gates.push(() => done(decoder.decode(url, slot))));
    const { art, scene } = setup({ decode });
    for (const key of ["a", "b", "c", "d"]) {
      decoder.stage(urlOf(key), { width: 627, height: 900 });
      art.request(scene, source(key));
    }
    const fifth: ArtSource = { key: "art:pack:q", url: "blob:q1" };
    decoder.stage("blob:q1", { width: 627, height: 900 });
    art.request(scene, fifth);
    expect(art.stats).toMatchObject({ decoding: 4, queued: 1 });
    // The fifth's URL is revoked and replaced before a slot frees up.
    resolve.mockImplementation((s) => (s.key === fifth.key ? { key: s.key, url: "blob:q2" } : s));
    gates.shift()!();
    await settle();
    expect(decoder.asked.some((ask) => ask.url === "blob:q1")).toBe(false);
    expect(art.isMissing(fifth.key)).toBe(false);
    decoder.stage("blob:q2", { width: 627, height: 900 });
    art.request(scene, fifth);
    for (const open of gates.splice(0)) open();
    await settle();
    expect(decoder.asked.some((ask) => ask.url === "blob:q2")).toBe(true);
    resolve.mockImplementation((s) => s);
  });

  it("does not decode a queued pack job after its pack is removed, through the real pack-art module", async () => {
    const real = await vi.importActual<typeof import("./pack-art.js")>("./pack-art.js");
    const resolve = vi.mocked(currentPackArt);
    resolve.mockImplementation(real.currentPackArt);
    const store = {
      objectUrl: async (id: string, path: string) => `blob:${id}/${path}`,
      revoke: () => undefined,
    };
    const manifest = {
      id: "demo",
      version: "1.0.0",
      languages: { base: "en", available: ["en"] },
      files: [{ path: "cards/en/x.demo.01a.webp", bytes: 1, sha256: "" }],
    } as unknown as Parameters<typeof real.setPackArt>[0][number];
    real.setPackArt([manifest], store);
    real.packArtFor("x.demo.01a", "en");
    await vi.advanceTimersByTimeAsync(250);
    const held = real.packArtFor("x.demo.01a", "en");
    expect(held).not.toBeNull();
    const decoder = new FakeDecoder();
    const gates: (() => void)[] = [];
    const decode: ScanDecoder = (url, slot) => new Promise((done) => gates.push(() => done(decoder.decode(url, slot))));
    const { art, scene } = setup({ decode });
    for (const key of ["a", "b", "c", "d"]) {
      decoder.stage(urlOf(key), { width: 627, height: 900 });
      art.request(scene, source(key));
    }
    decoder.stage(held!.url, { width: 627, height: 900 });
    art.request(scene, held!);
    expect(art.stats).toMatchObject({ decoding: 4, queued: 1 });
    // The pack is uninstalled while its decode waits; the queue then drains.
    real.setPackArt([], store);
    for (const open of gates.splice(0)) open();
    await settle();
    // Whatever the queue started once a slot freed is let finish, then checked.
    for (const open of gates.splice(0)) open();
    await settle();
    expect(decoder.asked.some((ask) => ask.url === held!.url)).toBe(false);
    expect(art.isMissing(held!.key)).toBe(false);
    real.resetPackArt();
    resolve.mockImplementation((s) => s);
  });
});

describe("CardArt and PackLeases share one URL lifetime (pack-art owns it)", () => {
  const manifest = {
    id: "demo",
    version: "1.0.0",
    languages: { base: "en", available: ["en"] },
    files: [{ path: "cards/en/x.demo.01a.webp", bytes: 1, sha256: "" }],
  } as unknown as Parameters<typeof import("./pack-art.js").setPackArt>[0][number];

  async function rig() {
    const real = await vi.importActual<typeof import("./pack-art.js")>("./pack-art.js");
    vi.mocked(currentPackArt).mockImplementation(real.currentPackArt);
    vi.mocked(releasePackArt).mockImplementation(real.releasePackArt);
    vi.mocked(leasePackUrl).mockImplementation(real.leasePackUrl);
    vi.mocked(isPackArtKey).mockImplementation(real.isPackArtKey);
    let serial = 0;
    const revoked: string[] = [];
    const store = {
      objectUrl: async (id: string, path: string) => `blob:${id}/${path}#${++serial}`,
      revoke: (id: string, path?: string) => void revoked.push(`${id}/${path ?? "*"}`),
      detach: (id: string, path: string) => `blob:${id}/${path}#${serial}`,
    };
    real.setPackArt([manifest], store);
    real.packArtFor("x.demo.01a", "en");
    await vi.advanceTimersByTimeAsync(250);
    const held = real.packArtFor("x.demo.01a", "en")!;
    expect(held).not.toBeNull();
    const gates: (() => void)[] = [];
    const sizes = new Map<string, Size>();
    const decode: ScanDecoder = (url, slot) =>
      new Promise((done) =>
        gates.push(() => {
          const size = sizes.get(url);
          done(size ? ({ width: size.width, height: Math.min(size.height, slot.height) } as HTMLCanvasElement) : null);
        }),
      );
    const { art, scene } = setup({ decode });
    sizes.set(held.url, { width: 300, height: 400 });
    return { real, art, scene, held, gates, revoked };
  }

  const reset = async (): Promise<void> => {
    const real = await vi.importActual<typeof import("./pack-art.js")>("./pack-art.js");
    real.resetPackArt();
    vi.mocked(currentPackArt).mockImplementation((s) => s);
    vi.mocked(releasePackArt).mockReset();
    vi.mocked(leasePackUrl).mockImplementation(() => null);
    vi.mocked(isPackArtKey).mockImplementation(() => false);
  };

  beforeEach(() => vi.useFakeTimers());
  afterEach(reset);

  it("keeps the URL for a re-requested decode when the DOM lease is released after an eviction", async () => {
    const { real, art, scene, held, gates, revoked } = await rig();
    // The table texture is there, Rules holds a lease, then the texture is evicted.
    art.request(scene, held);
    gates.splice(0).forEach((open) => open());
    await settle();
    expect(scene.textures.exists(held.key)).toBe(true);
    const dom = new real.PackLeases();
    dom.begin();
    dom.image(held);
    dom.end();
    real.releasePackArt(held.key);
    scene.textures.remove(held.key);
    expect(revoked).toEqual([]);
    // Hover asks for the same key again while the lease is alive: a new decode starts on the retained URL.
    // (a fresh request: CardArt's own bookkeeping saw the eviction)
    const again = new CardArt({
      decode: (url, slot) =>
        new Promise((done) =>
          gates.push(() => done({ width: 300, height: Math.min(400, slot.height) } as HTMLCanvasElement)),
        ),
      budgetBytes: BUDGET,
      renderScale: () => 1,
    });
    again.request(scene, held);
    expect(gates).toHaveLength(1);
    // The row unmounts: the DOM lease goes while the decode is still reading.
    dom.dispose();
    expect(revoked).toEqual([]);
    gates.splice(0).forEach((open) => open());
    await settle();
    expect(again.isMissing(held.key)).toBe(false);
    expect(scene.textures.exists(held.key)).toBe(true);
    // The new texture owns the URL now: still not revoked, still current.
    expect(revoked).toEqual([]);
    expect(real.currentPackArt(held)?.url).toBe(held.url);
  });

  it("revokes an evicted URL when the last decode lease lets go", async () => {
    const { real, art, scene, held, gates, revoked } = await rig();
    art.request(scene, held);
    // Evicted while its first decode is still reading.
    real.releasePackArt(held.key);
    expect(revoked).toEqual([]);
    gates.splice(0).forEach((open) => open());
    await settle();
    expect(revoked).toEqual(["demo/cards/en/x.demo.01a.webp"]);
  });

  it("refreshPackArt during a failing decode with a live DOM lease delivers a fresh URL and the retry succeeds", async () => {
    const { real, art, scene, held, gates, revoked } = await rig();
    const revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const announced = vi.fn();
    const off = (await import("../language-change.js")).onArtChange(announced);
    // Rules holds a DOM lease on the URL; a decode reads it too.
    const dom = new real.PackLeases();
    dom.begin();
    dom.image(held);
    dom.end();
    art.request(scene, held);
    // The DOM image fails and asks for a refresh while the decode is still out.
    real.refreshPackArt(held.key, held.url);
    // Nothing is revoked under the decode, but the failed URL is no longer current and a fresh one is being read.
    expect(revoked).toEqual([]);
    expect(revokeUrl).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(250);
    const fresh = real.currentPackArt(held);
    expect(fresh).not.toBeNull();
    expect(fresh!.url).not.toBe(held.url);
    expect(announced).toHaveBeenCalled();
    // The decode of the failed URL fails (nothing at it): a retry, not a missing scan; the old blob is revoked now.
    // (the DOM lease is still held and does not block this)
    gates.splice(0).forEach((open) => open());
    await settle();
    expect(art.isMissing(held.key)).toBe(false);
    expect(revokeUrl).toHaveBeenCalledWith(held.url);
    // The redraw asks again with the fresh URL and it decodes.
    const sizes = new Map<string, Size>();
    sizes.set(fresh!.url, { width: 300, height: 400 });
    const retry = new CardArt({
      decode: (url, slot) =>
        Promise.resolve({ width: sizes.get(url)!.width, height: Math.min(400, slot.height) } as HTMLCanvasElement),
      budgetBytes: BUDGET,
      renderScale: () => 1,
    });
    retry.request(scene, fresh!);
    await settle();
    expect(retry.isMissing(held.key)).toBe(false);
    expect(scene.textures.exists(held.key)).toBe(true);
    dom.dispose();
    off();
    revokeUrl.mockRestore();
  });
});

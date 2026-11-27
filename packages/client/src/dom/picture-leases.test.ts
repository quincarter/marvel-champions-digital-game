// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PackManifest } from "@mc/content";
import { packArtFor, releasePackArt, resetPackArt, setPackArt, type PackArtStore } from "../art/pack-art.js";
import { drawCardPool } from "./card-pool-sheet.js";
import type { CardPoolCard } from "./card-pool-sheet.types.js";
import { PictureLeases } from "./picture-leases.js";
import { SheetBuilder } from "./sheet-builder.js";

const manifest = (): PackManifest =>
  ({
    schema: 1,
    id: "demo",
    version: "1.2.0",
    kind: "hero",
    name: "Demo",
    authors: [],
    description: "",
    requires: { app: ">=0.1.0", dslFeatures: [], packs: [] },
    contents: { cards: "cards" },
    languages: { base: "en", available: ["en"] },
    files: [
      { path: "cards/en/x.demo.01a.webp", bytes: 1, sha256: "" },
      { path: "cards/en/x.demo.02.webp", bytes: 1, sha256: "" },
    ],
    totalBytes: 2,
    license: "x",
  }) as unknown as PackManifest;

const fakeStore = (): PackArtStore & { revoked: string[] } => {
  const revoked: string[] = [];
  return {
    revoked,
    objectUrl: async (id, path) => `blob:test/${id}/${path}`,
    revoke: (id, path) => void revoked.push(`${id}/${path ?? "*"}`),
  };
};

const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(200);
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  resetPackArt();
  vi.useRealTimers();
});

describe("PictureLeases for a screen's mounted pictures", () => {
  it("holds a pack scan while it is mounted, gives it back when a later pass no longer draws it, and on dispose", async () => {
    const store = fakeStore();
    setPackArt([manifest()], store);
    packArtFor("x.demo.01a", "en");
    await flush();
    const art = packArtFor("x.demo.01a", "en")!;
    const leases = new PictureLeases();
    leases.begin();
    expect(leases.image(art)).toEqual({ src: art.url, retry: art.key });
    leases.end();
    // The cache evicts the texture while the <img> is still mounted: the held URL stays valid.
    releasePackArt(art.key);
    expect(store.revoked).toEqual([]);
    // A redraw whose window no longer reaches the row lets the hold go: now the revoke happens.
    leases.begin();
    leases.end();
    expect(store.revoked).toEqual(["demo/cards/en/x.demo.01a.webp"]);
    leases.dispose();
  });

  it("finishes a pass that never reached end() when the next begins, instead of leaking its holds", async () => {
    const store = fakeStore();
    setPackArt([manifest()], store);
    packArtFor("x.demo.01a", "en");
    await flush();
    const art = packArtFor("x.demo.01a", "en")!;
    const leases = new PictureLeases();
    leases.begin();
    leases.image(art);
    // The redraw was cut short: no end(). The next begin() adopts then releases it as usual.
    leases.begin();
    leases.end();
    releasePackArt(art.key);
    expect(store.revoked).toEqual(["demo/cards/en/x.demo.01a.webp"]);
  });

  it("asks the pack art to read a file again when a part's picture fails to load (mc-image-error), and stops on dispose", async () => {
    const store = fakeStore();
    setPackArt([manifest()], store);
    packArtFor("x.demo.01a", "en");
    await flush();
    const art = packArtFor("x.demo.01a", "en")!;
    const element = document.createElement("div");
    const leases = new PictureLeases();
    leases.watch(element);
    element.dispatchEvent(new CustomEvent("mc-image-error", { detail: { key: art.key, src: art.url } }));
    // The failed URL was the current one: it is forgotten (revoked) and read from the store afresh.
    expect(store.revoked).toEqual(["demo/cards/en/x.demo.01a.webp"]);
    leases.dispose();
    element.dispatchEvent(new CustomEvent("mc-image-error", { detail: { key: art.key, src: art.url } }));
    expect(store.revoked).toHaveLength(1);
  });
});

describe("a windowed card pool with a pack scan", () => {
  const card = (cardId: string, image: CardPoolCard["image"]): CardPoolCard => ({
    cardId,
    image,
    missing: cardId,
    title: cardId,
    cost: null,
    caption: "",
    captionStrong: false,
    typeLine: "",
    note: null,
    rules: "",
    quantity: 0,
  });

  it("puts the retry key on a mounted pack scan, so a failed lazy image can be re-resolved, in list and grid", async () => {
    const store = fakeStore();
    setPackArt([manifest()], store);
    packArtFor("x.demo.01a", "en");
    await flush();
    const art = packArtFor("x.demo.01a", "en")!;
    const leases = new PictureLeases();
    for (const view of ["list", "grid"] as const) {
      const b = new SheetBuilder({} as never, { x: 0, y: 0 }, () => false);
      leases.begin();
      drawCardPool(b, {
        key: "list:pool",
        rect: { x: 0, y: 0, width: 300, height: 300 },
        view,
        count: 1,
        geometry:
          view === "grid"
            ? { columns: 1, cellWidth: 280, artHeight: 200, captionHeight: 46, cellHeight: 300, rows: 1 }
            : null,
        listRow: { height: 90, thumbWidth: 50 },
        scrollTop: 0,
        cardAt: () => card("x.demo.01", leases.image(art)),
      });
      leases.end();
      const scroll = b.nodes.find((n) => n.kind === "scroll");
      const image = (scroll?.kind === "scroll" ? scroll.nodes : []).find((n) => n.kind === "image");
      expect(image).toMatchObject({ src: art.url, retry: art.key });
    }
    leases.dispose();
  });

  it("holds only the rows in the window: scrolling the scan out of it releases the lease", async () => {
    const store = fakeStore();
    setPackArt([manifest()], store);
    packArtFor("x.demo.01a", "en");
    await flush();
    const art = packArtFor("x.demo.01a", "en")!;
    const leases = new PictureLeases();
    const draw = (scrollTop: number): void => {
      const b = new SheetBuilder({} as never, { x: 0, y: 0 }, () => false);
      leases.begin();
      drawCardPool(b, {
        key: "list:pool",
        rect: { x: 0, y: 0, width: 300, height: 100 },
        view: "list",
        count: 200,
        geometry: null,
        listRow: { height: 90, thumbWidth: 50 },
        scrollTop,
        // Only the first card is the pack scan.
        cardAt: (i) => card(`c${i}`, i === 0 ? leases.image(art) : { src: `/a/${i}.png` }),
      });
      leases.end();
    };
    draw(0);
    releasePackArt(art.key);
    expect(store.revoked).toEqual([]);
    // Far down the list: row 0 is outside the window, so nothing holds its URL any more.
    draw(90 * 100);
    expect(store.revoked).toEqual(["demo/cards/en/x.demo.01a.webp"]);
    leases.dispose();
  });
});

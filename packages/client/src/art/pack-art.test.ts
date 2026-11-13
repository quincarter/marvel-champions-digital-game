import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cardId, type AnyCard, type PackManifest } from "@mc/content";
import { onArtChange } from "../language-change.js";
import { artFor } from "./art-source.js";
import {
  packArtFor,
  packArtKey,
  packFileArt,
  releasePackArt,
  resetPackArt,
  setPackArt,
  type PackArtStore,
} from "./pack-art.js";

const manifest = (over: Partial<PackManifest> = {}): PackManifest =>
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
    languages: { base: "en", available: ["en", "es"] },
    files: [
      { path: "cards/en/x.demo.01a.webp", bytes: 1, sha256: "" },
      { path: "cards/en/x.demo.02.webp", bytes: 1, sha256: "" },
      { path: "cards/es/x.demo.02.webp", bytes: 1, sha256: "" },
    ],
    totalBytes: 3,
    license: "x",
    ...over,
  }) as unknown as PackManifest;

const fakeStore = (): PackArtStore & { urls: string[]; revoked: string[] } => {
  const urls: string[] = [];
  const revoked: string[] = [];
  return {
    urls,
    revoked,
    objectUrl: async (id, path) => {
      const url = `blob:test/${id}/${path}`;
      urls.push(url);
      return url;
    },
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

describe("an installed pack that is not loaded", () => {
  it("still shows its own cover file, and no card picture", async () => {
    const withCover = manifest({
      cover: "cover.webp",
      files: [
        { path: "cover.webp", bytes: 1, sha256: "" },
        { path: "cards/en/x.demo.01a.webp", bytes: 1, sha256: "" },
      ],
    });
    setPackArt([], fakeStore(), [withCover]);
    expect(packFileArt("demo", "cover.webp")).toBeNull();
    await flush();
    expect(packFileArt("demo", "cover.webp")).toEqual({
      key: "art:pack:demo@1.2.0/cover.webp",
      url: "blob:test/demo/cover.webp",
    });
    expect(packFileArt("demo", "cards/en/x.demo.01a.webp")).toBeNull();
    expect(packArtFor("x.demo.01a", "en")).toBeNull();
    // A pack with no cover shows nothing.
    setPackArt([], fakeStore(), [manifest()]);
    expect(packFileArt("demo", "cover.webp")).toBeNull();
  });
});

describe("pack card art", () => {
  it("answers null the first time, then the pack's blob URL under a versioned texture key, and announces the arrival", async () => {
    const store = fakeStore();
    setPackArt([manifest()], store);
    const announced = vi.fn();
    const off = onArtChange(announced);
    expect(packArtFor("x.demo.01a", "en")).toBeNull();
    await flush();
    expect(announced).toHaveBeenCalledTimes(1);
    expect(packArtFor("x.demo.01a", "en")).toEqual({
      key: "art:pack:demo@1.2.0/cards/en/x.demo.01a.webp",
      url: "blob:test/demo/cards/en/x.demo.01a.webp",
    });
    off();
  });

  it("reads every picture ahead and asks the store once for each, however often it is drawn", async () => {
    const store = fakeStore();
    setPackArt([manifest()], store);
    for (let i = 0; i < 5; i += 1) packArtFor("x.demo.01a", "en");
    await flush();
    expect(store.urls).toHaveLength(3);
  });

  it("announces nothing when the same packs are set again, or when there are none", async () => {
    const announced = vi.fn();
    const off = onArtChange(announced);
    setPackArt([], undefined);
    await flush();
    expect(announced).not.toHaveBeenCalled();
    setPackArt([manifest()], fakeStore());
    await flush();
    setPackArt([manifest()], fakeStore());
    await flush();
    expect(announced).toHaveBeenCalledTimes(1);
    off();
  });

  it("uses the player's language where the pack has that picture and the base language otherwise", async () => {
    setPackArt([manifest()], fakeStore());
    packArtFor("x.demo.02", "es");
    packArtFor("x.demo.01a", "es");
    await flush();
    expect(packArtFor("x.demo.02", "es")?.key).toBe(packArtKey("demo", "1.2.0", "cards/es/x.demo.02.webp"));
    expect(packArtFor("x.demo.01a", "es")?.key).toBe(packArtKey("demo", "1.2.0", "cards/en/x.demo.01a.webp"));
  });

  it("has no picture for a card the pack ships none for, a base card, or a pack that is not loaded", async () => {
    setPackArt([manifest()], fakeStore());
    await flush();
    expect(packArtFor("x.demo.99", "en")).toBeNull();
    expect(packArtFor("01001", "en")).toBeNull();
    expect(packArtFor("x.other.01", "en")).toBeNull();
    setPackArt([{ ...manifest(), languages: undefined } as unknown as PackManifest], fakeStore());
    expect(packArtFor("x.demo.01a", "en")).toBeNull();
  });

  it("revokes the URL when the texture is evicted and reads it again on the next ask", async () => {
    const store = fakeStore();
    setPackArt([manifest()], store);
    packArtFor("x.demo.01a", "en");
    await flush();
    const art = packArtFor("x.demo.01a", "en")!;
    releasePackArt(art.key);
    expect(store.revoked).toEqual(["demo/cards/en/x.demo.01a.webp"]);
    expect(packArtFor("x.demo.01a", "en")).toBeNull();
    await flush();
    expect(store.urls).toHaveLength(4);
    expect(packArtFor("x.demo.01a", "en")).not.toBeNull();
    releasePackArt("art:some/base/scan.png");
    expect(store.revoked).toHaveLength(1);
  });

  it("keeps a new version's pictures apart from the old version's", async () => {
    const store = fakeStore();
    setPackArt([manifest()], store);
    packArtFor("x.demo.01a", "en");
    await flush();
    setPackArt([manifest({ version: "1.3.0" })], store);
    expect(packArtFor("x.demo.01a", "en")).toBeNull();
    await flush();
    expect(packArtFor("x.demo.01a", "en")?.key).toBe("art:pack:demo@1.3.0/cards/en/x.demo.01a.webp");
  });

  it("is what artFor answers for a custom card, and leaves base cards on their scans", async () => {
    const store = fakeStore();
    setPackArt([manifest()], store);
    const custom = { id: cardId("x.demo.02"), type: "event" } as unknown as AnyCard;
    expect(artFor(custom, { kind: "front" })).toBeNull();
    await flush();
    expect(artFor(custom, { kind: "front" })?.url).toBe("blob:test/demo/cards/en/x.demo.02.webp");
    const base = { id: cardId("01001"), type: "event", art: "01001", images: { front: "/bundles/cards/01001.png" } };
    expect(artFor(base as unknown as AnyCard, { kind: "front" })?.url).toMatch(/^\/card-art\//);
  });
});

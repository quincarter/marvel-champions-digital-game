import { describe, expect, it } from "vitest";
import { CORE_CARDS, type PackIndex, type PackIndexEntry, type PackManifest } from "@mc/content";
import { parsePackPreview } from "../packs/pack-preview.js";
import { PackInstallError } from "../packs/unpack-pack.js";
import type { InstalledPack } from "../packs/pack-store.js";
import {
  actionsOf,
  emptyTextOf,
  errorTextOf,
  featuredFacesOf,
  modStoreGridOf,
  packPageOf,
  progressOf,
  tileArtOf,
  tileOf,
  tilesOf,
  type ModStoreContext,
} from "./mod-store-model.js";

function entry(id: string, over: Partial<PackIndexEntry> = {}): PackIndexEntry {
  return {
    id,
    kind: "hero",
    name: id,
    creator: "Someone",
    summary: "A summary.",
    tags: ["hero"],
    approved: "2026-11-12",
    latest: "1.0.0",
    withdrawn: false,
    versions: {
      "1.0.0": {
        manifest: "m",
        base: "b",
        zip: "z",
        zipBytes: 2 * 1024 * 1024,
        zipSha256: "x",
        requires: { app: ">=0.1.0" },
      },
    },
    ...over,
  };
}

function installedPack(id: string, version = "1.0.0", withdrawn = false): InstalledPack {
  const manifest = {
    id,
    version,
    kind: "hero",
    name: `Installed ${id}`,
    authors: ["A", "B"],
    description: "From the manifest.",
    license: "CC-BY-4.0",
    totalBytes: 1024,
  } as unknown as PackManifest;
  return { id, version, manifest, installedAt: "2026-11-12T00:00:00Z", withdrawn };
}

const context = (installed: InstalledPack[] = []): ModStoreContext => ({
  appVersion: "0.43.2",
  supportedDslFeatures: [],
  installed: new Map(installed.map((p) => [p.id, p])),
});

const index = (packs: PackIndexEntry[]): PackIndex => ({ schema: 2, generated: "2026-11-10T00:00:00Z", packs });

describe("tilesOf", () => {
  const packs = [entry("b-hero"), entry("a-scenario", { kind: "scenario" }), entry("c-mod", { kind: "modular" })];

  it("filters by tab and sorts by name", () => {
    const all = tilesOf(index(packs), context(), "all").map((t) => t.id);
    expect(all).toEqual(["a-scenario", "b-hero", "c-mod"]);
    expect(tilesOf(index(packs), context(), "heroes").map((t) => t.id)).toEqual(["b-hero"]);
    expect(tilesOf(index(packs), context(), "scenarios").map((t) => t.id)).toEqual(["a-scenario"]);
  });

  it("shows only installed packs on Installed, including ones the catalog dropped", () => {
    const ctx = context([installedPack("b-hero"), installedPack("gone")]);
    const tiles = tilesOf(index(packs), ctx, "installed");
    expect(tiles.map((t) => t.id)).toEqual(["b-hero", "gone"]);
    const gone = tiles.find((t) => t.id === "gone")!;
    expect(gone.state).toBe("withdrawn");
    expect(gone.inCatalog).toBe(false);
  });

  it("hides a withdrawn pack nobody installed but keeps an installed one", () => {
    const withdrawn = entry("w", { withdrawn: true });
    expect(tilesOf(index([withdrawn]), context(), "all")).toEqual([]);
    expect(tilesOf(index([withdrawn]), context([installedPack("w")]), "all")[0]!.state).toBe("withdrawn");
  });

  it("handles a missing catalog", () => {
    expect(tilesOf(null, context(), "all")).toEqual([]);
    expect(emptyTextOf("installed")).toMatch(/installed/);
  });
});

describe("tileOf", () => {
  it("carries the state chip words and size", () => {
    const tile = tileOf(entry("p"), context());
    expect(tile.state).toBe("install");
    expect(tile.stateLabel).toBe("Install");
    expect(tile.size).toBe("2.0 MB");
    expect(tile.kindLabel).toBe("Hero");
  });

  it("marks a pack that needs a newer app", () => {
    const needs = entry("n", {
      versions: {
        "1.0.0": { ...entry("n").versions["1.0.0"]!, requires: { app: ">=9.0.0" } },
      },
    });
    const tile = tileOf(needs, context());
    expect(tile.state).toBe("needs-app-update");
    expect(tile.reason).toContain(">=9.0.0");
  });
});

describe("actionsOf", () => {
  const ids = (tile: ReturnType<typeof tileOf>, busy = false, confirmingRemove = false): string[] =>
    actionsOf({ tile, busy, confirmingRemove }).map((a) => a.id);

  it("offers Install for a new pack", () => {
    expect(ids(tileOf(entry("p"), context()))).toEqual(["install"]);
  });

  it("offers Remove alone for an installed, current pack", () => {
    expect(ids(tileOf(entry("p"), context([installedPack("p")])))).toEqual(["remove"]);
  });

  it("offers Update and Remove when a newer version exists", () => {
    const newer = entry("p", {
      latest: "1.1.0",
      versions: { "1.1.0": entry("p").versions["1.0.0"]! },
    });
    const tile = tileOf(newer, context([installedPack("p", "1.0.0")]));
    expect(ids(tile)).toEqual(["update", "remove"]);
  });

  it("shows a disabled Install with the reason for a pack that needs an app update", () => {
    const needs = entry("n", {
      versions: { "1.0.0": { ...entry("n").versions["1.0.0"]!, requires: { app: ">=9.0.0" } } },
    });
    const [action] = actionsOf({ tile: tileOf(needs, context()), busy: false, confirmingRemove: false });
    expect(action).toMatchObject({ id: "install", enabled: false });
    expect(action!.reason).toBeTruthy();
  });

  it("offers nothing for a withdrawn pack nobody installed, and Remove for one that is installed", () => {
    expect(ids(tileOf(entry("w", { withdrawn: true }), context()))).toEqual([]);
    expect(ids(tileOf(entry("w", { withdrawn: true }), context([installedPack("w")])))).toEqual(["remove"]);
  });

  it("asks twice before removing", () => {
    const tile = tileOf(entry("p"), context([installedPack("p")]));
    expect(ids(tile, false, true)).toEqual(["confirm-remove", "cancel-remove"]);
  });

  it("disables every button while an install runs", () => {
    const actions = actionsOf({ tile: tileOf(entry("p"), context()), busy: true, confirmingRemove: false });
    expect(actions.every((a) => !a.enabled)).toBe(true);
  });
});

describe("progressOf", () => {
  it("rises through the phases and ends full", () => {
    const steps = [
      progressOf({ phase: "download", received: 0, total: 100 }),
      progressOf({ phase: "download", received: 100, total: 100 }),
      progressOf({ phase: "verify-zip" }),
      progressOf({ phase: "unzip" }),
      progressOf({ phase: "verify-files", done: 1, total: 4 }),
      progressOf({ phase: "verify-files", done: 4, total: 4 }),
      progressOf({ phase: "store" }),
      progressOf({ phase: "done" }),
    ];
    const fractions = steps.map((s) => s.fraction);
    expect([...fractions].sort((a, b) => a - b)).toEqual(fractions);
    expect(fractions.at(-1)).toBe(1);
    expect(steps[1]!.text).toBe("Downloading 100 B of 100 B");
    expect(steps[4]!.text).toBe("Checking files (1 of 4)");
  });

  it("copes with an unknown total", () => {
    expect(progressOf({ phase: "download", received: 5, total: 0 })).toEqual({ fraction: 0, text: "Downloading" });
  });
});

describe("errorTextOf", () => {
  it("maps every install error code to a sentence", () => {
    const codes = [
      "download",
      "zip-size",
      "zip-hash",
      "unzip",
      "unsafe-path",
      "unlisted-file",
      "missing-file",
      "file-size",
      "file-hash",
      "manifest",
      "too-large",
      "withdrawn",
      "mismatch",
      "store",
    ] as const;
    const texts = new Set(codes.map((code) => errorTextOf(new PackInstallError(code, "RAWMSG"))));
    expect(texts.size).toBe(codes.length);
    for (const text of texts) expect(text).not.toContain("RAWMSG");
  });

  it("falls back for anything else", () => {
    expect(errorTextOf(new Error("boom"))).toMatch(/Nothing was changed/);
    expect(errorTextOf(undefined)).toMatch(/Nothing was changed/);
  });

  it("says the installed version is unchanged when an update fails", () => {
    expect(errorTextOf(new PackInstallError("zip-hash", "raw"), "1.0.0")).toContain("installed v1.0.0 is unchanged");
    expect(errorTextOf(new PackInstallError("zip-hash", "raw"))).toContain("Nothing was installed");
  });
});

describe("packPageOf", () => {
  it("uses the catalog for a pack that is not installed", () => {
    const e = entry("p");
    const page = packPageOf(tileOf(e, context()), e, undefined);
    expect(page.byline).toBe("By Someone");
    expect(page.meta).toBe("Hero pack · v1.0.0 · 2.0 MB");
    expect(page.body).toContain("A summary.");
    expect(page.body).toContain("Permission: listed in the store");
    expect(page.requirement).toBeUndefined();
  });

  it("uses the manifest's description, authors and license once installed", () => {
    const e = entry("p");
    const inst = installedPack("p");
    const page = packPageOf(tileOf(e, context([inst])), e, inst);
    expect(page.body).toContain("From the manifest.");
    expect(page.body).toContain("A, B");
    expect(page.body).toContain("CC-BY-4.0");
    expect(page.meta).toContain("installed: v1.0.0");
  });

  it("states the requirement when the app is too old", () => {
    const needs = entry("n", {
      versions: { "1.0.0": { ...entry("n").versions["1.0.0"]!, requires: { app: ">=9.0.0" } } },
    });
    const page = packPageOf(tileOf(needs, context()), needs, undefined);
    expect(page.requirement).toContain(">=9.0.0");
    expect(page.requirement).not.toContain("Needs app");
    expect(page.body).toContain(page.requirement!);
  });

  it("says a dropped pack is no longer listed", () => {
    const inst = installedPack("gone");
    const tile = tilesOf(null, context([inst]), "installed")[0]!;
    expect(packPageOf(tile, undefined, inst).body).toContain("no longer listed");
  });
});

describe("modStoreGridOf", () => {
  it("is one column on a phone and more on a wide screen", () => {
    expect(modStoreGridOf(343, true).columns).toBe(1);
    expect(modStoreGridOf(1392, false).columns).toBeGreaterThan(2);
  });
});

describe("a tile's art", () => {
  const identity = { ...CORE_CARDS.find((card) => card.type === "hero_identity")!, id: "x.demo.01a" };
  const villain = { ...CORE_CARDS.find((card) => card.type === "villain")!, id: "x.demo.01" };
  const preview = (card: unknown, images: string[], featuredImages: string[] = images) =>
    parsePackPreview(
      {
        schema: 1,
        packId: "demo",
        version: "1.0.0",
        featured: { cardId: (card as { id: string }).id, images: featuredImages },
        images,
        languages: { base: "en", available: ["en"] },
        cards: [card],
        decks: [],
      },
      "demo",
    )!;
  const withBase = (over: Partial<PackIndexEntry["versions"][string]> = {}, top: Partial<PackIndexEntry> = {}) =>
    tileOf(
      entry("demo", {
        ...top,
        versions: { "1.0.0": { ...entry("demo").versions["1.0.0"]!, base: "https://h/demo/1.0.0/", ...over } },
      }),
      context(),
    );

  it("carries the version's preview address and base from the catalog", () => {
    const tile = withBase({ preview: "https://h/demo/1.0.0/preview.json" });
    expect(tile.previewUrl).toBe("https://h/demo/1.0.0/preview.json");
    expect(tile.baseUrl).toBe("https://h/demo/1.0.0/");
    expect(tileOf(entry("plain"), context()).previewUrl).toBeUndefined();
  });

  it("prefers the catalog thumbnail, then the featured picture, then the generated face, then the letter", () => {
    const pictures = ["cards/en/x.demo.01a.webp", "cards/en/x.demo.01b.webp"];
    expect(tileArtOf(withBase({}, { thumbnail: "https://h/thumb.webp" }), preview(identity, pictures))).toEqual({
      kind: "thumbnail",
      url: "https://h/thumb.webp",
    });
    expect(tileArtOf(withBase(), preview(identity, pictures))).toEqual({
      kind: "picture",
      url: "https://h/demo/1.0.0/cards/en/x.demo.01a.webp",
    });
    const face = tileArtOf(withBase(), preview(identity, []));
    expect(face).toMatchObject({ kind: "face", face: { kind: "hero" } });
    expect(tileArtOf(withBase(), undefined)).toEqual({ kind: "letter" });
    expect(tileArtOf(withBase(), null)).toEqual({ kind: "letter" });
  });

  it("features a hero's two sides and any other card's one face", () => {
    const hero = featuredFacesOf(
      preview(identity, ["cards/en/x.demo.01a.webp", "cards/en/x.demo.01b.webp"]),
      "https://h/",
    );
    expect(hero.map((face) => face.face.kind)).toEqual(["hero", "alterEgo"]);
    expect(hero[1]!.pictureUrl).toBe("https://h/cards/en/x.demo.01b.webp");
    const lone = featuredFacesOf(preview(villain, []), "https://h/");
    expect(lone).toHaveLength(1);
    expect(lone[0]!.pictureUrl).toBeUndefined();
    expect(featuredFacesOf(undefined, "https://h/")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTER,
  creatorsIn,
  creditLineOf,
  creditsOf,
  filterTiles,
  foldText,
  isFiltering,
  packChips,
  packCountText,
  resultCountText,
  tagChipsOf,
  toggleTag,
} from "./mod-store-browse.js";
import { tileOf, type ModStoreTile } from "./mod-store-model.js";

function tile(id: string, over: Partial<ModStoreTile> = {}): ModStoreTile {
  const creator = over.creator ?? "Someone";
  return {
    creators: creatorsIn(creator),
    id,
    name: id,
    creator: "Someone",
    kind: "hero",
    kindLabel: "Hero",
    summary: "A summary.",
    state: "install",
    stateLabel: "Install",
    version: "1.0.0",
    size: "1 MB",
    installed: false,
    thumbnail: undefined,
    latest: "1.0.0",
    cover: undefined,
    previewUrl: undefined,
    baseUrl: undefined,
    reason: undefined,
    inCatalog: true,
    tags: [],
    approved: "2026-11-01",
    ...over,
  };
}

const tiles = [
  tile("spider-gwen", { name: "Ghost-Spider", creator: "Ana & Bo", tags: ["Spider-Verse", "Aggression"] }),
  tile("moon-knight", { name: "Moon Knight", creator: "Bo", tags: ["Street level"], approved: "2026-11-10" }),
  tile("retcons", {
    name: "Retcons",
    kind: "house-rule",
    kindLabel: "House rule",
    creator: "Cy",
    summary: "Héroe tweaks",
    tags: ["spider-verse"],
    approved: "2026-10-01",
  }),
];

describe("search", () => {
  it("folds case and accents", () => {
    expect(foldText("Héroe SPIDER")).toBe("heroe spider");
  });

  it("matches every word against name, creator, summary, kind and tags", () => {
    const find = (text: string) => filterTiles(tiles, { ...EMPTY_FILTER, text }).map((one) => one.id);
    expect(find("")).toEqual(["spider-gwen", "moon-knight", "retcons"]);
    expect(find("ghost")).toEqual(["spider-gwen"]);
    expect(find("bo")).toEqual(["spider-gwen", "moon-knight"]);
    expect(find("heroe")).toEqual(["retcons"]);
    expect(find("house rule")).toEqual(["retcons"]);
    expect(find("#street")).toEqual(["moon-knight"]);
    expect(find("spider aggression")).toEqual(["spider-gwen"]);
    expect(find("nothing-like-this")).toEqual([]);
  });

  it("needs every chosen tag, whatever its case", () => {
    const filter = { ...EMPTY_FILTER, tags: ["Spider-Verse"] };
    expect(filterTiles(tiles, filter).map((one) => one.id)).toEqual(["spider-gwen", "retcons"]);
    expect(filterTiles(tiles, { ...filter, tags: ["spider-verse", "aggression"] }).map((one) => one.id)).toEqual([
      "spider-gwen",
    ]);
  });

  it("shows one creator's packs, shared credits included", () => {
    expect(filterTiles(tiles, { ...EMPTY_FILTER, creator: "bo" }).map((one) => one.id)).toEqual([
      "spider-gwen",
      "moon-knight",
    ]);
  });

  it("sorts newest approval first, else keeps the tab's name order", () => {
    expect(filterTiles(tiles, { ...EMPTY_FILTER, sort: "newest" }).map((one) => one.id)).toEqual([
      "moon-knight",
      "spider-gwen",
      "retcons",
    ]);
  });

  it("knows when the list is narrowed: the sort alone does not", () => {
    expect(isFiltering(EMPTY_FILTER)).toBe(false);
    expect(isFiltering({ ...EMPTY_FILTER, sort: "newest" })).toBe(false);
    expect(isFiltering({ ...EMPTY_FILTER, text: "  " })).toBe(false);
    expect(isFiltering({ ...EMPTY_FILTER, text: "x" })).toBe(true);
    expect(isFiltering({ ...EMPTY_FILTER, creator: "Bo" })).toBe(true);
  });
});

describe("tag chips", () => {
  it("lists the tab's tags, the most used first, counting one spelling", () => {
    expect(tagChipsOf(tiles, [])).toEqual([
      { tag: "Spider-Verse", count: 2, on: false },
      { tag: "Aggression", count: 1, on: false },
      { tag: "Street level", count: 1, on: false },
    ]);
  });

  it("leaves out the kind tag the catalog gives every pack", () => {
    expect(tagChipsOf([tile("x", { tags: ["hero", "Hero", "Mutant"] })], [])).toEqual([
      { tag: "Mutant", count: 1, on: false },
    ]);
  });

  it("keeps a chosen tag no pack in view carries, so it can be switched off", () => {
    expect(tagChipsOf([], ["Mutant"])).toEqual([{ tag: "Mutant", count: 0, on: true }]);
  });

  it("switches a tag on and off", () => {
    expect(toggleTag([], "Spider-Verse")).toEqual(["Spider-Verse"]);
    expect(toggleTag(["Spider-Verse"], "spider-verse")).toEqual([]);
  });

  it("packs chips into rows and counts the ones left out", () => {
    const packed = packChips([50, 50, 50, 50], (w) => w, 120, 2, 10);
    expect(packed.slots.map((slot) => [slot.x, slot.row])).toEqual([
      [0, 0],
      [60, 0],
      [0, 1],
      [60, 1],
    ]);
    expect(packChips([50, 50, 50], (w) => w, 120, 1, 10).hidden).toBe(1);
    expect(packChips([], (w: number) => w, 120, 1).rows).toBe(0);
  });
});

describe("credits", () => {
  it("splits shared credits into people", () => {
    expect(creatorsIn("Ana & Bo")).toEqual(["Ana", "Bo"]);
    expect(creatorsIn("Ana, Bo and Cy")).toEqual(["Ana", "Bo", "Cy"]);
    expect(creatorsIn("Sandy Anderson")).toEqual(["Sandy Anderson"]);
    expect(creatorsIn("DesignHacker & BlueHG (nemesis set)")).toEqual(["DesignHacker", "BlueHG"]);
    expect(creatorsIn("Neptune (Typhon00)")).toEqual(["Neptune"]);
    expect(creatorsIn("Ana (art, and text)")).toEqual(["Ana"]);
  });

  it("credits a co-author the catalog's creator line leaves out (GMW Fixes: Gideon's Gaming and Bluefire)", () => {
    const entry = tileOf(
      {
        id: "gmw-fixes-gg",
        kind: "house-rule",
        name: "GMW Fixes",
        creator: "Gideon's Gaming",
        authors: ["Gideon's Gaming", "Bluefire"],
        summary: "",
        tags: [],
        approved: "2026-11-12",
        latest: "1.0.0",
        withdrawn: false,
        versions: {},
      },
      { appVersion: "0.45.0", supportedDslFeatures: [], installed: new Map() },
    );
    expect(entry.creators).toEqual(["Gideon's Gaming", "Bluefire"]);
    const credits = creditsOf([entry, tile("lost-traits-bf", { name: "Lost Traits", creator: "Bluefire" })]);
    expect(credits.find((credit) => credit.name === "Bluefire")?.packs.map((pack) => pack.id)).toEqual([
      "gmw-fixes-gg",
      "lost-traits-bf",
    ]);
    expect(filterTiles([entry], { ...EMPTY_FILTER, creator: "bluefire" })).toHaveLength(1);
  });

  it("lists each creator with their packs, the busiest first", () => {
    const credits = creditsOf(tiles);
    expect(credits.map((credit) => [credit.name, credit.packs.length])).toEqual([
      ["Bo", 2],
      ["Ana", 1],
      ["Cy", 1],
    ]);
    expect(creditLineOf(credits[0]!)).toBe("Ghost-Spider (Hero) · Moon Knight (Hero)");
  });

  it("counts packs in English and Spanish", () => {
    expect(packCountText(1, "en")).toBe("1 pack");
    expect(packCountText(3, "es")).toBe("3 paquetes");
    expect(resultCountText(2, 9, true, "en")).toBe("2 of 9 packs");
    expect(resultCountText(9, 9, false, "en")).toBe("9 packs");
  });
});

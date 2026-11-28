import { describe, expect, it } from "vitest";
import { EMPTY_FILTER, creatorsIn } from "./mod-store-browse.js";
import type { ModStoreTile } from "./mod-store-model.js";
import {
  browseModelOf,
  finderChipsOf,
  findersOf,
  headerModelOf,
  modStoreFocusOrder,
  noticeModelOf,
  stateChipOf,
  tileModelOf,
  type BrowseInput,
} from "./mod-store-page-model.js";

function tile(id: string, over: Partial<ModStoreTile> = {}): ModStoreTile {
  return {
    creators: creatorsIn("Someone"),
    id,
    name: id,
    creator: "Someone",
    kind: "hero",
    kindLabel: "Hero pack",
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
    tags: ["Spider-Verse"],
    approved: "2026-11-01",
    ...over,
  };
}

const thumb = { src: null, fit: "contain" as const };

const input = (over: Partial<BrowseInput> = {}): BrowseInput => ({
  tab: "all",
  status: "ready",
  offline: false,
  phone: false,
  findersOpen: false,
  filter: EMPTY_FILTER,
  tabTiles: [tile("a"), tile("b", { tags: [] })],
  updateBar: null,
  failedIds: new Set(),
  scrollFrom: 0,
  thumbOf: () => thumb,
  ...over,
});

describe("stateChipOf", () => {
  it("is a mark and the words, red only for the call to action", () => {
    expect(stateChipOf(tile("a"), false)).toEqual({ text: "+ Install", solid: true });
    expect(stateChipOf(tile("a", { state: "installed", stateLabel: "Installed" }), false)).toEqual({
      text: "✓ Installed",
      solid: false,
    });
    expect(stateChipOf(tile("a", { state: "update", stateLabel: "Update" }), false)).toEqual({
      text: "↑ Update",
      solid: true,
    });
    expect(stateChipOf(tile("a", { state: "withdrawn", stateLabel: "Withdrawn" }), false).text).toBe("✕ Withdrawn");
  });

  it("says Retry update, with a ! mark, for a pack the last Update all could not update", () => {
    const chip = stateChipOf(tile("a", { state: "update", stateLabel: "Update" }), true);
    expect(chip.text).toBe("! Retry update");
    expect(chip.solid).toBe(true);
  });
});

describe("tileModelOf", () => {
  it("carries the pack's words, its size, its initial and its picture", () => {
    const model = tileModelOf(tile("wolverine", { name: "wolverine", creator: "Bo" }), false, thumb);
    expect(model).toMatchObject({
      id: "wolverine",
      meta: "Hero pack · by Bo",
      foot: "1 MB",
      badge: "+ Install",
      letter: "W",
      thumb,
    });
  });
});

describe("findersOf", () => {
  it("leads with the picked creator, then the tags with their counts, and offers Clear while something narrows", () => {
    const filter = { ...EMPTY_FILTER, creator: "Bo", tags: ["Spider-Verse"] };
    const chips = finderChipsOf([tile("a")], filter);
    expect(chips[0]).toMatchObject({ id: "creator", selected: true, mark: false });
    expect(chips[0]!.label).toContain("Bo");
    expect(chips[1]).toMatchObject({ id: "tag:Spider-Verse", selected: true, mark: true });
    expect(findersOf([tile("a")], filter).clearLabel).toBe("Clear");
    expect(findersOf([tile("a")], EMPTY_FILTER).clearLabel).toBe("");
  });

  it("says the sort in force and how many packs show", () => {
    const finders = findersOf([tile("a"), tile("b")], { ...EMPTY_FILTER, text: "b" });
    expect(finders.sortLabel).toBe("⇅ A to Z");
    expect(finders.search.value).toBe("b");
    expect(finders.countText).toBe("1 of 2 packs");
    expect(findersOf([tile("a")], { ...EMPTY_FILTER, sort: "newest" }).sortLabel).toBe("⇅ Newest");
  });
});

describe("browseModelOf", () => {
  it("shows a grid of tiles with the finders, the tabs and the caption on a wide screen", () => {
    const model = browseModelOf(input());
    expect(model.tabs.map((t) => t.id)).toEqual(["all", "heroes", "scenarios", "extras", "installed", "credits"]);
    expect(model.selected).toBe("all");
    expect(model.finders).not.toBeNull();
    expect(model.body).toMatchObject({ kind: "grid", listId: "grid:all" });
    expect(model.body.kind === "grid" && model.body.tiles.map((t) => t.id)).toEqual(["a", "b"]);
    expect(model.toggle.shown).toBe(false);
    expect(model.caption.heading).toBe("Beta");
  });

  it("folds a phone's finders behind the magnifier until it is pressed or a search narrows the list", () => {
    expect(browseModelOf(input({ phone: true })).finders).toBeNull();
    expect(browseModelOf(input({ phone: true })).toggle).toMatchObject({ shown: true, open: false });
    expect(browseModelOf(input({ phone: true, findersOpen: true })).finders).not.toBeNull();
    const searching = browseModelOf(input({ phone: true, filter: { ...EMPTY_FILTER, text: "a" } }));
    expect(searching.finders).not.toBeNull();
    expect(searching.toggle.open).toBe(true);
    // Credits has no finders to fold.
    expect(browseModelOf(input({ phone: true, tab: "credits" })).toggle.shown).toBe(false);
  });

  it("uses the phone's short caption on a phone", () => {
    expect(browseModelOf(input({ phone: true })).caption.body).not.toBe(browseModelOf(input()).caption.body);
  });

  it("says loading in place of the list, with no finders or update bar", () => {
    const bar = { text: "x", fraction: null, action: null, show: null };
    const model = browseModelOf(input({ status: "loading", updateBar: bar }));
    expect(model.body).toMatchObject({ kind: "message", text: "Loading the store..." });
    expect(model.finders).toBeNull();
    expect(model.updateBar).toBeNull();
  });

  it("offers Try again when the store cannot be reached and nothing is installed", () => {
    const model = browseModelOf(input({ status: "failed", tabTiles: [] }));
    expect(model.body).toMatchObject({ kind: "message", retryLabel: "Try again" });
    // The failed store still shows what is installed.
    expect(browseModelOf(input({ status: "failed" })).body.kind).toBe("grid");
  });

  it("shows the offline strip, and the Update all bar, only once the store is ready", () => {
    const bar = { text: "1 update", fraction: null, action: null, show: null };
    const ready = browseModelOf(input({ offline: true, updateBar: bar }));
    expect(ready.offline).toContain("offline");
    expect(ready.updateBar).toBe(bar);
    expect(browseModelOf(input({ offline: true, status: "failed", updateBar: bar })).offline).toBeNull();
    expect(browseModelOf(input({ tab: "credits", updateBar: bar })).updateBar).toBeNull();
  });

  it("lists each creator with their packs on Credits", () => {
    const model = browseModelOf(input({ tab: "credits" }));
    expect(model.body).toMatchObject({ kind: "credits" });
    const body = model.body;
    expect(body.kind === "credits" && body.credits.map((c) => c.name)).toEqual(["Someone"]);
    expect(body.kind === "credits" && body.credits[0]!.countText).toBe("2 packs ▸");
    expect(model.finders).toBeNull();
  });

  it("says no packs here for an empty tab and no match when the search leaves none, keeping the finders", () => {
    expect(browseModelOf(input({ tabTiles: [] })).body).toMatchObject({ kind: "message" });
    const none = browseModelOf(input({ filter: { ...EMPTY_FILTER, text: "zzzz-no-such-pack" } }));
    expect(none.body).toMatchObject({ kind: "message", text: "No packs match. Try fewer words or tags." });
    expect(none.finders).not.toBeNull();
  });

  it("marks only the packs the last Update all could not update", () => {
    const model = browseModelOf(
      input({
        tabTiles: [
          tile("a", { state: "update", stateLabel: "Update" }),
          tile("b", { state: "update", stateLabel: "Update" }),
        ],
        failedIds: new Set(["a"]),
      }),
    );
    const body = model.body;
    expect(body.kind === "grid" && body.tiles.map((t) => t.badge)).toEqual(["! Retry update", "↑ Update"]);
  });

  it("hands the grid's scroll token through, so a new filter can send it to the top", () => {
    const body = browseModelOf(input({ scrollFrom: 3 })).body;
    expect(body.kind === "grid" && body.scrollFrom).toBe(3);
  });
});

describe("headerModelOf", () => {
  const base = { phone: false, inPack: false, installedCount: 0, backGlyph: undefined, aboutGlyph: undefined };

  it("leads back to the title screen, or to the store from a pack's page", () => {
    expect(headerModelOf(base).backLabel).toBe("◂ TITLE");
    expect(headerModelOf({ ...base, inPack: true }).backLabel).toBe("◂ STORE");
  });

  it("is a bare arrow and a ! on a phone, and counts what is installed", () => {
    const phone = headerModelOf({ ...base, phone: true, installedCount: 3 });
    expect(phone).toMatchObject({ backLabel: "◂", aboutLabel: "!", installedText: "3 installed", badge: "Beta" });
    expect(headerModelOf(base).installedText).toBe("");
    expect(headerModelOf(base).aboutLabel).toBe("About mods");
  });
});

describe("noticeModelOf", () => {
  it("has both speakers with their pictures, and the two answers", () => {
    const model = noticeModelOf(
      (id) => (id === "44001a" ? { src: "dp.webp", focus: { x: 0.5, y: 0.1 } } : null),
      undefined,
    );
    expect(model.lines.map((l) => l.speaker)).toEqual(["Deadpool", "Spider-Man"]);
    expect(model.lines[0]!.portrait).toEqual({ src: "dp.webp", focus: { x: 0.5, y: 0.1 } });
    expect(model.lines[1]!.portrait).toEqual({ src: null });
    expect(model.buttons.map((b) => b.id)).toEqual(["report", "close"]);
  });
});

describe("modStoreFocusOrder", () => {
  const keys = ["back", "about", "tab:all", "tile:a", "card:x", "action:install", "card:y"];

  it("keeps the browse view in the screen's own order", () => {
    expect(modStoreFocusOrder(keys, "browse")).toEqual(keys);
  });

  it("puts a pack's buttons before its cards", () => {
    expect(modStoreFocusOrder(keys, "pack")).toEqual([
      "back",
      "about",
      "action:install",
      "tab:all",
      "tile:a",
      "card:x",
      "card:y",
    ]);
  });

  it("offers Got it, then Report, over the heads-up, and nothing under it", () => {
    expect(modStoreFocusOrder([...keys, "report", "close"], "notice")).toEqual(["close", "report"]);
  });
});

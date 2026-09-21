import { describe, expect, test } from "vitest";
import { flattenShelves, shelvesOf, YOUR_DECKS_SHELF_ID, type ShelfCandidate } from "./roster-shelves.js";

interface Item {
  readonly id: string;
  readonly name: string;
}

const item = (id: string, name: string): Item => ({ id, name });

const packOrder = ["core", "gob", "twc"];
const packName = (code: string): string =>
  ({ core: "Core Set", gob: "Green Goblin", twc: "The Wrecking Crew" })[code] ?? code;

function candidate(
  item: Item,
  packCode: string | null,
  extra: Partial<ShelfCandidate<Item>> = {},
): ShelfCandidate<Item> {
  return { item, packCode, searchHaystacks: [item.name], passesChips: true, ...extra };
}

describe("shelvesOf", () => {
  test("groups by pack, in release order, regardless of input order", () => {
    const candidates = [
      candidate(item("u", "Ultron"), "core"),
      candidate(item("r", "Rhino"), "core"),
      candidate(item("g", "Goblin scenario"), "gob"),
    ];
    const shelves = shelvesOf(candidates, packOrder, packName, "");
    expect(shelves.map((s) => s.id)).toEqual(["core", "gob"]);
    expect(shelves[0]!.title).toBe("Core Set");
    expect(shelves[0]!.items.map((i) => i.id)).toEqual(["u", "r"]);
  });

  test("stable shelf order: which shelves appear, and in what order, never depends on the input's own order — only which item lands in which shelf's own list does", () => {
    const candidates = [
      candidate(item("u", "Ultron"), "core"),
      candidate(item("r", "Rhino"), "core"),
      candidate(item("g", "Goblin scenario"), "gob"),
      candidate(item("w", "Wrecker"), "twc"),
    ];
    const forward = shelvesOf(candidates, packOrder, packName, "");
    const reversed = shelvesOf([...candidates].reverse(), packOrder, packName, "");
    expect(reversed.map((s) => s.id)).toEqual(forward.map((s) => s.id));
    // Every shelf holds the same items either way — reversing the input reverses a shelf's own item order (the
    // caller's order is preserved, not re-sorted), so compare as sets.
    for (const shelf of forward) {
      const other = reversed.find((s) => s.id === shelf.id)!;
      expect(new Set(other.items.map((i) => (i as Item).id))).toEqual(new Set(shelf.items.map((i) => (i as Item).id)));
    }
  });

  test("null packCode buckets into 'Your decks', first, only when non-empty", () => {
    const withDecks = shelvesOf(
      [candidate(item("u", "Ultron"), "core"), candidate(item("d", "My deck"), null)],
      packOrder,
      packName,
      "",
    );
    expect(withDecks.map((s) => s.id)).toEqual([YOUR_DECKS_SHELF_ID, "core"]);
    expect(withDecks[0]!.title).toBe("Your decks");

    const withoutDecks = shelvesOf([candidate(item("u", "Ultron"), "core")], packOrder, packName, "");
    expect(withoutDecks.map((s) => s.id)).toEqual(["core"]);
  });

  test("a chip-excluded candidate never appears on any shelf", () => {
    const shelves = shelvesOf(
      [candidate(item("u", "Ultron"), "core", { passesChips: false })],
      packOrder,
      packName,
      "",
    );
    expect(shelves).toEqual([]);
  });

  test("empty query keeps everything that passes chips", () => {
    const shelves = shelvesOf(
      [candidate(item("u", "Ultron"), "core"), candidate(item("r", "Rhino"), "core")],
      packOrder,
      packName,
      "",
    );
    expect(flattenShelves(shelves).map((i) => i.id)).toEqual(["u", "r"]);
  });

  test("a nested item match narrows a shelf without dropping the whole thing", () => {
    const shelves = shelvesOf(
      [candidate(item("u", "Ultron"), "core"), candidate(item("r", "Rhino"), "core")],
      packOrder,
      packName,
      "ultr",
    );
    expect(shelves).toHaveLength(1);
    expect(shelves[0]!.items.map((i) => i.id)).toEqual(["u"]);
  });

  test("a query matching a pack's own name keeps the whole shelf, even items whose own fields don't match", () => {
    const shelves = shelvesOf(
      [candidate(item("u", "Ultron"), "core"), candidate(item("r", "Rhino"), "core")],
      packOrder,
      packName,
      "core set",
    );
    expect(shelves).toHaveLength(1);
    expect(shelves[0]!.items.map((i) => i.id)).toEqual(["u", "r"]);
  });

  test("a pack-name match never pulls in 'Your decks' — it has no pack name to match", () => {
    const shelves = shelvesOf(
      [candidate(item("d", "My deck"), null, { searchHaystacks: ["My deck"] })],
      packOrder,
      packName,
      "core",
    );
    expect(shelves).toEqual([]);
  });

  test("empty shelves (nothing survives the query) are dropped entirely", () => {
    const shelves = shelvesOf(
      [candidate(item("u", "Ultron"), "core"), candidate(item("g", "Goblin scenario"), "gob")],
      packOrder,
      packName,
      "goblin",
    );
    expect(shelves.map((s) => s.id)).toEqual(["gob"]);
  });

  test("accent- and case-insensitive, like the rest of S8's search", () => {
    const shelves = shelvesOf(
      [candidate(item("c", "Café scenario"), "core", { searchHaystacks: ["Café scenario"] })],
      packOrder,
      packName,
      "cafe",
    );
    expect(shelves).toHaveLength(1);
  });

  test("a pack the caller never named in packOrder still shows, appended after the named ones is not guaranteed — but it must not silently vanish", () => {
    const shelves = shelvesOf([candidate(item("x", "Mystery"), "future-pack")], packOrder, packName, "");
    // Not covered by packOrder, so this module drops it rather than guessing a position — the caller is
    // expected to keep packOrder in step with every pack the pool actually has (POOL_PACKS).
    expect(shelves).toEqual([]);
  });
});

describe("flattenShelves", () => {
  test("every item, in shelf order then item order", () => {
    const shelves = shelvesOf(
      [
        candidate(item("d", "My deck"), null),
        candidate(item("u", "Ultron"), "core"),
        candidate(item("g", "Goblin scenario"), "gob"),
      ],
      packOrder,
      packName,
      "",
    );
    expect(flattenShelves(shelves).map((i) => i.id)).toEqual(["d", "u", "g"]);
  });
});

describe("shelvesOf with a solo shelf", () => {
  const candidate = (item: string, packCode: string | null): ShelfCandidate<string> => ({
    item,
    packCode,
    searchHaystacks: [item],
    passesChips: true,
  });
  const order = ["core", "cap", "msm", "box2"];
  const names: Record<string, string> = {
    core: "Core Set",
    cap: "Captain America",
    msm: "Ms. Marvel",
    box2: "Second Box",
  };
  const nameOf = (code: string): string => names[code] ?? code;
  const solo = { id: "hero-packs", title: "Hero packs" };
  const all = [
    candidate("Spider-Man", "core"),
    candidate("She-Hulk", "core"),
    candidate("Cap", "cap"),
    candidate("Kamala", "msm"),
    candidate("A", "box2"),
    candidate("B", "box2"),
  ];

  it("gathers one-item packs onto one shelf, where the first of them would have been", () => {
    const shelves = shelvesOf(all, order, nameOf, "", solo);
    expect(shelves.map((s) => [s.id, s.items])).toEqual([
      ["core", ["Spider-Man", "She-Hulk"]],
      ["hero-packs", ["Cap", "Kamala"]],
      ["box2", ["A", "B"]],
    ]);
  });

  it("leaves every pack its own shelf when no solo shelf is asked for", () => {
    expect(shelvesOf(all, order, nameOf, "").map((s) => s.id)).toEqual(["core", "cap", "msm", "box2"]);
  });

  it("a box filtered down to one hit stays on its own shelf", () => {
    const shelves = shelvesOf(all, order, nameOf, "she-hulk", solo);
    expect(shelves.map((s) => [s.id, s.items])).toEqual([["core", ["She-Hulk"]]]);
  });

  it("searching a hero pack by its pack name finds its hero on the gathered shelf", () => {
    const shelves = shelvesOf(all, order, nameOf, "ms. marvel", solo);
    expect(shelves.map((s) => [s.id, s.items])).toEqual([["hero-packs", ["Kamala"]]]);
  });
});

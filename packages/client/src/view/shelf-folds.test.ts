import { describe, expect, it } from "vitest";

import {
  foldShelves,
  loadShelfFolds,
  openShelfItems,
  saveShelfFolds,
  shelfFocusKeys,
  shelfFoldsKey,
  toggleShelfFold,
  unfoldShelf,
} from "./shelf-folds.js";
import type { Shelf } from "./roster-shelves.js";

const memory = (): Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

const shelves: readonly Shelf<string>[] = [
  { id: "core", title: "Core", items: ["a", "b"] },
  { id: "custom", title: "Custom packs", items: ["c"] },
];

describe("shelf folds", () => {
  it("toggles a shelf folded and open again", () => {
    const folded = toggleShelfFold(new Set(), "core");
    expect([...folded]).toEqual(["core"]);
    expect(toggleShelfFold(folded, "core").size).toBe(0);
    expect(unfoldShelf(folded, "core").size).toBe(0);
    expect(unfoldShelf(folded, "other")).toBe(folded);
  });

  it("round-trips through storage per list", () => {
    const storage = memory();
    saveShelfFolds("seats", new Set(["custom", "core"]), storage);
    expect([...loadShelfFolds("seats", storage)].sort()).toEqual(["core", "custom"]);
    expect(loadShelfFolds("scenario-select", storage).size).toBe(0);
    saveShelfFolds("scenario-select", new Set(["core"]), storage);
    expect([...loadShelfFolds("seats", storage)].sort()).toEqual(["core", "custom"]);
    expect([...loadShelfFolds("scenario-select", storage)]).toEqual(["core"]);
  });

  it("reads garbage or a blocked store as nothing folded", () => {
    const storage = memory();
    storage.data.set(shelfFoldsKey("seats"), "{not json");
    expect(loadShelfFolds("seats", storage).size).toBe(0);
    storage.data.set(shelfFoldsKey("seats"), JSON.stringify({ a: 1 }));
    expect(loadShelfFolds("seats", storage).size).toBe(0);
    storage.data.set(shelfFoldsKey("seats"), JSON.stringify(["core", 4]));
    expect([...loadShelfFolds("seats", storage)]).toEqual(["core"]);
    expect(loadShelfFolds("seats", null).size).toBe(0);
    expect(() => saveShelfFolds("seats", new Set(["x"]), null)).not.toThrow();
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(loadShelfFolds("seats", throwing).size).toBe(0);
    expect(() => saveShelfFolds("seats", new Set(["x"]), throwing)).not.toThrow();
  });

  it("marks folded shelves collapsed, except while filtering", () => {
    const folded = new Set(["custom"]);
    expect(foldShelves(shelves, folded, false).map((s) => s.collapsed ?? false)).toEqual([false, true]);
    expect(foldShelves(shelves, folded, true)).toBe(shelves);
    expect(openShelfItems(foldShelves(shelves, folded, false))).toEqual(["a", "b"]);
  });

  it("lists header stops for every shelf and card stops only for open ones", () => {
    const keys = shelfFocusKeys(foldShelves(shelves, new Set(["core"]), false), "h", "c", (x) => x);
    expect(keys).toEqual(["h:core", "h:custom", "c:c"]);
    expect(shelfFocusKeys(shelves, "h", "c", (x) => x)).toEqual(["h:core", "c:a", "c:b", "h:custom", "c:c"]);
  });
});

import { describe, expect, it, test } from "vitest";
import {
  DECK_LIST_LAST_KEY,
  deckListChips,
  deckListGroupOf,
  deckListShows,
  displayedDeckIds,
  freshDeckVisit,
  nextDeckList,
  openingDeckList,
  readLastDeckList,
  reconcileDeckSelection,
  writeLastDeckList,
} from "./deck-list-open.js";

describe("openingDeckList (#755)", () => {
  test("the default opens every list together, as the screen always has", () => {
    expect(openingDeckList("all", null, true)).toBeNull();
  });

  test("a named list opens alone", () => {
    expect(openingDeckList("precon", null, true)).toBe("precon");
    expect(openingDeckList("build", "community", true)).toBe("build");
    expect(openingDeckList("community", null, true)).toBe("community");
  });

  test("last used opens the list left open last, or all when none was", () => {
    expect(openingDeckList("last", "community", true)).toBe("community");
    expect(openingDeckList("last", null, true)).toBeNull();
  });

  test("hidden precons: never opens on the Preconstructed list", () => {
    expect(openingDeckList("precon", null, false)).toBeNull();
    expect(openingDeckList("last", "precon", false)).toBeNull();
    expect(openingDeckList("build", null, false)).toBe("build");
  });
});

describe("deckListShows", () => {
  test("all shows every list; one list shows only itself", () => {
    for (const group of ["precon", "build", "community"] as const) expect(deckListShows(group, null, true)).toBe(true);
    expect(deckListShows("build", "build", true)).toBe(true);
    expect(deckListShows("precon", "build", true)).toBe(false);
    expect(deckListShows("community", "precon", true)).toBe(false);
  });

  test("hidden precons never show, whichever list is open", () => {
    expect(deckListShows("precon", null, false)).toBe(false);
    expect(deckListShows("precon", "precon", false)).toBe(false);
    expect(deckListShows("build", null, false)).toBe(true);
    expect(deckListShows("community", null, false)).toBe(true);
  });
});

describe("the list chips", () => {
  test("three lists, and two once the precons are hidden", () => {
    expect(deckListChips(true).map((c) => c.id)).toEqual(["precon", "build", "community"]);
    expect(deckListChips(false).map((c) => c.id)).toEqual(["build", "community"]);
  });

  test("tapping a chip opens its list; tapping the open one goes back to all", () => {
    expect(nextDeckList(null, "build")).toBe("build");
    expect(nextDeckList("build", "community")).toBe("community");
    expect(nextDeckList("community", "community")).toBeNull();
  });
});

describe("the remembered list", () => {
  const memory = (): { store: Map<string, string>; storage: Pick<Storage, "getItem" | "setItem"> } => {
    const store = new Map<string, string>();
    return {
      store,
      storage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => void store.set(key, value) },
    };
  };

  test("round-trips a list, and all reads back as null", () => {
    const { storage, store } = memory();
    expect(readLastDeckList(storage)).toBeNull();
    writeLastDeckList("community", storage);
    expect(store.get(DECK_LIST_LAST_KEY)).toBe("community");
    expect(readLastDeckList(storage)).toBe("community");
    writeLastDeckList(null, storage);
    expect(readLastDeckList(storage)).toBeNull();
  });

  test("an unknown value or storage that throws is no list", () => {
    const { storage, store } = memory();
    store.set(DECK_LIST_LAST_KEY, "bogus");
    expect(readLastDeckList(storage)).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(readLastDeckList(broken)).toBeNull();
    expect(() => writeLastDeckList("build", broken)).not.toThrow();
  });
});

describe("reconcileDeckSelection", () => {
  const options = [
    { id: "p1", group: "precon" as const },
    { id: "s1", group: "build" as const },
    { id: "c1", group: "community" as const },
  ];
  it("keeps a selection on the displayed list", () => {
    expect(reconcileDeckSelection("s1", options, null, true)).toBe("s1");
    expect(reconcileDeckSelection("s1", options, "build", true)).toBe("s1");
  });
  it("moves a saved deck's selection to the first deck of Precons or Community, and back", () => {
    expect(reconcileDeckSelection("s1", options, "precon", true)).toBe("p1");
    expect(reconcileDeckSelection("s1", options, "community", true)).toBe("c1");
    expect(reconcileDeckSelection("c1", options, "build", true)).toBe("s1");
  });
  it("selects nothing when the list is empty", () => {
    const noSaved = options.filter((o) => o.group !== "build");
    expect(reconcileDeckSelection("p1", noSaved, "build", true)).toBeNull();
    expect(reconcileDeckSelection(null, [], null, true)).toBeNull();
  });
  it("skips hidden precons", () => {
    expect(reconcileDeckSelection("p1", options, null, false)).toBe("s1");
  });
  it("keeps a deck asked for by id on every list", () => {
    expect(reconcileDeckSelection("s1", options, "precon", true, "s1")).toBe("s1");
    expect(reconcileDeckSelection("s1", options, "precon", true, "c1")).toBe("p1");
  });
});

describe("deck list groups", () => {
  it("classifies precon, community and own decks", () => {
    expect(deckListGroupOf(true, false)).toBe("precon");
    expect(deckListGroupOf(false, true)).toBe("community");
    expect(deckListGroupOf(false, false)).toBe("build");
  });
  it("Your decks shows no community offers, even with zero saved decks", () => {
    const options = [
      { id: "p1", group: "precon" as const },
      { id: "c1", group: "community" as const },
    ];
    expect(displayedDeckIds(options, "build", true)).toEqual([]);
    expect(reconcileDeckSelection("c1", options, "build", true)).toBeNull();
    expect(displayedDeckIds(options, null, true)).toEqual(["p1", "c1"]);
    expect(displayedDeckIds(options, "precon", false)).toEqual([]);
  });
});

describe("freshDeckVisit", () => {
  it("pins a requested deck on every visit, whatever an earlier visit's chip tap did", () => {
    // Visit 1 ends with a chip tap (the scene sets its pin false); visit 2 asks for a hidden precon by id.
    const visit = freshDeckVisit("precon-1", "last", "build", false);
    expect(visit).toEqual({ deckList: null, focusPinned: true, fallbackSelection: false });
    const options = [
      { id: "precon-1", group: "precon" as const },
      { id: "mine", group: "build" as const },
    ];
    expect(
      reconcileDeckSelection("precon-1", options, visit.deckList, false, visit.focusPinned ? "precon-1" : null),
    ).toBe("precon-1");
  });

  it("opens on the setting's list when no deck is asked for", () => {
    expect(freshDeckVisit(null, "build", null, true).deckList).toBe("build");
  });
});

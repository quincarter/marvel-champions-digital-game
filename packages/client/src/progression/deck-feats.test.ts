import { beforeEach, describe, expect, it } from "vitest";
import { NO_DECK_FEATS, noteDeckFeat, readDeckFeats } from "./deck-feats.js";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  } as Storage;
});

describe("deck feats", () => {
  it("start unnoted", () => {
    expect(readDeckFeats()).toEqual(NO_DECK_FEATS);
  });

  it("are noted once and kept", () => {
    expect(noteDeckFeat("built")).toBe(true);
    expect(noteDeckFeat("built")).toBe(false);
    expect(noteDeckFeat("playedBuilt")).toBe(true);
    expect(readDeckFeats()).toEqual({ built: true, edited: false, playedBuilt: true });
  });

  it("read as unnoted when the stored value is not a record", () => {
    store.set("mc-deck-feats", "not json");
    expect(readDeckFeats()).toEqual(NO_DECK_FEATS);
  });
});

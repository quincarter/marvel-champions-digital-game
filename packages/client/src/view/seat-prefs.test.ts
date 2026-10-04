import { describe, expect, test } from "vitest";
import {
  REC_COLLAPSED_KEY,
  loadRecommendedCollapsed,
  recommendedStartsCollapsed,
  saveRecommendedCollapsed,
} from "./seat-prefs.js";

const memory = (): Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe("seat prefs", () => {
  test("never chosen reads as null, then remembers either way", () => {
    const storage = memory();
    expect(loadRecommendedCollapsed(storage)).toBeNull();
    saveRecommendedCollapsed(true, storage);
    expect(loadRecommendedCollapsed(storage)).toBe(true);
    saveRecommendedCollapsed(false, storage);
    expect(loadRecommendedCollapsed(storage)).toBe(false);
    expect(storage.data.get(REC_COLLAPSED_KEY)).toBe("0");
  });

  test("a missing or throwing store is just forgetful", () => {
    expect(loadRecommendedCollapsed(null)).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadRecommendedCollapsed(broken)).toBeNull();
    expect(() => saveRecommendedCollapsed(true, broken)).not.toThrow();
  });

  test("a phone starts the Recommended shelf folded, every other layout open, and a remembered choice wins either way", () => {
    expect(recommendedStartsCollapsed(null, true)).toBe(true);
    expect(recommendedStartsCollapsed(null, false)).toBe(false);
    expect(recommendedStartsCollapsed(false, true)).toBe(false);
    expect(recommendedStartsCollapsed(true, false)).toBe(true);
  });
});

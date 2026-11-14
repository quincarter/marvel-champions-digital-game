import { describe, expect, test } from "vitest";
import { readBarOnTop, writeBarOnTop } from "./replay-bar-pref.js";

function memory(): Pick<Storage, "getItem" | "setItem"> & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

describe("replay bar placement preference", () => {
  test("is the bottom until chosen, and then holds", () => {
    const store = memory();
    expect(readBarOnTop(store)).toBe(false);
    writeBarOnTop(true, store);
    expect(store.data.get("mc-replay-bar-top")).toBe("1");
    expect(readBarOnTop(store)).toBe(true);
    writeBarOnTop(false, store);
    expect(readBarOnTop(store)).toBe(false);
  });

  test("a storage that throws leaves the bottom and does not throw", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(readBarOnTop(broken)).toBe(false);
    expect(() => writeBarOnTop(true, broken)).not.toThrow();
  });
});

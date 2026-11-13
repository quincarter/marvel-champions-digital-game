import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { noteModInstalls, readModInstalls } from "./mod-installs.js";

function stubStorage(): Map<string, string> {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  });
  return data;
}

describe("the record of installed mods", () => {
  let data: Map<string, string>;
  beforeEach(() => {
    data = stubStorage();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("starts empty and notes each pack once, keeping its first kind", () => {
    expect(readModInstalls()).toEqual({});
    expect(noteModInstalls([{ id: "a", kind: "hero" }])).toBe(true);
    expect(noteModInstalls([{ id: "a", kind: "scenario" }])).toBe(false);
    expect(
      noteModInstalls([
        { id: "a", kind: "hero" },
        { id: "b", kind: "art" },
      ]),
    ).toBe(true);
    expect(readModInstalls()).toEqual({ a: "hero", b: "art" });
  });

  it("keeps a pack after it is gone from the pack store (nothing removes an entry)", () => {
    noteModInstalls([{ id: "a", kind: "hero" }]);
    noteModInstalls([]);
    expect(readModInstalls()).toEqual({ a: "hero" });
  });

  it("is not fooled by an id that is an Object.prototype name", () => {
    expect(noteModInstalls([{ id: "constructor", kind: "hero" }])).toBe(true);
    expect(readModInstalls().constructor).toBe("hero");
  });

  it("reads a damaged or foreign record as empty, and keeps only text kinds", () => {
    data.set("mc-mod-installs", "{not json");
    expect(readModInstalls()).toEqual({});
    data.set("mc-mod-installs", "[1,2]");
    expect(readModInstalls()).toEqual({});
    data.set("mc-mod-installs", JSON.stringify({ a: "hero", b: 7 }));
    expect(readModInstalls()).toEqual({ a: "hero" });
  });
});

import { describe, expect, it } from "vitest";

import { ByteLru } from "./byte-lru.js";

describe("ByteLru", () => {
  it("evicts least recently used entries when the bytes pass the cap, though the count is fine", () => {
    const lru = new ByteLru<string>(100, 100);
    lru.set("a", "A", 40);
    lru.set("b", "B", 40);
    lru.get("a");
    expect(lru.set("c", "C", 40)).toEqual(["B"]);
    expect(lru.bytes).toBe(80);
    expect(lru.get("b")).toBeUndefined();
  });

  it("counts a size that is only known later, and never evicts the entry just sized", () => {
    const lru = new ByteLru<string>(100, 100);
    lru.set("a", "A", 60);
    lru.set("b", "B");
    expect(lru.setBytes("b", 70)).toEqual(["A"]);
    expect(lru.setBytes("b", 500)).toEqual([]);
    expect(lru.get("b")).toBe("B");
  });

  it("still caps the entry count", () => {
    const lru = new ByteLru<number>(2, 1000);
    lru.set("a", 1, 1);
    lru.set("b", 2, 1);
    expect(lru.set("c", 3, 1)).toEqual([1]);
    expect(lru.size).toBe(2);
  });
});

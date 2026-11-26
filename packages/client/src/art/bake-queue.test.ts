import { describe, expect, it } from "vitest";

import { BakeQueue } from "./bake-queue.js";

describe("BakeQueue", () => {
  it("hands out the lowest priority first, first in first out among equals", () => {
    const queue = new BakeQueue<string>(10);
    queue.enqueue("far", 900);
    queue.enqueue("a", 0);
    queue.enqueue("near", 40);
    queue.enqueue("b", 0);
    expect([queue.next(), queue.next(), queue.next(), queue.next()]).toEqual(["a", "b", "near", "far"]);
    expect(queue.next()).toBeNull();
  });

  it("stops at the in-flight cap until a slot is given back", () => {
    const queue = new BakeQueue<string>(2);
    for (const item of ["a", "b", "c"]) queue.enqueue(item, 0);
    expect(queue.next()).toBe("a");
    expect(queue.next()).toBe("b");
    expect(queue.next()).toBeNull();
    expect(queue.inFlight).toBe(2);
    queue.done();
    expect(queue.next()).toBe("c");
  });

  it("serves a re-prioritised item in its new place", () => {
    const queue = new BakeQueue<string>(1);
    queue.enqueue("overscan", 500);
    queue.enqueue("other", 300);
    expect(queue.reprioritize("overscan", 0)).toBe(true);
    expect(queue.next()).toBe("overscan");
  });

  it("cancels a waiting item but not one already dispatched", () => {
    const queue = new BakeQueue<string>(1);
    queue.enqueue("a", 0);
    queue.enqueue("b", 1);
    expect(queue.next()).toBe("a");
    expect(queue.remove("a")).toBe(false);
    expect(queue.reprioritize("a", 5)).toBe(false);
    expect(queue.remove("b")).toBe(true);
    queue.done();
    expect(queue.next()).toBeNull();
  });
});

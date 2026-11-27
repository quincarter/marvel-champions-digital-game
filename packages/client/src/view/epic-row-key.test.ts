import { describe, expect, it } from "vitest";
import { epicRowKey } from "./epic-row-key.js";

describe("epicRowKey", () => {
  it("names the command and its targets, so a reordered list keeps each key on its own target", () => {
    expect(epicRowKey("host", "t1", "p2")).toBe("row:host:t1:p2");
    expect(epicRowKey("host", "t1", "p2")).toBe(epicRowKey("host", "t1", "p2"));
    expect(epicRowKey("host", "t1", "p3")).not.toBe(epicRowKey("host", "t1", "p2"));
    expect(epicRowKey("remote", "t2:card9", "hero1")).not.toBe(epicRowKey("drop", "t2"));
  });
});

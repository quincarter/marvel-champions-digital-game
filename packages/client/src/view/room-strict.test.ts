import { describe, expect, test } from "vitest";
import { roomStrictOf, strictReason } from "./room-strict.js";

describe("roomStrictOf", () => {
  test("only a strict room's game is strict", () => {
    expect(roomStrictOf({ roomPlayMode: "strict" })).toBe(true);
    expect(roomStrictOf({ roomPlayMode: "host" })).toBe(false);
    expect(roomStrictOf({})).toBe(false);
    expect(roomStrictOf(null)).toBe(false);
  });

  test("the reason is one line", () => {
    expect(strictReason()).toBe("Strict rules: the host turned this off");
  });
});

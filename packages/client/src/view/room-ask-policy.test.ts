import { describe, expect, it } from "vitest";
import { askAllowedOf, seatUndoPolicyOf } from "./room-ask-policy.js";

const room = (playMode: "host" | "strict", undo: "off" | "host" | "ask", cheats: boolean) =>
  ({ playMode, undo, cheats }) as const;

describe("what a guest may ask the host for", () => {
  it("offers an undo ask only under the ask policy", () => {
    expect(askAllowedOf("undo", room("host", "ask", false))).toBe(true);
    expect(askAllowedOf("undo", room("host", "host", false))).toBe(false);
    expect(askAllowedOf("undo", room("host", "off", false))).toBe(false);
    expect(askAllowedOf("undo", room("strict", "ask", false))).toBe(false);
    expect(askAllowedOf("undo", null)).toBe(false);
  });

  it("offers a change only with cheats on in Host control", () => {
    expect(askAllowedOf("adjust", room("host", "ask", true))).toBe(true);
    expect(askAllowedOf("adjust", room("host", "ask", false))).toBe(false);
    expect(askAllowedOf("adjust", room("strict", "off", true))).toBe(false);
  });

  it("forces Strict to off and reads an unreadable policy as ask", () => {
    expect(seatUndoPolicyOf({ playMode: "strict", undo: "ask" })).toBe("off");
    expect(seatUndoPolicyOf({ playMode: "host", undo: "ask" })).toBe("ask");
  });
});

describe("Each player Undo", () => {
  it("lets a guest's Undo through, to be done by the host's device", () => {
    expect(askAllowedOf("undo", { playMode: "host", undo: "own", cheats: false })).toBe(true);
    expect(seatUndoPolicyOf({ playMode: "host", undo: "own" })).toBe("own");
    expect(seatUndoPolicyOf({ playMode: "strict", undo: "own" })).toBe("off");
  });
});

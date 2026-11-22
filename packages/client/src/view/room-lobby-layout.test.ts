import { describe, expect, it } from "vitest";
import { lobbyLayout } from "./room-lobby-layout.js";

const sizes: readonly [string, number, number][] = [
  ["se", 375, 667],
  ["pixel", 412, 924],
  ["tablet-portrait", 768, 1024],
  ["tablet", 1024, 768],
  ["desktop", 1440, 900],
];

describe("lobbyLayout", () => {
  it("picks tabs, stack and wide by width", () => {
    expect(lobbyLayout(375, 667, 56, "seats", 16).mode).toBe("tabs");
    expect(lobbyLayout(768, 1024, 56, "seats", 24).mode).toBe("stack");
    expect(lobbyLayout(1024, 768, 56, "seats", 24).mode).toBe("wide");
  });
  it.each(sizes)("keeps every panel on screen at %s", (_name, width, height) => {
    for (const active of ["seats", "settings", "chat"] as const) {
      const layout = lobbyLayout(width, height, 56, active, width < 500 ? 16 : 24);
      expect(Object.keys(layout.panels).length).toBeGreaterThan(0);
      for (const rect of Object.values(layout.panels)) {
        expect(rect.height).toBeGreaterThan(80);
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(layout.footer.y);
      }
    }
  });
  it("shows only the chosen panel on a phone", () => {
    expect(Object.keys(lobbyLayout(375, 667, 56, "chat", 16).panels)).toEqual(["chat"]);
    expect(Object.keys(lobbyLayout(768, 1024, 56, "chat", 24).panels).sort()).toEqual(["chat", "seats"]);
  });
});

import { describe, expect, test } from "vitest";
import { font, minType, typeRole } from "./tokens.js";

describe("the threat bar's count type (click-through F14)", () => {
  test("is not the display face, whose 7 reads as a 1 at the bar's size", () => {
    expect(typeRole.threatCount.family).not.toBe(font.display);
    expect(typeRole.threatCount.family).toBe(font.body);
  });

  test("stays bold and at least the table's small-label floor", () => {
    expect(typeRole.threatCount.weight).toBe(800);
    expect(typeRole.threatCount.size).toBeGreaterThanOrEqual(minType.desktopBody + 1);
  });
});

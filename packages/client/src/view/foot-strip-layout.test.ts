import { describe, expect, test } from "vitest";
import { POOL_CARDS } from "../content/pool-cards.js";
import { FOOT_STRIP_HEIGHT, footStripLayout } from "./foot-strip-layout.js";

describe("footStripLayout", () => {
  test("a short line stays on one row at the usual height", () => {
    expect(footStripLayout("▶ USE", 112)).toEqual({
      lines: 1,
      height: FOOT_STRIP_HEIGHT,
      smaller: false,
      clipped: false,
    });
  });

  test("Skin Contact and Weather Control wrap to two lines in an identity panel's narrow text column", () => {
    for (const name of ["Skin Contact", "Weather Control"]) {
      const layout = footStripLayout(`▶ ${name}`, 112);
      expect(layout.lines, name).toBe(2);
      expect(layout.height, name).toBeGreaterThan(FOOT_STRIP_HEIGHT);
      expect(layout.smaller, name).toBe(false);
    }
  });

  test("a line too long for two drops one font step and is limited to two lines", () => {
    const layout = footStripLayout("▶ exhaust, spend 2 resources, discard 3 cards", 100);
    expect(layout.lines).toBe(2);
    expect(layout.smaller).toBe(true);
    expect(footStripLayout("▶ one two three four five six seven eight nine ten eleven twelve", 100).clipped).toBe(true);
  });

  test("every printed ability name in the pool fits two lines at the narrowest identity column, one font step down at worst", () => {
    const labels = new Set<string>();
    const walk = (value: unknown, depth = 0): void => {
      if (!value || typeof value !== "object" || depth > 6) return;
      if (Array.isArray(value)) {
        for (const item of value) walk(item, depth + 1);
        return;
      }
      const record = value as Record<string, unknown>;
      if (typeof record.id === "string" && typeof record.label === "string") labels.add(record.label);
      for (const child of Object.values(record)) walk(child, depth + 1);
    };
    for (const card of POOL_CARDS) walk(card);
    expect(labels.size, "the pool has printed ability names").toBeGreaterThan(50);
    const layouts = [...labels].map((label) => ({ label, ...footStripLayout(`▶ ${label}`, 104) }));
    // At the 104 px floor these names still need a third line even one step down (a 15-letter hyphenated word, a
    // 27-letter name, a setup sentence). Those clip at two lines with an ellipsis; the sheet a tap opens names them.
    // A new name joining this list is a layout question for whoever scripts it.
    expect(layouts.filter((l) => l.clipped).map((l) => l.label)).toEqual([
      "Spider-Nonsense",
      "Psychogenetic Compatibility",
      "I feel a storm coming...",
      // Wave 7 (wave-7 data step 11): Psylocke's and Deadpool's ability names; the client step decides how to show them ("[star]" is an unrendered icon token).
      "[star] Psi-Energy Control",
      "The Regeneratin' Degenerate",
    ]);
    // The font step is the exception: most names read at the usual size on two lines.
    expect(layouts.filter((l) => l.smaller).length).toBeLessThan(labels.size / 4);
  });
});

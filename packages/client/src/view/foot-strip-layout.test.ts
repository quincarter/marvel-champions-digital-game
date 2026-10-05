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

  test("a line too long for two drops one font step and takes a third line", () => {
    const layout = footStripLayout("▶ exhaust, spend 2 resources, discard 3 cards", 100);
    expect(layout.lines).toBe(3);
    expect(layout.smaller).toBe(true);
    expect(layout.height).toBe(FOOT_STRIP_HEIGHT + 24);
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
    // At the 104 px floor three names (a 15-letter hyphenated word, a 27-letter name, a setup sentence) need a third
    // line one step down: the strip grows to hold it instead of ending in an ellipsis. None is ever clipped.
    expect(layouts.filter((l) => l.clipped).map((l) => l.label)).toEqual([]);
    expect(layouts.filter((l) => l.lines === 3).map((l) => l.label)).toEqual(
      expect.arrayContaining(["Psychogenetic Compatibility", "I feel a storm coming..."]),
    );
    // The font step is the exception: most names read at the usual size on two lines.
    expect(layouts.filter((l) => l.smaller).length).toBeLessThan(labels.size / 4);
  });

  // Seen cut in real games at 1440x900: the strip is the card column of a villain panel (~75px) or a minion tile
  // (~80px) and the name sits beside a damage tag at worst. Each now grows to two rows instead of ending in "…".
  test.each(["Adamantium Claws", "Gauntlet Beam", "Energy Barrier", "Storm's Crown"])(
    "the attachment name %s wraps in a narrow card column rather than being cut",
    (name) => {
      for (const width of [75, 84, 96]) {
        const layout = footStripLayout(name, width);
        expect(layout.lines, `${name} @${width}`).toBeGreaterThanOrEqual(2);
        expect(layout.clipped, `${name} @${width}`).toBe(false);
        expect(layout.height).toBe(FOOT_STRIP_HEIGHT + 12 * (layout.lines - 1));
      }
    },
  );

  test("a longer attachment name wraps in the hero panel's text column without being clipped", () => {
    const layout = footStripLayout("Targeted for Elimination", 112);
    expect(layout.clipped).toBe(false);
    expect(layout.lines).toBeGreaterThanOrEqual(2);
  });
});

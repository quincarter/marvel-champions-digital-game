import { describe, expect, test } from "vitest";
import { deckFromStarterDeck } from "@mc/content";
import { POOL_STARTER_DECKS } from "../content/pool.js";
import { heroAspectsOf } from "./roster-filter.js";
import { chipRowFits, chipStripHeight, compactChipWidth, minChipCellWidth, packCompactChipsToRows, wrapChipsToRows, type ChipLabel } from "./chip-layout.js";

/** The real Heroes roster chip set (`scenes/title.ts#heroChipDefs`), in the same order: aspects, then source, then "Playable now". */
function realHeroChips(): readonly ChipLabel[] {
  const decks = POOL_STARTER_DECKS.map((starter) => deckFromStarterDeck(starter, "poolv1"));
  const aspectChips = heroAspectsOf(decks).map((aspect) => ({ id: `aspect:${aspect}`, text: aspect }));
  const sourceChips = [
    { id: "source:precon", text: "Precon" },
    { id: "source:imported", text: "Imported" },
    { id: "source:userBuilt", text: "Built" },
  ];
  return [...aspectChips, ...sourceChips, { id: "playable-now", text: "Playable now" }];
}

/** `title-layout.ts`'s `contentColumnWidth` at a phone size — duplicated as a literal here so this test doesn't depend on that module's own tiers changing out from under it silently; `title-layout.test.ts` covers the real function. */
const PHONE_COLUMN_WIDTH = 375 - 16 * 2;

describe("minChipCellWidth / chipRowFits", () => {
  test("a wide label needs a wider cell than a short one", () => {
    expect(minChipCellWidth("Playable now")).toBeGreaterThan(minChipCellWidth("Built"));
  });

  test("all eight real hero chips crammed into one row at phone width would not fit — the bug this module fixes", () => {
    const chips = realHeroChips();
    expect(chips.length).toBeGreaterThanOrEqual(8);
    expect(chipRowFits(chips, PHONE_COLUMN_WIDTH)).toBe(false);
  });

  test("a single chip alone in a row of that width fits", () => {
    expect(chipRowFits([{ id: "x", text: "Playable now" }], PHONE_COLUMN_WIDTH)).toBe(true);
  });

  test("an empty row always fits", () => {
    expect(chipRowFits([], 10)).toBe(true);
  });
});

describe("wrapChipsToRows", () => {
  test("the real hero chip set wraps to more than one row at phone width, and no resulting row would truncate", () => {
    const chips = realHeroChips();
    const rows = wrapChipsToRows(chips, PHONE_COLUMN_WIDTH);
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) expect(chipRowFits(row, PHONE_COLUMN_WIDTH)).toBe(true);
    // Every chip is drawn exactly once, in its original order.
    expect(rows.flat()).toEqual(chips);
  });

  test("the real hero chip set wraps to two rows at the content column's own cap (640), and neither row truncates", () => {
    // Was asserted at 1 row before `CHIP_MIN_CHAR_WIDTH_PX`'s 2026-09 fix (4.6 → 7.0): the old estimate left out
    // `typeRole.label.letterSpacing`, so it under-counted every chip and let this row through at a width real
    // rendering would have truncated at. Two rows, uncramped, is the honest fit at this width.
    const chips = realHeroChips();
    const rows = wrapChipsToRows(chips, 640);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(chipRowFits(row, 640)).toBe(true);
  });

  test("a handful of scenario product chips (three packs) fit one row even at phone width", () => {
    const chips: ChipLabel[] = [
      { id: "product:core", text: "Core Set" },
      { id: "product:gob", text: "Green Goblin" },
      { id: "product:twc", text: "The Wrecking Crew" },
    ];
    const rows = wrapChipsToRows(chips, PHONE_COLUMN_WIDTH);
    for (const row of rows) expect(chipRowFits(row, PHONE_COLUMN_WIDTH)).toBe(true);
  });

  test("no chips wrap to no rows", () => {
    expect(wrapChipsToRows([], 300)).toEqual([]);
  });

  test("a label too long for any row still gets its own row rather than being silently dropped", () => {
    const rows = wrapChipsToRows([{ id: "huge", text: "A Genuinely Enormous Label That Never Fits Anywhere" }], 60);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(1);
  });
});

describe("packCompactChipsToRows (W2b's second pass: compact chips sized to their own label, not stretched to share a row evenly)", () => {
  test("short chips pack several to a row rather than each claiming an equal share of the width", () => {
    const chips: ChipLabel[] = [
      { id: "a", text: "Core Set" },
      { id: "b", text: "Green Goblin" },
      { id: "c", text: "The Wrecking Crew" },
    ];
    const rows = packCompactChipsToRows(chips, 640);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(chips);
    // Every chip's own compact width is far short of a third of 640 — proof they aren't stretched.
    for (const chip of chips) expect(compactChipWidth(chip.text)).toBeLessThan(640 / 3);
  });

  test("wraps to a new row only once the running total would overflow, never splitting a chip", () => {
    const chips = realHeroChips();
    const rows = packCompactChipsToRows(chips, PHONE_COLUMN_WIDTH);
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) {
      const total = row.reduce((sum, chip, i) => sum + compactChipWidth(chip.text) + (i > 0 ? 6 : 0), 0);
      expect(total).toBeLessThanOrEqual(PHONE_COLUMN_WIDTH);
    }
    expect(rows.flat()).toEqual(chips);
  });

  test("a chip wider than the whole row still gets its own row", () => {
    const rows = packCompactChipsToRows([{ id: "huge", text: "A Genuinely Enormous Label That Never Fits Anywhere" }], 60);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(1);
  });

  test("no chips wrap to no rows", () => {
    expect(packCompactChipsToRows([], 300)).toEqual([]);
  });
});

describe("chipStripHeight", () => {
  test("one row is exactly the touch target height", () => {
    expect(chipStripHeight(1)).toBe(44);
  });

  test("two rows add the gap between them", () => {
    expect(chipStripHeight(2)).toBe(44 * 2 + 6);
  });

  test("zero rows takes no space", () => {
    expect(chipStripHeight(0)).toBe(0);
  });
});

import { describe, expect, test } from "vitest";
import { rectsOverlap, type Rect } from "./layout.js";
import { hit } from "../tokens.js";
import {
  COMPACT_SET_CHOICE_HEIGHT,
  OPTION_CARD_HEIGHT,
  OPTION_GROUPS_STACKED_HEIGHT,
  compactOptionHeight,
  compactRowIndex,
  compactRowRects,
  difficultySlotRect,
  optionGroupsStacked,
  sectionHeaderInlineFits,
  setChoiceRowRects,
  setsCardHeight,
  setsCardInline,
  stackedHeaderLabelLines,
  tableSetupCompactLayout,
  tableSetupLayout,
  tableSetupLayoutRects,
  type TableSetupCompactLayoutInput,
  type TableSetupLayoutInput,
} from "./table-setup-layout.js";

/** The exact viewports the task's own VERIFY section mandates, plus tablet portrait (768×1024) and a short desktop. */
const SIZES: readonly { readonly name: string; readonly width: number; readonly height: number }[] = [
  { name: "desktop 1440x900", width: 1440, height: 900 },
  { name: "desktop 1870x1050", width: 1870, height: 1050 },
  { name: "tabletLandscape 1024x768", width: 1024, height: 768 },
  { name: "tabletPortrait 768x1024", width: 768, height: 1024 },
  { name: "phone 390x844", width: 390, height: 844 },
  { name: "short desktop 1280x760", width: 1280, height: 760 },
];

/** A realistic input: two difficulties, a required set plus five modular candidates, four seats, a full encounter-deck breakdown. */
const REALISTIC: Omit<TableSetupLayoutInput, "width" | "height"> = {
  difficultyCount: 2,
  modularCardCount: 6,
  seatCount: 4,
  compositionRows: 5,
  whatsInThereRows: 5,
  nemesisLines: 4,
};

function noOverlap(input: TableSetupLayoutInput): void {
  const layout = tableSetupLayout(input);
  const rects = tableSetupLayoutRects(layout);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      expect(rectsOverlap(rects[i]!, rects[j]!), `rect ${i} overlaps rect ${j} at ${input.width}x${input.height}`).toBe(
        false,
      );
    }
  }
}

describe("tableSetupLayout: no overlap", () => {
  for (const size of SIZES) {
    test(size.name, () => {
      noOverlap({ ...REALISTIC, width: size.width, height: size.height });
    });
  }

  test("a solo game (one seat, one modular candidate) still doesn't overlap", () => {
    noOverlap({
      width: 390,
      height: 844,
      difficultyCount: 2,
      modularCardCount: 1,
      seatCount: 1,
      compositionRows: 3,
      whatsInThereRows: 5,
      nemesisLines: 0,
    });
    noOverlap({
      width: 1440,
      height: 900,
      difficultyCount: 2,
      modularCardCount: 1,
      seatCount: 1,
      compositionRows: 3,
      whatsInThereRows: 5,
      nemesisLines: 0,
    });
  });

  test("Breakout's three difficulties and zero-modular scenario still doesn't overlap", () => {
    noOverlap({
      width: 390,
      height: 844,
      difficultyCount: 3,
      modularCardCount: 5,
      seatCount: 4,
      compositionRows: 4,
      whatsInThereRows: 5,
      nemesisLines: 0,
    });
    noOverlap({
      width: 1440,
      height: 900,
      difficultyCount: 3,
      modularCardCount: 5,
      seatCount: 4,
      compositionRows: 4,
      whatsInThereRows: 5,
      nemesisLines: 0,
    });
  });

  test("wide: the option cards and The Hood's own modular sets still don't overlap anything", () => {
    for (const size of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 1870, height: 1050 },
    ]) {
      noOverlap({ ...REALISTIC, ...size, optionSpans: [1, 1, 2, 2], hoodSetCount: 9 });
    }
  });

  test("a very short viewport never overlaps, even if content is heavily trimmed", () => {
    // Below this, even the *mandatory* controls (Difficulty/Modular/Seating, four seats, six modular cards) no
    // longer fit above the pinned seed field at all — a real fit failure this module can't paper over without
    // shrinking a real control, not a viewport any of this app's `REFERENCE_VIEWPORTS` (shortest: phone at 844)
    // or the task's own mandated sizes (shortest: 844) ever reaches.
    noOverlap({ ...REALISTIC, width: 390, height: 700 });
    noOverlap({ ...REALISTIC, width: 1024, height: 620 });
  });
});

describe("tableSetupLayout: composition", () => {
  test("the header bar spans the full width, above every section", () => {
    const layout = tableSetupLayout({ ...REALISTIC, width: 1440, height: 900 });
    expect(layout.headerBar).toEqual({ x: 0, y: 0, width: 1440, height: layout.headerBar.height });
    expect(layout.difficultyHeader.y).toBeGreaterThanOrEqual(layout.headerBar.height);
  });

  test("wide (desktop/tabletLandscape): a fixed ink sidebar sits to the right of the body, full body height", () => {
    for (const size of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
    ]) {
      const layout = tableSetupLayout({ ...REALISTIC, ...size });
      expect(layout.wide).toBe(true);
      expect(layout.sidebar).not.toBeNull();
      expect(layout.sidebar!.x).toBeGreaterThan(layout.difficultyRow.x);
      expect(layout.dealItOut.x).toBeGreaterThanOrEqual(layout.sidebar!.x);
      expect(layout.dealItOut.y + layout.dealItOut.height).toBeLessThanOrEqual(
        layout.sidebar!.y + layout.sidebar!.height + 0.01,
      );
    }
  });

  test("narrow (phone/tabletPortrait): no sidebar, one column, Deal it out pinned to the screen's own foot", () => {
    for (const size of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
    ]) {
      const layout = tableSetupLayout({ ...REALISTIC, ...size });
      expect(layout.wide).toBe(false);
      expect(layout.sidebar).toBeNull();
      expect(layout.dealItOut.y + layout.dealItOut.height).toBeGreaterThanOrEqual(size.height - 40);
    }
  });

  test("the encounter-deck panels sit side by side on tablet portrait, stacked on phone", () => {
    const portrait = tableSetupLayout({ ...REALISTIC, width: 768, height: 1024 });
    expect(portrait.encounterPanels.composition.y).toBe(portrait.encounterPanels.whatsInThere.y);
    expect(portrait.encounterPanels.whatsInThere.x).toBeGreaterThan(portrait.encounterPanels.composition.x);

    const phone = tableSetupLayout({ ...REALISTIC, width: 390, height: 844 });
    expect(phone.encounterPanels.whatsInThere.y).toBeGreaterThan(phone.encounterPanels.composition.y);
    expect(phone.encounterPanels.whatsInThere.x).toBe(phone.encounterPanels.composition.x);
  });

  test("modular grid never exceeds 4 columns, and covers every card at some row count", () => {
    for (const size of [
      { width: 1870, height: 1050 },
      { width: 390, height: 844 },
    ]) {
      const layout = tableSetupLayout({ ...REALISTIC, ...size });
      expect(layout.modularColumns).toBeLessThanOrEqual(4);
      expect(layout.modularColumns * layout.modularRows).toBeGreaterThanOrEqual(REALISTIC.modularCardCount);
    }
  });

  test("seed and reroll sit side by side, sharing one row, above Deal it out", () => {
    for (const size of SIZES) {
      const layout = tableSetupLayout({ ...REALISTIC, width: size.width, height: size.height });
      expect(layout.seed.y).toBe(layout.reroll.y);
      expect(layout.seed.x + layout.seed.width).toBeLessThanOrEqual(layout.reroll.x);
      expect(layout.seed.y + layout.seed.height).toBeLessThanOrEqual(layout.dealItOut.y + 0.01);
    }
  });

  test("wide: Random is a real control on the seating header's own line; narrow: it's unused (zero area)", () => {
    const wide = tableSetupLayout({ ...REALISTIC, width: 1440, height: 900 });
    expect(wide.randomControl.width).toBeGreaterThan(0);
    const narrow = tableSetupLayout({ ...REALISTIC, width: 390, height: 844 });
    expect(narrow.randomControl.width).toBe(0);
  });

  test("wide: the option cards and The Hood's own modular sets are absent unless offered", () => {
    const plain = tableSetupLayout({ ...REALISTIC, width: 1440, height: 900 });
    expect(plain.optionCards).toEqual([]);
    expect(plain.hoodHeader.height).toBe(0);
    expect(plain.hoodGrid.height).toBe(0);

    const withBoth = tableSetupLayout({
      ...REALISTIC,
      width: 1440,
      height: 900,
      optionSpans: [1, 1],
      hoodSetCount: 9,
    });
    expect(withBoth.optionCards).toHaveLength(2);
    expect(withBoth.hoodHeader.height).toBeGreaterThan(0);
    expect(withBoth.hoodGrid.height).toBeGreaterThan(0);
    expect(withBoth.hoodHeader.y).toBeGreaterThan(withBoth.modularGrid.y);
    expect(withBoth.hoodColumns).toBeLessThanOrEqual(4);
    expect(withBoth.hoodColumns * withBoth.hoodRows).toBeGreaterThanOrEqual(9);
    // Narrow (tablet portrait) draws the option cards too, but not The Hood's own set picker.
    const narrowWithBoth = tableSetupLayout({
      ...REALISTIC,
      width: 768,
      height: 1024,
      optionSpans: [1, 1],
      hoodSetCount: 9,
    });
    expect(narrowWithBoth.optionCards).toHaveLength(2);
    expect(narrowWithBoth.hoodHeader.height).toBe(0);
  });

  test("option cards: two one-column cards share a row, a two-column card takes a row of its own, all under the difficulty row", () => {
    for (const size of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
    ]) {
      const layout = tableSetupLayout({ ...REALISTIC, ...size, optionSpans: [1, 1, 1, 2] });
      const [a, b, c, d] = layout.optionCards as [Rect, Rect, Rect, Rect];
      expect(a.y).toBe(b.y);
      expect(a.x + a.width).toBeLessThan(b.x);
      expect(c.y).toBeGreaterThan(a.y);
      expect(c.width).toBe(a.width);
      expect(d.y).toBeGreaterThan(c.y);
      expect(d.width).toBe(layout.difficultyRow.width);
      expect(a.y).toBeGreaterThanOrEqual(layout.difficultyRow.y + layout.difficultyRow.height);
      noOverlap({ ...REALISTIC, ...size, optionSpans: [1, 1, 1, 2] });
    }
  });

  test("option cards: a lone one-column card is half-width and a two-column card right after it starts a new row", () => {
    const layout = tableSetupLayout({ ...REALISTIC, width: 1440, height: 900, optionSpans: [1, 2] });
    const [a, b] = layout.optionCards as [Rect, Rect];
    expect(a.width).toBeLessThan(b.width);
    expect(b.y).toBeGreaterThan(a.y);
  });

  test("panel row budgets never exceed what was asked for, and are never negative", () => {
    for (const size of SIZES) {
      const layout = tableSetupLayout({ ...REALISTIC, width: size.width, height: size.height });
      const [composition, whatsInThere, nemesis] = layout.encounterPanels.rowBudgets;
      expect(composition).toBeGreaterThanOrEqual(0);
      expect(composition).toBeLessThanOrEqual(REALISTIC.compositionRows);
      expect(whatsInThere).toBeGreaterThanOrEqual(0);
      expect(whatsInThere).toBeLessThanOrEqual(REALISTIC.whatsInThereRows);
      expect(nemesis).toBeGreaterThanOrEqual(0);
      expect(nemesis).toBeLessThanOrEqual(REALISTIC.nemesisLines);
    }
  });
});

/** Phone (2026-09-18 correction): P12's own scrolling page, never trimmed. */
const COMPACT_SIZES: readonly { readonly name: string; readonly width: number; readonly height: number }[] = [
  { name: "phone 390x844", width: 390, height: 844 },
  { name: "narrow phone 360x740", width: 360, height: 740 },
];

const COMPACT_SEAT_COUNTS = [1, 4] as const;

function compactInputFor(width: number, height: number, seatCount: 1 | 4): TableSetupCompactLayoutInput {
  return {
    width,
    height,
    difficultyIds: ["standard", "expert"],
    requiredModularIds: ["rhino"],
    candidateModularIds: ["bomb_scare", "masters_of_evil", "under_attack", "legions_of_hydra", "the_doomsday_chair"],
    modularHeaderRightLabel: "1 REQUIRED · 1 CHOSEN",
    optionRows: [],
    hasTowerDefenseSetupDamage: false,
    hoodSetIds: [],
    seatCount,
    compositionRows: 4,
    whatsInThereRows: 5,
    hasNemesisStandby: true,
  };
}

describe("tableSetupCompactLayout", () => {
  for (const size of COMPACT_SIZES) {
    for (const seatCount of COMPACT_SEAT_COUNTS) {
      test(`no overlap among fixed screen elements at ${size.name}, ${seatCount} seat(s)`, () => {
        const layout = tableSetupCompactLayout(compactInputFor(size.width, size.height, seatCount));
        // back/step sit *inside* headerBar and footerSummary/dealItOut sit *inside* footer by design (they're
        // drawn on those grounds) — only siblings drawn on the same ground should never overlap each other.
        expect(rectsOverlap(layout.back, layout.step)).toBe(false);
        expect(rectsOverlap(layout.footerSummary, layout.dealItOut)).toBe(false);
        expect(rectsOverlap(layout.headerBar, layout.viewport)).toBe(false);
        expect(rectsOverlap(layout.viewport, layout.footer)).toBe(false);
        expect(rectsOverlap(layout.headerBar, layout.footer)).toBe(false);
      });

      test(`the footer never overlaps the scroll region at ${size.name}, ${seatCount} seat(s)`, () => {
        const layout = tableSetupCompactLayout(compactInputFor(size.width, size.height, seatCount));
        expect(layout.footer.y).toBeGreaterThanOrEqual(layout.viewport.y + layout.viewport.height - 0.01);
      });

      test(`content rows never overlap each other at ${size.name}, ${seatCount} seat(s)`, () => {
        const layout = tableSetupCompactLayout(compactInputFor(size.width, size.height, seatCount));
        const rects = compactRowRects(layout);
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
          }
        }
      });

      test(`content is taller than the viewport, so it genuinely scrolls, at ${size.name}, ${seatCount} seat(s)`, () => {
        const layout = tableSetupCompactLayout(compactInputFor(size.width, size.height, seatCount));
        expect(layout.contentHeight - layout.viewport.height).toBeGreaterThan(0);
      });

      test(`nothing is trimmed to zero rows at ${size.name}, ${seatCount} seat(s)`, () => {
        const layout = tableSetupCompactLayout(compactInputFor(size.width, size.height, seatCount));
        // Every modular set (required + candidate) gets its own real row — none dropped for space.
        expect(layout.rows.filter((r) => r.id.startsWith("modular:")).length).toBe(1 + 5);
        // The encounter panel is sized for its own full row count (composition + what's-in-there + standby), not a floor.
        const encounterRow = layout.rows.find((r) => r.id === "encounterPanel")!;
        expect(encounterRow.height).toBeGreaterThan((4 + 5 + 1) * 18);
      });
    }
  }

  test("every candidate modular row's id matches the exact 'modular:<id>' shape tableSetupFocusOrder's own stop ids use", () => {
    const layout = tableSetupCompactLayout(compactInputFor(390, 844, 4));
    expect(compactRowIndex(layout, "modular:bomb_scare")).toBeGreaterThanOrEqual(0);
    expect(compactRowIndex(layout, "modular:not-a-real-id")).toBe(-1);
  });

  test("the modular header's right label moves to its own line when it wouldn't fit inline, growing that row's own height", () => {
    const narrow = tableSetupCompactLayout({
      ...compactInputFor(360, 740, 1),
      modularHeaderRightLabel: "1 REQUIRED · 1 CHOSEN",
    });
    const wide = tableSetupCompactLayout({ ...compactInputFor(390, 844, 1), modularHeaderRightLabel: "" });
    expect(wide.modularHeaderStacked).toBe(false);
    const header = narrow.rows.find((r) => r.id === "header:modular")!;
    const headerNoLabel = wide.rows.find((r) => r.id === "header:modular")!;
    if (narrow.modularHeaderStacked) expect(header.height).toBeGreaterThan(headerNoLabel.height);
  });

  test("sectionHeaderInlineFits: a short heading with no label always fits; a long label at a narrow width doesn't", () => {
    expect(sectionHeaderInlineFits(400, "DIFFICULTY", "")).toBe(true);
    expect(sectionHeaderInlineFits(120, "MODULAR SETS", "1 REQUIRED · 1 CHOSEN")).toBe(false);
  });

  test("a solo game (one seat) is exactly as tall as a four-seat game — the first-player row is one fixed-height row of chips either way", () => {
    const solo = tableSetupCompactLayout(compactInputFor(390, 844, 1));
    const full = tableSetupCompactLayout(compactInputFor(390, 844, 4));
    expect(solo.contentHeight).toBe(full.contentHeight);
  });

  test("a stacked modular header's label wraps to a second line when it is longer than the column, and the row grows for it", () => {
    expect(stackedHeaderLabelLines(358, "1 REQUIRED · 1 CHOSEN")).toBe(1);
    const mojo = "1 required · 2 set aside at random · one joins at random at setup";
    expect(stackedHeaderLabelLines(358, mojo)).toBe(2);
    const base = compactInputFor(390, 844, 1);
    const short = tableSetupCompactLayout({ ...base, modularHeaderRightLabel: "1 REQUIRED · 1 CHOSEN" });
    const long = tableSetupCompactLayout({ ...base, modularHeaderRightLabel: mojo });
    const rowOf = (layout: typeof short) => layout.rows.find((row) => row.id === "header:modular")!;
    expect(long.modularHeaderStacked).toBe(true);
    expect(rowOf(long).height).toBeGreaterThan(rowOf(short).height);
  });
});

/** Rhino's picker with every pack open: one required set, the recommended group, then seven cycle groups, 62 tiles in all. */
const MANY_SECTIONS = [
  { id: "required", label: null, itemCount: 1 },
  { id: "recommended", label: "Recommended · 1", itemCount: 1 },
  { id: "core", label: "Core Set · 4", itemCount: 4 },
  { id: "wave1", label: "Wave 1 · 4", itemCount: 4 },
  { id: "cycle1", label: "The Rise of Red Skull · 6", itemCount: 6 },
  { id: "cycle3", label: "The Galaxy's Most Wanted · 6", itemCount: 6 },
  { id: "cycle4", label: "The Mad Titan's Shadow · 15", itemCount: 15 },
  { id: "cycle5", label: "Sinister Motives · 9", itemCount: 9 },
  { id: "cycle6", label: "Mutant Genesis · 16", itemCount: 16 },
] as const;
const MANY_COUNT = MANY_SECTIONS.reduce((sum, s) => sum + s.itemCount, 0);

describe("tableSetupLayout: a modular grid of dozens of sets scrolls inside its panel", () => {
  const manyInput = (width: number, height: number): TableSetupLayoutInput => ({
    ...REALISTIC,
    width,
    height,
    modularCardCount: MANY_COUNT,
    modularSections: MANY_SECTIONS,
  });

  for (const size of SIZES.filter((s) => s.width >= 700)) {
    test(`${size.name}: the panel stays inside the page, scrolls, and nothing overlaps`, () => {
      noOverlap(manyInput(size.width, size.height));
      const layout = tableSetupLayout(manyInput(size.width, size.height));
      expect(layout.modularScrolls).toBe(true);
      expect(layout.modularPlan.contentHeight).toBeGreaterThan(layout.modularGrid.height);
      // The page does not grow: the whole body, panels included, still ends above the bottom edge.
      const bottom = Math.max(...tableSetupLayoutRects(layout).map((r) => r.y + r.height));
      expect(bottom).toBeLessThanOrEqual(size.height);
      // At least two rows of tiles stay in view, and the encounter panels keep room to read.
      expect(layout.modularGrid.height).toBeGreaterThanOrEqual(2 * 58);
      expect(layout.encounterPanels.composition.height).toBeGreaterThan(60);
    });
  }

  test("every tile fits inside the panel's width, leaving the scrollbar its room", () => {
    const layout = tableSetupLayout(manyInput(1440, 900));
    for (const cell of layout.modularPlan.cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.x + cell.width).toBeLessThanOrEqual(layout.modularGrid.width - 10 + 0.01);
    }
    expect(layout.modularPlan.cells).toHaveLength(MANY_COUNT);
  });

  test("a short list (one group of six) does not scroll and keeps its natural height", () => {
    const layout = tableSetupLayout({
      ...REALISTIC,
      width: 1440,
      height: 900,
      modularSections: [{ id: "recommended", label: "Recommended · 6", itemCount: 6 }],
    });
    expect(layout.modularScrolls).toBe(false);
    expect(layout.modularGrid.height).toBe(layout.modularPlan.contentHeight);
  });

  test("the Hood's own section below it still fits without overlap", () => {
    noOverlap({ ...manyInput(1440, 900), hoodSetCount: 9 });
  });
});

describe("tableSetupCompactLayout: folded modular groups", () => {
  test("a group row stands before its sets, and a folded group's sets are not rows at all", () => {
    const base = compactInputFor(390, 844, 1);
    const layout = tableSetupCompactLayout({
      ...base,
      candidateModularIds: ["a", "b", "c"],
      candidateModularEntries: [
        { kind: "group", id: "recommended" },
        { kind: "set", id: "a" },
        { kind: "group", id: "wave1" },
      ],
    });
    const ids = layout.rows.map((r) => r.id).filter((id) => id.startsWith("modular"));
    expect(ids).toEqual(expect.arrayContaining(["modulargroup:recommended", "modular:a", "modulargroup:wave1"]));
    expect(ids).not.toContain("modular:b");
    expect(compactRowIndex(layout, "modulargroup:recommended")).toBeLessThan(compactRowIndex(layout, "modular:a"));
  });
});

/**
 * The Standard / Expert set chips folded into the difficulty row (owner decision 2026-10-08): the page the set row cost
 * a 56px row on, at the sizes the owner named. The Four Horsemen page is the worst case: a Horsemen's-sides card under
 * the difficulty row, and a modular grid of a required set, two recommended and Longshot.
 */
describe("tableSetupLayout: the set choices live in the difficulty row", () => {
  const HORSEMEN: Omit<TableSetupLayoutInput, "width" | "height"> = {
    difficultyCount: 2,
    modularCardCount: 4,
    seatCount: 1,
    compositionRows: 6,
    whatsInThereRows: 5,
    nemesisLines: 3,
    modularSections: [
      { id: "required", label: null, itemCount: 1 },
      { id: "recommended", label: "Recommended · 2", itemCount: 2 },
      { id: "extras", label: "Extras · 1", itemCount: 1 },
    ],
    optionSpans: [2],
    optionGroupCounts: [4],
    setChoiceRows: 1,
  };
  /** The same page with the set row as an option card of its own, which is what the page used to cost. */
  const SEPARATE: Omit<TableSetupLayoutInput, "width" | "height"> = {
    ...HORSEMEN,
    optionSpans: [1, 2],
    optionGroupCounts: [0, 4],
    setChoiceRows: 0,
  };
  const bottomOf = (r: Rect): number => r.y + r.height;
  const WIDE_AND_NARROW = [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
  ];

  for (const size of WIDE_AND_NARROW) {
    test(`${size.width}x${size.height}: the set card sits inside the difficulty row beside the cards, and nothing overlaps`, () => {
      noOverlap({ ...HORSEMEN, ...size });
      const layout = tableSetupLayout({ ...HORSEMEN, ...size });
      expect(layout.difficultySlots).toBe(3);
      expect(layout.setsCard.y).toBe(layout.difficultyRow.y);
      expect(bottomOf(layout.setsCard)).toBeLessThanOrEqual(bottomOf(layout.difficultyRow));
      expect(layout.setsCard).toEqual(difficultySlotRect(layout.difficultyRow, 3, 2));
      // The option cards start right under the difficulty row: no row of its own for the set choice.
      expect(layout.optionCards[0]!.y).toBeLessThanOrEqual(bottomOf(layout.difficultyRow) + 12);
      expect(layout.optionCards).toHaveLength(1);
    });
  }

  test("1280x720, the Four Horsemen page: the modular grid and the encounter panels fit above the bottom edge", () => {
    const layout = tableSetupLayout({ ...HORSEMEN, width: 1280, height: 720 });
    expect(bottomOf(layout.encounterPanels.composition)).toBeLessThanOrEqual(720 - 24);
    // Two tiles' rows stay in view in the grid, and the panels keep at least two body rows each.
    expect(layout.modularGrid.height).toBeGreaterThanOrEqual(2 * 58);
    expect(Math.min(...layout.encounterPanels.rowBudgets)).toBeGreaterThanOrEqual(2);
    // The same page with a row of its own for the set choice leaves the panels no body rows at all.
    const separate = tableSetupLayout({ ...SEPARATE, width: 1280, height: 720 });
    expect(Math.max(...separate.encounterPanels.rowBudgets)).toBe(0);
    expect(layout.encounterPanels.composition.height).toBeGreaterThan(separate.encounterPanels.composition.height);
  });

  test("tablet portrait: the Four Horsemen page keeps panel rows the separate row took away", () => {
    const layout = tableSetupLayout({ ...HORSEMEN, width: 768, height: 1024 });
    const separate = tableSetupLayout({ ...SEPARATE, width: 768, height: 1024 });
    expect(Math.min(...layout.encounterPanels.rowBudgets)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...separate.encounterPanels.rowBudgets)).toBe(0);
    expect(layout.difficultyRow.height).toBeLessThan(80);
  });

  test("a set card is a full touch target: every chip row is hit.target tall, wide (beside) and narrow (over)", () => {
    for (const rows of [1, 2]) {
      for (const inline of [true, false]) {
        const card = { x: 0, y: 0, width: inline ? 294 : 215, height: setsCardHeight(rows, inline) };
        const rects = setChoiceRowRects(card, rows, inline);
        expect(rects).toHaveLength(rows);
        for (const row of rects) {
          expect(row.chips.height).toBe(hit.target);
          expect(row.chips.y).toBeGreaterThanOrEqual(card.y);
          expect(bottomOf(row.chips)).toBeLessThanOrEqual(bottomOf(card));
        }
        if (rows === 2) expect(rects[1]!.chips.y).toBeGreaterThanOrEqual(bottomOf(rects[0]!.chips));
      }
    }
    expect(setsCardHeight(0, true)).toBe(0);
  });

  test("a one-row set card fits the difficulty card height on every width; two rows grow the row to fit", () => {
    expect(setsCardHeight(1, true)).toBeLessThanOrEqual(76);
    expect(setsCardHeight(1, false)).toBeLessThanOrEqual(76);
    const two = tableSetupLayout({ ...HORSEMEN, width: 1440, height: 900, setChoiceRows: 2 });
    expect(two.setsInline).toBe(true);
    expect(two.difficultyRow.height).toBe(setsCardHeight(2, true));
    expect(two.setsCard.height).toBe(two.difficultyRow.height);
    expect(setsCardInline(294)).toBe(true);
    expect(setsCardInline(209)).toBe(false);
  });

  test("three difficulties have no spare slot: the set choices get a strip under the cards", () => {
    for (const size of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
    ]) {
      const input = { ...HORSEMEN, ...size, difficultyCount: 3, optionSpans: [] as (1 | 2)[], optionGroupCounts: [] };
      const layout = tableSetupLayout(input);
      expect(layout.difficultySlots).toBe(3);
      expect(layout.setsCard.y).toBeGreaterThanOrEqual(bottomOf(layout.difficultyRow));
      expect(layout.setsCard.width).toBe(layout.difficultyRow.width);
      noOverlap(input);
    }
  });

  test("no set choices: the layout is the difficulty row alone, as before", () => {
    const layout = tableSetupLayout({ ...REALISTIC, width: 1440, height: 900 });
    expect(layout.setsCard.height).toBe(0);
    expect(layout.difficultyRow.height).toBe(76);
  });

  test("the Horsemen's A/B chips are 44px: the card holds a hit.target of chip inside its padding", () => {
    // Beside the label (a wide card) or over it (a narrow one), the card is tall enough for a 44px chip row.
    expect(OPTION_CARD_HEIGHT - 16).toBeGreaterThanOrEqual(hit.target);
    expect(OPTION_GROUPS_STACKED_HEIGHT - 8 - 14 - 2 - 8).toBeGreaterThanOrEqual(hit.target);
    expect(optionGroupsStacked(908, 4)).toBe(false);
    expect(optionGroupsStacked(720, 4)).toBe(true);
    const wide = tableSetupLayout({ ...HORSEMEN, width: 1440, height: 900 });
    expect(wide.optionCards[0]!.height).toBe(OPTION_CARD_HEIGHT);
    const narrow = tableSetupLayout({ ...HORSEMEN, width: 768, height: 1024 });
    expect(narrow.optionCards[0]!.height).toBe(OPTION_GROUPS_STACKED_HEIGHT);
  });

  test("the option cards' own rows: a stepper and a toggle share a row at the card height", () => {
    const layout = tableSetupLayout({
      ...REALISTIC,
      width: 1440,
      height: 900,
      optionSpans: [1, 1],
      optionGroupCounts: [0, 0],
    });
    const [a, b] = layout.optionCards as [Rect, Rect];
    expect(a.height).toBe(OPTION_CARD_HEIGHT);
    expect(b.y).toBe(a.y);
  });

  test("phone: a set row is one 44px chip row (not the 76px name-over-chips row), and the Horsemen's chips are 44px", () => {
    expect(COMPACT_SET_CHOICE_HEIGHT).toBeGreaterThanOrEqual(hit.target);
    expect(COMPACT_SET_CHOICE_HEIGHT).toBeLessThan(compactOptionHeight("groups", 1));
    const input = (optionRows: TableSetupCompactLayoutInput["optionRows"]) => ({
      ...compactInputFor(390, 844, 1),
      optionRows,
    });
    const without = tableSetupCompactLayout(input([]));
    const withSet = tableSetupCompactLayout(input([{ id: "standardSet", height: COMPACT_SET_CHOICE_HEIGHT }]));
    expect(withSet.contentHeight - without.contentHeight).toBe(COMPACT_SET_CHOICE_HEIGHT + 10);
    // Two rows of two Horsemen, each cell a label and a full chip row.
    expect(compactOptionHeight("groups", 4)).toBeGreaterThanOrEqual(28 + 2 * (14 + hit.target));
  });
});

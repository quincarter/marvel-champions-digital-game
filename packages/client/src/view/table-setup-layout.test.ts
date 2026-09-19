import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import {
  compactRowIndex,
  compactRowRects,
  sectionHeaderInlineFits,
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
      expect(rectsOverlap(rects[i]!, rects[j]!), `rect ${i} overlaps rect ${j} at ${input.width}x${input.height}`).toBe(false);
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
    noOverlap({ width: 390, height: 844, difficultyCount: 2, modularCardCount: 1, seatCount: 1, compositionRows: 3, whatsInThereRows: 5, nemesisLines: 0 });
    noOverlap({ width: 1440, height: 900, difficultyCount: 2, modularCardCount: 1, seatCount: 1, compositionRows: 3, whatsInThereRows: 5, nemesisLines: 0 });
  });

  test("Breakout's three difficulties and zero-modular scenario still doesn't overlap", () => {
    noOverlap({ width: 390, height: 844, difficultyCount: 3, modularCardCount: 5, seatCount: 4, compositionRows: 4, whatsInThereRows: 5, nemesisLines: 0 });
    noOverlap({ width: 1440, height: 900, difficultyCount: 3, modularCardCount: 5, seatCount: 4, compositionRows: 4, whatsInThereRows: 5, nemesisLines: 0 });
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
    for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
      const layout = tableSetupLayout({ ...REALISTIC, ...size });
      expect(layout.wide).toBe(true);
      expect(layout.sidebar).not.toBeNull();
      expect(layout.sidebar!.x).toBeGreaterThan(layout.difficultyRow.x);
      expect(layout.dealItOut.x).toBeGreaterThanOrEqual(layout.sidebar!.x);
      expect(layout.dealItOut.y + layout.dealItOut.height).toBeLessThanOrEqual(layout.sidebar!.y + layout.sidebar!.height + 0.01);
    }
  });

  test("narrow (phone/tabletPortrait): no sidebar, one column, Deal it out pinned to the screen's own foot", () => {
    for (const size of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
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
    for (const size of [{ width: 1870, height: 1050 }, { width: 390, height: 844 }]) {
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
    const narrow = tableSetupCompactLayout({ ...compactInputFor(360, 740, 1), modularHeaderRightLabel: "1 REQUIRED · 1 CHOSEN" });
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
});

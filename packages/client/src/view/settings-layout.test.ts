import { describe, expect, test } from "vitest";
import { SAVE_DATA_ROW_DETAIL } from "./save-data-model.js";
import { rectsOverlap } from "./layout.js";
import { settingsLayout, settingsLayoutRects } from "./settings-layout.js";

/** docs/phase4-screen-gaps.md §0/§5: phone, tablet portrait/landscape and desktop. */
const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "small desktop", width: 800, height: 600 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
];

/**
 * The real detail strings `scenes/settings.ts` draws — not placeholders —
 * so this test exercises the width the fidelity pass found broken:
 * "Reduced motion"'s three-line description at phone width used to run into
 * "Sharper text"'s own heading below it.
 */
const ROW_DETAILS = [
  "Skip travel animation and auto-advancing reveals; beats and state changes still appear, just without the motion.",
  "Renders text at the screen's own pixel density. Off trades a little crispness for less texture memory.",
  "Reads a card's full rules text larger in the Inspect sheet — the screen whose whole job is reading a card closely.",
  "Sound isn't built yet (PLAN.md Phase 8).",
];

/** `guideRowInfoOf`'s own rows after "Guide level" (docs/guided-mode.md §4 G2b) — the real detail strings. */
const GUIDE_ROW_DETAILS = [
  "A short scripted first game against Rhino with Spider-Man — five lessons long.",
  "What each aspect is for, when to pick it, and a couple of signature cards.",
  "Catches ending your turn when the main scheme would finish next villain phase.",
  "Catches ending your turn in hero form with no ready defender against a lethal-looking attack.",
  "Catches flipping to (or staying in) alter-ego when the scheme would complete from it.",
  "Catches a payment that spends more than a card costs, or skips a cheaper card that would cover it.",
];

describe("settingsLayout", () => {
  for (const { name, width, height } of SIZES) {
    test(`no two Table rows overlap, and none overlaps the "Table" heading above them, at ${name}`, () => {
      // `content`'s own rects are in content space (`y` from the body's own top, `0`) — a separate coordinate
      // space from the screen-space `header`/`bodyViewport` (`view/settings-layout.ts`'s own doc comment), so
      // only rects within `content` are compared against each other here.
      const layout = settingsLayout({ x: 0, y: 0, width, height }, ROW_DETAILS);
      const { content } = layout;
      for (const row of content.rows) {
        expect(rectsOverlap(row, content.tableHeading)).toBe(false);
      }
      for (let i = 0; i < content.rows.length; i++) {
        for (let j = i + 1; j < content.rows.length; j++) {
          expect(rectsOverlap(content.rows[i]!, content.rows[j]!)).toBe(false);
        }
      }
    });

    test(`the one body viewport stays within the panel, and never overlaps the header, at ${name}`, () => {
      const layout = settingsLayout({ x: 0, y: 0, width, height }, ROW_DETAILS);
      for (const rect of settingsLayoutRects(layout)) {
        expect(rect.x).toBeGreaterThanOrEqual(layout.panel.x);
        expect(rect.x + rect.width).toBeLessThanOrEqual(layout.panel.x + layout.panel.width + 0.001);
      }
      expect(rectsOverlap(layout.bodyViewport, layout.header)).toBe(false);
    });

    test(`every Table row is at least as tall as its own wrapped detail text needs, at ${name}`, () => {
      // Regression for the fidelity pass: a fixed row height sized for the
      // shortest detail let a longer one's wrapped lines run into the row below.
      const layout = settingsLayout({ x: 0, y: 0, width, height }, ROW_DETAILS);
      const { rows } = layout.content;
      for (let i = 0; i + 1 < rows.length; i++) {
        expect(rows[i]!.y + rows[i]!.height).toBeLessThanOrEqual(rows[i + 1]!.y);
      }
    });
  }

  test("grows to fit however many rows are asked for", () => {
    expect(settingsLayout({ x: 0, y: 0, width: 800, height: 600 }, []).content.rows).toHaveLength(0);
    expect(
      settingsLayout({ x: 0, y: 0, width: 800, height: 600 }, ["A.", "B.", "C.", "D.", "E."]).content.rows,
    ).toHaveLength(5);
  });

  test("the Unlocks and Save data rows are laid out after the toggles, ahead of the Guide group", () => {
    const details = [...ROW_DETAILS, "0 of 3 campaigns open.", SAVE_DATA_ROW_DETAIL];
    const layout = settingsLayout({ x: 0, y: 0, width: 390, height: 844 }, details, GUIDE_ROW_DETAILS);
    expect(layout.content.rows).toHaveLength(details.length);
    const last = layout.content.rows[details.length - 1]!;
    expect(last.y).toBeGreaterThan(layout.content.rows[details.length - 2]!.y);
    expect(last.y + last.height).toBeLessThanOrEqual(layout.content.guideHeading.y);
  });

  test("a short detail row is shorter than a long detail row at the same width", () => {
    const layout = settingsLayout({ x: 0, y: 0, width: 1440, height: 900 }, [
      "Short.",
      "This description is quite a bit longer, so it should wrap to more than one line and need a taller row than a short one-line description would.",
    ]);
    expect(layout.content.rows[1]!.height).toBeGreaterThan(layout.content.rows[0]!.height);
  });

  for (const { name, width, height } of SIZES) {
    test(`the Guide group's own content doesn't overlap the Table rows above it, at ${name}`, () => {
      const layout = settingsLayout({ x: 0, y: 0, width, height }, ROW_DETAILS, GUIDE_ROW_DETAILS);
      const { content } = layout;
      expect(content.guideRows).toHaveLength(GUIDE_ROW_DETAILS.length);
      for (const row of content.rows) {
        expect(rectsOverlap(content.guideHeading, row)).toBe(false);
        expect(rectsOverlap(content.guideLevelRow, row)).toBe(false);
      }
      expect(content.guideHeading.y).toBeGreaterThanOrEqual(
        content.rows.length > 0 ? content.rows[content.rows.length - 1]!.y : content.tableHeading.y,
      );
    });

    test(`the Guide group's own rows don't overlap each other, at ${name}`, () => {
      const layout = settingsLayout({ x: 0, y: 0, width, height }, ROW_DETAILS, GUIDE_ROW_DETAILS);
      const parts = [layout.content.guideHeading, layout.content.guideLevelRow, ...layout.content.guideRows];
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          expect(rectsOverlap(parts[i]!, parts[j]!)).toBe(false);
        }
      }
    });

    test(`no content row ever draws outside the content's own [0, totalHeight] span, at ${name}`, () => {
      const layout = settingsLayout({ x: 0, y: 0, width, height }, ROW_DETAILS, GUIDE_ROW_DETAILS);
      const { content } = layout;
      const all = [
        content.tableHeading,
        ...content.rows,
        content.guideHeading,
        content.guideLevelRow,
        ...content.guideRows,
      ];
      for (const rect of all) {
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.y + rect.height).toBeLessThanOrEqual(content.totalHeight + 0.001);
      }
    });

    test(`the segmented Guide-level row's three cells all fit inside the row's own content width, at ${name}`, () => {
      // Regression, 2026-09-26: the rightmost cell's own border used to land exactly on the row's own right edge,
      // which — once this group draws inside a masked scroll region — is also the mask's own edge, clipping the
      // border away entirely. The row itself has to stay within the content width for a caller's own edge inset
      // (`scenes/settings.ts`'s own `#drawGuideLevelRow`) to have any room to work with.
      const layout = settingsLayout({ x: 0, y: 0, width, height }, ROW_DETAILS, GUIDE_ROW_DETAILS);
      const { guideLevelRow: levelRow } = layout.content;
      expect(levelRow.x).toBeGreaterThanOrEqual(layout.content.tableHeading.x);
      expect(levelRow.x + levelRow.width).toBeLessThanOrEqual(
        layout.content.tableHeading.x + layout.content.tableHeading.width + 0.001,
      );
    });
  }

  test("the body viewport shrinks shorter than its own content once the panel runs out of room, at phone height", () => {
    // At a real phone height, the Table group + Unlocks row already use most of the panel, so the Guide group's
    // own six rows have to scroll rather than push the panel past the screen (the problem this viewport exists for).
    const layout = settingsLayout({ x: 0, y: 0, width: 390, height: 844 }, ROW_DETAILS, GUIDE_ROW_DETAILS);
    expect(layout.bodyViewport.height).toBeLessThan(layout.content.totalHeight);
    expect(layout.bodyViewport.y + layout.bodyViewport.height).toBeLessThanOrEqual(
      layout.panel.y + layout.panel.height + 0.001,
    );
  });

  test("the body viewport is exactly the content's own height when there's room to spare (no dead scroll space)", () => {
    const layout = settingsLayout({ x: 0, y: 0, width: 1440, height: 2000 }, ROW_DETAILS, GUIDE_ROW_DETAILS);
    expect(layout.bodyViewport.height).toBe(layout.content.totalHeight);
  });
});

describe("settingsLayout villain group", () => {
  const VILLAIN = {
    auto: "What happens once the villain phase has nothing left for you to answer.",
    hold: "Keep every revealed card on screen until you tap past it, even when you have no answer to it.",
    speed: "How long each step stays up while the phase runs on its own.",
    dock: "Desktop and tablet dock the villain phase on the right. Off draws it full screen, as now.",
  };
  for (const { name, width, height } of SIZES) {
    test(`villain rows and tiles do not overlap each other or Guide at ${name}`, () => {
      const { content } = settingsLayout({ x: 0, y: 0, width, height }, ROW_DETAILS, GUIDE_ROW_DETAILS, VILLAIN);
      const v = content.villain!;
      const stack = [v.heading, v.auto, v.hold, v.speed, v.dock, content.guideHeading];
      for (let i = 0; i < stack.length - 1; i++) expect(rectsOverlap(stack[i]!, stack[i + 1]!)).toBe(false);
      expect(v.heading.y).toBeGreaterThan(content.rows[content.rows.length - 1]!.y);
      for (const tile of v.autoTiles) {
        expect(tile.y).toBeGreaterThanOrEqual(v.auto.y);
        expect(tile.y + tile.height).toBeLessThanOrEqual(v.auto.y + v.auto.height + 0.001);
        expect(tile.x + tile.width).toBeLessThanOrEqual(v.auto.x + v.auto.width + 0.001);
      }
      expect(rectsOverlap(v.autoTiles[0]!, v.autoTiles[1]!)).toBe(false);
      expect(rectsOverlap(v.autoTiles[1]!, v.autoTiles[2]!)).toBe(false);
      expect(v.speedControl.x + v.speedControl.width).toBeLessThanOrEqual(v.speed.x + v.speed.width);
    });
  }

  test("tiles sit side by side on desktop and stack on a phone", () => {
    const desktop = settingsLayout({ x: 0, y: 0, width: 1440, height: 900 }, ROW_DETAILS, [], VILLAIN).content.villain!;
    expect(new Set(desktop.autoTiles.map((t) => t.y)).size).toBe(1);
    const phone = settingsLayout({ x: 0, y: 0, width: 390, height: 844 }, ROW_DETAILS, [], VILLAIN).content.villain!;
    expect(new Set(phone.autoTiles.map((t) => t.y)).size).toBe(3);
  });

  test("no villain group without details", () => {
    expect(settingsLayout({ x: 0, y: 0, width: 800, height: 600 }, ROW_DETAILS).content.villain).toBeNull();
  });
});

describe("settingsLayout card hover row", () => {
  const DETAIL = "With a mouse, rest on a card on the table to see it larger beside the pointer, with its state.";
  test("sits below the Table rows and above the villain group on desktop, control inside the row", () => {
    const { content } = settingsLayout({ x: 0, y: 0, width: 1440, height: 900 }, ROW_DETAILS, [], undefined, DETAIL);
    const hover = content.cardHover!;
    expect(hover.row.y).toBeGreaterThan(content.rows[content.rows.length - 1]!.y);
    expect(rectsOverlap(hover.row, content.rows[content.rows.length - 1]!)).toBe(false);
    expect(hover.control.x + hover.control.width).toBeLessThanOrEqual(hover.row.x + hover.row.width);
    expect(hover.control.y).toBeGreaterThanOrEqual(hover.row.y);
    expect(hover.control.y + hover.control.height).toBeLessThanOrEqual(hover.row.y + hover.row.height);
  });

  test("pushes the villain group down without overlapping it", () => {
    const villain = { auto: "a", hold: "h", speed: "s", dock: "d" };
    const { content } = settingsLayout({ x: 0, y: 0, width: 1440, height: 900 }, ROW_DETAILS, [], villain, DETAIL);
    expect(rectsOverlap(content.cardHover!.row, content.villain!.heading)).toBe(false);
    expect(content.villain!.heading.y).toBeGreaterThan(content.cardHover!.row.y);
  });

  test("absent on a phone and a tablet, which have no mouse popover, and without a detail", () => {
    for (const [width, height] of [
      [390, 844],
      [1024, 768],
    ] as const) {
      expect(
        settingsLayout({ x: 0, y: 0, width, height }, ROW_DETAILS, [], undefined, DETAIL).content.cardHover,
      ).toBeNull();
    }
    expect(settingsLayout({ x: 0, y: 0, width: 1440, height: 900 }, ROW_DETAILS).content.cardHover).toBeNull();
  });
});

describe("settingsLayout card size row", () => {
  const DETAIL = "Draws cards larger in the deck builder, collection and card lists so the text is easier to read.";
  test("is on every form factor, its control inside its row, below the Table rows and above the villain group", () => {
    const villain = { auto: "a", hold: "h", speed: "s", dock: "d" };
    for (const [width, height] of [
      [390, 844],
      [1024, 768],
      [1440, 900],
    ] as const) {
      const { content } = settingsLayout({ x: 0, y: 0, width, height }, ROW_DETAILS, [], villain, undefined, DETAIL);
      const size = content.cardSize!;
      const last = content.rows[content.rows.length - 1]!;
      expect(size.row.y).toBeGreaterThan(last.y);
      expect(rectsOverlap(size.row, last)).toBe(false);
      expect(rectsOverlap(size.row, content.villain!.heading)).toBe(false);
      expect(content.villain!.heading.y).toBeGreaterThan(size.row.y);
      expect(size.control.x).toBeGreaterThanOrEqual(size.row.x);
      expect(size.control.x + size.control.width).toBeLessThanOrEqual(size.row.x + size.row.width);
      expect(size.control.y + size.control.height).toBeLessThanOrEqual(size.row.y + size.row.height);
    }
  });

  test("sits below the hover row on desktop without overlapping it", () => {
    const { content } = settingsLayout(
      { x: 0, y: 0, width: 1440, height: 900 },
      ROW_DETAILS,
      [],
      undefined,
      "hover",
      DETAIL,
    );
    expect(rectsOverlap(content.cardHover!.row, content.cardSize!.row)).toBe(false);
    expect(content.cardSize!.row.y).toBeGreaterThan(content.cardHover!.row.y);
  });

  test("absent without a detail", () => {
    expect(settingsLayout({ x: 0, y: 0, width: 1440, height: 900 }, ROW_DETAILS).content.cardSize).toBeNull();
  });
});

describe("settingsLayout's First player token row", () => {
  const DETAIL =
    "How the token moves to a new first player: tossed, slid, bounced or spun across the table, or placed at once.";
  test("follows Card size on every form factor, its control inside its row, above the villain group", () => {
    const villain = { auto: "a", hold: "h", speed: "s", dock: "d" };
    for (const [width, height] of [
      [390, 844],
      [1024, 768],
      [1440, 900],
    ] as const) {
      const { content } = settingsLayout(
        { x: 0, y: 0, width, height },
        ROW_DETAILS,
        [],
        villain,
        undefined,
        "size",
        DETAIL,
      );
      const token = content.tokenMotion!;
      expect(token.row.y).toBeGreaterThan(content.cardSize!.row.y);
      expect(rectsOverlap(token.row, content.cardSize!.row)).toBe(false);
      expect(content.villain!.heading.y).toBeGreaterThan(token.row.y);
      expect(token.control.x).toBeGreaterThanOrEqual(token.row.x);
      expect(token.control.x + token.control.width).toBeLessThanOrEqual(token.row.x + token.row.width);
      expect(token.control.y + token.control.height).toBeLessThanOrEqual(token.row.y + token.row.height);
    }
  });

  test("absent without a detail", () => {
    expect(settingsLayout({ x: 0, y: 0, width: 1440, height: 900 }, ROW_DETAILS).content.tokenMotion).toBeNull();
  });
});

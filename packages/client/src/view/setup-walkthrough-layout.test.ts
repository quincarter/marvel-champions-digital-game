import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { setupWalkthroughLayout, setupWalkthroughLayoutRects } from "./setup-walkthrough-layout.js";

const SIZES: readonly { readonly width: number; readonly height: number }[] = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

describe("setupWalkthroughLayout", () => {
  // A five-label checklist wraps to two rows at some widths (`scenes/setup-deal.ts`'s own `wrapChipsToRows` call) —
  // both row counts are exercised at every size, since the phone composition has the least slack to absorb it.
  for (const checklistRows of [1, 2]) {
    for (const size of SIZES) {
      test(`no overlap at ${size.width}x${size.height}, 1 other seat, ${checklistRows} checklist row(s)`, () => {
        const layout = setupWalkthroughLayout({ ...size, otherSeatCount: 1, seatCount: 2, checklistRows });
        const rects = setupWalkthroughLayoutRects(layout);
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
          }
        }
      });

      test(`no overlap at ${size.width}x${size.height}, 3 other seats (a 4-player game), ${checklistRows} checklist row(s)`, () => {
        const layout = setupWalkthroughLayout({ ...size, otherSeatCount: 3, seatCount: 4, checklistRows });
        const rects = setupWalkthroughLayoutRects(layout);
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
          }
        }
      });

      test(`every rect stays within the viewport at ${size.width}x${size.height}, ${checklistRows} checklist row(s)`, () => {
        const layout = setupWalkthroughLayout({ ...size, otherSeatCount: 3, seatCount: 4, checklistRows });
        for (const rect of setupWalkthroughLayoutRects(layout)) {
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(size.width + 0.5);
          expect(rect.y + rect.height).toBeLessThanOrEqual(size.height + 0.5);
        }
      });
    }
  }

  test("a two-row checklist at phone width shrinks the hand row and revealed panel to stay on screen, never the checklist or the commit row's touch target", () => {
    const oneRow = setupWalkthroughLayout({
      width: 390,
      height: 844,
      otherSeatCount: 3,
      seatCount: 4,
      checklistRows: 1,
    });
    const twoRows = setupWalkthroughLayout({
      width: 390,
      height: 844,
      otherSeatCount: 3,
      seatCount: 4,
      checklistRows: 2,
    });
    expect(twoRows.checklist.height).toBeGreaterThan(oneRow.checklist.height);
    expect(twoRows.handRow.height).toBeLessThan(oneRow.handRow.height);
    expect(twoRows.commitRow.height).toBe(oneRow.commitRow.height);
    expect(twoRows.logPanel!.y + twoRows.logPanel!.height).toBeLessThanOrEqual(844.5);
  });

  test("the phone hand row never shrinks below a strip of readable full-height cards; the revealed panel gives first", () => {
    // The tightest phone case this screen is tested at: a 4-player game, a two-row checklist, a revealed setup card.
    const phone = setupWalkthroughLayout({
      width: 390,
      height: 844,
      otherSeatCount: 3,
      seatCount: 4,
      checklistRows: 2,
      hasRevealedCard: true,
    });
    expect(phone.handRow.height).toBeGreaterThanOrEqual(180);
    // The room came out of the revealed-card panel, not the commit row or the log's own floor.
    expect(phone.revealedPanel!.height).toBeLessThan(120);
    expect(phone.revealedPanel!.height).toBeGreaterThanOrEqual(70);
    expect(phone.logPanel!.height).toBeGreaterThanOrEqual(60);
    expect(phone.logPanel!.y + phone.logPanel!.height).toBeLessThanOrEqual(phone.commitRow.y);
  });

  test("when even the floors can't fit (a five-row checklist on a narrow phone), the strip floor gives way to the row floor before anything overflows", () => {
    const phone = setupWalkthroughLayout({
      width: 390,
      height: 844,
      otherSeatCount: 3,
      seatCount: 4,
      checklistRows: 5,
      hasRevealedCard: true,
    });
    expect(phone.handRow.height).toBe(120);
    expect(phone.revealedPanel!.height).toBe(70);
    // A four-row checklist with two other seats is the tightest case that still fits: the hand gives up its strip
    // floor only as far as needed.
    const tight = setupWalkthroughLayout({
      width: 390,
      height: 844,
      otherSeatCount: 2,
      seatCount: 3,
      checklistRows: 4,
      hasRevealedCard: true,
    });
    expect(tight.handRow.height).toBeGreaterThanOrEqual(120);
    expect(tight.handRow.height).toBeLessThan(180);
    expect(tight.logPanel!.y + tight.logPanel!.height).toBeLessThanOrEqual(tight.commitRow.y);
  });

  test("tablet landscape is the all-seats composition; every other size is the focus composition", () => {
    expect(setupWalkthroughLayout({ width: 1024, height: 768, otherSeatCount: 3, seatCount: 4 }).mode).toBe("allSeats");
    for (const size of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      expect(setupWalkthroughLayout({ ...size, otherSeatCount: 3, seatCount: 4 }).mode).toBe("focus");
    }
  });

  test("allSeats gives one column per seat, all the same width, none overlapping", () => {
    const layout = setupWalkthroughLayout({ width: 1024, height: 768, otherSeatCount: 3, seatCount: 4 });
    expect(layout.seatColumns).toHaveLength(4);
    const widths = new Set(layout.seatColumns.map((column) => Math.round(column.width)));
    expect(widths.size).toBe(1);
  });

  test("focus mode splits body and sidebar on tablet/desktop; phone stacks them", () => {
    const desktop = setupWalkthroughLayout({ width: 1440, height: 900, otherSeatCount: 3, seatCount: 4 });
    expect(desktop.split).toBe(true);
    expect(desktop.revealedPanel?.x).toBeGreaterThan(desktop.handRow.x);

    const phone = setupWalkthroughLayout({ width: 390, height: 844, otherSeatCount: 3, seatCount: 4 });
    expect(phone.split).toBe(false);
    expect(phone.revealedPanel?.y).toBeGreaterThan(phone.otherSeats.at(-1)?.y ?? 0);
  });

  test("the header bar spans the full width, above everything else", () => {
    const layout = setupWalkthroughLayout({ width: 1440, height: 900, otherSeatCount: 1, seatCount: 2 });
    expect(layout.headerBar).toEqual({ x: 0, y: 0, width: 1440, height: layout.headerBar.height });
    expect(layout.checklist.y).toBeGreaterThanOrEqual(layout.headerBar.height);
  });

  test("a solo game (no other seats) still lays out cleanly", () => {
    const layout = setupWalkthroughLayout({ width: 1440, height: 900, otherSeatCount: 0, seatCount: 1 });
    expect(layout.otherSeats).toHaveLength(0);
    expect(layout.revealedPanel).not.toBeNull();
  });

  test("fidelity pass (2026-09-18): other seats sit side by side in one row on tablet-portrait/desktop, same height, none overlapping", () => {
    const desktop = setupWalkthroughLayout({ width: 1440, height: 900, otherSeatCount: 3, seatCount: 4 });
    expect(desktop.otherSeats).toHaveLength(3);
    const heights = new Set(desktop.otherSeats.map((rect) => Math.round(rect.height)));
    expect(heights.size).toBe(1);
    // Side by side: every seat's row shares the same y, and none starts before the previous one ends.
    const ys = new Set(desktop.otherSeats.map((rect) => Math.round(rect.y)));
    expect(ys.size).toBe(1);
    for (let i = 1; i < desktop.otherSeats.length; i++) {
      expect(desktop.otherSeats[i]!.x).toBeGreaterThanOrEqual(
        desktop.otherSeats[i - 1]!.x + desktop.otherSeats[i - 1]!.width,
      );
    }
  });

  test("fidelity pass: other seats stack full-width on phone instead (no room for a row of three)", () => {
    const phone = setupWalkthroughLayout({ width: 390, height: 844, otherSeatCount: 3, seatCount: 4 });
    expect(phone.otherSeats).toHaveLength(3);
    const xs = new Set(phone.otherSeats.map((rect) => Math.round(rect.x)));
    expect(xs.size).toBe(1);
    for (let i = 1; i < phone.otherSeats.length; i++) {
      expect(phone.otherSeats[i]!.y).toBeGreaterThanOrEqual(
        phone.otherSeats[i - 1]!.y + phone.otherSeats[i - 1]!.height,
      );
    }
  });

  test("fidelity pass: the commit row is pinned to the bottom of the viewport on phone, not inline after the hand", () => {
    const phone = setupWalkthroughLayout({ width: 390, height: 844, otherSeatCount: 1, seatCount: 2 });
    expect(phone.commitSticky).toBe(true);
    expect(phone.commitRow.y + phone.commitRow.height).toBeLessThanOrEqual(844.5);
    expect(phone.commitRow.y + phone.commitRow.height).toBeGreaterThan(800);

    const desktop = setupWalkthroughLayout({ width: 1440, height: 900, otherSeatCount: 1, seatCount: 2 });
    expect(desktop.commitSticky).toBe(false);
  });

  test("fidelity pass: the revealed-card panel is short when nothing has been revealed yet, tall once something has", () => {
    const empty = setupWalkthroughLayout({
      width: 1440,
      height: 900,
      otherSeatCount: 1,
      seatCount: 2,
      hasRevealedCard: false,
    });
    const full = setupWalkthroughLayout({
      width: 1440,
      height: 900,
      otherSeatCount: 1,
      seatCount: 2,
      hasRevealedCard: true,
    });
    expect(empty.revealedPanel!.height).toBeLessThan(full.revealedPanel!.height);
    // The log panel absorbs the room the short panel frees up.
    expect(empty.logPanel!.height).toBeGreaterThan(full.logPanel!.height);
  });

  test("fidelity pass: titleRow sits inside the header bar, clear of its very top edge", () => {
    const layout = setupWalkthroughLayout({ width: 1440, height: 900, otherSeatCount: 1, seatCount: 2 });
    expect(layout.titleRow.y).toBeGreaterThan(0);
    expect(layout.titleRow.y + layout.titleRow.height).toBeLessThanOrEqual(layout.headerBar.height);
  });
});

describe("setupWalkthroughLayout at an enlarged Card size", () => {
  for (const cardScale of [1, 1.25, 1.5]) {
    for (const size of SIZES) {
      for (const otherSeatCount of [0, 1, 3]) {
        test(`x${cardScale} at ${size.width}x${size.height}, ${otherSeatCount} other seat(s): nothing overlaps and no card is cut off`, () => {
          const layout = setupWalkthroughLayout({
            ...size,
            otherSeatCount,
            seatCount: otherSeatCount + 1,
            cardScale,
          });
          // A phone's pinned commit row sits over the scrolling body by design.
          const rects = setupWalkthroughLayoutRects(layout).filter(
            (rect) => !(layout.commitSticky && rect === layout.commitRow),
          );
          for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
              expect(rectsOverlap(rects[i]!, rects[j]!), `${i}/${j}`).toBe(false);
            }
          }
          if (!layout.body) return; // tablet landscape: text rows, no cards to scale
          const { viewport, contentHeight } = layout.body;
          expect(viewport.y + viewport.height).toBeLessThanOrEqual(size.height);
          for (const rect of [layout.handRow, ...layout.otherSeats, layout.revealedPanel!, layout.logPanel!]) {
            expect(rect.x).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.width).toBeLessThanOrEqual(size.width + 0.5);
            // Every card either sits inside the body's content or the body scrolls to it.
            expect(rect.y + rect.height - viewport.y).toBeLessThanOrEqual(contentHeight + 0.5);
          }
          // At Fit to screen nothing needs scrolling (the squeeze-to-fit rules hold, as before).
          if (cardScale === 1 && layout.formFactor !== "phone") {
            expect(contentHeight).toBeLessThanOrEqual(viewport.height + 0.5);
          }
        });
      }
    }
  }

  test("the hand row, seat cards and revealed card grow with the scale on a desktop", () => {
    const at = (cardScale: number) =>
      setupWalkthroughLayout({ width: 1440, height: 900, otherSeatCount: 1, seatCount: 2, cardScale });
    expect(at(1.5).handRow.height).toBeCloseTo(at(1).handRow.height * 1.5);
    expect(at(1.5).otherSeats[0]!.height).toBeCloseTo(at(1).otherSeats[0]!.height * 1.5);
    expect(at(1.5).revealedPanel!.height).toBeGreaterThan(at(1).revealedPanel!.height);
  });

  test("an enlarged body that is taller than the screen reports it, so the scene scrolls it", () => {
    const layout = setupWalkthroughLayout({ width: 390, height: 844, otherSeatCount: 3, seatCount: 4, cardScale: 1.5 });
    expect(layout.body!.contentHeight).toBeGreaterThan(layout.body!.viewport.height);
  });
});

describe("the opening hand grows into the free space (desktop and tablet portrait)", () => {
  const base = { otherSeatCount: 1, seatCount: 2, handCount: 6 } as const;
  const at = (width: number, height: number, extra: object = {}) =>
    setupWalkthroughLayout({ width, height, ...base, ...extra });
  const CARD_W = 0.716;
  const cardsOf = (rect: { width: number; height: number }) => Math.min(rect.height, (rect.width - 40) / (6 * CARD_W));

  test("at 1920 x 1080 the hand spans the full width and its cards are taller than in the body column", () => {
    const wide = at(1920, 1080);
    const usual = setupWalkthroughLayout({ width: 1920, height: 1080, otherSeatCount: 1, seatCount: 2 });
    expect(wide.handRow.width).toBeGreaterThan(usual.handRow.width);
    expect(cardsOf(wide.handRow)).toBeGreaterThan(cardsOf(usual.handRow) * 1.1);
    expect(wide.handRow.height).toBeLessThanOrEqual(1080 / 2);
  });

  test("the commit row follows the cards, and the sidebar sits beside it and the other seats", () => {
    const layout = at(1920, 1080);
    expect(layout.commitRow.y).toBeGreaterThanOrEqual(layout.handRow.y + layout.handRow.height);
    expect(layout.revealedPanel!.y).toBe(layout.commitRow.y);
    expect(layout.revealedPanel!.x).toBeGreaterThan(layout.commitRow.x + layout.commitRow.width - 1);
    expect(layout.otherSeatsLabel.y).toBeGreaterThan(layout.commitRow.y);
  });

  test("nothing overlaps or leaves the screen, and nothing scrolls, at desktop sizes and seat counts", () => {
    for (const [width, height] of [
      [1280, 720],
      [1440, 900],
      [1920, 1080],
      [2560, 1440],
      [768, 1024],
    ] as const) {
      for (const otherSeatCount of [0, 1, 3]) {
        const layout = at(width, height, { otherSeatCount, seatCount: otherSeatCount + 1 });
        const rects = setupWalkthroughLayoutRects(layout);
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!), `${width}x${height} ${otherSeatCount} ${i}/${j}`).toBe(false);
          }
        }
        for (const rect of rects) {
          expect(rect.x + rect.width).toBeLessThanOrEqual(width + 0.5);
          expect(rect.y + rect.height).toBeLessThanOrEqual(height + 0.5);
        }
        expect(layout.body!.contentHeight).toBeLessThanOrEqual(layout.body!.viewport.height + 0.5);
      }
    }
  });

  test("a screen with no room to gain keeps the usual layout", () => {
    const short = at(1280, 600);
    const usual = setupWalkthroughLayout({ width: 1280, height: 600, otherSeatCount: 1, seatCount: 2 });
    expect(short.handRow).toEqual(usual.handRow);
  });

  test("a phone, an enlarged Card size and an unknown hand all keep the usual layout", () => {
    const phone = at(390, 844);
    expect(phone.handRow).toEqual(
      setupWalkthroughLayout({ width: 390, height: 844, otherSeatCount: 1, seatCount: 2 }).handRow,
    );
    const landscape = at(900, 420);
    expect(landscape.formFactor).toBe("phoneLandscape");
    expect(landscape.handRow).toEqual(
      setupWalkthroughLayout({ width: 900, height: 420, otherSeatCount: 1, seatCount: 2 }).handRow,
    );
    const big = at(1920, 1080, { cardScale: 1.5 });
    expect(big.handRow).toEqual(
      setupWalkthroughLayout({ width: 1920, height: 1080, otherSeatCount: 1, seatCount: 2, cardScale: 1.5 }).handRow,
    );
    const none = setupWalkthroughLayout({ width: 1920, height: 1080, otherSeatCount: 1, seatCount: 2 });
    expect(none.revealedPanel!.y).toBe(none.handLabel.y);
  });
});

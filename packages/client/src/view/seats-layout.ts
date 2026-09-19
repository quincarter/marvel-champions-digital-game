/**
 * Take your seats (docs/phase4-screen-gaps.md §3 W2/W2b, D03/P03/T-P02),
 * composition read off `docs/design-renders/ScreensDesktop_02-03.png`,
 * `ScreensTablet_01-02.png` and `ScreensPhone_00.png`, rebuilt 2026-09-18 and
 * revised the same day for the owner's second-pass notes (real gutters, a
 * fixed ~300px full-height side panel, taller seat cards, "Use
 * preconstructed" folded into the roster's own header row instead of its own
 * full-width strip):
 *
 * The same full-width **ink** header bar as Scenario select — Back (Bangers,
 * labelled with the chosen scenario's own name) and the Bangers page title on
 * the left, the step count on the right.
 *
 * **Wide (desktop/tabletLandscape): two columns.** On the left: four
 * equal-width, individually-selectable seat cards in one row (115px tall —
 * a portrait thumbnail, the seat label, the hero name, a meta line), a
 * `rosterHeader` row (the "HEROES — SEAT N OF 4" label on the left, the small
 * quiet "Use preconstructed for all seats" button right-aligned on the same
 * line), then the search field, the aspect/source chip strip, and the
 * pack-shelf hero roster (no boxed background of its own). On the right: a
 * **full-height ink** hero-detail panel, `DETAIL_WIDTH` wide, inset `GUTTER`,
 * with two actions pinned at its own foot.
 *
 * **Narrow (phone/tabletPortrait): one column**, stacked exactly as D02's own
 * narrow layout does.
 */
import { hit } from "../tokens.js";
import { chipStripHeight } from "./chip-layout.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";

export const MAX_SEATS = 4;
export const SEAT_SLOT_HEIGHT = 115;
export const DETAIL_LINE_HEIGHT = 20;
export const HEADER_HEIGHT = 64;
export const GUTTER = 24;
export const DETAIL_WIDTH = 300;
export const ROSTER_HEADER_HEIGHT = 26;
export const FOOTER_HEIGHT = 18;
const SHELVES_MIN_HEIGHT = 160;
const CTA_GAP = 10;

export interface SeatsLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly chipRows: number;
  readonly detailLines: number;
}

export interface SeatsLayout {
  readonly formFactor: FormFactor;
  readonly wide: boolean;
  readonly headerBar: Rect;
  readonly back: Rect;
  readonly step: Rect;
  readonly seatSlots: readonly Rect[];
  /** The "HEROES — SEAT N OF 4" / "Use preconstructed" row above the search field. */
  readonly rosterHeader: Rect;
  /** The small quiet "Use preconstructed for all seats" button, right-aligned within `rosterHeader`. */
  readonly usePreconstructed: Rect;
  readonly search: Rect;
  readonly chips: Rect;
  readonly shelves: Rect;
  readonly detail: Rect;
  /** The quiet "Play N heroes ▸" action, beside `deckCheck`. */
  readonly play: Rect;
  /** The primary "Deck check ▸" action. */
  readonly deckCheck: Rect;
}

/**
 * Every top-level region, for a no-overlap test. `play`/`deckCheck` are deliberately excluded: on a wide layout
 * they are pinned *inside* `detail`'s own foot by design, and on a narrow one they're the bottom-most row, already
 * guaranteed clear by construction. `usePreconstructed` is excluded too — it's inside `rosterHeader` by design.
 */
export function seatsLayoutRects(layout: SeatsLayout): readonly Rect[] {
  return [layout.back, layout.step, ...layout.seatSlots, layout.rosterHeader, layout.search, layout.chips, layout.shelves, layout.detail];
}

/**
 * The detail panel's own width, exposed so a caller can measure its hero-detail text's *real* wrapped line count
 * against this exact width before calling `seatsLayout` — see `view/scenario-select-layout.ts`'s own
 * `detailPanelWidthFor` (the identical fix, for the identical reason).
 */
export function detailPanelWidthFor(width: number, height: number): number {
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  const gutter = formFactor === "phone" ? 16 : GUTTER;
  return wide ? DETAIL_WIDTH : width - gutter * 2;
}

export function seatsLayout(input: SeatsLayoutInput): SeatsLayout {
  const { width, height } = input;
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  const gutter = formFactor === "phone" ? 16 : GUTTER;
  const gap = gutter;
  const smallGap = 8;

  const headerBar: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const headerPad = 16;
  const backWidth = 90;
  const stepWidth = Math.min(160, Math.max(90, width * 0.32));
  const back: Rect = { x: headerPad, y: (HEADER_HEIGHT - hit.target) / 2, width: backWidth, height: hit.target };
  const step: Rect = { x: width - headerPad - stepWidth, y: (HEADER_HEIGHT - hit.target) / 2, width: stepWidth, height: hit.target };

  const left = gutter;
  const detailWidth = detailPanelWidthFor(width, height);
  const shelvesWidth = wide ? width - gutter * 2 - gap - detailWidth : width - gutter * 2;

  const bodyTop = HEADER_HEIGHT + gutter;
  const bodyBottom = height - gutter;

  // Wide: one row of four. Narrow: 2×2 — four seat cards squeezed to ~85px wide each at phone width left no room
  // for the portrait thumbnail plus any text at all (second-pass fidelity pass: the name/meta text overlapped
  // between cards). A 2×2 grid keeps each card wide enough for its own content at every width.
  const seatCols = wide ? MAX_SEATS : 2;
  const seatRows = MAX_SEATS / seatCols;
  const slotWidth = (shelvesWidth - (seatCols - 1) * 6) / seatCols;
  const seatSlots: Rect[] = Array.from({ length: MAX_SEATS }, (_, i) => {
    const col = i % seatCols;
    const row = Math.floor(i / seatCols);
    return { x: left + col * (slotWidth + 6), y: bodyTop + row * (SEAT_SLOT_HEIGHT + 6), width: slotWidth, height: SEAT_SLOT_HEIGHT };
  });
  let y = bodyTop + seatRows * SEAT_SLOT_HEIGHT + (seatRows - 1) * 6 + smallGap;

  const usePreconstructedWidth = Math.min(230, shelvesWidth * 0.5);
  const rosterHeader: Rect = { x: left, y, width: shelvesWidth, height: ROSTER_HEADER_HEIGHT };
  const usePreconstructed: Rect = { x: rosterHeader.x + rosterHeader.width - usePreconstructedWidth, y: rosterHeader.y, width: usePreconstructedWidth, height: ROSTER_HEADER_HEIGHT };
  y += ROSTER_HEADER_HEIGHT + smallGap;

  const search: Rect = { x: left, y, width: shelvesWidth, height: hit.target };
  y += hit.target + smallGap;
  const chipsHeight = chipStripHeight(input.chipRows);
  const chips: Rect = { x: left, y, width: shelvesWidth, height: chipsHeight };
  y += chipsHeight + smallGap;

  const ctaHeight = hit.primary;
  const ctaWidth = (shelvesWidth - CTA_GAP) / 2;

  if (wide) {
    const detailHeight = bodyBottom - bodyTop;
    const shelves: Rect = { x: left, y, width: shelvesWidth, height: Math.max(SHELVES_MIN_HEIGHT, bodyBottom - y) };
    const detail: Rect = { x: left + shelvesWidth + gap, y: bodyTop, width: detailWidth, height: detailHeight };
    // Wide keeps the two actions stacked (quiet above primary) rather than squeezed side by side in a ~300px
    // panel, where neither label would read — the panel is narrower than the roster column the phone/tablet
    // pair shares the row across.
    const stacked = detail.width - 32;
    const ctaBlockHeight = ctaHeight * 2 + 8 + FOOTER_HEIGHT + 4;
    // "Play N heroes" is the way forward, so it takes the primary's place at the very foot; Deck check is the
    // optional look above it (owner, 2026-09-18: "Deck check shouldn't be the primary action").
    const deckCheck: Rect = { x: detail.x + 16, y: detail.y + detail.height - 16 - ctaBlockHeight, width: stacked, height: ctaHeight };
    const play: Rect = { x: detail.x + 16, y: deckCheck.y + ctaHeight + 8, width: stacked, height: ctaHeight };
    return { formFactor, wide, headerBar, back, step, seatSlots, rosterHeader, usePreconstructed, search, chips, shelves, detail, play, deckCheck };
  }

  // Clamped so `shelves` can never be squeezed below `SHELVES_MIN_HEIGHT` by an oversized detail panel — see
  // `view/scenario-select-layout.ts`'s identical fix and its own comment for why this has to account for every
  // fixed element between the detail block and the body's own bottom edge, not just the gap immediately below it.
  const rawDetailHeight = Math.max(DETAIL_LINE_HEIGHT, input.detailLines * DETAIL_LINE_HEIGHT) + 16;
  const maxDetailHeight = Math.max(DETAIL_LINE_HEIGHT + 16, bodyBottom - y - SHELVES_MIN_HEIGHT - gap - ctaHeight);
  const detailHeight = Math.min(rawDetailHeight, maxDetailHeight);
  const play: Rect = { x: left + ctaWidth + CTA_GAP, y: bodyBottom - ctaHeight, width: ctaWidth, height: ctaHeight };
  const deckCheck: Rect = { x: left, y: bodyBottom - ctaHeight, width: ctaWidth, height: ctaHeight };
  const detail: Rect = { x: left, y: play.y - gap - detailHeight, width: detailWidth, height: detailHeight };
  const shelvesHeight = Math.max(SHELVES_MIN_HEIGHT, detail.y - gap - y);
  const shelves: Rect = { x: left, y, width: shelvesWidth, height: shelvesHeight };
  return { formFactor, wide, headerBar, back, step, seatSlots, rosterHeader, usePreconstructed, search, chips, shelves, detail, play, deckCheck };
}

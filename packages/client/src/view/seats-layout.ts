/**
 * Take your seats (docs/phase4-screen-gaps.md §3 W2/W2b, D03/P03/T-P02),
 * composition read off `docs/design-renders/ScreensDesktop_02-03.png`,
 * `ScreensTablet_01-02.png` and `ScreensPhone_00.png`, rebuilt 2026-09-18 for
 * the owner's reopened brief (an active-seat model, pack shelves, a
 * full-height ink hero-detail panel, "Play N heroes" beside "Deck check ▸"):
 *
 * The same full-width **ink** header bar as Scenario select — Back (labelled
 * with the chosen scenario's own name, e.g. "◂ Klaw") and "TAKE YOUR SEATS" on
 * the left, the step count on the right.
 *
 * **Wide (desktop/tabletLandscape): two columns.** On the left: four
 * equal-width, individually-selectable seat cards in one row (T-P02's own
 * "SEAT 1 · YOU / SEAT 2 · AI / …", the *active* one ringed red — clicking one
 * makes it active, per `view/setup-draft.ts`'s `setActiveSeat`), a small quiet
 * "Use preconstructed for all seats" link, then the search field, the
 * aspect/source chip strip, and the pack-shelf hero roster (`ui/shelf-roster.ts`
 * over `view/roster-shelves.ts`, one shelf per hero pack — the roster picks a
 * hero *for the active seat*, `view/setup-draft.ts`'s `assignToActiveSeat`).
 * On the right: a **full-height ink** hero-detail panel (stats, obligation,
 * nemesis set — data only) with two actions pinned at its own foot, side by
 * side: a quiet "Play N heroes ▸" (straight to Table setup with today's
 * seating) and the primary "Deck check ▸" (the active seat's own deck,
 * `scenes/seats.ts`'s `goToDeckCheckOrTableSetup`).
 *
 * **Narrow (phone/tabletPortrait): one column**, stacked exactly as D02's own
 * narrow layout does: seat row, the link, search, chips, the shelf roster
 * (scrolls; no more "how many rows fit" arithmetic), the ink detail block
 * sized to its own content, then the same two actions as one full-width row
 * at the screen's own foot — P03's own "PLAY 3" / "DECK CHECK ▸" pair.
 */
import { hit } from "../tokens.js";
import { chipStripHeight } from "./chip-layout.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";
import { LABEL_ROOM, setupMetrics } from "./setup-metrics.js";

export const MAX_SEATS = 4;
export const SEAT_SLOT_HEIGHT = 76;
export const DETAIL_LINE_HEIGHT = 20;
export const HEADER_HEIGHT = 64;
const DETAIL_WIDTH_MIN = 260;
const DETAIL_WIDTH_MAX = 360;
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
 * they are pinned *inside* `detail`'s own foot by design (their own dedicated test checks that containment and
 * that they don't overlap each other), and on a narrow one they're the bottom-most row, already guaranteed clear
 * by construction.
 */
export function seatsLayoutRects(layout: SeatsLayout): readonly Rect[] {
  return [layout.back, layout.step, ...layout.seatSlots, layout.usePreconstructed, layout.search, layout.chips, layout.shelves, layout.detail];
}

/**
 * The detail panel's own width, exposed so a caller can measure its hero-detail text's *real* wrapped line count
 * against this exact width before calling `seatsLayout` — see `view/scenario-select-layout.ts`'s own
 * `detailPanelWidthFor` (the identical fix, needed for the identical reason: a long obligation/nemesis-set name
 * clipping against the ~300px side panel, 2026-09-18 fidelity pass).
 */
export function detailPanelWidthFor(width: number, height: number): number {
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  const { pad } = setupMetrics(width, height);
  const maxColumn = wide ? 1200 : 640;
  const column = Math.min(width - pad * 2, maxColumn);
  return wide ? Math.min(DETAIL_WIDTH_MAX, Math.max(DETAIL_WIDTH_MIN, column * 0.26)) : column;
}

export function seatsLayout(input: SeatsLayoutInput): SeatsLayout {
  const { width, height } = input;
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  const { pad, gap, smallGap } = setupMetrics(width, height);

  const headerBar: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const headerPad = 16;
  const backWidth = 70;
  const stepWidth = Math.min(160, Math.max(90, width * 0.32));
  const back: Rect = { x: headerPad, y: (HEADER_HEIGHT - hit.target) / 2, width: backWidth, height: hit.target };
  const step: Rect = { x: width - headerPad - stepWidth, y: (HEADER_HEIGHT - hit.target) / 2, width: stepWidth, height: hit.target };

  const maxColumn = wide ? 1200 : 640;
  const column = Math.min(width - pad * 2, maxColumn);
  const left = (width - column) / 2;

  const detailWidth = detailPanelWidthFor(width, height);
  const shelvesWidth = wide ? column - gap - detailWidth : column;

  const bodyTop = HEADER_HEIGHT + pad;
  const bodyBottom = height - pad;

  const slotWidth = (shelvesWidth - (MAX_SEATS - 1) * 6) / MAX_SEATS;
  const seatSlots: Rect[] = Array.from({ length: MAX_SEATS }, (_, i) => ({ x: left + i * (slotWidth + 6), y: bodyTop, width: slotWidth, height: SEAT_SLOT_HEIGHT }));
  let y = bodyTop + SEAT_SLOT_HEIGHT + smallGap;

  const usePreconstructed: Rect = { x: left, y, width: shelvesWidth, height: 20 };
  y += 20 + smallGap;

  // Room for the "Heroes — N seats..." section label drawn just above the search field (`scenes/seats.ts`).
  y += LABEL_ROOM;
  const search: Rect = { x: left, y, width: shelvesWidth, height: hit.target };
  y += hit.target + smallGap;
  const chipsHeight = chipStripHeight(input.chipRows);
  const chips: Rect = { x: left, y, width: shelvesWidth, height: chipsHeight };
  y += chipsHeight + smallGap;

  const detailHeight = wide ? bodyBottom - bodyTop : Math.max(DETAIL_LINE_HEIGHT, input.detailLines * DETAIL_LINE_HEIGHT) + 16;
  const ctaHeight = hit.primary;
  const ctaWidth = (shelvesWidth - CTA_GAP) / 2;

  if (wide) {
    const shelves: Rect = { x: left, y, width: shelvesWidth, height: Math.max(SHELVES_MIN_HEIGHT, bodyBottom - y) };
    const detail: Rect = { x: left + shelvesWidth + gap, y: bodyTop, width: detailWidth, height: detailHeight };
    // Wide keeps the two actions stacked (quiet above primary) rather than squeezed side by side in a ~280px
    // panel, where neither label would read — the panel is narrower than the roster column the phone/tablet
    // pair shares the row across.
    const stacked = detail.width - 24;
    const play: Rect = { x: detail.x + 12, y: detail.y + detail.height - 12 - ctaHeight * 2 - 8, width: stacked, height: ctaHeight };
    const deckCheck: Rect = { x: detail.x + 12, y: detail.y + detail.height - 12 - ctaHeight, width: stacked, height: ctaHeight };
    return { formFactor, wide, headerBar, back, step, seatSlots, usePreconstructed, search, chips, shelves, detail, play, deckCheck };
  }

  const deckCheck: Rect = { x: left + ctaWidth + CTA_GAP, y: bodyBottom - ctaHeight, width: ctaWidth, height: ctaHeight };
  const play: Rect = { x: left, y: bodyBottom - ctaHeight, width: ctaWidth, height: ctaHeight };
  const detail: Rect = { x: left, y: play.y - gap - detailHeight, width: column, height: detailHeight };
  const shelvesHeight = Math.max(SHELVES_MIN_HEIGHT, detail.y - gap - y);
  const shelves: Rect = { x: left, y, width: shelvesWidth, height: shelvesHeight };
  return { formFactor, wide, headerBar, back, step, seatSlots, usePreconstructed, search, chips, shelves, detail, play, deckCheck };
}

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
 * **Narrow (phone/tabletPortrait): P03's own composition** (rebuilt 2026-09-19
 * after the owner's phone screenshot: the 2×2 seat cards, three wrapped chip
 * rows, a hero-detail block *and* the two actions all had to fit one 844px
 * screen, which left the shelf roster a ~160px strip that cropped every card
 * to its top third — "mobile is completely broken"). One column, top to
 * bottom: one row of four compact **seat chips** (P03's "SEAT 1 / C. MARVEL"
 * strip, not the wide layout's 115px cards); the `rosterHeader` row, now a
 * full 44px touch row holding the active seat's **details disclosure**
 * (`detailsToggle`, one line: aspect · HP · hand, or "Tap a hero for seat N")
 * on the left and "Use preconstructed" on the right; only while that
 * disclosure is open (`detailsOpen`), the **seat summary** block (the stat
 * lines and obligation/nemesis, with the "Clear seat" control — this is where
 * the wide layout's ink detail panel and the seat card's "✕" both went); one
 * chip row — a square **search toggle** (`searchToggle`) at its head, then
 * the chips as **one horizontally-scrolling rail** (`chipsScroll`, drawn by
 * `ui/chip-rail.ts`) rather than wrapped rows; the search field only while
 * that toggle is on (`searchOpen`); then the shelves take **every remaining
 * pixel** above a sticky ink `footer` carrying Deck check and Play — the same
 * sticky-footer shape Table setup's own phone layout (P12) already uses.
 * `detail` is null on narrow: nothing else is allowed to take height away
 * from the roster. (Revised 2026-09-21 for the owner's phone note: the always-
 * open summary, header row and search field together cost the roster ~150px
 * of an 844px screen; "this stuff should be collapsible".)
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
/** Narrow only: one compact seat chip (P03's "SEAT N" + a Bangers name), a full touch target and a little more. */
export const SEAT_CHIP_HEIGHT = 64;
export const SEAT_CHIP_GAP = 6;
/** Narrow only: the active seat's summary line(s) beside its "Clear seat" control — a 44px target tall so the control is a real one. */
export const SEAT_SUMMARY_HEIGHT = 56;
export const CLEAR_SEAT_WIDTH = 104;
/** Narrow only: the sticky ink footer's own vertical padding around the two 52px actions. */
export const NARROW_FOOTER_PAD = 12;
export const NARROW_FOOTER_HEIGHT = hit.primary + NARROW_FOOTER_PAD * 2;
/** Narrow only: "Deck check ▸" is the fixed-width side trip; "Play N heroes ▸" takes the rest of the footer row. */
export const NARROW_DECK_CHECK_WIDTH = 140;
/**
 * Narrow only: the shelf roster is the whole point of the screen, so the layout never gives it less than one shelf
 * header band plus `scenes/seats.ts`'s `#cardMetrics` card-height floor (160px) — anything shorter is the bug this
 * rebuild fixes. Sized so a 375×667 phone fits exactly (a card at the floor, nothing under the footer).
 */
export const NARROW_SHELVES_MIN_HEIGHT = 220;

export interface SeatsLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly chipRows: number;
  readonly detailLines: number;
  /** Narrow only: the active seat's details block is open under the roster header row. Shut by default. Ignored on wide. */
  readonly detailsOpen?: boolean;
  /** Narrow only: the search field row is shown under the chip rail. Off by default. Ignored on wide, where the field is always drawn. */
  readonly searchOpen?: boolean;
}

export interface SeatsLayout {
  readonly formFactor: FormFactor;
  readonly wide: boolean;
  readonly headerBar: Rect;
  readonly back: Rect;
  readonly step: Rect;
  readonly seatSlots: readonly Rect[];
  /** Wide: the "HEROES — SEAT N OF 4" / "Use preconstructed" row above the search field. Narrow: the 44px row holding `detailsToggle` and "Use preconstructed". */
  readonly rosterHeader: Rect;
  /** The small quiet "Use preconstructed for all seats" button, right-aligned within `rosterHeader`. */
  readonly usePreconstructed: Rect;
  /** Narrow only: the active seat's details disclosure, the left part of `rosterHeader`. Null on wide. */
  readonly detailsToggle: Rect | null;
  /** The search field. Zero-height on a narrow layout whose toggle is off (`searchOpen`) — nothing is drawn there. */
  readonly search: Rect;
  /** Narrow only: the square toggle at the head of the chip row that shows/hides `search`. Null on wide. */
  readonly searchToggle: Rect | null;
  /** The chip strip. On wide, `chipRows` wrapped rows tall; on narrow (`chipsScroll`), exactly one row that scrolls sideways. */
  readonly chips: Rect;
  /** True on narrow: draw the chips as one horizontally-scrolling rail (`ui/chip-rail.ts`) rather than wrapped rows. */
  readonly chipsScroll: boolean;
  readonly shelves: Rect;
  /** The full-height ink hero-detail panel. Wide only — null on narrow, where `seatSummary` carries the active seat's facts instead. */
  readonly detail: Rect | null;
  /** Narrow only, and only while `detailsOpen`: the active seat's summary lines under the roster header row (stat lines, obligation/nemesis). Null on wide and when shut. */
  readonly seatSummary: Rect | null;
  /** Narrow only, and only while `detailsOpen`: the quiet "Clear seat" control right-aligned inside `seatSummary` — the seat card's "✕" has no room on a phone chip. Null otherwise. */
  readonly clearSeat: Rect | null;
  /** Narrow only: the sticky ink band at the screen's foot that `play`/`deckCheck` sit inside. Null on wide. */
  readonly footer: Rect | null;
  /** The "Play N heroes ▸" action, beside `deckCheck`. */
  readonly play: Rect;
  /** The "Deck check ▸" action. */
  readonly deckCheck: Rect;
}

/**
 * Every top-level region, for a no-overlap test. `play`/`deckCheck` are deliberately excluded: on a wide layout
 * they are pinned *inside* `detail`'s own foot by design, and on a narrow one they're the bottom-most row, already
 * guaranteed clear by construction. `usePreconstructed` is excluded too — it's inside `rosterHeader` by design.
 */
export function seatsLayoutRects(layout: SeatsLayout): readonly Rect[] {
  return [
    layout.back,
    layout.step,
    ...layout.seatSlots,
    layout.rosterHeader,
    ...(layout.search.height > 0 ? [layout.search] : []),
    ...(layout.searchToggle ? [layout.searchToggle] : []),
    layout.chips,
    layout.shelves,
    ...(layout.detail ? [layout.detail] : []),
    ...(layout.seatSummary ? [layout.seatSummary] : []),
    ...(layout.footer ? [layout.footer] : []),
  ];
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

/**
 * The roster column's own width — what the search field, the chip strip and the shelves all span — exposed so a
 * caller can wrap its chips against the *real* column before calling `seatsLayout` with the resulting row count.
 * `scenes/seats.ts` used to wrap against the full viewport width for that first estimate and against the column
 * for the actual draw, which under-counted the rows whenever the two disagreed (always: the column is at least two
 * gutters narrower, and 300px+ narrower on wide) and drew the extra row straight through the shelves below.
 */
export function rosterColumnWidthFor(width: number, height: number): number {
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  const gutter = formFactor === "phone" ? 16 : GUTTER;
  return wide ? width - gutter * 2 - gutter - DETAIL_WIDTH : width - gutter * 2;
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
  const backWidth = 140;
  const stepWidth = Math.min(160, Math.max(90, width * 0.32));
  const back: Rect = { x: headerPad, y: (HEADER_HEIGHT - hit.target) / 2, width: backWidth, height: hit.target };
  const step: Rect = {
    x: width - headerPad - stepWidth,
    y: (HEADER_HEIGHT - hit.target) / 2,
    width: stepWidth,
    height: hit.target,
  };

  const left = gutter;
  const detailWidth = detailPanelWidthFor(width, height);
  const shelvesWidth = rosterColumnWidthFor(width, height);

  const bodyTop = HEADER_HEIGHT + gutter;
  const bodyBottom = height - gutter;

  if (wide) {
    // One row of four seat cards.
    const slotWidth = (shelvesWidth - (MAX_SEATS - 1) * 6) / MAX_SEATS;
    const seatSlots: Rect[] = Array.from({ length: MAX_SEATS }, (_, i) => ({
      x: left + i * (slotWidth + 6),
      y: bodyTop,
      width: slotWidth,
      height: SEAT_SLOT_HEIGHT,
    }));
    let y = bodyTop + SEAT_SLOT_HEIGHT + smallGap;

    const usePreconstructedWidth = Math.min(230, shelvesWidth * 0.5);
    const rosterHeader: Rect = { x: left, y, width: shelvesWidth, height: ROSTER_HEADER_HEIGHT };
    const usePreconstructed: Rect = {
      x: rosterHeader.x + rosterHeader.width - usePreconstructedWidth,
      y: rosterHeader.y,
      width: usePreconstructedWidth,
      height: ROSTER_HEADER_HEIGHT,
    };
    y += ROSTER_HEADER_HEIGHT + smallGap;

    const search: Rect = { x: left, y, width: shelvesWidth, height: hit.target };
    y += hit.target + smallGap;
    const chipsHeight = chipStripHeight(input.chipRows);
    const chips: Rect = { x: left, y, width: shelvesWidth, height: chipsHeight };
    y += chipsHeight + smallGap;

    const ctaHeight = hit.primary;
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
    const deckCheck: Rect = {
      x: detail.x + 16,
      y: detail.y + detail.height - 16 - ctaBlockHeight,
      width: stacked,
      height: ctaHeight,
    };
    const play: Rect = { x: detail.x + 16, y: deckCheck.y + ctaHeight + 8, width: stacked, height: ctaHeight };
    return {
      formFactor,
      wide,
      headerBar,
      back,
      step,
      seatSlots,
      rosterHeader,
      usePreconstructed,
      detailsToggle: null,
      search,
      searchToggle: null,
      chips,
      chipsScroll: false,
      shelves,
      detail,
      seatSummary: null,
      clearSeat: null,
      footer: null,
      play,
      deckCheck,
    };
  }

  // Narrow (P03): compact seat chips in one row, the summary line, header/search/rail, then the shelves take all
  // the room down to the sticky footer. Nothing here is sized to "whatever is left" except the shelves.
  const chipWidth = (shelvesWidth - (MAX_SEATS - 1) * SEAT_CHIP_GAP) / MAX_SEATS;
  const seatSlots: Rect[] = Array.from({ length: MAX_SEATS }, (_, i) => ({
    x: left + i * (chipWidth + SEAT_CHIP_GAP),
    y: bodyTop,
    width: chipWidth,
    height: SEAT_CHIP_HEIGHT,
  }));
  let y = bodyTop + SEAT_CHIP_HEIGHT + smallGap;

  // The one always-present row under the seat chips: the active seat's details disclosure on the left, "Use
  // preconstructed" on the right — a full touch target tall, since both halves are controls.
  const usePreconstructedWidth = Math.min(180, shelvesWidth * 0.42);
  const rosterHeader: Rect = { x: left, y, width: shelvesWidth, height: hit.target };
  const usePreconstructed: Rect = {
    x: rosterHeader.x + rosterHeader.width - usePreconstructedWidth,
    y: rosterHeader.y,
    width: usePreconstructedWidth,
    height: hit.target,
  };
  const detailsToggle: Rect = {
    x: left,
    y,
    width: shelvesWidth - usePreconstructedWidth - smallGap,
    height: hit.target,
  };
  y += hit.target + smallGap;

  // Open only: the summary block the disclosure reveals, with "Clear seat" inside it.
  const detailsOpen = input.detailsOpen ?? false;
  const seatSummary: Rect | null = detailsOpen
    ? { x: left, y, width: shelvesWidth, height: SEAT_SUMMARY_HEIGHT }
    : null;
  const clearSeat: Rect | null = detailsOpen
    ? {
        x: left + shelvesWidth - CLEAR_SEAT_WIDTH,
        y: y + (SEAT_SUMMARY_HEIGHT - hit.target) / 2,
        width: CLEAR_SEAT_WIDTH,
        height: hit.target,
      }
    : null;
  if (detailsOpen) y += SEAT_SUMMARY_HEIGHT + smallGap;

  // One chip row, whatever `chipRows` says: the search toggle at its head, then the rail, which scrolls sideways
  // instead of wrapping.
  const searchToggle: Rect = { x: left, y, width: hit.target, height: hit.target };
  const chips: Rect = {
    x: left + hit.target + smallGap,
    y,
    width: shelvesWidth - hit.target - smallGap,
    height: chipStripHeight(1),
  };
  y += chips.height + smallGap;
  const searchOpen = input.searchOpen ?? false;
  const search: Rect = { x: left, y, width: shelvesWidth, height: searchOpen ? hit.target : 0 };
  if (searchOpen) y += hit.target + smallGap;

  const footer: Rect = { x: 0, y: height - NARROW_FOOTER_HEIGHT, width, height: NARROW_FOOTER_HEIGHT };
  const deckCheck: Rect = {
    x: left,
    y: footer.y + NARROW_FOOTER_PAD,
    width: NARROW_DECK_CHECK_WIDTH,
    height: hit.primary,
  };
  const play: Rect = {
    x: left + NARROW_DECK_CHECK_WIDTH + CTA_GAP,
    y: footer.y + NARROW_FOOTER_PAD,
    width: shelvesWidth - NARROW_DECK_CHECK_WIDTH - CTA_GAP,
    height: hit.primary,
  };

  // Floored, never trimmed: on a viewport too short for even this (a landscape phone), the shelves keep one card's
  // worth of height and are the thing that runs under the footer — the footer's own ink hides the overflow, and a
  // cropped last shelf beats a roster that can't show a single hero.
  const shelves: Rect = {
    x: left,
    y,
    width: shelvesWidth,
    height: Math.max(NARROW_SHELVES_MIN_HEIGHT, footer.y - gutter - y),
  };
  return {
    formFactor,
    wide,
    headerBar,
    back,
    step,
    seatSlots,
    rosterHeader,
    usePreconstructed,
    detailsToggle,
    search,
    searchToggle,
    chips,
    chipsScroll: true,
    shelves,
    detail: null,
    seatSummary,
    clearSeat,
    footer,
    play,
    deckCheck,
  };
}

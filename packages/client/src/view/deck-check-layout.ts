/**
 * Deck check's own layout (W1, docs/phase4-screen-gaps.md §3 "Deck check
 * screen"; rebuilt 2026-09-18 for the owner's fidelity note — "The 'Deck
 * Check' screens and elements there don't flow well with the design."
 *
 * **The desktop canvas for this step is D04, "Deck builder — live validation
 * against the 40–50 rule"** (`artifacts/design-screenshots/individual/screens-desktop.dc/04-s04.png`):
 * an ink top bar (Bangers "◂ SEATS", the Bangers "HERO — ASPECT" title, a
 * green/red filled "N CARDS · LEGAL" badge at the right) over a full-width
 * three-column body — a ~230px parchment rail (aspect, filter, cost curve at
 * its own foot), the card grid in the middle, and a ~300px full-height ink
 * rail (the deck list, then its own footer actions) on the right. The old
 * version of this file read D04's *absence* from the phone canvas set as
 * license to invent an unrelated two-column shape; it wasn't — D04 **is**
 * this screen's own desktop composition, just drawn read-only here (the
 * aspect tiles and cost curve are informational rather than editable, the
 * grid shows the deck's *own* cards rather than the whole legal pool, and
 * the right rail's footer holds "Edit deck"/"Start game ▸" rather than
 * "Preconstructed"/"Clear") — the same relationship `scenes/deck-builder.ts`
 * already has to this canvas (its own doc comment reads the identical
 * three-column split), so both screens draw the *same* composition rather
 * than two different guesses at it.
 *
 * **Wide (desktop/tabletLandscape): three columns**, matching
 * `scenes/deck-builder.ts`'s own `LEFT_RAIL_WIDTH`/`RIGHT_RAIL_WIDTH`/
 * `RAIL_GAP` so the two screens' columns line up pixel-for-pixel when a
 * player moves between them. `rail` (left, `RAIL_WIDTH`): the deck's aspect
 * tiles, the type filter chips (filtering `cards`, not editing the deck),
 * and the cost curve pinned at the rail's own foot. `cards` (middle,
 * flexible): the deck's own card grid. `panel` (right, `PANEL_WIDTH`, full
 * height, ink): the deck list, with Edit deck (quiet) and Start game ▸ (the
 * screen's one red action) pinned at its own foot.
 *
 * **Narrow (phone/tabletPortrait): one column**, P04's own shape unchanged —
 * a Curve/Cards/Aspect tab strip under a "YOUR DECK · N" header (not the
 * wide header's hero name/legality badge — P04 draws its own, simpler
 * header, and this stays a deliberate per-form-factor difference rather than
 * forcing one header shape at every width), whichever tab's content, then a
 * footer ink bar (Edit deck, Start game ▸).
 */
import { hit } from "../tokens.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";

export const HEADER_HEIGHT = 64;
export const GUTTER = 24;
/** Matches `scenes/deck-builder.ts`'s own `LEFT_RAIL_WIDTH` (D04's left aspect/filter/cost-curve rail). */
export const RAIL_WIDTH = 230;
/** Matches `scenes/deck-builder.ts`'s own `RIGHT_RAIL_WIDTH` (D04's right ink "Your deck" rail). */
export const PANEL_WIDTH = 300;
/** Matches `scenes/deck-builder.ts`'s own `RAIL_GAP`. */
export const RAIL_GAP = 24;
/**
 * Matches `scenes/deck-builder.ts`'s own `WIDE_MIN_WIDTH`: below this the three-column split (two fixed-width
 * rails, `RAIL_WIDTH + PANEL_WIDTH + RAIL_GAP * 2` = 578px, plus `pad * 2`) doesn't leave the middle grid a livable
 * width even at `CARDS_MIN_WIDTH`'s own floor — a landscape-shaped but narrow viewport (800×600) forced the grid
 * below that floor and overflowed the screen before this was added. Reusing the same number as the builder means
 * the two screens switch from one column to the shared three-column composition at the identical width.
 */
export const WIDE_MIN_WIDTH = 1000;
/** Never let the card grid get squeezed narrower than this by the two rails — unreachable once `WIDE_MIN_WIDTH` holds, kept as a documented floor the way `decks-layout.ts`'s `POOL_MIN_WIDTH` is. */
const CARDS_MIN_WIDTH = 260;

export type DeckCheckTab = "curve" | "cards" | "aspect";

export interface DeckCheckLayout {
  readonly formFactor: FormFactor;
  readonly wide: boolean;
  readonly pad: number;
  readonly headerBar: Rect;
  readonly back: Rect;
  /** The header's own right-aligned text area — narrow: the step fraction; wide: the "N CARDS · LEGAL" badge. */
  readonly meta: Rect;
  /** Wide only: the left parchment rail (aspect tiles, filter chips, cost curve). */
  readonly rail: Rect | null;
  /** Wide: the deck's own card grid, full body height, between `rail` and `panel`. Narrow: null — the Cards tab draws into `content` instead. */
  readonly cards: Rect | null;
  /** Wide only: the full-height ink rail (the deck list, then Edit deck/Start game ▸ pinned at its own foot). */
  readonly panel: Rect | null;
  /** Narrow only: the Curve / Cards / Aspect tab strip. */
  readonly tabs: Rect | null;
  /** Narrow only: whichever tab's own content draws into this same rect. */
  readonly content: Rect | null;
  /** Narrow only: the ink footer bar behind Edit deck and Start game. */
  readonly footer: Rect | null;
  /** Always present: wide pins this inside `panel`'s own foot; narrow pins it inside `footer`. */
  readonly editDeck: Rect;
  /** Always present, same rule as `editDeck`. */
  readonly startGame: Rect;
}

/** Every rect this layout places, for a no-overlap test. `editDeck`/`startGame` are deliberately excluded — they sit *inside* `panel` (wide) or `footer` (narrow) by design, the same exclusion `seats-layout.ts` makes for its own `play`/`deckCheck`. */
export function deckCheckLayoutRects(layout: DeckCheckLayout): readonly Rect[] {
  return [
    layout.back,
    layout.meta,
    ...(layout.rail ? [layout.rail] : []),
    ...(layout.cards ? [layout.cards] : []),
    ...(layout.panel ? [layout.panel] : []),
    ...(layout.tabs ? [layout.tabs] : []),
    ...(layout.content ? [layout.content] : []),
    ...(layout.footer ? [layout.footer] : []),
  ];
}

const FOOTER_PADDING = 12;
const EDIT_DECK_WIDTH = 130;
const BUTTON_GAP = 8;
/** The panel's own foot: Edit deck (quiet) above Start game ▸ (primary) — stacked, the same reason `seats-layout.ts`'s wide `play`/`deckCheck` pair stacks inside its own narrower detail panel rather than sitting side by side. */
const PANEL_CTA_HEIGHT = hit.primary;
const PANEL_CTA_GAP = 8;
const PANEL_INSET = 16;

export interface DeckCheckLayoutInput {
  readonly width: number;
  readonly height: number;
}

export function deckCheckLayout(input: DeckCheckLayoutInput): DeckCheckLayout {
  const { width, height } = input;
  const formFactor = formFactorFor(width, height);
  const wide = (formFactor === "desktop" || formFactor === "tabletLandscape") && width >= WIDE_MIN_WIDTH;
  const phone = formFactor === "phone";
  const pad = phone ? 16 : GUTTER;

  const headerBar: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const headerPad = 16;
  const backWidth = 90;
  const metaWidth = Math.min(260, Math.max(120, width * 0.3));
  const back: Rect = { x: headerPad, y: (HEADER_HEIGHT - hit.target) / 2, width: backWidth, height: hit.target };
  const meta: Rect = {
    x: width - headerPad - metaWidth,
    y: (HEADER_HEIGHT - hit.target) / 2,
    width: metaWidth,
    height: hit.target,
  };

  const bodyTop = HEADER_HEIGHT + pad;
  const bodyBottom = height - pad;
  const left = pad;

  if (wide) {
    const bodyHeight = bodyBottom - bodyTop;
    const cardsWidth = Math.max(CARDS_MIN_WIDTH, width - pad * 2 - RAIL_WIDTH - PANEL_WIDTH - RAIL_GAP * 2);
    const rail: Rect = { x: left, y: bodyTop, width: RAIL_WIDTH, height: bodyHeight };
    const cards: Rect = { x: left + RAIL_WIDTH + RAIL_GAP, y: bodyTop, width: cardsWidth, height: bodyHeight };
    const panel: Rect = { x: cards.x + cardsWidth + RAIL_GAP, y: bodyTop, width: PANEL_WIDTH, height: bodyHeight };

    const ctaBlockHeight = PANEL_CTA_HEIGHT * 2 + PANEL_CTA_GAP;
    const startGame: Rect = {
      x: panel.x + PANEL_INSET,
      y: panel.y + panel.height - PANEL_INSET - PANEL_CTA_HEIGHT,
      width: panel.width - PANEL_INSET * 2,
      height: PANEL_CTA_HEIGHT,
    };
    const editDeck: Rect = {
      x: panel.x + PANEL_INSET,
      y: panel.y + panel.height - PANEL_INSET - ctaBlockHeight,
      width: panel.width - PANEL_INSET * 2,
      height: PANEL_CTA_HEIGHT,
    };

    return {
      formFactor,
      wide,
      pad,
      headerBar,
      back,
      meta,
      rail,
      cards,
      panel,
      tabs: null,
      content: null,
      footer: null,
      editDeck,
      startGame,
    };
  }

  const column = Math.min(width - pad * 2, 640);
  const tabLeft = (width - column) / 2;
  const tabs: Rect = { x: tabLeft, y: bodyTop, width: column, height: hit.target };

  const footerHeight = hit.primary + FOOTER_PADDING * 2;
  const footer: Rect = { x: 0, y: height - footerHeight, width, height: footerHeight };
  const editDeck: Rect = { x: tabLeft, y: footer.y + FOOTER_PADDING, width: EDIT_DECK_WIDTH, height: hit.primary };
  const startGame: Rect = {
    x: tabLeft + EDIT_DECK_WIDTH + BUTTON_GAP,
    y: footer.y + FOOTER_PADDING,
    width: column - EDIT_DECK_WIDTH - BUTTON_GAP,
    height: hit.primary,
  };

  const contentTop = tabs.y + tabs.height + 10;
  // Never negative: a viewport too short for even the fixed chrome still gets a zero-height content rect rather than
  // one that overlaps the footer above it — the same floor `statBlockLayout` (`view/layout.ts`) holds for a badge row.
  const content: Rect = { x: tabLeft, y: contentTop, width: column, height: Math.max(0, footer.y - contentTop) };

  return {
    formFactor,
    wide,
    pad,
    headerBar,
    back,
    meta,
    rail: null,
    cards: null,
    panel: null,
    tabs,
    content,
    footer,
    editDeck,
    startGame,
  };
}

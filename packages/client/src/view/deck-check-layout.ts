/**
 * Deck check's own layout (W1, docs/phase4-screen-gaps.md §3 "Deck check
 * screen"), as a pure function — same "layout function a plain-TS test can
 * check for overlap" `title-layout.ts` already does for Title (S8).
 *
 * P04's shape, in one column at every size: a header (Back, the deck's name
 * and card count), the Curve/Cards/Aspect tab strip, a scrolling content area
 * that takes whatever height is left, and a footer pinned to the bottom
 * (Edit deck, Start game ▸). Unlike `title-layout.ts`, `content` never needs
 * a "how many rows fit" pass: it's one flexible rect the scene fills however
 * the active tab wants (a chart, a virtualized list, a chip strip), not a
 * fixed number of equal-height rows.
 */
import { hit } from "../tokens.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";

export interface DeckCheckLayoutInput {
  readonly width: number;
  readonly height: number;
}

export interface DeckCheckLayout {
  readonly formFactor: FormFactor;
  readonly pad: number;
  readonly left: number;
  readonly column: number;
  /** Back button and the "<deck name> · <count>" title. */
  readonly header: Rect;
  /** The Curve / Cards / Aspect tab strip. */
  readonly tabs: Rect;
  /** Everything between the tabs and the footer — the active tab draws into this. Never negative: see the module doc comment. */
  readonly content: Rect;
  /** The ink footer bar behind Edit deck and Start game. */
  readonly footer: Rect;
  readonly editDeck: Rect;
  readonly startGame: Rect;
}

/** Every rect this layout places, for a no-overlap test. */
export function deckCheckLayoutRects(layout: DeckCheckLayout): readonly Rect[] {
  return [layout.header, layout.tabs, layout.content, layout.footer];
}

const FOOTER_PADDING = 12;
const EDIT_DECK_WIDTH = 130;
const BUTTON_GAP = 8;

export function deckCheckLayout(input: DeckCheckLayoutInput): DeckCheckLayout {
  const { width, height } = input;
  const formFactor = formFactorFor(width, height);
  const phone = formFactor === "phone";
  const pad = phone ? 16 : 32;
  const column = Math.min(width - pad * 2, 640);
  const left = (width - column) / 2;

  const header: Rect = { x: left, y: pad, width: column, height: hit.target };
  const tabs: Rect = { x: left, y: header.y + header.height + 10, width: column, height: hit.target };

  const footerHeight = hit.primary + FOOTER_PADDING * 2;
  const footer: Rect = { x: 0, y: height - footerHeight, width, height: footerHeight };
  const editDeck: Rect = { x: left, y: footer.y + FOOTER_PADDING, width: EDIT_DECK_WIDTH, height: hit.primary };
  const startGame: Rect = {
    x: left + EDIT_DECK_WIDTH + BUTTON_GAP,
    y: footer.y + FOOTER_PADDING,
    width: column - EDIT_DECK_WIDTH - BUTTON_GAP,
    height: hit.primary,
  };

  const contentTop = tabs.y + tabs.height + 10;
  // Never negative: a viewport too short for even the fixed chrome still gets a zero-height content rect rather than
  // one that overlaps the footer above it — the same floor `statBlockLayout` (`view/layout.ts`) holds for a badge row.
  const content: Rect = { x: left, y: contentTop, width: column, height: Math.max(0, footer.y - contentTop) };

  return { formFactor, pad, left, column, header, tabs, content, footer, editDeck, startGame };
}

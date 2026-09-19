/**
 * How the villain phase's inline interrupt window tiles the cards the viewer
 * can play right now (`inlineInterruptFor`, `villain-walkthrough.ts`).
 *
 * The window used to be text only, a name, type line and rules text per
 * option, which left most of a large panel empty and read slower than the
 * card itself. Each option now gets the same treatment as a revealed boost
 * card (`villain-phase-boosts.ts`, which does the tiling): the scan on the
 * left at the printed ratio, the text to its right (kept for accessibility
 * and as the fallback when a scan is missing), and the Play button at the
 * foot of that text column.
 *
 * Unlike a boost card, an interrupt option is a legal play, so none may fold
 * into "+N more": if the scans don't all fit, every option drops to a
 * text-only row instead.
 *
 * Pure function of the rect, the count and the form factor.
 */
import { boostCardsLayout } from "./villain-phase-boosts.js";
import type { FormFactor, Rect } from "./layout.js";

/** Tallest one option's panel gets, so a lone option isn't a wall-sized scan. */
const MAX_CARD_HEIGHT_WIDE = 380;
const MAX_CARD_HEIGHT_PHONE = 260;
/** Gap between stacked rows in the text-only fallback; matches the boost tiling's gap. */
const GAP = 10;
const PAD = 10;
/** A Play button wider than this on a desktop column reads as a banner, not a button. */
const MAX_BUTTON_WIDTH = 280;

export interface InterruptCardSlot {
  /** The option's own bordered panel. */
  readonly card: Rect;
  /** The scan, at the printed 2.5:3.5 ratio; zero-size in the text-only fallback. */
  readonly art: Rect;
  /** Name, type line and rules text, to the right of `art`, above `button`. */
  readonly text: Rect;
  /** The option's Play button, at the foot of the text column. */
  readonly button: Rect;
}

/** `count` is `inlineInterruptFor(...).length`; `buttonHeight` is the Play button's hit height. */
export function interruptCardsLayout(rect: Rect, count: number, formFactor: FormFactor, buttonHeight: number): readonly InterruptCardSlot[] {
  if (count <= 0 || rect.width <= 0 || rect.height <= 0) return [];

  const maxCardHeight = formFactor === "phone" ? MAX_CARD_HEIGHT_PHONE : MAX_CARD_HEIGHT_WIDE;
  // Try the capped height first; if that can't show every option, give the
  // tiling the whole rect before giving up on scans.
  const capped: Rect = { ...rect, height: Math.min(rect.height, maxCardHeight) };
  let tiled = boostCardsLayout(capped, count, formFactor);
  if (tiled.overflow > 0 || rowsOf(tiled.slots) > 1) tiled = boostCardsLayout(rect, count, formFactor);

  // Each slot's text column also has to hold the button beneath its text.
  const minTextHeight = buttonHeight + 40;
  const scansFit = tiled.overflow === 0 && tiled.slots.every((slot) => slot.text.height >= minTextHeight);

  if (scansFit) {
    return tiled.slots.map(({ card, art, text }) => withButton(card, art, text, buttonHeight));
  }

  // Text-only fallback: every option stacked, sharing the height evenly.
  const rowHeight = Math.max(0, (rect.height - (count - 1) * GAP) / count);
  return Array.from({ length: count }, (_, i) => {
    const card: Rect = { x: rect.x, y: rect.y + i * (rowHeight + GAP), width: rect.width, height: rowHeight };
    const art: Rect = { x: card.x + PAD, y: card.y + PAD, width: 0, height: 0 };
    const text: Rect = { x: card.x + PAD, y: card.y + PAD, width: Math.max(0, card.width - PAD * 2), height: Math.max(0, card.height - PAD * 2) };
    return withButton(card, art, text, buttonHeight);
  });
}

function rowsOf(slots: readonly { readonly card: Rect }[]): number {
  return new Set(slots.map((slot) => slot.card.y)).size;
}

function withButton(card: Rect, art: Rect, column: Rect, buttonHeight: number): InterruptCardSlot {
  const height = Math.min(buttonHeight, column.height);
  const button: Rect = { x: column.x, y: column.y + column.height - height, width: Math.min(column.width, MAX_BUTTON_WIDTH), height };
  const text: Rect = { ...column, height: Math.max(0, column.height - height - 8) };
  return { card, art, text, button };
}

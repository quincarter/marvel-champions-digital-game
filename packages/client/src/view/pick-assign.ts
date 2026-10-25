/**
 * Direct picks: while the Board asks "who attacks?" or "which target?", each candidate wears the button (or number
 * key) that picks it, so a decision never needs a walk of the focus ring.
 *
 * The scheme (owner report, 2026-10-24): on a pad, hold RT and press A / X / Y / B for the first four candidates, the
 * same buttons and the same LB / RB paging the RT layer already uses for abilities (`view/pad-layers.ts`); nothing is
 * taken from the base buttons (A selects the focused card, B cancels, Y inspects, Start confirms). On the keyboard the
 * digits 1 to 9 pick, and the zone keys page past nine. A candidate off the page showing wears nothing, and a "more"
 * hint says there are others.
 *
 * Pure: this module only answers which candidate a slot means, and how paging moves the window.
 */

/** Candidates per page on a pad: the four face buttons. */
export const PAD_PICK_SLOTS = 4;
/** Candidates per page on the keyboard: the digits 1 to 9. */
export const KEY_PICK_SLOTS = 9;

export type PickSet = "pad" | "keyboard";

export const pickSlotsOf = (set: PickSet): number => (set === "pad" ? PAD_PICK_SLOTS : KEY_PICK_SLOTS);

/** The page of candidates showing: `start` is the first candidate's index, `size` how many slots a page has. */
export interface PickWindow {
  readonly start: number;
  readonly size: number;
  readonly count: number;
  /** 0-based. */
  readonly page: number;
  readonly pageCount: number;
  /** More candidates than one page holds: the "more" hint shows. */
  readonly paged: boolean;
}

/** The window an `offset` (the index of any candidate on the page wanted) falls in, clamped to the candidates there are. */
export function pickWindow(count: number, offset: number, size: number): PickWindow {
  const slots = Math.max(1, Math.floor(size));
  const total = Math.max(0, Math.floor(count));
  const pageCount = Math.max(1, Math.ceil(total / slots));
  const page = Math.min(pageCount - 1, Math.max(0, Math.floor(Math.max(0, offset) / slots)));
  return { start: page * slots, size: slots, count: total, page, pageCount, paged: pageCount > 1 };
}

/** The candidate index a slot (0-based: A, X, Y, B in turn; the keys 1 to 9) picks on this page, or null when it holds none. */
export function pickIndexOfSlot(window: PickWindow, slot: number): number | null {
  if (!Number.isInteger(slot) || slot < 0 || slot >= window.size) return null;
  const index = window.start + slot;
  return index < window.count ? index : null;
}

/** The slot a candidate wears on this page, or null when it is on another page. */
export function pickSlotOfIndex(window: PickWindow, index: number): number | null {
  if (index < window.start || index >= window.start + window.size || index >= window.count) return null;
  return index - window.start;
}

/**
 * The offset of the page `direction` away, cycling past either end (the last page's next is the first): the owner asked
 * to "cycle through them". A single page stays where it is.
 */
export function pagedOffset(count: number, offset: number, size: number, direction: 1 | -1): number {
  const window = pickWindow(count, offset, size);
  if (!window.paged) return 0;
  const page = (window.page + direction + window.pageCount) % window.pageCount;
  return page * window.size;
}

/** The slot a number key means (Digit1 to Digit9, 0-based), or null for any other key. */
export function pickSlotOfDigit(code: string): number | null {
  const match = /^Digit([1-9])$/.exec(code);
  return match ? Number(match[1]) - 1 : null;
}

/** The "more" hint's words: "more ▸" with the page when there are several. */
export function pickMoreText(window: PickWindow): string {
  return `more ▸ ${window.page + 1}/${window.pageCount}`;
}

import type { PoolGridGeometry } from "../view/deck-pool-grid.js";
import type { Rect } from "../view/layout.js";

/** A button of a card's quantity strip ("−" or "+"): whether it presses, and why it does not. */
export interface CardPoolButton {
  /** Not pressable: dimmed. A string is the reason (a tooltip). */
  readonly disabled?: string | true;
  /** The button's name for assistive tech ("Remove a copy of Web-Swing"), already translated. */
  readonly aria: string;
}

/** A card as the pool draws it: everything is already worded, so the drawing has no rules of its own. */
export interface CardPoolCard {
  readonly cardId: string;
  /** The card scan, or null (then `missing` says so). */
  readonly imageUrl: string | null;
  /** What the picture box says with no scan: the card name. */
  readonly missing: string;
  /** The name, fitted to its width by the caller. */
  readonly title: string;
  /** The printed cost, or null for a card with none (its pip is left out). */
  readonly cost: number | null;
  /** Card view: the line under the name (type, why it is offered, a campaign mark). */
  readonly caption: string;
  /** The caption is a note the player should read (drawn stronger than a plain type line). */
  readonly captionStrong: boolean;
  /** List view: the type line, the why-offered note and the rules text. */
  readonly typeLine: string;
  readonly note: string | null;
  readonly rules: string;
  /** Copies in the deck: more than none draws a red, heavier frame in Card view. */
  readonly quantity: number;
  /** The −/+ strip (Card view) or end cluster (List view); absent for a pool that only reads. */
  readonly controls?: { readonly minus: CardPoolButton; readonly plus: CardPoolButton };
  /** The card is the one shown in a side pane: a red frame even with no copies. */
  readonly shown?: boolean;
}

/** What `drawCardPool` is given. */
export interface CardPoolModel {
  /** The scroll region's key (`list:pool`). */
  readonly key: string;
  /** The window the list is drawn in, in the sheet's own coordinates. */
  readonly rect: Rect;
  readonly view: "grid" | "list";
  /** False for a pool that only reads: no −/quantity/+ strip, so a card face takes its whole cell (true by default). */
  readonly controls?: boolean;
  readonly count: number;
  /** Card view's geometry (cell sizes, columns), with the strip's room already in `cellHeight`; null in List view. */
  readonly geometry: PoolGridGeometry | null;
  /** List view: a row's height and its picture's width. */
  readonly listRow: { readonly height: number; readonly thumbWidth: number };
  /** Where the list is scrolled to now (from the element, or what was remembered). */
  readonly scrollTop: number;
  /** One card, asked for only while its row is in the window. */
  readonly cardAt: (index: number) => CardPoolCard;
}

/** Where `drawCardPool` put things: what a scene needs for its focus stops, hover and the next scroll. */
export interface CardPoolLayout {
  readonly rowHeight: number;
  readonly rowCount: number;
  /** The window drawn, as `windowKey` writes it: a scroll that changes it needs a redraw. */
  readonly window: string;
  /** A card's whole cell or row, in the list's content space (a focus stop's box, after the scroll is applied). */
  readonly cellRect: (index: number) => Rect;
  /** The part of a card that a hover popover and a tap take: its picture and text, not the quantity strip. */
  readonly faceRect: (index: number) => Rect;
}

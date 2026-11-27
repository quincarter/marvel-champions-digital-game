import type { PictureSource } from "../../shared/picture.types.js";
import type { McPictureCardModel } from "../mc-picture-card/mc-picture-card.types.js";

/** One card on a shelf (a hero, a scenario): what it says, the picture it shows, and the key a press reports. */
export interface ShelfRosterCard {
  /** What `mc-activate` / `mc-inspect` report when the card is tapped / held, and the card's `data-key` (`elementOf`). */
  readonly key: string;
  /** The identity card the hover popover shows from the picture (`hoverFaces`). */
  readonly cardId: string;
  readonly model: McPictureCardModel;
  /** The picture as one value (a hero's picture, cropped around a centered subject); overrides the model picture. */
  readonly picture?: PictureSource;
}

/** The link at a shelf header's right end ("See all ▸"): a press reports `key`. */
export interface ShelfRosterLink {
  readonly label: string;
  readonly key: string;
}

/** One shelf: a header and a row of cards that scrolls sideways. */
export interface ShelfRosterShelf {
  readonly id: string;
  /** What a press on the header reports (it folds the shelf, or opens it, as the screen decides). */
  readonly key: string;
  readonly title: string;
  /** "5 identities", already translated. */
  readonly count: string;
  /** A folding shelf says whether it is open (a ▾ or ▸ before the title: a shape, not a color). Absent for a plain header. */
  readonly open?: boolean;
  readonly link?: ShelfRosterLink;
  /** Folded away: the header band only, no row. */
  readonly collapsed?: boolean;
  readonly cards: readonly ShelfRosterCard[];
}

/** What a shelf roster shows. */
export interface ShelfRosterModel {
  /** `shelves`: a header and a sideways row per shelf. `grid`: the cards of the first shelf wrapped into rows, no header. */
  readonly mode: "shelves" | "grid";
  readonly shelves: readonly ShelfRosterShelf[];
  /** A card's size in px. */
  readonly cardWidth: number;
  readonly cardHeight: number;
  /** The space between cards (px). */
  readonly gap: number;
  /** The space under a shelf (px). */
  readonly shelfGap: number;
  readonly headerHeight: number;
  /** Words in place of the shelves (nothing matches), or null. */
  readonly emptyText: string | null;
  /** A press on this under the empty words (Clear), or none. */
  readonly emptyAction?: { readonly label: string; readonly key: string };
  /** The chevrons' names for assistive tech. */
  readonly previousLabel: string;
  readonly nextLabel: string;
}

/** Where a roster is scrolled: down the column, and along each shelf's row (by shelf id). */
export interface ShelfRosterScroll {
  readonly top: number;
  readonly lefts: Readonly<Record<string, number>>;
}

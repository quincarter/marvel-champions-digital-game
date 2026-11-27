import type { GlyphSpec } from "../../shared/glyph.types.js";
import type { PictureSource } from "../../shared/picture.types.js";
import type { McPictureCardModel } from "../mc-picture-card/mc-picture-card.types.js";

/** One tile of a shelf: a picture over a caption (`mc-picture-card`), chosen or not. */
export interface ShelfRosterItem {
  readonly id: string;
  /**
   * What a press reports and the tile's `data-key` (`elementOf`); `entry:<id>` when absent. Set it where an id appears on
   * more than one shelf (a hero in the Recommended shelf and in its pack).
   */
  readonly key?: string;
  /** Present but not available now (a hero already at the table, a locked one): the whole tile dims. */
  readonly dim?: boolean;
  /** The card a hover popover shows from the picture; empty for none. */
  readonly cardId: string;
  readonly picture: PictureSource;
  /** The chip, title and detail printed on the tile. */
  readonly card: McPictureCardModel;
  /** The chosen tile: a heavy red frame (the chip says so in words too). */
  readonly selected: boolean;
  /** A hold or a right-click on the tile raises `mc-inspect`. */
  readonly inspect: boolean;
}

/** One shelf: a header and a row of tiles that scrolls sideways. */
export interface ShelfRosterShelf {
  readonly id: string;
  readonly title: string;
  /** What is on it, worded ("3 scenarios"). */
  readonly count: string;
  /** A small picture ahead of the title (a pack's cover); null for none. */
  readonly cover: PictureSource | null;
  /**
   * A folding shelf says whether it is unfolded (the header leads with a chevron, and a tap on it raises `fold:<id>`);
   * undefined: it does not fold.
   */
  readonly open: boolean | undefined;
  /** The "See all" link at the header's end (raises `all:<id>`); empty for none. */
  readonly seeAll: string;
  readonly items: readonly ShelfRosterItem[];
}

/**
 * The glyphs that say which trigger pages a row (LT / RT on a pad): drawn beside the chevrons of one shelf, the one focus is
 * in. The chevrons show for it even where a pointer is not fine. Absent specs draw nothing.
 */
export interface ShelfRosterHint {
  readonly shelfId: string;
  readonly previous: readonly GlyphSpec[] | null;
  readonly next: readonly GlyphSpec[] | null;
  /** The glyph height in px, already scaled by the hint size setting. */
  readonly height: number;
  /** No open / close transition (reduced motion). */
  readonly still: boolean;
}

export interface ShelfRosterModel {
  /** `shelves`: each shelf with its header and a sideways row. `grid`: the first shelf's tiles wrapped as a grid, no header. */
  readonly mode: "shelves" | "grid";
  readonly shelves: readonly ShelfRosterShelf[];
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly gap: number;
  /** The width the shelves take, px; the scrollbar's gutter comes out of the frame beside it. */
  readonly contentWidth: number;
  /** The row chevrons' words for a screen reader ("Scroll left" / "Scroll right"). */
  readonly previousLabel: string;
  readonly nextLabel: string;
  /** Words in place of the shelves (nothing matches), or null. */
  readonly emptyText: string | null;
  /** The button under the words that undoes the filter ("Clear"); empty for none. It raises `mc-activate` with `clear`. */
  readonly clearLabel: string;
  /** The row-paging glyphs (a pad is in use), or none. */
  readonly hint?: ShelfRosterHint | null;
}

import type { McButtonKind } from "../../shared/button.types.js";
import type { PictureSource } from "../../shared/picture.types.js";
import type { BarChartBar } from "../mc-bar-chart/mc-bar-chart.types.js";
import type { LineListGroup } from "../mc-line-list/mc-line-list.types.js";
import type { StatTile } from "../mc-stat-tiles/mc-stat-tiles.types.js";

/** A footer action. `disabled` dims it but a tap still raises `mc-activate`, so the screen can say why. */
export interface DeckDetailsAction {
  readonly label: string;
  readonly look: McButtonKind;
  readonly disabled?: string | true;
}

/** Everything the deck details panel shows, already translated. */
export interface DeckDetailsModel {
  /** The hero's identity card, which the hover popover shows from the picture. */
  readonly cardId: string;
  readonly picture: PictureSource;
  /** The picture's height in px. */
  readonly artHeight: number;
  /** The width of the body's column, px (the scrollbar's gutter comes out beside it). */
  readonly contentWidth: number;
  readonly title: string;
  /** "Spider-Man (Peter Parker) · Justice". */
  readonly who: string;
  /** "40 cards · Average cost 1.9". */
  readonly counts: string;
  /** The deck's standing in words (checking, not usable, in the seat), or null. */
  readonly status: string | null;
  /** Cards this build does not know, in words, or null. */
  readonly missing: string | null;
  readonly statsHeading: string;
  readonly cardsHeading: string;
  readonly bars: readonly BarChartBar[];
  readonly tileRows: readonly (readonly StatTile[])[];
  readonly groups: readonly LineListGroup[];
  readonly use: DeckDetailsAction;
  /** Null for a deck that cannot be edited. */
  readonly edit: DeckDetailsAction | null;
  readonly close: DeckDetailsAction;
}

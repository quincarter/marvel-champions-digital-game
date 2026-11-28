/**
 * What the Roster's drawing pieces (`roster/*.ts`) share: the layout numbers, the scene state they read, and `RosterCtx`,
 * the one object the scene hands them. The pieces are plain functions over it; the scene stays the owner of the panel, the
 * focus route, the search worker, signing and navigation.
 */
import type Phaser from "phaser";
import type { Deck } from "@mc/content";
import type { PictureLeases } from "../../../dom/picture-leases.js";
import type { SheetGlyphs } from "../../../dom/sheet-glyphs.js";
import type { RosterDeckOption, RosterModel } from "../../../view/campaign-roster-model.js";
import type { SeatedPair, SeatRecommendation } from "../../../view/seat-recommendations.js";
import type { DeckSwap, KeptConflict } from "../../../view/name-conflicts.js";
import type { Rect } from "../../../view/layout.js";
import type { FocusStop } from "../../focus-route.js";
import type { CampaignRosterData } from "../routes.js";

/** A heading in the seat picker's list ("Recommended for seat #2", "All heroes"): a compact band, not a full row. */
export const PICKER_HEADING_HEIGHT = 22;
/** A saved deck's own name (#658) takes a line under the hero's in its picker row, so the row grows by this much. */
export const PICKER_DECK_NAME_STEP = 16;
/** A seat card's footer height that fits the hero, a saved deck's name and the aspects without overlap (#658). */
export const SEAT_FOOTER_THREE_LINES = 64;
/** The picker list's key in the panel. */
export const PICKER_LIST = "pick-list";
/** The search field's key in the panel. */
export const PICKER_SEARCH = "pick-search";
/** The scrollbar's room beside a scroller (`SCROLL_GUTTER` in `@mc/ui`). */
export const SCROLL_GUTTER = 8;

/** One row of the open picker as laid out: where it is in the list's content, for the focus ring and the hover popover. */
export interface PickerRowPlace {
  readonly entryIndex: number;
  readonly top: number;
  readonly height: number;
  readonly identityId: string;
  readonly name: string;
  readonly picture: boolean;
  readonly badges: readonly { readonly label: string; readonly fill: number }[];
}

/** The open picker's layout, kept for the focus stops, the hover popover and the e2e hooks. */
export interface PickerView {
  readonly panel: Rect;
  readonly listRect: Rect;
  readonly thumbSide: number;
  readonly rows: readonly PickerRowPlace[];
  readonly content: number;
}

export interface RosterState {
  seats: (Deck | null)[];
  savedDecks: readonly Deck[];
  model: RosterModel | null;
  /** Galaxy's Most Wanted's Balanced house rule, as chosen before this screen (issue #609); null for Normal. */
  balanced: CampaignRosterData["balanced"] | null;
  campaignId: string;
  expertCampaign: boolean;
  pickerSeat: number | null;
  /** The picker's search text, and the worker's latest ranking of the decks for it (null: no query). */
  pickerQuery: string;
  pickerRanking: ReadonlyMap<string, number> | null;
  /** The open picker's recommendations, worked out once per seat line-up rather than on every keystroke. */
  pickerRecs: { readonly key: string; readonly recs: readonly SeatRecommendation[] } | null;
  pickerView: PickerView | null;
  /** Where the picker's list was scrolled to. */
  pickerTop: number;
  signing: boolean;
  error: string | null;
  /** The seated Team-Up pairs of the latest draw, for the phone's per-card tags. */
  pairs: readonly SeatedPair[];
  phoneLayout: boolean;
  /** Cards replaced because they cannot be played beside another seat's hero, and cards kept as a resource. */
  swaps: readonly DeckSwap[];
  kept: readonly KeptConflict[];
}

export interface RosterCtx {
  readonly scene: Phaser.Scene;
  readonly glyphs: SheetGlyphs;
  readonly leases: PictureLeases;
  readonly actions: Map<string, () => void>;
  readonly inspects: Map<string, () => void>;
  readonly stops: Map<string, FocusStop>;
  readonly obstacles: Rect[];
  readonly state: RosterState;
  scroller(): HTMLElement | null;
  openPicker(seatNumber: number): void;
  closePicker(): void;
  removeSeat(seatNumber: number): void;
  pickDeck(seatNumber: number, option: RosterDeckOption): void;
  onSign(): void;
  onCancel(): void;
  /** Hands the search worker the picker's decks, and the query to rank them for. */
  syncSearch(options: readonly RosterDeckOption[]): void;
  /** Puts the caret in the picker's search field. */
  focusSearch(): void;
  inspectIdentity(cardId: string): void;
}

/** The state of Take your seats the scene and its presses share: the draft and the choices the player made on this screen. */
import type { CoreAspect } from "@mc/content";
import { loadRecommendedCollapsed } from "../../view/seat-prefs.js";
import type { SetupDraft } from "../../view/setup-draft.js";
import { ALL_PACKS, type ShelfDrillState } from "../../view/shelf-drill.js";
import { loadShelfFolds } from "../../view/shelf-folds.js";
import { SeatsBook } from "./seats-book.js";
import type { SeatsSearch } from "./seats-search.js";

export class SeatsState {
  draft!: SetupDraft;
  readonly book = new SeatsBook();
  search!: SeatsSearch;
  /** Narrow only: the active seat's details are open, and the search field is shown. Shut by default. */
  detailsOpen = false;
  searchOpen = false;
  drill: ShelfDrillState = ALL_PACKS;
  /** The aspect whose tip is open, if any. */
  tipAspect: CoreAspect | null = null;
  /** The hero whose decks the Pick a deck sheet lists (its group key), while it is open. */
  decksKey: string | null = null;
  /** `null` until the player chooses; then remembered across visits (`view/seat-prefs.ts`). */
  recCollapsed: boolean | null = loadRecommendedCollapsed();
  /** The pack shelves folded to their header, remembered across visits (#753). */
  folded: ReadonlySet<string> = loadShelfFolds("seats");
  /** The deck under the pointer or under keyboard focus, whose reason the detail panel spells out. */
  hoverDeckId: string | null = null;
  focusDeckId: string | null = null;
}

/** What Decks & Collection and its presses share: the player's choices on this screen and what its workers last answered. */
import type { AnyCard, CoreAspect, Deck, HeroIdentityCard } from "@mc/content";
import type { PictureFocus } from "../../art/focus.js";
import type { Picture } from "../../art/pictures.js";
import type { DecksTab } from "../../components/decks/decks.types.js";
import { PictureLeases } from "../../dom/picture-leases.js";
import { CardPoolSearch } from "../../view/card-pool-search.js";
import type { CommunityOffer } from "../../view/community-decks-model.js";
import { DeckSearchClient } from "../../view/deck-search-client.js";
import type { DeckInsights } from "../../view/deck-insights.js";
import type { DeckListId } from "../../view/deck-list-open.js";
import type { ResultsHistory } from "../../view/results-history.js";
import type { RosterFilter } from "../../view/roster-filter.js";

/** What a caller (Title, on an `illegal_deck` refusal) hands over on launch. */
export interface DecksSceneData {
  /** Selected and scrolled into view; named in `message`: the deck `createGame` just refused. */
  readonly focusDeckId?: string | null;
  readonly message?: string | null;
}

/** The banner under the list heading. */
export interface DecksStatus {
  readonly text: string;
  readonly tone: "success" | "error";
}

export class DecksState {
  savedDecks: readonly Deck[] = [];
  data: DecksSceneData = {};
  status: DecksStatus | null = null;
  busy = false;
  pasteText = "";
  marvelcdbText = "";
  /** The card pool pane text search (name, traits, type, rules text, and `field:value` terms), kept across rebuilds. */
  poolSearchText = "";
  /** Both text searches run in a worker (view/deck-search-client.ts); each ranking is the last answer, shown until the next arrives. Null when no search is active. */
  readonly deckSearch = new DeckSearchClient();
  deckRanking: ReadonlyMap<string, number> | null = null;
  deckDocsVersion: string | null = null;
  /** The deck list first status pass also runs in the `deckSearch` worker; a deck is asked about once. */
  statusAsked = new WeakSet<Deck>();
  /** The pool the asked decks were sent against; a change (a pack loaded) forgets them so each is checked again. */
  statusAskedPool = "";
  /** Bumped whenever a worker answer is remembered, so the offers cache is rebuilt from the new statuses. */
  statusEpoch = 0;
  /** True while `askStatuses` is calling `checkDecks`: an answer that comes back inside the call (no worker) is used by the draw already under way. */
  askingStatuses = false;
  /** The pool search: `field:value` terms filter here, the free words are ranked by the worker (`view/card-pool-search.ts`). */
  poolSearch!: CardPoolSearch;
  poolDocsVersion: string | null = null;
  /** The deck and identity the pool pane draws now: what the search worker ranks. */
  poolContext: { readonly deck: Deck; readonly identity: HeroIdentityCard } | null = null;
  /** The deck whose Delete was pressed once and awaits its confirming second press. */
  deleteArmedId: string | null = null;
  filter: RosterFilter = { text: "" };
  /** Collapsed by default: the quick-filter chips cost nothing until asked for, so the deck list itself gets the column room. */
  filtersExpanded = false;
  /** Whether a phone pool chips are open under their Filters button; they start folded to leave the cards the room. */
  poolFiltersOpen = false;
  /** Which of the Import/Export box two fields is open, if either. */
  importExportOpen: "paste" | "marvelcdb" | null = null;
  poolAspectFilter: CoreAspect | "basic" | "identity" | null = null;
  poolSortByCost = false;
  selectedDeckId: string | null = null;
  /** The bundled hero picture chosen per identity this visit (a hero with several keeps one). */
  readonly deckPictures = new Map<string, Picture | null>();
  /** `deckArtOf`, per identity. */
  readonly deckArt = new Map<string, { url: string | null; tileUrl?: string; focus?: PictureFocus }>();
  /** The leases this screen holds on its mounted card and hero pictures (`dom/picture-leases.ts`). */
  readonly pictures = new PictureLeases();
  activeTab: DecksTab = "decks";
  history: ResultsHistory | null = null;
  /** What each deck finished games say (`view/deck-insights.ts`), folded in the stats worker; null until it answers. */
  insights: DeckInsights | null = null;
  /** The villain the games pane reads your winning decks against (a stepper); null: the most faced. */
  againstVillain: string | null = null;
  /** The stats pane tab: the deck own numbers, or what your games say about it (#529). LT / RT switch them. */
  paneTab: "deck" | "games" = "deck";
  /**
   * The pool card shown in the stats pane (#529): a tap or A on a pool card puts it there with what your games say about
   * it, in place of opening Inspect; "Deck stats" (or B) goes back to the deck. Null: the deck stats.
   */
  paneCard: AnyCard | null = null;
  /** The deck `paneCard` was opened on: a different selection (a copy, an import) shows that deck stats instead. */
  paneCardDeckId: string | null = null;
  /** The list shown alone (the Preconstructed, Your decks or Community chip), or null for all three (#755). */
  deckList: DeckListId | null = null;
  /** `communityOffers` for the saved decks and unlocks it was last built from (both are replaced, never mutated). */
  offersCache: {
    readonly epoch: number;
    readonly saved: readonly Deck[];
    readonly gate: unknown;
    readonly offers: readonly CommunityOffer[];
  } | null = null;
  focusedOnce = false;
  /** The deck an import just added: the next list draw scrolls to it, once. */
  scrollToDeckId: string | null = null;
  /** True while the selected row is only the first one, standing in for a `focusDeckId` deck not loaded yet. */
  fallbackSelection = false;
  /** True until the list is changed: a `focusDeckId` deck opens on every list, but only on the way in. */
  focusPinned = true;
  /** Counters the page reads as "start from the top" / "reveal this" keys: a bump is a request. */
  listTop = 0;
  poolTop = 0;
  revealKey = 0;
  /** A deck to reveal in the list on the next draw. */
  revealDeckId: string | null = null;
}

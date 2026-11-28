import type { AspectPickerModel } from "../../../components/deck-builder/mc-aspect-picker/mc-aspect-picker.types.js";
import type { BuilderActionsModel } from "../../../components/deck-builder/mc-builder-actions/mc-builder-actions.types.js";
import type {
  BuilderHeaderModel,
  BuilderLayout,
} from "../../../components/deck-builder/mc-builder-header/mc-builder-header.types.js";
import type { SaveBarModel } from "../../../components/deck-builder/mc-builder-save-bar/mc-builder-save-bar.types.js";
import type { BuilderTabsModel } from "../../../components/deck-builder/mc-builder-tabs/mc-builder-tabs.types.js";
import type { DeckChartsModel } from "../../../components/deck-builder/mc-deck-charts/mc-deck-charts.types.js";
import type { DeckListModel } from "../../../components/deck-builder/mc-deck-list/mc-deck-list.types.js";
import type { DeckNameModel } from "../../../components/deck-builder/mc-deck-name/mc-deck-name.types.js";
import type { GamesPanelModel } from "../../../components/deck-builder/mc-games-panel/mc-games-panel.types.js";
import type { IdentityPickerModel } from "../../../components/deck-builder/mc-identity-picker/mc-identity-picker.types.js";
import type { IdentityRowModel } from "../../../components/deck-builder/mc-identity-row/mc-identity-row.types.js";
import type { LegalityModel } from "../../../components/deck-builder/mc-legality-lines/mc-legality-lines.types.js";
import type { PackSortModel } from "../../../components/deck-builder/mc-pack-sort/mc-pack-sort.types.js";
import type { PoolListModel } from "../../../components/deck-builder/mc-pool-list/mc-pool-list.types.js";
import type { PoolSearchModel } from "../../../components/deck-builder/mc-pool-search/mc-pool-search.types.js";
import type { QuickFiltersModel } from "../../../components/deck-builder/mc-quick-filters/mc-quick-filters.types.js";
import type { RewardsModel } from "../../../components/deck-builder/mc-rewards-strip/mc-rewards-strip.types.js";
import type { ShowTogglesModel } from "../../../components/deck-builder/mc-show-toggles/mc-show-toggles.types.js";
import type { StartFromModel } from "../../../components/deck-builder/mc-start-from/mc-start-from.types.js";
import type { TypeFiltersModel } from "../../../components/deck-builder/mc-type-filters/mc-type-filters.types.js";
import type { BuilderTab, RailTab } from "../../../components/deck-builder/shared/deck-builder-events.types.js";

export type { BuilderLayout, BuilderTab, RailTab };

/** Which of the screen's three steps shows: pick a hero, "Start from" a precon, or the builder itself. */
export type BuilderStage = "pick" | "start" | "build";

/** The open aspect tip's words, as its plate shows them. */
export interface AspectTipModel {
  readonly aspect: string;
  readonly heading: string;
  readonly tagline: string;
  readonly body: string;
  readonly linkLabel: string;
  /** Why the lesson link is not live (empty when it is). */
  readonly linkReason: string;
  readonly linkAvailable: boolean;
}

/** The filters' fold: a Filters chip that opens them in the pool list's place. */
export interface FiltersFoldModel {
  readonly label: string;
  readonly open: boolean;
  /** How many filters are on, for the chip (words and a count, never colour). */
  readonly active: number;
}

/** The builder itself. */
export interface BuildModel {
  readonly identity: IdentityRowModel;
  readonly aspects: AspectPickerModel;
  /** Null in a campaign (a campaign seat's deck has no name of its own). */
  readonly name: DeckNameModel | null;
  readonly legality: LegalityModel;
  readonly rewards: RewardsModel | null;
  /** The narrow layout's Pool, Deck and From your games. */
  readonly tabs: BuilderTabsModel;
  /** The wide layout's Your deck and From your games. */
  readonly rail: BuilderTabsModel;
  readonly tab: BuilderTab;
  readonly railTab: RailTab;
  readonly chartTab: "curve" | "odds";
  readonly types: TypeFiltersModel;
  readonly shows: ShowTogglesModel;
  readonly quick: QuickFiltersModel;
  readonly packs: PackSortModel;
  readonly search: PoolSearchModel;
  /** Null when the filters are always shown; else the Filters chip (a phone, a tablet, a short window). */
  readonly fold: FiltersFoldModel | null;
  /** "128 cards". */
  readonly countText: string;
  /** "Card pool" / "Pool". */
  readonly poolLabel: string;
  readonly pool: PoolListModel;
  readonly charts: DeckChartsModel;
  readonly deckList: DeckListModel;
  readonly games: GamesPanelModel;
  readonly actions: BuilderActionsModel;
  readonly save: SaveBarModel;
}

/** Everything the deck builder shows, already computed and translated by the scene's view models. */
export interface DeckBuilderPageModel {
  readonly stage: BuilderStage;
  readonly header: BuilderHeaderModel;
  readonly pick: IdentityPickerModel | null;
  readonly start: StartFromModel | null;
  readonly build: BuildModel | null;
  /** The open aspect tip, if any. */
  readonly tip: AspectTipModel | null;
}

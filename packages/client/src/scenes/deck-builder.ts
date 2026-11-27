/**
 * The deck builder (PLAN.md Phase 9): pick an identity and its aspect(s), name the deck, search/filter the pool, add and
 * remove cards, and save — with live legality from the same `validateDeck` the Decks screen and `createGame` use
 * (`view/deck-builder-model.ts`'s `legalityOf`). This scene decides nothing about what's legal; it only shows what the
 * engine already said.
 *
 * Two entries: `{ deck }` edits a saved deck (its identity is already fixed); `{}` starts fresh, showing only the
 * identity picker until one is chosen — `Deck.identityCardId` is required, so there is no `Deck` to build against until
 * then (`view/deck-builder-model.ts`'s `newDeck` needs an identity).
 *
 * **A Lit panel over the canvas (Lit panels, phase 4).** The whole screen is one `mc-sheet` (`@mc/ui`), drawn with the
 * same layout this scene always computed (`SheetBuilder`'s boxes, text, buttons and picture parts at the layout's own
 * rects) and the same look; Phaser draws nothing here but the ground it shows through the chrome buttons' holes. What
 * the panel changes:
 * - the search, deck name and hero search are real `<input>`s (`mc-search-field`), so the caret, IME and the phone's
 *   keyboard are the browser's own;
 * - every list scrolls natively (a swipe on a list presses nothing: the tap rule is in `@mc/ui`), with the scroll
 *   gutter the sheet adds;
 * - the pool list (Card or List view) is windowed: only the rows near the viewport are parts, so a pool of thousands of
 *   cards costs what a screen of them does, and a card's picture is a lazy `<img>` that loads when its row is built, so
 *   art arriving never rebuilds the screen;
 * - hover (the card popover), hold / right-click Inspect and the pad's focus stops keep their keys and rects.
 *
 * Composition, against D04: three columns on a desktop (an aspect/filter rail ending in the cost curve, the card pool,
 * "Your deck" on an ink ground), one column of tabs below `WIDE_MIN_WIDTH`.
 *
 * **Issue #217 (2026-10-17).** A precon handed to this scene is never edited in place (`editableDeckOf`): the player
 * edits their own copy, which Save adds to their decks. The pool shows as card pictures by default (Card view, each cell
 * with its own −/+), with List view keeping the text rows. The search matches every word against name, traits, type and
 * rules text. Back warns once about unsaved changes, a saved deck can be deleted here, and New deck picks a hero from
 * searchable tiles, then starts from an empty deck or a copy of one of that hero's precons.
 */

import "@mc/ui";
import type { McSearchDetail, McSearchFocusDetail, McSearchField, McSheet } from "@mc/ui";
import { rebuildOnPackChange } from "../ui/pack-redraw.js";
import type { PictureFocus } from "../art/focus.js";
import Phaser from "phaser";
import type { AnyCard, CardType, CoreAspect, Deck, HeroIdentityCard, StarterDeck, Trait } from "@mc/content";
import { DECK_MIN_CARDS, requiredIdentitySet, type CampaignDeckContext, type CampaignGrant } from "@mc/engine";
import type { CardId } from "@mc/content";
import {
  CUSTOM_SHELF_ID,
  POOL_HERO_SHELF_PACKS,
  POOL_PACKS,
  POOL_VERSION,
  currentCardsById,
  currentPool,
  currentPoolKey,
  currentStarterDecks,
} from "../content/pool.js";
import { loadedPacks } from "../packs/pack-registry.js";
import { isHouseRulePack } from "../packs/pack-runtime.js";
import { cardDisplayName, qualifiedHeroName } from "../view/hero-names.js";
import { artFor, artLanguageNow } from "../art/art-source.js";
import { packPictureFor } from "../art/pack-art.js";
import { customCardBadgeOf, isCustomCard } from "../view/custom-content.js";
import { HERO_ART, heroArtForIdentity } from "../art/hero-art.js";
import { cardInspectModel } from "../view/inspect-model.js";
import {
  SELECTABLE_ASPECTS,
  addCard,
  aspectCountFor,
  packFilterChoices,
  traitFilterChoices,
  traitLabelOf,
  deckRuleRefusals,
  type DeckBuildingRules,
  QUICK_COST_MAX,
  stepChoice,
  withCycles,
  singleChoiceOf,
  pickSummaryOf,
  type FilterChoice,
  browsablePool,
  editableDeckOf,
  hasUnsavedChanges,
  preconsFor,
  startingDeckOf,
  touch,
  poolRowNote,
  poolTypeLine,
  subtitleCutFrom,
  identityOptions,
  legalityOf,
  removeCard,
  resetToIdentitySet,
  resetToPrecon,
  setAspects,
  setName,
  type PackInfo,
  type PoolFilter,
  type PoolSort,
  type PoolSortKey,
  DEFAULT_POOL_SORT,
} from "../view/deck-builder-model.js";
import {
  costCurveBars,
  deckCountText,
  deckListGroupsOf,
  deckListSortLabel,
  deckStatsOf,
  nextDeckListSort,
  type DeckListEntry,
  type DeckListSort,
} from "../view/deck-stats.js";
import { CHIP_GAP, chipStripHeight, splitInfoSegment, wrapChipsToRows } from "../view/chip-layout.js";
import { deckBuilderFocusOrder } from "../view/screen-focus.js";
import {
  activeDeckFilterCount,
  deckBuilderNarrowFocusOrder,
  deckBuilderTabRects,
  DECK_BUILDER_TABS,
  startTab,
  stepDeckBuilderTab,
  type DeckBuilderTab,
} from "../view/deck-builder-tabs.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { poolCellRect, poolGridGeometry, type PoolGridGeometry } from "../view/deck-pool-grid.js";
import { accent, hit, ink, signal, surface, typeRole, dotGrid, type TypeSpec } from "../tokens.js";
import { caseOf, cssOf } from "../ui/theme.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder, type Measured, type TextOptions } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { isDesktopType } from "../ui/desktop-type.js";
import {
  NOTHING_STANDS_OUT,
  againstVillainOf,
  fromYourGamesOf,
  fromYourGamesType,
  againstStepOf,
  type DeckInsights,
  type SuggestedCard,
} from "../view/deck-insights.js";
import { loadDeckInsights } from "../view/player-stats-client.js";
import { loadGlobalVillainCards, type GlobalLoad } from "../global-stats/global-stats-client.js";
import { globalVillainDecksOf } from "../global-stats/global-stats-model.js";
import { askAnswerAllowed } from "../view/global-ask.js";
import { readConsent } from "../global-stats/global-consent.js";
import { shareFinishedGamesNow } from "../global-stats/share-now.js";
import {
  AGAINST_LABELS,
  AGAINST_NOTE_FINISH,
  AGAINST_NOTE_NONE,
  AGAINST_NOTE_READING,
  AGAINST_NOTE_SHARE_IN_SETTINGS,
  AGAINST_NOTE_STALE,
  AGAINST_NOTE_UNAVAILABLE,
  globalRowFailed,
  shareLabel,
  shareLine,
  type AgainstSource,
} from "../view/global-stats-ui.js";
import type { GlobalVillainCards } from "@mc/sync-worker/global-protocol";
import { POOL_STATS_NAMES } from "../view/player-stats-names.js";
import { noteDeckFeat } from "../progression/deck-feats.js";
import { refreshUnlocks } from "../progression/progression.js";
import { appSession, campaignService, deckStorage } from "../session.js";
import { campaignCardsById, campaignPool } from "../content/campaign-pool.js";
import { openRunPacksNow } from "../campaign/run-packs.js";
import { cardSizeFactor } from "../settings.js";
import { deckBuilderRowSizes, type DeckBuilderRowSizes } from "../view/deck-builder-rows.js";
import {
  campaignDeckContextWithGrants,
  campaignDeckEditModel,
  campaignDeckSizeLabel,
  campaignDeckSizeSplit,
  campaignDeckVerdictOf,
  campaignRefusesAdd,
  campaignRefusesCut,
  prohibitedCampaignCardIds,
  removedFromCampaignCardIds,
  setRewardIncluded,
  type CampaignDeckEditModel,
  type CampaignDeckEditRow,
} from "../view/campaign-deck-edit-model.js";
import type { CampaignReturn } from "./campaign/routes.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { inputDevice } from "../platform/input-device.js";
import { SCENES } from "./keys.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { aspectTipContentOf, type AspectTipContent } from "../view/aspect-tip-model.js";
import { aspectStampOf } from "../view/aspect-stamp.js";
import { DeckSearchClient } from "../view/deck-search-client.js";
import { parsePoolQuery } from "../view/pool-query.js";
import type { SearchHelpSheetData } from "./search-help-sheet.js";
import type { PoolPickSheetData } from "./pool-pick-sheet.js";
import { deckCopiesOf, drawOdds, oddsGroupsOf, oddsRowsOf, percentText } from "../view/deck-odds.js";
import { deckBuilderView, rememberDeckBuilderView } from "../platform/deck-builder-view.js";
import type { DeckCheckSceneData } from "./deck-check.js";
import type { SearchDocument } from "../view/deck-search.js";
import type { CardLanguage } from "../art/card-language.js";
import { cardSearchDocumentOf } from "../view/card-search-document.js";
import { cardNamesReady, loadCardNames, localizedNameOf } from "../view/card-names.js";
import { localizedLabelOf } from "../view/card-text.js";
import { onArtChange } from "../language-change.js";
import { t, type MessageKey } from "../i18n/translate.js";
import type { AspectLessonSceneData } from "./aspect-lesson.js";
import { choicesWithPicks as withPicks } from "../view/pool-pick-rows.js";

/** How the pool is shown: card pictures in a grid, or the text rows with each card's rules. Kept between visits. */
type PoolView = "grid" | "list";

/**
 * Between-issue deck editing (`scenes/campaign/deck-edit.ts`), a campaign mode over this same screen rather than a
 * second deck grid: the identity is locked for the whole campaign (RRG 1.8 Appendix I; MC10 p. 3), so no picker,
 * no name field (a campaign seat's deck has none of its own) and no Preconstructed/Clear (both would silently drop
 * the campaign's own granted lines, which a player can never remove by hand). Save writes through
 * `campaignService().setSeatDeck` and returns to `returnTo`, instead of `deckStorage()` and the Decks screen.
 */
export interface DeckBuilderCampaignData {
  readonly runId: string;
  readonly seatNumber: number;
  readonly returnTo: CampaignReturn;
  readonly context: CampaignDeckContext;
  /** The header text: the campaign's own name plus the seat and its identity (`scenes/campaign/deck-edit.ts` builds it — it alone knows the campaign's display name). */
  readonly title: string;
  /** This seat's own `CampaignGrant`s, threaded to `campaignDeckEditModel` for `CampaignDeckEditRow.face` (MC27 p. 22's Enhanced side). */
  readonly grants: readonly CampaignGrant[];
  /** Present only when MC27 p. 6's optional freeze is still available to opt into (`deck-edit.ts`'s own eligibility check) — absent once the seat has opted in (routed to `SCENES.campaignFrozenDeck` instead) or for a box with no optional freeze at all. */
  readonly optionalFreeze?: { readonly eligible: true };
}

export interface DeckBuilderSceneData {
  readonly deck?: Deck;
  readonly campaign?: DeckBuilderCampaignData;
  /** Campaign mode: the deck as the run stores it, when `deck` already holds unsaved edits (back from Deck check). */
  readonly savedDeck?: Deck;
  /** Open on the deck rail's From your games tab (Decks & Collection's "Build my own from this" / "Edit with these"). */
  readonly railTab?: "deck" | "games";
  /** Open on this narrow tab: coming back from Deck check, on the Deck tab that opened it. */
  readonly tab?: DeckBuilderTab;
  /**
   * Where Back (and Delete) go instead of Decks, for a builder opened from another screen (the room deck picker's "Edit
   * deck"). That screen is given `focusDeckId` (the deck just saved, if any) on top of `data`.
   */
  readonly returnTo?: CampaignReturn;
}

/** The identity row's art window, wide for its height: a cover crop of the hero's face and shoulders. */
const IDENTITY_THUMB_ASPECT = 1.5;
/** The −, quantity and + at a pool row's right end. */
const POOL_ROW_CONTROLS_WIDTH = 146;
/** Card view: the −, quantity and + strip under each cell's caption. */
const GRID_CONTROLS_HEIGHT = hit.target + 8;
/** Lines of rules text a pool row shows before the ellipsis; Inspect has the rest. */
const CARD_TEXT_LINES = 3;
/** Room left at a scrolling region's right edge for its scrollbar, so no control sits under it. */
const NARROW_SCROLLBAR_GUTTER = 10;
/** The small label type in the case it is written in (a type line, a note, rules text): the old Phaser text drew these without capitals. */
const SENTENCE_LABEL: TypeSpec = { ...typeRole.label, uppercase: false };
/** Rows built above and below the pool list's viewport, so a scroll shows pictures already in place. */
const POOL_OVERSCAN_ROWS = 2;
/**
 * The pool this screen builds against: the base pool plus every loaded custom pack's cards (`currentPool()`). Each
 * derived list below is kept until the loaded packs change, so a pack installed or removed shows on the next visit
 * and nothing is rebuilt per frame.
 */
let campaignMode = false;
/** In a campaign's deck edit, the open run's pool (`campaignPool`, #978): its own pack copies, for search and lookups too. */
const poolNow = (): readonly AnyCard[] => (campaignMode ? campaignPool() : currentPool());
let identitiesOf: { readonly pool: readonly AnyCard[]; readonly list: readonly HeroIdentityCard[] } | null = null;
const identities = (): readonly HeroIdentityCard[] => {
  const now = poolNow();
  if (identitiesOf?.pool !== now) identitiesOf = { pool: now, list: identityOptions(now) };
  return identitiesOf.list;
};
const cardById = (): ReadonlyMap<string, AnyCard> => (campaignMode ? campaignCardsById() : currentCardsById());
/** What the search worker's documents are keyed by: the loaded packs, and in a campaign the open run's pack copies. */
const poolKeyNow = (): string =>
  campaignMode
    ? `${currentPoolKey()}|run:${openRunPacksNow()
        .map((pack) => `${pack.id}@${pack.version}`)
        .join(",")}`
    : currentPoolKey();

/**
 * `filter` plus the search's `field:value` terms (`pool-query.ts`) as clauses this side applies; the search worker
 * answers the search's free words.
 */
function withSearchClauses(filter: PoolFilter, search: string): PoolFilter {
  const clauses = parsePoolQuery(search).clauses;
  return clauses.length > 0 ? { ...filter, clauses } : filter;
}

/** The free words of a search, for the search worker; its `field:value` terms filter without it. */
const freeTextOf = (text: string): string => parsePoolQuery(text).text.trim();

/** Built on first search and kept: the documents the search worker ranks (every card; every hero). */
let poolSearchDocuments: {
  readonly pool: readonly AnyCard[];
  readonly lang: CardLanguage;
  readonly docs: readonly SearchDocument[];
} | null = null;
const POOL_SEARCH_DOCUMENTS = (): readonly SearchDocument[] => {
  const now = poolNow();
  const lang = artLanguageNow();
  if (poolSearchDocuments?.pool !== now || poolSearchDocuments.lang !== lang) {
    const infos = packInfos();
    poolSearchDocuments = {
      pool: now,
      lang,
      docs: now.map((card) =>
        cardSearchDocumentOf(
          card,
          infos.find((pack) => pack.code === (card.setCode as string))?.name,
          localizedNameOf(card.id as string, lang),
        ),
      ),
    };
  }
  return poolSearchDocuments.docs;
};
/** Every villain's name in the pool (what the Worker keys its villains by), for Everyone's Against stepper. */
let poolVillains: readonly string[] | null = null;
const poolVillainNames = (): readonly string[] =>
  (poolVillains ??= [
    ...new Set([...currentCardsById().values()].filter((card) => card.type === "villain").map((c) => c.name)),
  ]);
let heroSearchDocuments: {
  readonly list: readonly HeroIdentityCard[];
  readonly docs: readonly SearchDocument[];
} | null = null;
const HERO_SEARCH_DOCUMENTS = (): readonly SearchDocument[] => {
  const list = identities();
  if (heroSearchDocuments?.list !== list) {
    heroSearchDocuments = {
      list,
      docs: list.map((identity) => ({
        id: identity.id as string,
        primary: [qualifiedHeroName(identity), identity.name, identity.alterEgo.faceName],
        secondary: [...identity.hero.traits, ...identity.alterEgo.traits],
      })),
    };
  }
  return heroSearchDocuments.docs;
};

/** Every base pack, in release order, with its cycle — what the Pack/Cycle filter and the "pack" sort read. */
const BASE_PACK_INFOS: readonly PackInfo[] = POOL_PACKS.map((pack) => ({
  code: pack.code as string,
  name: pack.name,
  cycleId: POOL_HERO_SHELF_PACKS.find((p) => p.code === (pack.code as string))?.cycleId ?? (pack.cycleId as string),
  cycleName: POOL_HERO_SHELF_PACKS.find((p) => p.code === (pack.code as string))?.cycleName ?? (pack.cycleId as string),
}));
/** The base packs, then one per loaded custom pack (all in the "Custom packs" cycle), so the Pack filter can name them. */
const packInfos = (): readonly PackInfo[] => {
  const packs = loadedPacks();
  if (packs.length === 0) return BASE_PACK_INFOS;
  return [
    ...BASE_PACK_INFOS,
    // A house rule has no cards of its own to filter by.
    ...packs
      .filter((pack) => !isHouseRulePack(pack))
      .map((pack) => ({ code: pack.id, name: pack.name, cycleId: CUSTOM_SHELF_ID, cycleName: "Custom packs" })),
  ];
};

/** The Sort button's cycle (the primary key); the Then button cycles "None" and the rest but `match` and the primary. */
const SORT_CYCLE: readonly { readonly sort: PoolSortKey; readonly label: string }[] = [
  { sort: "match", label: "Match" },
  { sort: "name", label: "Name" },
  { sort: "aspect", label: "Aspect" },
  { sort: "type", label: "Type" },
  { sort: "cost", label: "Cost" },
  { sort: "pack", label: "Pack" },
];

/** The Then button's choices under `primary`: none first, then every key but `match` and the primary itself. */
const thenChoicesFor = (primary: PoolSortKey): readonly (PoolSortKey | null)[] => [
  null,
  ...SORT_CYCLE.map((o) => o.sort).filter((key) => key !== "match" && key !== primary),
];

/** Below this, the three-column desktop split doesn't have room to breathe and the scene stacks into one column instead. */
const WIDE_MIN_WIDTH = 1000;
const LEFT_RAIL_WIDTH = 230;
const RIGHT_RAIL_WIDTH = 300;
const RAIL_GAP = 24;
/** Card view's column cap: enough that a 4K window's pool keeps cards near their usual size instead of blowing them up. */
const POOL_MAX_COLUMNS = 20;

/** The Hero and Basic show toggles' focus stops (`type:<id>`), drawn before the type chips (issue #977). */
const SHOW_TOGGLE_IDS = ["show-hero", "show-basic"] as const;

/**
 * W1's type filter chips (docs/phase4-screen-gaps.md §3): "All" plus every `PoolFilter.type` the pool actually
 * holds player-deck cards of. `null` means "All" — no filter. `text` duplicates `label` to satisfy
 * `view/chip-layout.ts`'s `ChipLabel` (its wrap math reads a chip's display text under that name).
 */
const TYPE_FILTERS: readonly {
  readonly id: string;
  readonly label: string;
  readonly text: string;
  readonly type: CardType | null;
}[] = (
  [
    { id: "all", label: "All", type: null },
    { id: "ally", label: "Ally", type: "ally" },
    { id: "event", label: "Event", type: "event" },
    { id: "upgrade", label: "Upgrade", type: "upgrade" },
    { id: "support", label: "Support", type: "support" },
    { id: "resource", label: "Resource", type: "resource" },
    { id: "scheme", label: "Side scheme", type: "player_side_scheme" },
  ] as const
).map((chip) => ({ ...chip, text: chip.label }));

/** The quick Cost and Icon chips (issue #531): one tap filters, a second tap on the same chip clears it. */
const QUICK_FILTERS: readonly {
  readonly id: string;
  readonly text: string;
  readonly apply: (filter: PoolFilter, on: boolean) => PoolFilter;
  readonly isOn: (filter: PoolFilter) => boolean;
}[] = [
  ...Array.from({ length: QUICK_COST_MAX + 1 }, (_, cost) => ({
    id: `cost:${cost}`,
    text: cost === QUICK_COST_MAX ? `${cost}+` : `${cost}`,
    apply: (filter: PoolFilter, on: boolean): PoolFilter => ({ ...filter, cost: on ? cost : null }),
    isOn: (filter: PoolFilter): boolean => filter.cost === cost,
  })),
  ...(["physical", "mental", "energy", "wild"] as const).map((icon) => ({
    id: `icon:${icon}`,
    text: `${icon.charAt(0).toUpperCase()}${icon.slice(1)}`,
    apply: (filter: PoolFilter, on: boolean): PoolFilter => ({ ...filter, resource: on ? icon : null }),
    isOn: (filter: PoolFilter): boolean => filter.resource === icon,
  })),
];

/** Under this height the narrow layout folds the pool's filters behind the Filters chip, as a phone does. */
const FOLD_FILTERS_BELOW_HEIGHT = 700;
/** The search row's Card/List toggle, ?, Clear and their gaps, plus a field that can still show a query. */
const SEARCH_ROW_MIN_WIDTH = 92 + hit.target * 2 + CHIP_GAP * 3 + 160;
/** The wide left rail's Cost curve / Odds tabs: shorter than a touch target, as only a mouse reaches them there. */
const CHART_TAB_HEIGHT = 30;

/** From this column width the quick filters fit one row: ten chips, then a trait stepper `QUICK_TRAIT_WIDTH` wide. */
const QUICK_ONE_ROW_MIN = 720;
const QUICK_TRAIT_WIDTH = 200;

/** How long the mouse rests on an aspect's "i" before its tip opens (issue #911: too eager on fast sweeps). */
const ASPECT_TIP_HOVER_DELAY_MS = 350;

/** `color` scaled toward black by `factor` (0 to 1), channel by channel. */
function shade(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

/** What the panel's scrolling region the parts being built sit in is: its element key and where it shows on screen. */
interface Scope {
  readonly key: string;
  readonly view: Rect;
}

/** One place a card is drawn in a list, for the hover popover: `rect` is in the region's content space when `scope` is set. */
interface DeckLine {
  readonly cardId: string;
  readonly rect: Rect;
  readonly scope: Scope | null;
  /** The face to show when it is not the card's default (the identity row's hero side). */
  readonly face?: HoverCardIdRect["face"];
}

/** The pool list's element key. */
const POOL_LIST = "list:pool";

export class DeckBuilderScene extends Phaser.Scene {
  /** Row sizes for the global Card size setting, read in `create()`. */
  #rows: DeckBuilderRowSizes = deckBuilderRowSizes(1);
  #identity: HeroIdentityCard | null = null;
  #deck: Deck | null = null;
  #filter: PoolFilter = {};
  /** The left rail's chart on a wide screen: the cost curve, or the draw odds (issue #531). */
  #chartTab: "curve" | "odds" = "curve";
  /** The odds' group (`deck-odds.ts`) and how many cards are drawn; null is the first group / the opening hand. */
  #oddsGroup: string | null = null;
  #oddsDraws: number | null = null;
  /** The rule settings' verdicts for the deck last drawn (`#ruleRefusal`). */
  #refusals: {
    readonly deck: Deck;
    readonly rules: string;
    readonly refusal: (cardId: CardId, step: 1 | -1) => string | null;
  } | null = null;
  #filterText = "";
  #sort: PoolSort = DEFAULT_POOL_SORT;
  /** How the Your deck list is sorted (issue #594). */
  #deckSort: DeckListSort = "aspect";
  #status: string | null = null;
  /** The id of the deck this visit last saved, so Back can hand it to Decks to select. */
  #savedDeckId: string | null = null;
  /** The deck as storage holds it (null while it was never saved): what "unsaved changes" and Delete compare against. */
  #savedDeck: Deck | null = null;
  /** Back was pressed once with unsaved changes: the next press leaves without saving. */
  #leaveArmed = false;
  /** Delete was pressed once: the next press deletes the saved deck. */
  #deleteArmed = false;
  #poolView: PoolView = "grid";
  /** New deck's "Start from" step: the hero picked, while the player chooses an empty deck or one of its precons. */
  #startFor: HeroIdentityCard | null = null;
  #identitySearch = "";
  /** The pool search and the hero search, ranked off the main thread (`view/deck-search-client.ts`); new per visit. */
  #poolSearch: DeckSearchClient | null = null;
  #heroSearch: DeckSearchClient | null = null;
  /** The newest answer to the pool search (card id → score); null with no search text. */
  #poolRanking: ReadonlyMap<string, number> | null = null;
  #heroRanking: ReadonlyMap<string, number> | null = null;
  #busy = false;
  #returnTo: CampaignReturn | null = null;
  #campaign: DeckBuilderCampaignData | null = null;
  /** Recomputed every `#rebuild` from `#deck`/`#campaign` — the row-level marks the pool list and "your deck" panel both read; `null` outside campaign mode. */
  #campaignModel: CampaignDeckEditModel | null = null;
  /** `#campaignModel`'s rows by card id: a pool row reads one each time it scrolls in. */
  #campaignRows: ReadonlyMap<string, CampaignDeckEditRow> = new Map();
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();
  /** `#identityArtUrl`, per visit, so a redraw never reshuffles a hero with several pictures. */
  readonly #identityArt = new Map<string, { url: string | null; focus?: PictureFocus }>();
  /** The narrow layout's tab (issue #544). The wide layout's rail tab is `#railTab`; `#setTab` keeps the two in step. */
  #tab: DeckBuilderTab = "pool";
  /** A phone folds the pool's filters behind a Filters chip; whether it is open. */
  #filtersOpen = false;
  /** The last narrow draw's tab-row facts the focus order reads. */
  #narrowFolded = false;
  /** The desktop hover popover over the pool rows, the identity picker and the "Your deck" lines. */
  #hover: HoverPreview | null = null;
  /**
   * What the player's finished games say about this hero's cards (`view/deck-insights.ts`, issue #529 C2), folded in
   * the stats worker when the screen opens; null until it answers.
   */
  #insights: DeckInsights | null = null;
  /** The villain "From your games" reads your winning decks against (a stepper); null: the most faced. */
  #againstVillain: string | null = null;
  /** Whose decks the Against block reads: your own games' (from `#insights`) or everyone's (read on first use). */
  #againstSource: AgainstSource = "yours";
  /** Everyone's decks by villain, read when Everyone is chosen or the stepper rests on one; absent: not asked. */
  readonly #againstGlobal = new Map<string, GlobalLoad<GlobalVillainCards> | { readonly kind: "reading" }>();
  /** A press on "Share my games" is being saved (a second press waits), or the last one failed. */
  #shareBusy = false;
  #shareFailed = false;
  /** When Share first appeared (ms), for the 400 ms grace; null while it is not shown. */
  #shareShownAt: number | null = null;
  /** The stepper's read, waiting for it to rest on a villain (the Worker allows 120 reads an hour). */
  #stepTimer: Phaser.Time.TimerEvent | null = null;
  /** Which of the deck rail's two tabs shows: the deck list, or "From your games" (LB / RB). Not in campaign mode. */
  #railTab: "deck" | "games" = "deck";
  /** The rail tabs' and the From your games rows' stops, in the order drawn, for the focus route. */
  #railStops: string[] = [];
  /** Which aspect button's inline tip (G10b) is open, if any, and the timers of its hover open / close. */
  #aspectTipOpen: CoreAspect | null = null;
  #tipTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * The open tip's anchor and content, recorded by `#drawAspectPicker` and drawn by `#drawOpenAspectTip` once the
   * whole screen is down, so it sits over everything. `scope` marks an anchor inside a scrolling region, given in the
   * region's content space.
   */
  #openAspectTip: { readonly anchor: Rect; readonly content: AspectTipContent; readonly scope: Scope | null } | null =
    null;

  // ---- The panel ------------------------------------------------------------------------------------------------

  /** The panel: the whole screen, one Lit sheet made once a visit. */
  #region: DomRegion<McSheet> | null = null;
  /** The parts being built (the panel's top level, or a scrolling region's own while one is drawn). */
  #b!: SheetBuilder;
  #glyphs!: SheetGlyphs;
  /** What a press on each key does, this draw. */
  readonly #actions = new Map<string, () => void>();
  /** What a hold or a right-click on a key does when it is not what a press does (a hero tile: Inspect, not pick). */
  readonly #holds = new Map<string, () => void>();
  /** The scrolling region being drawn, if any: stops, hovers and the tip anchor in it are in its content space. */
  #scope: Scope | null = null;
  /** The scrolling regions this draw made, by element key (their scroll listeners and remembered offsets). */
  #scrollKeys: string[] = [];
  /** Where each scrolling region was scrolled to, kept across redraws and tab changes. */
  readonly #scrollMem = new Map<string, number>();
  /** Regions that go back to their top at the next mount (a new search or filter). */
  readonly #scrollReset = new Set<string>();
  readonly #hooked = new WeakSet<Element>();
  /** The field the caret is in (its key), or null: the route and the pad stand aside while one has it. */
  #focusedField: string | null = null;
  /** The pool list's rows drawn last (`start-end-count`): a scroll rebuilds only when the window moves. */
  #poolWindow = "";
  /** Each scrolling list's on-screen card rects, computed on demand from its scroll (a scroll draws nothing). */
  #hoverLists: (() => readonly (readonly [string, HoverCardIdRect])[])[] = [];
  /** The "Your deck" lines and From your games pictures, for the popover. */
  #deckLines: DeckLine[] = [];
  #alive = false;
  #artRedraw = false;

  constructor() {
    super(SCENES.deckBuilder);
  }

  create(data: DeckBuilderSceneData = {}): void {
    this.#alive = true;
    this.#region = null;
    this.#scrollMem.clear();
    this.#scrollReset.clear();
    this.#focusedField = null;
    this.#poolWindow = "";
    this.#aspectTipOpen = null;
    rebuildOnPackChange(this, () => this.#rebuild());
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#rows = deckBuilderRowSizes(cardSizeFactor(appSession().settings.cardSize));
    this.#campaign = data.campaign ?? null;
    this.#returnTo = data.returnTo ?? null;
    campaignMode = this.#campaign !== null;
    const given = data.deck ?? null;
    // A precon is never edited in place (issue #217): the builder edits the player's own copy of it.
    this.#deck =
      given && !this.#campaign ? editableDeckOf(given, `deck-${crypto.randomUUID()}`, new Date().toISOString()) : given;
    this.#savedDeck = this.#campaign ? (data.savedDeck ?? given) : null;
    this.#leaveArmed = false;
    this.#deleteArmed = false;
    this.#startFor = null;
    this.#identitySearch = "";
    this.#poolRanking = null;
    this.#heroRanking = null;
    this.#poolSearch = new DeckSearchClient();
    this.#heroSearch = new DeckSearchClient();
    // A campaign seat's hero may come from a pack the run carries but that is no longer installed (#978).
    const heroes = this.#campaign ? identityOptions(campaignPool()) : identities();
    this.#identity = this.#deck ? (heroes.find((i) => i.id === this.#deck!.identityCardId) ?? null) : null;
    // The sort, kept filters and card/list view the player last left (issue #531).
    const view = deckBuilderView();
    this.#filter = { ...view.filter };
    this.#sort = view.sort;
    this.#poolView = view.poolView;
    this.#deckSort = view.deckSort;
    this.#filterText = "";
    this.#status = given && this.#deck !== given ? t("deckBuilder.editingCopy") : null;
    this.#savedDeckId = null;
    this.#busy = false;
    // Whether this deck is already stored decides "unsaved changes" and Delete; a deck handed over unsaved (a copy) is not.
    if (given && this.#deck === given && !this.#campaign) {
      const id = given.id;
      void deckStorage()
        .get(id)
        .then((stored) => {
          if (!this.scene.isActive() || this.#deck?.id !== id) return;
          this.#savedDeck = stored;
          this.#rebuild();
        });
    }
    this.#filtersOpen = false;
    this.#insights = null;
    // Each visit starts on your own decks: a remembered Everyone, or a remembered "unavailable", does not outlive it.
    this.#againstSource = "yours";
    this.#againstVillain = null;
    this.#againstGlobal.clear();
    this.#shareFailed = false;
    this.#shareBusy = false;
    this.#shareShownAt = null;
    this.#stepTimer = null;
    this.#railTab = data.railTab === "games" ? "games" : "deck";
    this.#tab = data.tab ?? startTab(data.railTab);
    this.#glyphs = new SheetGlyphs(this, () => this.#rebuild());
    void appSession()
      .store.listSaves()
      .then((saves) => loadDeckInsights(saves))
      .then((insights) => {
        if (!this.scene.isActive()) return;
        this.#insights = insights;
        if (this.#showsGames()) this.#rebuild();
      })
      .catch(() => undefined);

    const onResize = (): void => this.#rebuild();
    this.scale.on("resize", onResize, this);
    // A picture whose source changed (the card language, a pack's art arriving) is a new URL on the same part: one
    // redraw, batched; a picture that merely loads never calls this (an `<img>` loads on its own).
    const offArt = onArtChange(() => {
      if (this.#artRedraw) return;
      this.#artRedraw = true;
      queueMicrotask(() => {
        this.#artRedraw = false;
        if (this.#alive && this.scene.isActive()) this.#rebuild();
      });
    });
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCardIds(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#stepTimer?.remove();
      this.#stepTimer = null;
      if (this.#tipTimer) clearTimeout(this.#tipTimer);
      this.scale.off("resize", onResize, this);
      offArt();
      this.#hover?.destroy();
      this.#hover = null;
      this.#glyphs.dispose();
      this.#poolSearch?.destroy();
      this.#poolSearch = null;
      this.#heroSearch?.destroy();
      this.#heroSearch = null;
    });
    // A pad that put the caret in a field can take it out again (B, A or Start). Bound before the route, so the A that
    // focuses the field is not also read as the press that leaves it (`text-field-escape.ts`).
    bindTextFieldEscape(
      this,
      () => ({
        focused: this.#focusedField !== null,
        blur: () => this.#fieldElement(this.#focusedField)?.blurInput(),
      }),
      () => this.#overlayUp(),
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      // B is the Back button (which asks to confirm when there are unsaved changes).
      onCancel: () => this.#stops.get("back")?.activate(),
      blocked: () => this.#overlayUp() || this.#focusedField !== null,
      onPage: (direction) => this.#scrollMain(direction * this.#mainHeight() * 0.9),
      // LB / RB: the narrow layout's tabs (Pool, Deck, From your games); the wide layout's deck rail has two.
      onTab: (direction) => {
        if (!this.#identity) return;
        if (!this.#isWide()) this.#setTab(stepDeckBuilderTab(DECK_BUILDER_TABS, this.#tab, direction));
        else this.#setRailTab(direction > 0 ? "games" : "deck");
      },
      onScroll: (_dx, dy) => this.#scrollMain(dy),
      onHomeEnd: (edge) => this.#scrollMain(edge === "home" ? -1e9 : 1e9),
    });
    this.#rebuild();
    fadeScreenIn(this);
  }

  /** Something drawn over the builder owns the keys and the pad: Inspect, the cheat sheet or the pack picker. */
  #overlayUp(): boolean {
    return (
      this.scene.isActive(SCENES.inspect) ||
      this.scene.isActive(SCENES.searchHelp) ||
      this.scene.isActive(SCENES.poolPick) ||
      this.scene.isActive(SCENES.aspectLesson)
    );
  }

  /** The field (`mc-search-field`) for a key, while it is drawn. */
  #fieldElement(key: string | null): McSearchField | null {
    return key ? ((this.#region?.element.elementOf(key) as McSearchField | null) ?? null) : null;
  }

  /** The scroller of a region, while it is drawn. */
  #scroller(key: string): HTMLElement | null {
    return this.#region?.element.elementOf(key) ?? null;
  }

  /** Where a region is scrolled to now: its element's offset, or what was remembered while it is not drawn. */
  #scrollTop(key: string): number {
    if (this.#scrollReset.has(key)) return 0;
    return this.#scroller(key)?.scrollTop ?? this.#scrollMem.get(key) ?? 0;
  }

  /** The region that takes the pad's paging and right stick: the first scrolling list on screen. */
  #mainScroller(): HTMLElement | null {
    for (const key of [POOL_LIST, "list:identity", ...this.#scrollKeys]) {
      const element = this.#scroller(key);
      if (element) return element;
    }
    return null;
  }

  #mainHeight(): number {
    return this.#mainScroller()?.clientHeight ?? 400;
  }

  #scrollMain(pixels: number): void {
    this.#mainScroller()?.scrollBy({ top: pixels });
  }

  /** The pool list goes back to its top (a new search, filter or sort). */
  #resetPool(): void {
    this.#scrollMem.set(POOL_LIST, 0);
    this.#scrollReset.add(POOL_LIST);
    this.#scrollReset.add("list:identity");
  }

  /** A press on a part of the panel (a button or a tap area). */
  #press(key: string): void {
    if (this.#overlayUp()) return;
    // A press anywhere but on the open aspect tip closes it.
    const closesTip = this.#aspectTipOpen !== null && !key.startsWith("aspect-");
    if (closesTip) this.#aspectTipOpen = null;
    this.#actions.get(key)?.();
    if (closesTip) this.#rebuild();
  }

  /** Every plain card the popover may open on: the lists' (clipped to their windows) and the "Your deck" lines. */
  #hoverCardIds(): ReadonlyMap<string, HoverCardIdRect> {
    const all = new Map<string, HoverCardIdRect>();
    for (const provider of this.#hoverLists) for (const [slot, rect] of provider()) all.set(slot, rect);
    this.#deckLines.forEach(({ cardId, rect, scope, face }, index) => {
      const at = scope ? this.#inScope(scope, rect) : rect;
      const shown = scope ? clipHoverRect(at, scope.view) : at;
      if (shown)
        all.set(hoverSlotOf(cardId, `line${index}`), { ...shown, cardId, through: true, ...(face ? { face } : {}) });
    });
    return all;
  }

  /** A rect given in a region's content space, on the screen now. */
  #inScope(scope: Scope, rect: Rect): Rect {
    return { ...rect, y: scope.view.y + rect.y - this.#scrollTop(scope.key) };
  }

  // ---- Drawing helpers --------------------------------------------------------------------------------------------

  /** A text, top left at (`x`, `y`) unless `origin`: `label` of the Phaser scene. */
  #text(
    x: number,
    y: number,
    text: string,
    spec: TypeSpec,
    color: number,
    alpha = 1,
    options: Omit<TextOptions, "color" | "alpha"> = {},
  ): Measured {
    return this.#b.text(x, y, caseOf(spec, text), spec, { color, ...(alpha < 1 ? { alpha } : {}), ...options });
  }

  /** The small capital label above a control group. */
  #label(x: number, y: number, text: string, onDark = false, options: Omit<TextOptions, "color" | "alpha"> = {}): void {
    this.#text(
      x,
      y,
      text,
      typeRole.label,
      onDark ? surface.paper.hex : surface.ink.hex,
      onDark ? ink.secondary : ink.label,
      options,
    );
  }

  /** A focus stop. In a scrolling region its rect follows the scroll, and taking focus scrolls it into view. */
  #stop(key: string, rect: Rect, activate: () => void, extra: Partial<FocusStop> = {}): void {
    const scope = this.#scope;
    if (!scope) {
      this.#stops.set(key, { rect, activate, ...extra });
      return;
    }
    this.#stops.set(key, {
      rect: () => this.#inScope(scope, rect),
      view: scope.view,
      activate,
      ensureVisible: () => this.#reveal(scope, rect),
      ...extra,
    });
  }

  /** Scrolls a region so `rect` (in its content space) is wholly in view. */
  #reveal(scope: Scope, rect: Rect): void {
    const element = this.#scroller(scope.key);
    if (!element) return;
    const top = element.scrollTop;
    if (rect.y < top) element.scrollTop = rect.y;
    else if (rect.y + rect.height > top + scope.view.height)
      element.scrollTop = rect.y + rect.height - scope.view.height;
  }

  /**
   * A button: its part, its press and its focus stop at once. `disabled` (a string says why) keeps it in place and dim;
   * the stop stays, as the old Phaser button's did, but its press does nothing.
   */
  #button(
    key: string,
    rect: Rect,
    label: string,
    onClick: () => void,
    options: {
      readonly look?: "primary" | "secondary" | "onInk" | "quiet" | "rail";
      readonly selected?: boolean;
      readonly disabled?: string | true;
      readonly type?: TypeSpec;
      readonly aria?: string;
      readonly stop?: boolean;
    } = {},
  ): void {
    this.#b.button({
      key,
      rect,
      label: caseOf(options.type ?? typeRole.label, label),
      look: options.look ?? "secondary",
      type: options.type ?? typeRole.label,
      ...(options.selected ? { selected: true } : {}),
      ...(options.disabled !== undefined ? { disabled: options.disabled } : {}),
      ...(options.aria ? { aria: options.aria } : {}),
    });
    const press = (): void => {
      if (options.disabled === undefined) onClick();
    };
    this.#actions.set(key, press);
    if (options.stop !== false) this.#stop(key, rect, press);
  }

  /**
   * A button in an aspect's own colors (the aspect chips, the precon rows): a box in the stamp's fill, its name in the
   * stamp's ink, a heavier outline while chosen, and a tap area over it. A tint is a fill, so what is chosen is also
   * said by the outline and a tick, never by the color alone.
   */
  #tintButton(
    key: string,
    rect: Rect,
    text: string,
    tint: { readonly fill: number; readonly ink: number },
    onClick: () => void,
    options: { readonly selected?: boolean; readonly disabled?: string | true; readonly type?: TypeSpec } = {},
  ): void {
    const b = this.#b;
    const off = options.disabled !== undefined;
    b.box(rect, {
      fill: tint.fill,
      stroke: surface.ink.hex,
      strokeWidth: options.selected ? 5 : 2,
      ...(off ? { alpha: 0.5 } : {}),
    });
    b.text(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      caseOf(options.type ?? typeRole.stamp, text),
      options.type ?? typeRole.stamp,
      {
        color: tint.ink,
        origin: [0.5, 0.5],
        fitWidth: rect.width - 12,
        ...(off ? { alpha: 0.5 } : {}),
      },
    );
    // The tick is its own mark beside the name, so what is chosen is said by the tick and the heavy outline, and the name stays the name.
    if (options.selected)
      b.text(rect.x + 10, rect.y + rect.height / 2, "✓", typeRole.rowTitle, {
        color: tint.ink,
        origin: [0, 0.5],
        ...(off ? { alpha: 0.5 } : {}),
      });
    b.tap(key, rect);
    const press = (): void => {
      if (!off) onClick();
    };
    this.#actions.set(key, press);
    this.#stop(key, rect, press);
  }

  /**
   * A scrolling region at `rect`: `draw` puts the content down from y 0 at its natural height (x is the screen's), and
   * the panel scrolls it natively. Stops and card hovers drawn in it follow the scroll.
   */
  #scrolled(key: string, rect: Rect, draw: (top: number) => number): void {
    const outer = this.#b;
    const before = this.#scope;
    this.#scrollKeys.push(key);
    outer.scrollFit(key, rect, (inner) => {
      this.#b = inner;
      this.#scope = { key, view: rect };
      const bottom = draw(0);
      this.#b = outer;
      this.#scope = before;
      return bottom;
    });
  }

  // ---- The screen ---------------------------------------------------------------------------------------------------

  #rebuild(): void {
    if (!this.#alive) return;
    this.#hoverLists = [];
    this.#deckLines = [];
    this.#railStops = [];
    this.#scrollKeys = [];
    this.#glyphs.reset();
    this.#stops = new Map();
    this.#actions.clear();
    this.#holds.clear();
    this.#openAspectTip = null;
    this.#scope = null;
    const { width, height } = this.scale.gameSize;
    const area: Rect = { x: 0, y: 0, width, height };
    this.#b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    const b = this.#b;
    b.box(area, { fill: surface.paper.hex });
    b.dots(area, "paper", dotGrid.onPaper.spacing, dotGrid.onPaper.radius, dotGrid.onPaper.alpha);

    const phone = formFactorFor(width, height) === "phone";
    const wide = !phone && width >= WIDE_MIN_WIDTH;
    const pad = phone ? 16 : 40;
    // The wide layout spans the whole window (issue #458): the rails keep their widths and the pool takes the rest,
    // adding columns as it grows (`POOL_MAX_COLUMNS`).
    const column = wide ? width - pad * 2 : Math.min(width - pad * 2, 720);
    const left = (width - column) / 2;

    let y = pad;
    // Campaign mode's title (the run's own name plus the seat and its identity, `scenes/campaign/deck-edit.ts`) can
    // run to two lines on a narrow layout, so the next row is placed from the title's own measured height.
    const titleText = this.#campaign ? this.#campaign.title.toUpperCase() : t("deckBuilder.title").toUpperCase();
    const title = b.text(left, y, titleText, typeRole.screenTitle, {
      color: surface.ink.hex,
      size: phone ? 28 : 38,
      wrapWidth: column - 108,
      letterSpacing: 2,
    });
    const backRect: Rect = { x: left + column - 100, y: y + 2, width: 100, height: hit.target };
    const campaign = this.#campaign;
    const dirty = this.#isDirty();
    const goBack = (): void => {
      // Unsaved changes: the first Back says so, the second leaves without saving.
      if (this.#isDirty() && !this.#leaveArmed) {
        this.#leaveArmed = true;
        this.#status = t(inputDevice().mode === "pad" ? "deckBuilder.unsavedLeavePad" : "deckBuilder.unsavedLeave");
        this.#rebuild();
        return;
      }
      if (campaign) goToScreen(this, campaign.returnTo.key, campaign.returnTo.data);
      else if (this.#returnTo) this.#leaveToReturn();
      // After a Save, Decks opens on the deck just saved (its row selected and in view).
      else goToScreen(this, SCENES.decks, this.#savedDeckId ? { focusDeckId: this.#savedDeckId } : undefined);
    };
    this.#button("back", backRect, dirty && this.#leaveArmed ? t("deckBuilder.leave") : t("deckBuilder.back"), goBack, {
      type: typeRole.rowTitle,
    });
    // Below the taller of the title and Back, so nothing drawn next sits against Back (issue #920).
    y += Math.max(title.height, phone ? 28 : 38, backRect.height + 2) + 16;

    if (!this.#identity && this.#startFor) {
      const startIds = this.#drawStartFrom(left, y, column, this.#startFor);
      this.#finish(area);
      this.#route?.set(
        deckBuilderFocusOrder({
          identityChosen: false,
          identityIds: [],
          identityExtraIds: startIds,
          aspectIds: [],
          typeFilterIds: [],
          poolCardIds: [],
        }),
        this.#stops,
      );
      this.#hover?.onDraw();
      return;
    }
    if (!this.#identity) {
      const shown = this.#drawIdentityPicker(left, y, column);
      this.#finish(area);
      this.#route?.set(
        deckBuilderFocusOrder({
          identityChosen: false,
          identityExtraIds: ["identity-search"],
          identityIds: shown.map((identity) => identity.id as string),
          aspectIds: [],
          typeFilterIds: [],
          poolCardIds: [],
        }),
        this.#stops,
      );
      this.#hover?.onDraw();
      return;
    }

    const deck = this.#deck!;
    this.#campaignModel = this.#campaign
      ? campaignDeckEditModel(deck, this.#pool(), this.#campaign.context, this.#campaign.grants)
      : null;
    this.#campaignRows = new Map(this.#campaignModel?.rows.map((row) => [row.cardId as string, row]));
    y = this.#drawIdentityRow(left, y, column, this.#identity);

    const pool = wide ? this.#rebuildWide(left, y, column, deck) : this.#rebuildNarrow(left, y, column, deck);
    this.#drawOpenAspectTip(area);
    this.#finish(area);

    if (!wide) {
      this.#route?.set(
        deckBuilderNarrowFocusOrder({
          tab: this.#tab,
          tabs: DECK_BUILDER_TABS,
          campaign: this.#campaign !== null,
          filtersFolded: this.#narrowFolded,
          filtersOpen: this.#filtersOpen,
          filterTextEntered: this.#filterText !== "",
          aspectIds: [...SELECTABLE_ASPECTS],
          typeFilterIds: [...SHOW_TOGGLE_IDS, ...TYPE_FILTERS.map((f) => f.id)],
          quickFilterIds: QUICK_FILTERS.map((f) => f.id),
          oddsIds: [...this.#stops.keys()].filter((key) => key.startsWith("odds:")),
          poolCardIds: pool.map((card) => card.id as string),
          rewardIds: (this.#campaignModel?.rewards ?? []).map((reward, at) => `${at}:${reward.cardId as string}`),
          showDelete: !this.#campaign && this.#savedDeck !== null,
          showFreeze: this.#campaign?.optionalFreeze?.eligible === true,
          gamesIds: this.#railStops,
        }),
        this.#stops,
      );
      this.#hover?.onDraw();
      return;
    }
    this.#route?.set(
      deckBuilderFocusOrder({
        identityChosen: true,
        identityIds: [],
        aspectIds: [...SELECTABLE_ASPECTS],
        typeFilterIds: [...SHOW_TOGGLE_IDS, ...TYPE_FILTERS.map((f) => f.id)],
        quickFilterIds: QUICK_FILTERS.map((f) => f.id),
        chartIds: [...this.#stops.keys()].filter((key) => key.startsWith("chart:") || key.startsWith("odds:")),
        poolCardIds: pool.map((card) => card.id as string),
        deckListIds: ["deck-sort", "deck-review"],
        showName: !this.#campaign,
        showPreconClear: !this.#campaign,
        showDelete: !this.#campaign && this.#savedDeck !== null,
        railIds: this.#railStops,
        filterExtraIds: [
          ...(this.#filterText ? ["filter-clear"] : []),
          "filter-help",
          "pool-view",
          ...(this.#narrowFolded ? ["filters-toggle"] : []),
        ],
        filtersFolded: this.#narrowFolded,
        filtersOpen: this.#filtersOpen,
        rewardIds: (this.#campaignModel?.rewards ?? []).map((reward, at) => `${at}:${reward.cardId as string}`),
      }),
      this.#stops,
    );
    this.#hover?.onDraw();
  }

  /** Hands the built parts to the panel (made once, so a list's scroll survives a redraw) and renders them now. */
  #finish(area: Rect): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      const keyOf = (event: Event): string => (event as CustomEvent<{ key: string }>).detail.key;
      element.addEventListener("mc-activate", (event) => this.#press(keyOf(event)));
      element.addEventListener("mc-inspect", (event) => {
        const key = keyOf(event);
        const hold = this.#holds.get(key);
        if (hold && !this.#overlayUp()) hold();
        else this.#press(key);
      });
      element.addEventListener("mc-hover", (event) => {
        const { key, over } = (event as CustomEvent<{ key: string; over: boolean }>).detail;
        this.#onTrack(key, over);
      });
      element.addEventListener("mc-search", (event) => {
        const field = (event.composedPath()[0] as HTMLElement | undefined)?.dataset?.key;
        this.#onSearch(field ?? "", (event as CustomEvent<McSearchDetail>).detail.value);
      });
      element.addEventListener("mc-search-focus", (event) => {
        const field = (event.composedPath()[0] as HTMLElement | undefined)?.dataset?.key ?? null;
        const focused = (event as CustomEvent<McSearchFocusDetail>).detail.focused;
        if (focused) this.#focusedField = field;
        else if (this.#focusedField === field) this.#focusedField = null;
      });
      this.#region = new DomRegion(this, element, area);
      // The card hover popover follows Phaser's pointer, which only hears the mouse over the canvas; the popover itself
      // is drawn in the canvas, so it is left out of the panel to be seen through it.
      this.#region.forwardMouseMoves();
      // Only while the pointer rests on a card: a press that follows a quick move onto a control must not land in the
      // hole of a popover that is still closing.
      this.#region.setHoles(() => {
        const popover = this.#hover?.shownRect;
        if (!popover) return [];
        const pointer = this.input.activePointer;
        for (const rect of this.#hoverCardIds().values())
          if (
            pointer.x >= rect.x &&
            pointer.x <= rect.x + rect.width &&
            pointer.y >= rect.y &&
            pointer.y <= rect.y + rect.height
          )
            return [popover];
        return [];
      });
    }
    this.#region.setRect(area);
    this.#region.element.nodes = this.#b.nodes;
    renderNow(this.#region.element);
    this.#afterMount();
  }

  /** A scrolling region just rendered: new ones go to where they were left, and every one tells the scene when it moves. */
  #afterMount(): void {
    for (const key of this.#scrollKeys.concat(this.#poolListKeys())) {
      const element = this.#scroller(key);
      if (!element) continue;
      const forced = this.#scrollReset.has(key);
      if (!this.#hooked.has(element)) {
        this.#hooked.add(element);
        element.addEventListener("scroll", () => this.#onScroll(key, element.scrollTop), { passive: true });
        const kept = this.#scrollMem.get(key) ?? 0;
        if (kept > 0 && !forced) element.scrollTop = kept;
      }
      if (forced) {
        element.scrollTop = 0;
        this.#scrollMem.set(key, 0);
      }
    }
    this.#scrollReset.clear();
  }

  #poolListKeys(): string[] {
    return [POOL_LIST, "list:identity"];
  }

  /** A region scrolled: it is remembered, the pool list builds the rows the new offset shows, an open tip follows. */
  #onScroll(key: string, top: number): void {
    this.#scrollMem.set(key, top);
    if (key === POOL_LIST && this.#poolWindowNow() !== this.#poolWindow) this.#rebuild();
    else if (this.#aspectTipOpen && key !== POOL_LIST) this.#rebuild();
  }

  #onSearch(field: string, value: string): void {
    if (field === "filter-text") {
      if (value !== this.#filterText) this.#applyFilterText(value);
    } else if (field === "name") {
      if (this.#deck && value !== this.#deck.name) this.#setDeck(setName(this.#deck, value), false);
    } else if (field === "identity-search") {
      if (value !== this.#identitySearch) {
        this.#identitySearch = value;
        this.#resetPool();
        this.#requestHeroSearch(value);
      }
    }
  }

  /** The search box's text changed: the pool is ranked for it and redrawn from its top. */
  #applyFilterText(value: string): void {
    this.#filterText = value;
    this.#resetPool();
    this.#requestPoolSearch(value);
  }

  /** The rows the pool list would build now: `start-end-count`, or "" when there is no list. */
  #poolWindowNow(): string {
    return this.#poolWindowFor(this.#scrollTop(POOL_LIST));
  }

  #poolWindowFor(top: number): string {
    const rowHeight = this.#poolRowHeight;
    if (rowHeight <= 0 || this.#poolRowCount <= 0) return "";
    const start = Math.max(0, Math.floor(top / rowHeight) - POOL_OVERSCAN_ROWS);
    const end = Math.min(this.#poolRowCount, Math.ceil((top + this.#poolViewHeight) / rowHeight) + POOL_OVERSCAN_ROWS);
    return `${start}-${end}-${this.#poolRowCount}`;
  }

  /** What the pool list last drew (`#drawPoolList`): its row height, row count and window height. */
  #poolRowHeight = 0;
  #poolRowCount = 0;
  #poolViewHeight = 0;
  /** Cards this screen must never offer to *add*: RRG 1.8 p. 29 removals from the campaign this deck belongs to. A line already in the deck from before a removal still shows (in "your deck" and, so a player can remove it, in the pool list) via `#campaignModel`'s own `refused` mark — this only narrows what browsing turns up. `null` outside campaign mode. */
  #removedFromCampaignIds(): ReadonlySet<string> | null {
    return this.#campaign ? new Set([...removedFromCampaignCardIds(this.#campaign.context)].map(String)) : null;
  }

  /** Cards this screen must never offer to *add*: MC27 p. 4's `Campaign.prohibited.cardIds` (Venom the ally 27190, Symbiote Suit 27191). Same narrowing rule as `#removedFromCampaignIds` — a line the deck already holds still shows, so its own refused "+"/"−" can fix it. `null` outside campaign mode. */
  #prohibitedCampaignIds(): ReadonlySet<string> | null {
    return this.#campaign ? new Set([...prohibitedCampaignCardIds(this.#campaign.context)].map(String)) : null;
  }

  /** The deck-building rule settings (Settings › Gameplay, issue #531). Campaign decks follow their campaign's rules. */
  #rules(): DeckBuildingRules {
    const settings = appSession().settings;
    return this.#campaign
      ? { signature: "free", copyLimits: false }
      : { signature: settings.deckSignatureCards, copyLimits: settings.deckCopyLimits };
  }

  /** Why the rule settings refuse adding (`1`) or removing (`-1`) one `cardId`, or null; built once per deck. */
  #ruleRefusal(deck: Deck, cardId: CardId, step: 1 | -1): string | null {
    if (!this.#identity) return null;
    const rules = this.#rules();
    const cached = this.#refusals;
    if (!cached || cached.deck !== deck || cached.rules !== rules.signature + rules.copyLimits)
      this.#refusals = {
        deck,
        rules: rules.signature + rules.copyLimits,
        refusal: deckRuleRefusals(deck, this.#identity, this.#pool(), rules),
      };
    return this.#refusals!.refusal(cardId, step);
  }

  /** Keeps the pool's sort, filters and view for the next visit (`platform/deck-builder-view.ts`). */
  #rememberView(): void {
    rememberDeckBuilderView({
      sort: this.#sort,
      filter: this.#filter,
      poolView: this.#poolView,
      deckSort: this.#deckSort,
    });
  }

  /** `deck`'s own campaign row, by card id — `null` outside campaign mode or for a card with no line yet. */
  /**
   * The cards this screen builds against: everything installed, and in a campaign the cards of the packs the run carries
   * too (`campaignPool`, #978), so a custom hero's run edits its deck even after the hero's pack is removed.
   */
  #pool(): readonly AnyCard[] {
    return this.#campaign ? campaignPool() : poolNow();
  }

  #campaignRowFor(cardId: string): CampaignDeckEditRow | null {
    return this.#campaignRows.get(cardId) ?? null;
  }

  /** `browsablePool`, narrowed for campaign mode: a removed card the deck doesn't currently hold is left out of what browsing turns up (`#removedFromCampaignIds`); one it still holds stays, so its row's own "−" can fix the deck. */
  #browsablePool(deck: Deck): readonly AnyCard[] {
    // A card the deck already holds stays listed even if its rules now refuse it (so its "-" can remove it); campaign
    // mode keeps its own marks for that (`#campaignModel`), and its granted lines are never browsable.
    const held = this.#campaign ? new Set<string>() : new Set(deck.cards.map((line) => line.cardId as string));
    const ranking = freeTextOf(this.#filterText) ? this.#poolRanking : null;
    const listed = browsablePool(
      this.#pool(),
      this.#identity!,
      deck.aspects,
      withSearchClauses(this.#filter, this.#filterText),
      this.#sort,
      packInfos(),
      held,
      ranking ?? undefined,
    );
    // The search worker answers the text search: only its matches stay, in the chosen sort (its ranking orders them
    // only under the Match sort, issue #531).
    const searched = ranking ? listed.filter((card) => ranking.has(card.id as string)) : listed;
    // "Hidden" signature cards stay in the deck but leave the pool list (Settings › Gameplay, issue #531), except one
    // the deck holds fewer of than its set's count, so it can be put back.
    const hidden =
      this.#rules().signature === "hidden"
        ? new Set(
            requiredIdentitySet(this.#identity!, this.#pool())
              .filter((line) => (deck.cards.find((c) => c.cardId === line.cardId)?.quantity ?? 0) >= line.quantity)
              .map((line) => line.cardId as string),
          )
        : null;
    const pool = hidden ? searched.filter((card) => !hidden.has(card.id as string)) : searched;
    const removed = this.#removedFromCampaignIds();
    const prohibited = this.#prohibitedCampaignIds();
    if (!removed && !prohibited) return pool;
    const alreadyHeld = (cardId: AnyCard["id"]): boolean =>
      (deck.cards.find((line) => line.cardId === cardId)?.quantity ?? 0) > 0;
    return pool.filter((card) => {
      if (removed?.has(card.id as string) && !alreadyHeld(card.id)) return false;
      if (prohibited?.has(card.id as string) && !alreadyHeld(card.id)) return false;
      return true;
    });
  }

  /** True from `WIDE_MIN_WIDTH` up on a non-phone: the three-column desktop layout. Below it, the tabbed narrow one. */
  #isWide(): boolean {
    const { width, height } = this.scale.gameSize;
    return formFactorFor(width, height) !== "phone" && width >= WIDE_MIN_WIDTH;
  }

  /** From your games is on screen: its narrow tab, or the wide rail's second tab. */
  #showsGames(): boolean {
    return this.#isWide() ? this.#railTab === "games" : this.#tab === "games";
  }

  /** The narrow layout's tab press (a tap, Enter, or LB / RB). Each tab keeps its own scroll; the aspect tip closes. */
  #setTab(tab: DeckBuilderTab): void {
    if (this.#tab === tab) return;
    this.#tab = tab;
    this.#railTab = tab === "games" ? "games" : "deck";
    this.#aspectTipOpen = null;
    this.#rebuild();
    this.#route?.focusKey(`tab:${tab}`);
  }

  /** A mouse resting on, or leaving, an aspect's "i" or its open tip: the tip opens after a pause and closes on leaving both. */
  #onTrack(key: string, over: boolean): void {
    const clear = (): void => {
      if (this.#tipTimer) clearTimeout(this.#tipTimer);
      this.#tipTimer = null;
    };
    if (key.startsWith("aspect-info:")) {
      const aspect = key.slice("aspect-info:".length) as CoreAspect;
      clear();
      if (over) {
        if (this.#aspectTipOpen === aspect) return;
        this.#tipTimer = setTimeout(() => {
          this.#tipTimer = null;
          this.#aspectTipOpen = aspect;
          this.#rebuild();
        }, ASPECT_TIP_HOVER_DELAY_MS);
      } else if (this.#aspectTipOpen === aspect) this.#closeTipSoon();
    } else if (key === "aspect-tip") {
      clear();
      if (!over) this.#closeTipSoon();
    }
  }

  #closeTipSoon(): void {
    if (this.#tipTimer) clearTimeout(this.#tipTimer);
    this.#tipTimer = setTimeout(() => {
      this.#tipTimer = null;
      if (this.#aspectTipOpen === null) return;
      this.#aspectTipOpen = null;
      this.#rebuild();
    }, 140);
  }

  /**
   * The narrow (phone and tablet portrait) layout (issue #544): a fixed tab row under the header — Pool, Deck, From
   * your games — and one tab's content filling the rest of the screen, so only one thing ever scrolls. Returns the
   * browsable pool (the Pool tab's cards; empty on the other tabs), for the caller's focus order.
   */
  #rebuildNarrow(left: number, top: number, column: number, deck: Deck): readonly AnyCard[] {
    const { height } = this.scale.gameSize;
    const pad = 16;
    let y = this.#drawTabRow(left, top, column, DECK_BUILDER_TABS, deck);

    if (this.#tab === "games") {
      const rect: Rect = { x: left, y, width: column, height: Math.max(hit.target * 2, height - y - pad) };
      this.#scrolled("list:games", rect, (at) =>
        this.#drawFromYourGames(left, at, column - NARROW_SCROLLBAR_GUTTER, deck, false),
      );
      return [];
    }

    if (this.#tab === "deck") {
      // Save is pinned under the region so it stays reachable however far the deck list runs.
      const saveHeight = hit.primary + 8;
      const rect: Rect = {
        x: left,
        y,
        width: column,
        height: Math.max(hit.target * 2, height - y - pad - saveHeight),
      };
      const inner = column - NARROW_SCROLLBAR_GUTTER;
      this.#scrolled("list:deck", rect, (at) => {
        let next = at;
        next = this.#drawAspectPicker(left, next, inner, deck);
        if (!this.#campaign) next = this.#drawNameField(left, next, inner, deck);
        next = this.#drawLegalityLine(left, next, inner, deck);
        next = this.#drawRewardsStrip(left, next, inner, false);
        this.#label(left, next, t("deckBuilder.costCurveLabel"));
        next = this.#drawCostCurve(left, next + 16, inner, deck, false);
        this.#label(left, next, t("deckBuilder.oddsLabel"));
        next = this.#drawOdds(left, next + 16, inner, deck, hit.target);
        next = this.#drawYourDeckList(left, next, inner, deck, false);
        return this.#drawPreconClearSave(left, next, inner, deck, false, "actions");
      });
      this.#drawPreconClearSave(left, rect.y + rect.height + 8, column, deck, false, "save");
      return [];
    }

    // Pool: the search row, the filters (behind a chip on a phone), and the list filling what is left.
    y = this.#drawFilterInput(left, y, column);
    const pool = this.#browsablePool(deck);
    const folded = this.#filtersFold();
    this.#narrowFolded = folded;
    const countText = this.#countText(pool.length);
    if (folded) {
      this.#drawFiltersToggle({ x: left, y, width: Math.min(column * 0.55, 200), height: hit.target });
      this.#text(left + column, y + hit.target / 2, countText, typeRole.label, surface.ink.hex, ink.meta, {
        origin: [1, 0.5],
      });
      y += hit.target + 12;
      if (this.#filtersOpen) {
        // The panel takes the list's place; the count above updates as the chips are pressed.
        const rect: Rect = { x: left, y, width: column, height: Math.max(hit.target * 2, height - y - pad) };
        const inner = column - NARROW_SCROLLBAR_GUTTER;
        this.#scrolled("list:filters", rect, (at) => {
          let next = this.#drawTypeFilters(left, at, inner);
          next = this.#drawQuickFilters(left, next, inner, deck);
          return this.#drawPackAndSort(left, next, inner, deck);
        });
        return pool;
      }
    } else {
      y = this.#drawTypeFilters(left, y, column);
      y = this.#drawQuickFilters(left, y, column, deck);
      y = this.#drawPackAndSort(left, y, column, deck);
      this.#label(left, y, `${t("deckBuilder.poolLabel")} — ${countText}`);
      y += 16;
    }
    const listRect: Rect = { x: left, y, width: column, height: Math.max(this.#rows.cardRowHeight, height - y - pad) };
    this.#drawPoolList(listRect, deck, pool);
    return pool;
  }

  /** "N cards" in the player's language. */
  #countText(count: number): string {
    return t(count === 1 ? "deckBuilder.cardCountOne" : "deckBuilder.cardCount", { count });
  }

  /**
   * Whether the filters sit behind a "Filters" chip: everywhere but a desktop-size screen, so a tablet's pool gets the
   * height (issue #631). Anything short folds them too: drawn open on a landscape phone they would push the list off
   * the screen.
   */
  #filtersFold(): boolean {
    const { width, height } = this.scale.gameSize;
    return formFactorFor(width, height) !== "desktop" || height < FOLD_FILTERS_BELOW_HEIGHT;
  }

  /** The "Filters" chip: opens the filters in the pool list's place, and counts how many are on. */
  #drawFiltersToggle(rect: Rect): void {
    const active = activeDeckFilterCount(this.#filter, this.#sort);
    const toggle = (): void => {
      this.#filtersOpen = !this.#filtersOpen;
      this.#rebuild();
      if (inputDevice().mode === "keyboard" || inputDevice().mode === "pad") this.#route?.focusKey("filters-toggle");
    };
    this.#button(
      "filters-toggle",
      rect,
      `${this.#filtersOpen ? "▾" : "▸"} ${t("deckBuilder.filters")}${active > 0 ? ` · ${active}` : ""}`,
      toggle,
      { selected: active > 0 },
    );
  }

  /** The fixed tab row: Pool, Deck with its live count, and From your games. Returns the y below it. */
  #drawTabRow(left: number, top: number, column: number, tabs: readonly DeckBuilderTab[], deck: Deck): number {
    const counted = this.#campaignModel
      ? campaignDeckSizeSplit(this.#campaignModel).counted
      : deckStatsOf(deck, this.#pool()).countedCards;
    const labels = tabs.map((tab) =>
      tab === "pool"
        ? t("deckBuilder.tabPool")
        : tab === "games"
          ? t("deckBuilder.tabGames")
          : counted < DECK_MIN_CARDS
            ? t("deckBuilder.tabDeckOf", { count: counted, min: DECK_MIN_CARDS })
            : t("deckBuilder.tabDeck", { count: counted }),
    );
    const rects = deckBuilderTabRects(labels, { x: left, y: top, width: column, height: hit.target }, 6);
    const current = tabs.indexOf(this.#tab);
    tabs.forEach((tab, index) => {
      const rect = rects[index]!;
      const selected = tab === this.#tab;
      const open = (): void => this.#setTab(tab);
      const key = `tab:${tab}`;
      // LB / RB reach the neighbouring tab: its glyph sits on that tab.
      const glyph = index === current - 1 ? "zonePrevious" : index === current + 1 ? "zoneNext" : null;
      if (glyph) {
        this.#glyphs.button(this.#b, {
          key,
          rect,
          label: caseOf(typeRole.label, labels[index]!),
          look: selected ? "primary" : "secondary",
          type: typeRole.label,
          ids: [glyph],
          ground: "paper",
        });
        this.#actions.set(key, open);
        this.#stop(key, rect, open);
      } else this.#button(key, rect, labels[index]!, open, { look: selected ? "primary" : "secondary" });
    });
    return top + hit.target + 12;
  }

  /**
   * The wide (desktop) layout (D04): a left aspect/filter/cost-curve rail, the card pool in the middle, "Your deck" on
   * its own ink ground on the right. Returns the browsable pool, for the caller's focus order.
   */
  #rebuildWide(left: number, top: number, column: number, deck: Deck): readonly AnyCard[] {
    const { height } = this.scale.gameSize;
    const pad = 40;
    const bottom = height - pad;
    const folded = this.#filtersFold();
    this.#narrowFolded = folded;

    const leftX = left;
    const midX = leftX + LEFT_RAIL_WIDTH + RAIL_GAP;
    const midWidth = Math.max(240, column - LEFT_RAIL_WIDTH - RIGHT_RAIL_WIDTH - RAIL_GAP * 2);
    const rightX = midX + midWidth + RAIL_GAP;

    // Left rail: aspect, filter, cost curve.
    let leftY = top;
    leftY = this.#drawAspectPicker(leftX, leftY, LEFT_RAIL_WIDTH, deck);
    if (!folded) {
      // The Hero and Basic toggles go in the middle, on the card count's row: the rail has no height to spare, and they
      // pushed the cost curve off a 900-high screen (PR #980 review).
      leftY = this.#drawTypeFilters(leftX, leftY, LEFT_RAIL_WIDTH, false);
      leftY = this.#drawPackAndSort(leftX, leftY, LEFT_RAIL_WIDTH, deck);
    }
    // The cost curve and the odds share the rail's last room behind two tabs (issue #531).
    const tabWidth = (LEFT_RAIL_WIDTH - CHIP_GAP) / 2;
    for (const [i, tab] of (["curve", "odds"] as const).entries()) {
      const rect: Rect = { x: leftX + i * (tabWidth + CHIP_GAP), y: leftY, width: tabWidth, height: CHART_TAB_HEIGHT };
      const pick = (): void => {
        this.#chartTab = tab;
        this.#rebuild();
      };
      this.#button(
        `chart:${tab}`,
        rect,
        tab === "curve" ? t("deckBuilder.chartCurve") : t("deckBuilder.chartOdds"),
        pick,
        {
          selected: this.#chartTab === tab,
        },
      );
    }
    leftY += CHART_TAB_HEIGHT + CHIP_GAP;
    if (this.#chartTab === "curve") this.#drawCostCurve(leftX, leftY, LEFT_RAIL_WIDTH, deck, true);
    else this.#drawOdds(leftX, leftY, LEFT_RAIL_WIDTH, deck, CHART_TAB_HEIGHT);

    // Right rail: name, legality, Your deck, Preconstructed/Clear, Save — one ink ground panel behind all of it.
    this.#b.box(
      { x: rightX, y: top - 8, width: RIGHT_RAIL_WIDTH, height: bottom - top + 8 },
      { fill: surface.ink.hex, stroke: surface.ink.hex, strokeWidth: 2 },
    );
    let rightY = top + 8;
    if (!this.#campaign) rightY = this.#drawNameField(rightX + 12, rightY, RIGHT_RAIL_WIDTH - 24, deck, true);
    rightY = this.#drawLegalityLine(rightX + 12, rightY, RIGHT_RAIL_WIDTH - 24, deck, true);
    rightY = this.#drawRewardsStrip(rightX + 12, rightY, RIGHT_RAIL_WIDTH - 24, true);
    rightY += 4;
    const actionsTop = bottom - hit.target * 2 - 24;
    rightY = this.#drawRailTabs(rightX + 12, rightY, RIGHT_RAIL_WIDTH - 24, true);
    rightY =
      this.#railTab === "games"
        ? this.#drawFromYourGames(rightX + 12, rightY, RIGHT_RAIL_WIDTH - 24, deck, true, actionsTop - 8)
        : this.#drawYourDeckList(rightX + 12, rightY, RIGHT_RAIL_WIDTH - 24, deck, true, actionsTop - 8 - rightY);
    this.#drawPreconClearSave(rightX + 12, actionsTop, RIGHT_RAIL_WIDTH - 24, deck, true);

    // Middle: the pool, search field above it.
    const pool = this.#browsablePool(deck);
    const countText = this.#countText(pool.length);
    let midY = top;
    this.#label(
      midX,
      midY,
      folded ? `${t("deckBuilder.cardPoolLabel")} — ${countText}` : t("deckBuilder.cardPoolLabel"),
    );
    midY += 16;
    if (folded) {
      // The search, then the chip that opens everything else in the list's place: one row, where the field keeps a
      // usable width even with its Clear button showing.
      const chipWidth = 150;
      const searchWidth = midWidth - chipWidth - CHIP_GAP;
      if (searchWidth >= SEARCH_ROW_MIN_WIDTH) {
        this.#drawFiltersToggle({ x: midX + searchWidth + CHIP_GAP, y: midY, width: chipWidth, height: hit.target });
        midY = this.#drawFilterInput(midX, midY, searchWidth);
      } else {
        midY = this.#drawFilterInput(midX, midY, midWidth);
        this.#drawFiltersToggle({ x: midX, y: midY, width: chipWidth, height: hit.target });
        midY += hit.target + CHIP_GAP;
      }
      if (this.#filtersOpen) {
        const rect: Rect = { x: midX, y: midY, width: midWidth, height: Math.max(hit.target * 2, bottom - midY) };
        const inner = midWidth - NARROW_SCROLLBAR_GUTTER;
        this.#scrolled("list:filters", rect, (at) => {
          let next = this.#drawTypeFilters(midX, at, inner);
          next = this.#drawQuickFilters(midX, next, inner, deck);
          return this.#drawPackAndSort(midX, next, inner, deck);
        });
        return pool;
      }
    } else {
      midY = this.#drawFilterInput(midX, midY, midWidth);
      // The quick filters sit under the search here: the left rail has no room left for them.
      midY = this.#drawQuickFilters(midX, midY - 4, midWidth, deck) - 4;
      const next = this.#drawShowToggles(midX, midY, midWidth, true);
      this.#text(midX + midWidth, midY + hit.target / 2, countText, typeRole.label, surface.ink.hex, ink.meta, {
        origin: [1, 0.5],
      });
      midY = next;
    }
    const listRect: Rect = {
      x: midX,
      y: midY,
      width: midWidth,
      height: Math.max(this.#rows.cardRowHeight, bottom - midY),
    };
    this.#drawPoolList(listRect, deck, pool);
    return pool;
  }

  #drawAspectPicker(left: number, top: number, column: number, deck: Deck): number {
    let y = top;
    const maxAspects = aspectCountFor(this.#identity!);
    const frozen = this.#campaignModel?.editingDisabled ?? false;
    this.#label(left, y, t("deckBuilder.aspectLabel", { count: maxAspects }));
    y += 16;
    // One row of five on a wide column, two-up on a phone's, one per row on the desktop rail, where two-up cells left
    // "AGGRESSION" no room beside its "i" segment and cut it short.
    const aspectCols = column >= 420 ? SELECTABLE_ASPECTS.length : column >= 300 ? 2 : 1;
    const aspectRows = Math.ceil(SELECTABLE_ASPECTS.length / aspectCols);
    const aspectCellWidth = (column - (aspectCols - 1) * 6) / aspectCols;
    SELECTABLE_ASPECTS.forEach((aspect, index) => {
      const row = Math.floor(index / aspectCols);
      const col = index % aspectCols;
      const cellRect: Rect = {
        x: left + col * (aspectCellWidth + 6),
        y: y + row * (hit.target + 6),
        width: aspectCellWidth,
        height: hit.target,
      };
      // G10b's tip: a split "i" segment at the cell's right-hand end, independent of `toggle`.
      const content = aspectTipContentOf(aspect);
      const split = content ? splitInfoSegment(cellRect) : null;
      const rect = split?.main ?? cellRect;
      const selected = deck.aspects.includes(aspect);
      // The aspect's own card-frame color, the same stamp Seats' aspect chips and the hero cards wear.
      const stamp = aspectStampOf(aspect, artLanguageNow());
      const toggle = (): void => {
        if (frozen) return;
        if (selected)
          this.#setDeck(
            setAspects(
              deck,
              deck.aspects.filter((a) => a !== aspect),
            ),
          );
        else if (deck.aspects.length < maxAspects) this.#setDeck(setAspects(deck, [...deck.aspects, aspect]));
        else this.#setDeck(setAspects(deck, [...deck.aspects.slice(1), aspect]));
      };
      this.#tintButton(`aspect:${aspect}`, rect, stamp.label, { fill: stamp.fill, ink: stamp.ink }, toggle, {
        selected,
        ...(frozen ? { disabled: this.#campaignModel?.editingDisabledReason ?? true } : {}),
      });

      if (content && split) {
        const isOpen = this.#aspectTipOpen === aspect;
        this.#drawInfoSegment(aspect, split.info, isOpen, { fill: stamp.fill, ink: stamp.ink });
        if (isOpen) this.#openAspectTip = { anchor: split.info, content, scope: this.#scope };
      }
    });
    return y + aspectRows * (hit.target + 6) + 10;
  }

  /** The split chip's "i" segment: a darker shade of the chip, an ink divider and ring; open, it inverts to ink. */
  #drawInfoSegment(
    aspect: CoreAspect,
    rect: Rect,
    isOpen: boolean,
    tint: { readonly fill: number; readonly ink: number },
  ): void {
    const b = this.#b;
    const ground = isOpen ? surface.ink.hex : shade(tint.fill, 0.78);
    const glyph = isOpen ? surface.paper.hex : tint.ink;
    b.box(rect, { fill: ground, stroke: surface.ink.hex, strokeWidth: 1.5 });
    // The divider: heavier than the outline, so the chip reads as two buttons side by side.
    b.box({ x: rect.x, y: rect.y, width: 2.5, height: rect.height }, { fill: surface.ink.hex });
    const cx = rect.x + rect.width / 2 + 1;
    const cy = rect.y + rect.height / 2;
    b.box({ x: cx - 10, y: cy - 10, width: 20, height: 20 }, { stroke: glyph, strokeWidth: 2, round: true });
    b.text(cx, cy, "i", typeRole.rowTitle, { color: glyph, size: 14, origin: [0.5, 0.5] });
    const key = `aspect-info:${aspect}`;
    b.tap(key, rect, { track: true });
    this.#actions.set(key, () => {
      this.#aspectTipOpen = isOpen ? null : aspect;
      this.#rebuild();
    });
  }

  /**
   * The open aspect tip (`#openAspectTip`), drawn last so it sits over everything else on the screen: the aspect's
   * name, tagline and tip line, and an "Aspects ▸" link to its lesson. One anchored in a scrolling region follows that
   * region's scroll (a scroll redraws it) and is left out once its "i" segment leaves the region.
   */
  #drawOpenAspectTip(area: Rect): void {
    const open = this.#openAspectTip;
    if (!open) return;
    const b = this.#b;
    const { content, scope } = open;
    const anchor = scope ? this.#inScope(scope, open.anchor) : open.anchor;
    if (scope && (anchor.y < scope.view.y || anchor.y + anchor.height > scope.view.y + scope.view.height)) return;
    const PANEL_WIDTH = 220;
    const PAD = 10;
    const GAP = 8;
    const ARROW = 7;
    const textWidth = PANEL_WIDTH - PAD * 2;
    const title = b.measure(content.title, typeRole.sectionHeader, { size: 16, wrapWidth: textWidth });
    const tagline = b.measure(content.tagline, typeRole.body, { wrapWidth: textWidth });
    const tip = b.measure(content.tipLine, typeRole.body, { wrapWidth: textWidth });
    const linkText = content.linkAvailable ? content.linkLabel : `${content.linkLabel} · ${content.linkReason}`;
    const link = b.measure(linkText, SENTENCE_LABEL, { wrapWidth: textWidth });
    const contentHeight = PAD + title.height + 6 + tagline.height + 6 + tip.height + 8 + link.height + PAD;
    const anchorCenterX = anchor.x + anchor.width / 2;
    const panelX = Math.max(
      area.x + 4,
      Math.min(anchorCenterX - PANEL_WIDTH / 2, area.x + area.width - PANEL_WIDTH - 4),
    );
    // Opens below the segment unless the screen has no room there.
    const clearBelow = anchor.y + anchor.height;
    const flipAbove = area.y + area.height - clearBelow < contentHeight + GAP + ARROW;
    const panelY = flipAbove ? anchor.y - GAP - ARROW - contentHeight : clearBelow + GAP + ARROW;
    const rect: Rect = { x: panelX, y: panelY, width: PANEL_WIDTH, height: contentHeight };
    b.box(rect, { fill: surface.ink.hex, stroke: surface.ink.hex, strokeWidth: 2, key: "aspect-tip-box" });
    b.box({ x: rect.x, y: rect.y + rect.height - 3, width: rect.width, height: 3 }, { fill: signal.caution.hex });
    const tipX = Math.max(rect.x + ARROW, Math.min(anchorCenterX, rect.x + rect.width - ARROW));
    if (flipAbove)
      b.poly(
        [
          [tipX - ARROW, rect.y + rect.height],
          [tipX + ARROW, rect.y + rect.height],
          [tipX, rect.y + rect.height + ARROW],
        ],
        { fill: surface.ink.hex },
      );
    else
      b.poly(
        [
          [tipX - ARROW, rect.y],
          [tipX + ARROW, rect.y],
          [tipX, rect.y - ARROW],
        ],
        { fill: surface.ink.hex },
      );
    b.tap("aspect-tip", rect, { track: true });
    this.#actions.set("aspect-tip", () => undefined);
    let y = rect.y + PAD;
    b.text(rect.x + PAD, y, content.title, typeRole.sectionHeader, {
      color: surface.paper.hex,
      size: 16,
      wrapWidth: textWidth,
    });
    y += title.height + 6;
    b.text(rect.x + PAD, y, content.tagline, typeRole.body, {
      color: surface.paper.hex,
      alpha: ink.secondary,
      wrapWidth: textWidth,
    });
    y += tagline.height + 6;
    b.text(rect.x + PAD, y, content.tipLine, typeRole.body, { color: surface.paper.hex, wrapWidth: textWidth });
    y += tip.height + 8;
    b.text(rect.x + PAD, y, linkText, SENTENCE_LABEL, {
      color: content.linkAvailable ? signal.caution.hex : surface.paper.hex,
      ...(content.linkAvailable ? {} : { alpha: ink.disabled }),
      wrapWidth: textWidth,
    });
    if (content.linkAvailable) {
      b.tap("aspect-lesson", { x: rect.x + PAD, y, width: textWidth, height: Math.max(link.height, 18) });
      this.#actions.set("aspect-lesson", () => {
        this.scene.launch(SCENES.aspectLesson, {
          aspect: content.aspect,
          backTo: "previous",
        } satisfies AspectLessonSceneData);
      });
    }
  }

  #drawTypeFilters(left: number, top: number, column: number, withShow = true): number {
    let y = withShow ? this.#drawShowToggles(left, top, column) : top;
    this.#label(left, y, t("deckBuilder.filterLabel"));
    y += 16;
    const chips = TYPE_FILTERS.map((chip) => ({ ...chip, text: t(`deckBuilder.type.${chip.id}` as MessageKey) }));
    const typeChipRows = wrapChipsToRows(chips, column);
    const activeTypeFilterId = TYPE_FILTERS.find((f) => f.type === (this.#filter.type ?? null))?.id ?? "all";
    typeChipRows.forEach((row, rowIndex) => {
      const cellWidth = (column - (row.length - 1) * CHIP_GAP) / row.length;
      row.forEach((chip, index) => {
        const rect: Rect = {
          x: left + index * (cellWidth + CHIP_GAP),
          y: y + rowIndex * (hit.target + CHIP_GAP),
          width: cellWidth,
          height: hit.target,
        };
        const selected = chip.id === activeTypeFilterId;
        const applyFilter = (): void => {
          this.#filter = { ...this.#filter, type: chip.type };
          this.#rememberView();
          this.#resetPool();
          this.#rebuild();
        };
        this.#button(`type:${chip.id}`, rect, chip.text, applyFilter, { selected });
      });
    });
    return y + chipStripHeight(typeChipRows.length) + 16;
  }

  /**
   * The Hero and Basic toggles (issue #977, benpap24): each one on shows that kind of card in the pool, off hides it, so
   * an aspect with both off lists that aspect's cards alone. They work beside the aspect buttons, which still choose
   * the deck's aspect, and either can be on with any aspect.
   */
  #drawShowToggles(left: number, top: number, column: number, inline = false): number {
    let y = top;
    // Inline (the desktop's pool column), a "show" word and two chips share one row with the card count at its end.
    const word = inline ? 48 : 0;
    if (inline)
      this.#label(left, y + hit.target / 2, t("deckBuilder.show"), false, { origin: [0, 0.5], fitWidth: word - 6 });
    else {
      this.#label(left, y, t("deckBuilder.show"));
      y += 16;
    }
    const width = inline ? Math.min(130, (column - word - CHIP_GAP) / 4) : (column - CHIP_GAP) / 2;
    // Plain chips, filled while on with a tick: a tinted Basic chip read as "on" either way.
    const toggles = [
      { id: "show-hero", text: t("deckBuilder.showHero"), key: "hideHero" },
      { id: "show-basic", text: aspectStampOf("basic", artLanguageNow()).label, key: "hideBasic" },
    ] as const;
    toggles.forEach((toggle, index) => {
      const rect: Rect = { x: left + word + index * (width + CHIP_GAP), y, width, height: hit.target };
      const shown = !this.#filter[toggle.key];
      const flip = (): void => {
        this.#filter = { ...this.#filter, [toggle.key]: shown };
        this.#rememberView();
        this.#resetPool();
        this.#rebuild();
      };
      this.#button(`type:${toggle.id}`, rect, `${shown ? "✓ " : ""}${toggle.text}`, flip, { selected: shown });
    });
    return y + hit.target + (inline ? 8 : 16);
  }

  /**
   * The quick filters under the type chips (issue #531): cost chips 0 to 5+, resource icon chips, and a trait stepper
   * (◂ name ▸, wrapping through "All traits") over the traits the pool holds under the other filters. Built for a tap
   * on a phone, where typing `o:2` is slow; each chip toggles.
   */
  #drawQuickFilters(left: number, top: number, column: number, deck: Deck): number {
    let y = top;
    this.#label(left, y, t("deckBuilder.quickLabel"));
    y += 16;
    const apply = (next: PoolFilter): void => {
      this.#filter = next;
      this.#rememberView();
      this.#resetPool();
      this.#rebuild();
    };
    const add = (id: string, rect: Rect, text: string, onClick: () => void, selected = false): void =>
      this.#button(id, rect, text, onClick, { selected });
    // A wide column takes every chip on one row with the trait stepper at its end; a narrow one stacks cost, icons
    // and the stepper.
    const oneRow = column >= QUICK_ONE_ROW_MIN;
    const stepperWidth = oneRow ? QUICK_TRAIT_WIDTH : column;
    const rows = oneRow
      ? [QUICK_FILTERS]
      : [QUICK_FILTERS.filter((f) => f.id.startsWith("cost:")), QUICK_FILTERS.filter((f) => f.id.startsWith("icon:"))];
    const chipsWidth = oneRow ? column - stepperWidth - CHIP_GAP : column;
    const textOf = (chip: (typeof QUICK_FILTERS)[number]): string =>
      chip.id.startsWith("icon:") ? t(`deckBuilder.${chip.id.replace(":", ".")}` as MessageKey) : chip.text;
    rows.forEach((row, rowIndex) => {
      // On one row the cost chips ("0" to "5+") take a square each and the icon names share what is left; elsewhere
      // a row's chips share it evenly.
      const isCost = (chip: (typeof row)[number]): boolean => oneRow && chip.id.startsWith("cost:");
      const costs = row.filter(isCost).length;
      const named = row.filter((chip) => !isCost(chip));
      const nameSpace = chipsWidth - costs * hit.target - (row.length - 1) * CHIP_GAP;
      // Names share their space by length, so "Physical" gets more than "Wild".
      const weight = (chip: (typeof row)[number]): number => (oneRow ? textOf(chip).length + 4 : 1);
      const totalWeight = named.reduce((sum, chip) => sum + weight(chip), 0);
      let x = left;
      row.forEach((chip) => {
        const width = isCost(chip) ? hit.target : (nameSpace * weight(chip)) / totalWeight;
        const rect: Rect = { x, y: y + rowIndex * (hit.target + CHIP_GAP), width, height: hit.target };
        x += width + CHIP_GAP;
        const on = chip.isOn(this.#filter);
        add(`quick:${chip.id}`, rect, textOf(chip), () => apply(chip.apply(this.#filter, !on)), on);
      });
    });
    if (!oneRow) y += chipStripHeight(rows.length) + CHIP_GAP;
    const stepperLeft = left + column - stepperWidth;

    const traits = traitFilterChoices(
      this.#pool(),
      this.#identity!,
      deck.aspects,
      withSearchClauses(this.#filter, this.#filterText),
      packInfos(),
    );
    const arrow = hit.target;
    // A kept trait no card shows under the other filters still names itself, so an empty pool says why.
    const traitName = this.#filter.trait ? traitLabelOf(this.#filter.trait) : t("deckBuilder.allTraits");
    const stepTrait = (dir: 1 | -1) => (): void =>
      apply({ ...this.#filter, trait: stepChoice(traits, this.#filter.trait, dir) as Trait | null });
    add("trait:prev", { x: stepperLeft, y, width: arrow, height: hit.target }, "<", stepTrait(-1));
    add(
      "trait:name",
      { x: stepperLeft + arrow + CHIP_GAP, y, width: stepperWidth - 2 * (arrow + CHIP_GAP), height: hit.target },
      traitName,
      stepTrait(1),
      this.#filter.trait != null,
    );
    add("trait:next", { x: left + column - arrow, y, width: arrow, height: hit.target }, ">", stepTrait(1));
    return y + hit.target + 16;
  }

  /**
   * The pool's Pack control, Wave button and Sort button (PR #88 step 5). One combined control would have hidden
   * which wave a pack belongs to, so: a full-width pack row (◂ name ▸) over a full-width wave button and a half-width
   * pair of sort buttons, which is what fits a 375px column. A press on the pack name or the wave button opens a picker
   * where several are chosen at once (issue #977, benpap24); the arrows still step one pack at a time, wrapping through
   * "All packs". Waves narrow the packs on offer; both only offer what the pool holds for this deck's aspects
   * (`packFilterChoices`).
   */
  #drawPackAndSort(left: number, top: number, column: number, deck: Deck): number {
    let y = top;
    this.#label(left, y, t("deckBuilder.packLabel"));
    y += 16;
    const choices = packFilterChoices(
      this.#pool(),
      this.#identity!,
      deck.aspects,
      withSearchClauses(this.#filter, this.#filterText),
      packInfos(),
    );
    const apply = (next: PoolFilter): void => {
      this.#filter = next;
      this.#rememberView();
      this.#resetPool();
      this.#rebuild();
    };
    const arrow = hit.target;
    // Every pack and wave, for picks the other filters have emptied: they stay in the picker, ticked (PR #980 review).
    const allPacks = packInfos().map((p) => ({ id: p.code, name: p.name, group: p.cycleName }));
    const allWaves = [...new Map(packInfos().map((p) => [p.cycleId, { id: p.cycleId, name: p.cycleName }])).values()];
    const packNames = new Map(packInfos().map((p) => [p.code, p.name]));
    const packLabel = pickSummaryOf(this.#filter.packCodes, packNames, t("deckBuilder.allPacks"), (count) =>
      t("deckBuilder.packsCount", { count }),
    );
    // With several packs picked, an arrow steps from "All packs": it goes back to one pack at a time.
    const stepPack = (dir: 1 | -1) => (): void => {
      const next = stepChoice(choices.packs, singleChoiceOf(this.#filter.packCodes), dir);
      apply({ ...this.#filter, packCodes: next ? [next] : null });
    };
    const pickPacks = (): void =>
      this.#openPoolPick(
        t("deckBuilder.pickPacksTitle"),
        withPicks(choices.packs, this.#filter.packCodes, allPacks),
        this.#filter.packCodes,
        (chosen) => apply({ ...this.#filter, packCodes: chosen.length ? chosen : null }),
      );
    const add = (id: string, rect: Rect, text: string, onClick: () => void, selected = false): void =>
      this.#button(id, rect, text, onClick, { selected });
    add("pack:prev", { x: left, y, width: arrow, height: hit.target }, "<", stepPack(-1));
    add(
      "pack:name",
      { x: left + arrow + CHIP_GAP, y, width: column - 2 * (arrow + CHIP_GAP), height: hit.target },
      `${packLabel} ▾`,
      pickPacks,
      Boolean(this.#filter.packCodes?.length),
    );
    add("pack:next", { x: left + column - arrow, y, width: arrow, height: hit.target }, ">", stepPack(1));
    y += hit.target + CHIP_GAP;

    // Every wave's name, so a picked wave the other filters have emptied still reads by name (PR #980 review).
    const cycleNames = new Map(allWaves.map((c) => [c.id, c.name]));
    const cycleLabel = pickSummaryOf(this.#filter.cycleIds, cycleNames, t("deckBuilder.allWaves"), (count) =>
      t("deckBuilder.wavesCount", { count }),
    );
    add(
      "pack:cycle",
      { x: left, y, width: column, height: hit.target },
      `${cycleLabel} ▾`,
      () => {
        this.#openPoolPick(
          t("deckBuilder.pickWavesTitle"),
          withPicks(choices.cycles, this.#filter.cycleIds, allWaves),
          this.#filter.cycleIds,
          (chosen) => apply(withCycles(this.#filter, chosen)),
        );
      },
      Boolean(this.#filter.cycleIds?.length),
    );
    y += hit.target + CHIP_GAP;

    // Sort, then a second key for its ties (issue #531): "Sort: Aspect" "Then: Type" lists by aspect, type, then name.
    const half = (column - CHIP_GAP) / 2;
    const resort = (next: PoolSort): void => {
      this.#sort = next;
      this.#rememberView();
      this.#resetPool();
      this.#rebuild();
    };
    const sortName = (key: PoolSortKey | null): string => t(`deckBuilder.sort.${key ?? "none"}` as MessageKey);
    const { primary, secondary } = this.#sort;
    const sortAt = Math.max(
      0,
      SORT_CYCLE.findIndex((o) => o.sort === primary),
    );
    add(
      "pack:sort",
      { x: left, y, width: half, height: hit.target },
      t("deckBuilder.sortBy", { name: sortName(primary) }),
      () => {
        const next = SORT_CYCLE[(sortAt + 1) % SORT_CYCLE.length]!.sort;
        resort({ primary: next, secondary: secondary === next ? null : secondary });
      },
      primary !== DEFAULT_POOL_SORT.primary,
    );
    const thenChoices = thenChoicesFor(primary);
    const thenAt = Math.max(0, thenChoices.indexOf(secondary));
    add(
      "pack:then",
      { x: left + half + CHIP_GAP, y, width: half, height: hit.target },
      t("deckBuilder.thenBy", { name: sortName(secondary) }),
      () => resort({ primary, secondary: thenChoices[(thenAt + 1) % thenChoices.length] ?? null }),
      secondary !== null,
    );
    return y + hit.target + 16;
  }

  #drawNameField(left: number, top: number, column: number, deck: Deck, onDark = false): number {
    let y = top;
    this.#label(left, y, t("deckBuilder.deckName"), onDark);
    y += 16;
    const nameRect: Rect = { x: left, y, width: column, height: hit.target };
    // The name is kept as it is typed (a short pause), so Save never holds an older one.
    this.#b.search(nameRect, {
      key: "name",
      value: deck.name,
      placeholder: t("deckBuilder.deckName"),
      clearLabel: t("deckBuilder.clearSearch"),
      debounce: 60,
    });
    this.#stop("name", nameRect, () => this.#fieldElement("name")?.focusInput());
    return y + hit.target + 16;
  }

  /**
   * Campaign mode's rewards strip (MC45 p. 24; owner decision, 2026-10-08): every reward the seat chose, in the deck
   * or not, each with its status in words and a button that flips it. A reward left out has no line in the list, so
   * this strip is the only place it can be put back. Nothing is drawn when the seat has no reward.
   */
  #drawRewardsStrip(left: number, top: number, column: number, onDark: boolean): number {
    const rewards = this.#campaignModel?.rewards ?? [];
    if (rewards.length === 0) return top;
    const frozen = this.#campaignModel?.editingDisabled ?? false;
    const ground = onDark ? surface.paper.hex : surface.ink.hex;
    this.#label(left, top, t("deckBuilder.rewardsLabel"), onDark);
    let y = top + 18;
    const buttonWidth = Math.min(132, Math.floor(column * 0.4));
    rewards.forEach((reward, at) => {
      const card = this.#pool().find((candidate) => candidate.id === reward.cardId);
      const textWidth = column - buttonWidth - 8;
      const name = this.#text(
        left,
        y,
        card ? cardDisplayName(card) : (reward.cardId as string),
        typeRole.rowTitle,
        ground,
        1,
        {
          wrapWidth: textWidth,
        },
      );
      const status = this.#text(
        left,
        y + name.height + 2,
        `${reward.included ? "✓" : "–"} ${reward.status}`,
        typeRole.body,
        ground,
        onDark ? ink.secondary : ink.label,
        { wrapWidth: textWidth },
      );
      const textHeight = name.height + 2 + status.height;
      const rowHeight = Math.max(hit.target, textHeight);
      const rect: Rect = {
        x: left + column - buttonWidth,
        y: y + (rowHeight - hit.target) / 2,
        width: buttonWidth,
        height: hit.target,
      };
      const toggle = (): void => void this.#toggleReward(reward.cardId, !reward.included);
      this.#button(`reward:${at}:${reward.cardId as string}`, rect, reward.toggleLabel, toggle, {
        look: onDark ? "onInk" : "secondary",
        ...(this.#busy ? { disabled: true as const } : {}),
        ...(frozen ? { disabled: this.#campaignModel?.editingDisabledReason ?? true } : {}),
      });
      y += rowHeight + 8;
    });
    return y + 4;
  }

  /**
   * Flips a reward and keeps the editor in step. The run is written at once (the grant's `leftOut` and the stored
   * line), so leaving without "Save changes" still keeps the choice; the open deck, the grants and the context are
   * rebuilt from the same pure edit, so unsaved changes to other lines are not lost.
   */
  async #toggleReward(cardId: CardId, included: boolean): Promise<void> {
    const campaign = this.#campaign;
    const deck = this.#deck;
    if (this.#busy || !campaign || !deck || this.#campaignModel?.editingDisabled) return;
    this.#busy = true;
    this.#rebuild();
    const record = await campaignService().load(campaign.runId);
    if (!record) {
      this.#busy = false;
      this.#status = "This campaign run is gone — nothing was saved.";
      this.#rebuild();
      return;
    }
    try {
      await campaignService().setSeatRewardIncluded(record, campaign.seatNumber, cardId, included);
    } catch (error) {
      this.#busy = false;
      this.#status = error instanceof Error ? error.message : "This reward could not be changed.";
      this.#rebuild();
      return;
    }
    const edit = setRewardIncluded(deck, campaign.grants, cardId, included);
    this.#campaign = {
      ...campaign,
      grants: edit.grants,
      context: campaignDeckContextWithGrants(campaign.context, edit.grants),
    };
    this.#deck = { ...deck, cards: edit.deck.cards };
    this.#busy = false;
    this.#status = null;
    this.#rebuild();
  }

  #drawLegalityLine(left: number, top: number, column: number, deck: Deck, onDark = false): number {
    let y = top;
    const verdict = this.#campaignModel ? this.#campaignModel.validation : legalityOf(deck, this.#pool());
    // Campaign mode's own count (the Briefing's "N cards + M pinned", MC10 p. 3): granted lines don't count toward
    // deck size, so the legal-count line says so rather than reading a plain total that includes them.
    const cardCountText = this.#campaignModel
      ? campaignDeckSizeLabel(campaignDeckSizeSplit(this.#campaignModel))
      : deckCountText(deckStatsOf(deck, this.#pool()), artLanguageNow());
    const legalityText = verdict.ok
      ? t("deckBuilder.legal", { count: cardCountText })
      : t(verdict.problems.length === 1 ? "deckBuilder.problemOne" : "deckBuilder.problems", {
          count: verdict.problems.length,
          list: verdict.problems.map((p) => p.message).join(" "),
        });
    const color = verdict.ok ? signal.heal.hex : accent.redDeep.hex;
    const legalityLine = this.#text(
      left,
      y,
      legalityText,
      typeRole.body,
      onDark && !verdict.ok ? surface.paper.hex : color,
      1,
      {
        wrapWidth: column,
        key: "legality",
      },
    );
    y += legalityLine.height + 12;

    if (this.#campaignModel?.editingDisabledReason) {
      const frozenLine = this.#text(
        left,
        y,
        this.#campaignModel.editingDisabledReason,
        typeRole.body,
        onDark ? surface.paper.hex : accent.redDeep.hex,
        1,
        { wrapWidth: column },
      );
      y += frozenLine.height + 12;
    }

    if (!this.#status && !this.#campaign && this.#isDirty()) {
      const dirtyLine = this.#text(
        left,
        y,
        this.#savedDeck ? t("deckBuilder.unsaved") : t("deckBuilder.notSaved"),
        typeRole.body,
        onDark ? surface.paper.hex : surface.ink.hex,
        ink.secondary,
        { wrapWidth: column },
      );
      y += dirtyLine.height + 8;
    }

    if (this.#status) {
      const statusLine = this.#text(
        left,
        y,
        this.#status,
        typeRole.body,
        onDark ? surface.paper.hex : surface.ink.hex,
        ink.secondary,
        { wrapWidth: column, key: "status" },
      );
      y += statusLine.height + 8;
    }
    return y;
  }

  /**
   * The draw odds (issue #531, `view/deck-odds.ts`): a group stepper (◂ Gives physical ▸, Resource cards, a trait, a
   * title ...), a draw count stepper starting at the alter ego's hand size (the opening hand), then the chance of
   * drawing 0, 1, 2 and 3+ of the group and of at least one. Black Cat's top 2 is "Resource cards", draw 2.
   */
  #drawOdds(left: number, top: number, column: number, deck: Deck, rowHeight: number): number {
    let y = top;
    const copies = deckCopiesOf(deck, (id) => cardById().get(id));
    const groups = oddsGroupsOf(copies);
    const add = (id: string, rect: Rect, text: string, onClick: () => void, enabled = true): void =>
      this.#button(id, rect, text, onClick, enabled ? {} : { disabled: true });
    if (groups.length === 0) {
      this.#text(left, y, t("deckBuilder.oddsEmpty"), typeRole.body, surface.ink.hex, ink.meta);
      return y + 24;
    }
    const at = Math.max(
      0,
      groups.findIndex((g) => g.id === this.#oddsGroup),
    );
    const group = groups[at]!;
    const step = (dir: 1 | -1) => (): void => {
      this.#oddsGroup = groups[(at + dir + groups.length) % groups.length]!.id;
      this.#rebuild();
    };
    const arrow = rowHeight;
    add("odds:prev", { x: left, y, width: arrow, height: rowHeight }, "<", step(-1));
    add(
      "odds:group",
      { x: left + arrow + CHIP_GAP, y, width: column - 2 * (arrow + CHIP_GAP), height: rowHeight },
      `${group.label} · ${group.count}`,
      step(1),
    );
    add("odds:next", { x: left + column - arrow, y, width: arrow, height: rowHeight }, ">", step(1));
    y += rowHeight + CHIP_GAP;

    const hand = this.#identity?.alterEgo.handSize ?? 6;
    const draws = Math.min(this.#oddsDraws ?? hand, copies.length);
    const setDraws = (next: number) => (): void => {
      this.#oddsDraws = Math.max(1, Math.min(copies.length, next));
      this.#rebuild();
    };
    add("odds:fewer", { x: left, y, width: arrow, height: rowHeight }, "−", setDraws(draws - 1), draws > 1);
    add(
      "odds:draws",
      { x: left + arrow + CHIP_GAP, y, width: column - 2 * (arrow + CHIP_GAP), height: rowHeight },
      draws === hand ? t("deckBuilder.oddsDrawOpening", { count: draws }) : t("deckBuilder.oddsDraw", { count: draws }),
      setDraws(hand),
    );
    add(
      "odds:more",
      { x: left + column - arrow, y, width: arrow, height: rowHeight },
      "+",
      setDraws(draws + 1),
      draws < copies.length,
    );
    y += rowHeight + 8;

    const { rows, atLeastOne } = oddsRowsOf(drawOdds(copies.length, group.count, draws));
    const line = rows.map((row) => `${row.label}: ${percentText(row.p)}`).join("   ");
    this.#text(left, y, line, typeRole.body, surface.ink.hex, ink.label, { key: "odds-line" });
    y += 18;
    this.#text(
      left,
      y,
      t("deckBuilder.oddsAtLeast", { p: percentText(atLeastOne) }),
      typeRole.body,
      surface.ink.hex,
      ink.label,
    );
    return y + 26;
  }

  /** The cost curve: a bar per cost (the last "N+"), blue (spent colour for the last), the count above it on a phone. */
  #drawCostCurve(left: number, top: number, column: number, deck: Deck, onDark: boolean): number {
    const stats = deckStatsOf(deck, this.#pool());
    // On a phone each bar carries its count above it (the cost is on the axis), so the chart reads as numbers, not
    // buttons. The desktop rail (`onDark`) has no room for it.
    const chartHeight = onDark ? 74 : 90;
    const bars = costCurveBars(stats);
    const gap = 6;
    const barWidth = (column - gap * (bars.length - 1)) / bars.length;
    const maxCount = Math.max(1, ...bars.map((bar) => bar.count));
    const axisColor = onDark ? surface.paper.hex : surface.ink.hex;
    const countRoom = onDark ? 0 : 16;
    bars.forEach((bar, index) => {
      const barHeight = Math.max(2, Math.round((bar.count / maxCount) * (chartHeight - 18 - countRoom)));
      const x = left + index * (barWidth + gap);
      const barTop = top + (chartHeight - 18 - barHeight);
      this.#b.box(
        { x, y: barTop, width: barWidth, height: barHeight },
        {
          fill: index === bars.length - 1 ? signal.spent.hex : signal.cost.hex,
          ...(onDark ? {} : { stroke: surface.ink.hex, strokeWidth: 2 }),
        },
      );
      if (!onDark)
        this.#text(x + barWidth / 2, barTop - 2, String(bar.count), typeRole.rowTitle, axisColor, 1, {
          origin: [0.5, 1],
        });
      this.#text(x + barWidth / 2, top + chartHeight - 10, bar.label, typeRole.label, axisColor, ink.label, {
        origin: [0.5, 0],
      });
    });
    return top + chartHeight + 16;
  }

  #setRailTab(tab: "deck" | "games"): void {
    if (this.#railTab === tab) return;
    this.#railTab = tab;
    this.#tab = tab === "games" ? "games" : this.#tab === "games" ? "deck" : this.#tab;
    this.#rebuild();
    this.#route?.focusKey(`rail:${tab}`);
  }

  /** The deck rail's two tabs: Your deck (LB) and From your games (RB). Returns where they end. */
  #drawRailTabs(left: number, top: number, column: number, onDark: boolean): number {
    const gap = 6;
    const width = (column - gap) / 2;
    const tabs = [
      { id: "deck" as const, label: t("deckBuilder.railDeck"), glyph: "zonePrevious" as const },
      { id: "games" as const, label: t("deckBuilder.railGames"), glyph: "zoneNext" as const },
    ];
    tabs.forEach((tab, index) => {
      const rect: Rect = { x: left + index * (width + gap), y: top, width, height: hit.target };
      const selected = this.#railTab === tab.id;
      const open = (): void => this.#setRailTab(tab.id);
      const key = `rail:${tab.id}`;
      const look = selected ? "primary" : onDark ? "onInk" : "secondary";
      if (selected) this.#button(key, rect, tab.label, open, { look });
      else {
        // The bumper that reaches the other tab, on the tab it reaches.
        this.#glyphs.button(this.#b, {
          key,
          rect,
          label: caseOf(typeRole.label, tab.label),
          look,
          type: typeRole.label,
          ids: [tab.glyph],
          ground: onDark ? "ink" : "paper",
        });
        this.#actions.set(key, open);
        this.#stop(key, rect, open);
      }
      this.#railStops.push(key);
    });
    return top + hit.target + 10;
  }

  /**
   * "From your games" (issue #529, C2): how this hero's finished games go, cards in this deck that rarely come out
   * (Cut), cards won with on this hero that the deck may take (Add), and the staples. Suggestions only: a press on Cut
   * or Add is the same as the deck list's − or the pool's +. Drawn down to `bottom` when given (the wide rail).
   */
  #drawFromYourGames(
    left: number,
    top: number,
    column: number,
    deck: Deck,
    onDark: boolean,
    bottom = Number.POSITIVE_INFINITY,
  ): number {
    const b = this.#b;
    const fg = onDark ? surface.paper.hex : surface.ink.hex;
    const soft = onDark ? ink.secondary : ink.label;
    let y = top;
    if (!this.#insights) {
      this.#text(left, y, t("deckBuilder.gamesReading"), typeRole.label, fg, ink.meta);
      return y + 24;
    }
    const pool = new Set(this.#browsablePool(deck).map((card) => card.id as string));
    // The same refusals the pool's −/+ read: a suggestion never cuts a campaign's granted card, or adds a refused one.
    const frozen = this.#campaignModel?.editingDisabled ?? false;
    const canCut = (entry: SuggestedCard): boolean =>
      !campaignRefusesCut(this.#campaignRowFor(entry.cardId), frozen) &&
      this.#ruleRefusal(deck, entry.cardId as CardId, -1) === null;
    const canAdd = (entry: SuggestedCard): boolean =>
      pool.has(entry.cardId) &&
      !campaignRefusesAdd(this.#campaignRowFor(entry.cardId), frozen) &&
      this.#ruleRefusal(deck, entry.cardId as CardId, 1) === null;
    const type = fromYourGamesType(isDesktopType());
    const view = fromYourGamesOf(
      this.#insights,
      deck.identityCardId as string,
      deck.cards.map((line) => line.cardId as string),
      deck.aspects,
      POOL_STATS_NAMES,
    );
    if (view.headline) {
      this.#text(left, y, view.headline.toUpperCase(), typeRole.label, onDark ? signal.caution.hex : fg, 1, {
        size: type.label,
      });
      y += type.label + 9;
    }
    if (view.insight) {
      const text = b.measure(view.insight, typeRole.body, { size: type.note, wrapWidth: column - 16 });
      b.box({ x: left, y, width: column, height: text.height + 12 }, { fill: surface.paper.hex });
      b.text(left + 8, y + 6, view.insight, typeRole.body, {
        color: surface.ink.hex,
        size: type.note,
        wrapWidth: column - 16,
      });
      y += text.height + 20;
    }
    const { thumb } = type;
    // What the stepper walks: your faced villains, or on Everyone those and then every other villain in the pool.
    const stepList = (source: AgainstSource): readonly string[] =>
      againstStepOf(this.#insights!, poolVillainNames(), source);
    const villainIn = (source: AgainstSource): string | undefined => {
      const list = stepList(source);
      return list.includes(this.#againstVillain ?? "") ? this.#againstVillain! : list[0];
    };
    const faced = stepList(this.#againstSource);
    // The Cut and Try lists leave room for the Against stepper and a first card under it: the rail does not scroll.
    // The room is the stepper's, the You / Everyone toggle's under it, and a first card. It is kept even with no villain
    // faced yet, so the switch is always there.
    // On Everyone with sharing off, Share and its line take room too (measured, at most two lines).
    const shareLineOf = (): string => (this.#shareFailed ? `${globalRowFailed()} ${shareLine()}` : shareLine());
    const shareLineHeight = (): number =>
      Math.min(
        b.measure(shareLineOf(), typeRole.body, { size: type.note, wrapWidth: column }).height,
        Math.ceil(type.note * 1.5 * 2),
      );
    let shareRoom = 0;
    if (this.#againstSource === "everyone" && readConsent() !== "on" && Number.isFinite(bottom))
      shareRoom = hit.target + 6 + shareLineHeight() + 8;
    // Touch sizes enlarge both controls, so the slack under the first card is kept small: a rail that cannot show its
    // Cut row at desktop size on a touch-reporting machine is a rail with a guess too many pixels reserved.
    let limit = bottom - (hit.target + 8) * 2 - shareRoom - thumb.height - 8;
    const section = (
      id: string,
      title: string,
      cards: readonly SuggestedCard[],
      action: { readonly label: string; readonly run: (cardId: string) => void } | null,
    ): void => {
      if (cards.length === 0) return;
      const head = b.measure(title.toUpperCase(), typeRole.barTitle, { size: 17, fitWidth: column });
      // The heading advances y by its measured height + 10, so test that, not a guessed 20: a heading with no
      // card row under it is never drawn.
      if (y + head.height + 10 + thumb.height > limit) return;
      b.text(left, y, title.toUpperCase(), typeRole.barTitle, { color: fg, size: 17, fitWidth: column });
      b.box({ x: left, y: y + head.height + 2, width: column, height: 2 }, { fill: fg });
      y += head.height + 10;
      for (const entry of cards) {
        if (y + thumb.height > limit) return;
        const card = cardById().get(entry.cardId);
        const pic: Rect = { x: left, y, width: thumb.width, height: thumb.height };
        b.image(pic, {
          src: card ? (artFor(card, { kind: "front" })?.url ?? null) : null,
          fill: surface.parchment.hex,
          key: `games-art:${id}:${entry.cardId}`,
        });
        // With the deck lines, so the pictures open the card popover and follow a scrolling region.
        this.#deckLines.push({ cardId: entry.cardId, rect: pic, scope: this.#scope });
        if (card) {
          const key = `games-open:${id}:${entry.cardId}`;
          b.tap(key, pic, { inspect: true });
          this.#actions.set(key, () => this.#inspect(card));
        }
        const buttonWidth = action ? 70 : 0;
        b.text(left + thumb.width + 8, y + 2, `${card?.name ?? entry.cardId}\n${entry.detail}`, typeRole.body, {
          color: fg,
          ...(onDark ? { alpha: ink.body } : {}),
          size: type.text,
          wrapWidth: column - thumb.width - 16 - buttonWidth,
          maxLines: type.lines,
        });
        if (action) {
          const rect: Rect = {
            x: left + column - buttonWidth,
            y: y + (thumb.height - hit.target) / 2,
            width: buttonWidth,
            height: hit.target,
          };
          const key = `games:${action.label}:${entry.cardId}`;
          this.#button(key, rect, action.label, () => action.run(entry.cardId), {
            look: onDark ? "onInk" : "secondary",
          });
          this.#railStops.push(key);
        }
        y += Math.max(thumb.height, hit.target) + 6;
      }
      y += 6;
    };
    const cutLabel = t("deckBuilder.gamesCutLabel");
    const addLabel = t("deckBuilder.gamesAddLabel");
    section("cut", t("deckBuilder.gamesCutTitle"), view.cut.filter(canCut), {
      label: cutLabel,
      run: (cardId) => this.#setDeck(removeCard(this.#deck!, cardId as CardId)),
    });
    section("try", t("deckBuilder.gamesTryTitle"), view.tryCards.filter(canAdd), {
      label: addLabel,
      run: (cardId) => this.#setDeck(addCard(this.#deck!, cardId as CardId)),
    });
    limit = bottom;
    let shareDrawn = false;
    if (y + (hit.target + 8) * 2 <= bottom) {
      const villain = villainIn(this.#againstSource);
      const everyone = this.#againstSource === "everyone";
      const theirs = everyone && villain !== undefined ? this.#againstGlobal.get(villain) : undefined;
      const insightsHere: DeckInsights =
        villain !== undefined && theirs?.kind === "ready"
          ? { heroes: {}, decks: {}, villains: { [villain]: globalVillainDecksOf(theirs.data) } }
          : this.#insights;
      const against =
        villain === undefined || (everyone && theirs?.kind !== "ready")
          ? null
          : againstVillainOf(
              insightsHere,
              villain,
              deck.identityCardId as string,
              deck.cards.map((line) => line.cardId as string),
              deck.aspects,
              POOL_STATS_NAMES,
            );
      if (villain !== undefined) {
        // Previous and next: with 129 villains a late-alphabet one is not 128 presses away.
        const prevWidth = faced.length > 1 ? hit.target + 12 : 0;
        const rect: Rect = { x: left + prevWidth, y, width: column - prevWidth, height: hit.target };
        const stepBy = (delta: number): void => {
          const next = faced[(faced.indexOf(villain) + delta + faced.length) % faced.length]!;
          this.#againstVillain = next;
          // Everyone's decks are read once the stepper rests on a villain, not on each press passing through.
          this.#stepTimer?.remove();
          this.#stepTimer = null;
          if (this.#againstSource === "everyone") {
            this.#stepTimer = this.time.delayedCall(400, () => {
              this.#stepTimer = null;
              void this.#loadAgainstGlobal(next);
            });
          }
          this.#rebuild();
          this.#route?.focusKey(delta < 0 ? "games:previous" : "games:against");
        };
        const step = (): void => stepBy(1);
        const look = onDark ? "onInk" : "secondary";
        if (prevWidth > 0) {
          const prevRect: Rect = { x: left, y, width: prevWidth - 8, height: hit.target };
          this.#button("games:previous", prevRect, "◂", () => stepBy(-1), {
            look,
            aria: t("deckBuilder.gamesPreviousVillain"),
          });
          this.#railStops.push("games:previous");
        }
        this.#button(
          "games:against",
          rect,
          `${against?.headline ?? t("deckBuilder.gamesAgainst", { villain })}${faced.length > 1 ? " ▸" : ""}`,
          step,
          { look, ...(faced.length > 1 ? {} : { disabled: true as const }), stop: faced.length > 1 },
        );
        if (faced.length > 1) this.#railStops.push("games:against");
        y += hit.target + 8;
      }
      // Whose decks: yours, or everyone's. Two equal buttons; the chosen one is filled and ticked.
      const half = Math.floor((column - 8) / 2);
      for (const [at, source] of (["yours", "everyone"] as const).entries()) {
        const chosen = this.#againstSource === source;
        const sourceRect: Rect = { x: left + at * (half + 8), y, width: half, height: hit.target };
        const choose = (): void => {
          if (this.#againstSource === source) return;
          this.#againstSource = source;
          // A read still waiting for the stepper to rest belongs to the other source.
          this.#stepTimer?.remove();
          this.#stepTimer = null;
          // Everyone with no villain chosen yet starts on the first of its list, read now (this press), not before.
          const first = villainIn(source);
          if (source === "everyone" && first !== undefined) void this.#loadAgainstGlobal(first);
          this.#rebuild();
          this.#route?.focusKey(`games:source:${source}`);
        };
        this.#button(`games:source:${source}`, sourceRect, `${chosen ? "✓ " : ""}${AGAINST_LABELS[source]}`, choose, {
          look: chosen ? "primary" : onDark ? "onInk" : "secondary",
        });
        this.#railStops.push(`games:source:${source}`);
      }
      y += hit.target + 8;
      const sourceNote =
        villain === undefined
          ? AGAINST_NOTE_FINISH
          : everyone && theirs?.kind !== "ready"
            ? theirs === undefined || theirs.kind === "reading"
              ? AGAINST_NOTE_READING
              : theirs.kind === "none"
                ? AGAINST_NOTE_NONE
                : AGAINST_NOTE_UNAVAILABLE
            : theirs?.kind === "ready" && theirs.stale
              ? AGAINST_NOTE_STALE
              : null;
      const note = (text: string): void => {
        const m = this.#text(left, y, text, typeRole.body, fg, soft, { size: type.note, wrapWidth: column });
        y += m.height + 8;
      };
      if (sourceNote && y + 30 < bottom) note(sourceNote);
      // Sharing is off: one press turns it on (the games finished so far are never sent), where the block has room.
      // Without room, a note says where Settings has it. Turning it off stays in Settings.
      if (everyone && readConsent() !== "on") {
        if (bottom - y >= shareRoom || !Number.isFinite(bottom)) {
          shareDrawn = true;
          this.#shareShownAt ??= performance.now();
          const shareRect: Rect = { x: left, y, width: column, height: hit.target };
          const share = (byFocus: boolean): void => {
            if (this.#shareBusy) return;
            // A tap meant for something else that lands as the button appears is not a press on it.
            if (this.#shareShownAt === null || !askAnswerAllowed(this.#shareShownAt, performance.now())) return;
            this.#shareBusy = true;
            void shareFinishedGamesNow().then((saved) => {
              this.#shareBusy = false;
              this.#shareFailed = !saved;
              if (!this.scene.isActive() || !this.#showsGames()) return;
              this.#rebuild();
              // A pad or keyboard press: the button is gone, so focus goes to the switch above it.
              if (saved && byFocus) this.#route?.focusKey("games:source:everyone");
            });
          };
          this.#b.button({
            key: "games:share",
            rect: shareRect,
            label: caseOf(typeRole.label, shareLabel()),
            look: onDark ? "onInk" : "secondary",
            type: typeRole.label,
          });
          this.#actions.set("games:share", () => share(false));
          this.#stop("games:share", shareRect, () => share(true));
          this.#railStops.push("games:share");
          y += hit.target + 6;
          y +=
            this.#text(left, y, shareLineOf(), typeRole.body, fg, soft, {
              size: type.note,
              wrapWidth: column,
              maxLines: 2,
            }).height + 8;
        } else if (bottom - y >= 30) note(AGAINST_NOTE_SHARE_IN_SETTINGS);
      }
      if (against) {
        // A card the lists above already offer keeps its one button (and its one stop).
        const offered = new Set([...view.cut, ...view.tryCards].map((entry) => entry.cardId));
        const wins = against.tryCards.filter((entry) => canAdd(entry) && !offered.has(entry.cardId));
        const losses = against.cutCards.filter((entry) => canCut(entry) && !offered.has(entry.cardId));
        section("wins", everyone ? t("deckBuilder.gamesTryEveryone") : t("deckBuilder.gamesTryYours"), wins, {
          label: addLabel,
          run: (cardId) => this.#setDeck(addCard(this.#deck!, cardId as CardId)),
        });
        section("losses", everyone ? t("deckBuilder.gamesCutEveryone") : t("deckBuilder.gamesCutYours"), losses, {
          label: cutLabel,
          run: (cardId) => this.#setDeck(removeCard(this.#deck!, cardId as CardId)),
        });
        const nothing = against.note ?? (wins.length + losses.length === 0 ? NOTHING_STANDS_OUT : null);
        if (nothing && y + 30 < bottom) note(nothing);
      }
    }
    if (!shareDrawn) this.#shareShownAt = null;
    section("keep", t("deckBuilder.gamesKeepTitle"), view.keep, null);
    if (view.note && y + 30 < bottom) {
      const m = this.#text(left, y, view.note, typeRole.body, fg, soft, { size: type.note, wrapWidth: column });
      y += m.height + 8;
    }
    return y;
  }

  /** Reads everyone's decks against `villain` (on a press only) and redraws when they arrive. */
  async #loadAgainstGlobal(villain: string): Promise<void> {
    const known = this.#againstGlobal.get(villain);
    if (known?.kind === "reading" || known?.kind === "ready" || known?.kind === "none") return;
    this.#againstGlobal.set(villain, { kind: "reading" });
    // The Worker counts a game against several villains for each; the first stands for the group here.
    const answer = await loadGlobalVillainCards(villain.split(" & ")[0]!);
    this.#againstGlobal.set(villain, answer);
    if (this.scene.isActive() && this.#railTab === "games") this.#rebuild();
  }

  #drawYourDeckList(
    left: number,
    top: number,
    column: number,
    deck: Deck,
    onDark: boolean,
    /** The wide rail's room for the list: when it is taller than that, the list scrolls inside it. Absent: it flows (the narrow layout's own region scrolls). */
    maxHeight?: number,
  ): number {
    this.#label(left, top, t("deckBuilder.yourDeck"), onDark);
    const listTop = this.#drawDeckListControls(left, top + 16, column, onDark);
    const groups = deckListGroupsOf(deck, this.#pool(), this.#deckSort);
    const noteOf = this.#campaign
      ? (entry: DeckListEntry): string | null => {
          const row = this.#campaignRowFor(entry.cardId as string);
          const faceNote = row?.face ? `On its ${row.face} (Enhanced) side. ` : "";
          const reason = row?.lockedReason ?? row?.refusedReason ?? row?.rewardNote ?? null;
          return faceNote ? `${faceNote}${reason ?? ""}`.trim() : reason;
        }
      : undefined;
    // A campaign-granted line is otherwise a dead end for "what does this card actually do" — the pool grid never
    // lists it (nothing to add), so its "your deck" line here is the only place Deck Edit shows it at all. A press on it
    // opens the same Inspect overlay the pool grid's own cards use, on its granted face.
    const inspectable = (entry: DeckListEntry): { readonly card: AnyCard; readonly face: string | null } | null => {
      if (!this.#campaign) return null;
      const row = this.#campaignRowFor(entry.cardId as string);
      if (!row?.locked) return null;
      const card = this.#pool().find((candidate) => candidate.id === entry.cardId);
      return card ? { card, face: row.face ?? null } : null;
    };
    // Every line is listed (none folded into "+ N more") and each has its own "-" while the deck can be edited.
    const frozen = this.#campaignModel?.editingDisabled ?? false;
    const drawList = (at: number): number => {
      const b = this.#b;
      const body = onDark ? surface.paper.hex : surface.ink.hex;
      let y = at;
      for (const group of groups) {
        if (group.entries.length === 0) continue;
        this.#text(left, y, `${group.label} · ${group.count}`, typeRole.label, body, ink.meta);
        y += 14;
        for (const entry of group.entries) {
          const rowTop = y;
          const removeWidth = 44;
          const cardId = entry.cardId as string;
          b.text(left, y, entry.name, typeRole.body, {
            color: body,
            fitWidth: column - 40 - removeWidth,
            key: `deck-name:${cardId}`,
          });
          this.#text(left + column - 10 - removeWidth, y, String(entry.quantity), typeRole.label, body, ink.secondary, {
            origin: [1, 0],
            key: `deck-qty:${cardId}`,
          });
          const rect: Rect = { x: left + column - removeWidth, y: y - 5, width: removeWidth, height: 26 };
          const row = this.#campaignRowFor(cardId);
          const locked = row?.locked ?? false;
          const refused = this.#ruleRefusal(deck, entry.cardId, -1);
          const off = locked || frozen || refused !== null;
          this.#b.button({
            key: `deck-minus:${cardId}`,
            rect,
            label: "−",
            look: onDark ? "onInk" : "secondary",
            type: typeRole.rowTitle,
            aria: t("deckBuilder.removeCopy", { name: entry.name }),
            ...(off
              ? {
                  disabled: frozen
                    ? (this.#campaignModel?.editingDisabledReason ?? true)
                    : (row?.lockedReason ?? refused ?? true),
                }
              : {}),
          });
          this.#actions.set(`deck-minus:${cardId}`, () => {
            if (!off) this.#setDeck(removeCard(deck, entry.cardId));
          });
          y += 29;
          const note = noteOf?.(entry) ?? null;
          if (note !== null) {
            // Wrapped, not cut: a campaign note says why a line is pinned or a reward ("... one of your 50."), and the end is the point.
            const noteLine = this.#text(left, y, note, SENTENCE_LABEL, body, ink.meta, { wrapWidth: column });
            y += Math.max(14, noteLine.height + 2);
          }
          const line: Rect = { x: left, y: rowTop, width: column - removeWidth - 4, height: y - rowTop };
          this.#deckLines.push({ cardId, rect: line, scope: this.#scope });
          // A hold or a right-click on any line opens Inspect; a plain press does too where the line is a
          // campaign grant (its only place to read it), and nothing elsewhere.
          const open = inspectable(entry);
          const card = open?.card ?? this.#pool().find((candidate) => candidate.id === entry.cardId);
          if (card) {
            const key = `deck-line:${cardId}`;
            b.tap(key, { x: left, y: rowTop, width: column - removeWidth - 4, height: y - rowTop }, { inspect: true });
            const show = (): void => this.#inspect(card, open?.face ?? null);
            this.#actions.set(key, open ? show : () => undefined);
            this.#holds.set(key, show);
          }
        }
        y += 4;
      }
      return y + 8;
    };
    if (maxHeight === undefined) return drawList(listTop);
    // The wide rail: the list scrolls in its own region once it outgrows the rail.
    const rect: Rect = {
      x: left,
      y: listTop,
      width: column,
      height: Math.max(hit.target * 2, maxHeight - (listTop - top)),
    };
    this.#scrolled("list:yourdeck", rect, (at) => drawList(at));
    return rect.y + rect.height + 8;
  }

  /** The Your deck list's Sort (issue #594) and Review (issue #595) controls; returns where the list starts. */
  #drawDeckListControls(left: number, top: number, column: number, onDark: boolean): number {
    const gap = 8;
    const width = (column - gap) / 2;
    const sortRect: Rect = { x: left, y: top, width, height: hit.target };
    const look = onDark ? "onInk" : "secondary";
    const sort = (): void => {
      this.#deckSort = nextDeckListSort(this.#deckSort);
      this.#rememberView();
      this.#rebuild();
    };
    this.#button("deck-sort", sortRect, deckListSortLabel(this.#deckSort), sort, { look });
    const reviewRect: Rect = { x: left + width + gap, y: top, width, height: hit.target };
    // `this.#deck`, not the drawn `deck`: typing a name changes the deck without a redraw.
    const review = (): void => this.#reviewDeck(this.#deck!);
    this.#button("deck-review", reviewRect, t("deckBuilder.review"), review, {
      look,
      ...(this.#busy ? { disabled: true as const } : {}),
    });
    return top + hit.target + gap;
  }

  /** Opens Deck check on the deck as it stands, saved or not; its Back and Edit deck come back here with that deck. */
  #reviewDeck(deck: Deck): void {
    const campaign = this.#campaign;
    const model = this.#campaignModel;
    const data: DeckBuilderSceneData = {
      deck,
      ...(this.#isWide() ? {} : { tab: "deck" as const }),
      ...(campaign && this.#savedDeck ? { campaign, savedDeck: this.#savedDeck } : {}),
    };
    goToScreen(this, SCENES.deckCheck, {
      deck,
      returnTo: { scene: SCENES.deckBuilder, data },
      // Deck check knows nothing of a campaign's grants and removals, so it is told how the campaign judges the deck.
      ...(model ? { verdict: campaignDeckVerdictOf(model) } : {}),
    } satisfies DeckCheckSceneData);
  }

  /**
   * Precon / Clear / Delete, the campaign freeze, and Save. `part` splits them for the narrow layout, which scrolls the
   * first group with the deck and pins Save under the region; the wide rail draws all of it at once.
   */
  #drawPreconClearSave(
    left: number,
    top: number,
    column: number,
    deck: Deck,
    onDark = false,
    part: "all" | "actions" | "save" = "all",
  ): number {
    let y = top;
    if (part === "save") return this.#drawSaveButton(left, y, column);
    const look = onDark ? "onInk" : "secondary";
    // Campaign mode (MC10 p. 3): Preconstructed and Clear both replace `deck.cards` wholesale, which would drop
    // the campaign's own granted lines — a player can never remove those by hand, so the screen never offers a
    // control that would do it as a side effect. `showPreconClear: false` already keeps them out of the focus
    // route; this keeps them off the screen too.
    if (!this.#campaign) {
      const resetRowGap = 8;
      const canDelete = this.#savedDeck !== null;
      const cells = canDelete ? 3 : 2;
      const resetCellWidth = (column - resetRowGap * (cells - 1)) / cells;
      const preconRect: Rect = { x: left, y, width: resetCellWidth, height: hit.target };
      const clearRect: Rect = {
        x: left + resetCellWidth + resetRowGap,
        y,
        width: resetCellWidth,
        height: hit.target,
      };
      if (canDelete) {
        const deleteRect: Rect = {
          x: left + (resetCellWidth + resetRowGap) * 2,
          y,
          width: resetCellWidth,
          height: hit.target,
        };
        this.#button(
          "delete",
          deleteRect,
          this.#deleteArmed ? t("deckBuilder.confirmDelete") : t("deckBuilder.delete"),
          () => void this.#delete(),
          { look, selected: this.#deleteArmed, ...(this.#busy ? { disabled: true as const } : {}) },
        );
      }
      const precon = resetToPrecon(deck, this.#identity!, currentStarterDecks());
      const doPrecon = (): void => {
        const fresh = resetToPrecon(this.#deck!, this.#identity!, currentStarterDecks());
        if (fresh) this.#setDeck(fresh);
      };
      this.#button(
        "preconstructed",
        preconRect,
        canDelete ? t("deckBuilder.preconShort") : t("deckBuilder.precon"),
        doPrecon,
        { look, ...(precon === null ? { disabled: t("deckBuilder.noPrecon") } : {}) },
      );
      this.#button(
        "clear",
        clearRect,
        t("deckBuilder.clear"),
        () => this.#setDeck(resetToIdentitySet(this.#deck!, this.#identity!, this.#pool())),
        { look },
      );
      y += hit.target + 16;
    }

    // MC27 p. 6's optional Expert Campaign freeze: nothing chooses it for the player (unlike MC16's mandatory
    // freeze, which `deck-edit.ts` detects and routes around before this scene ever loads), so it is offered here
    // as a standing choice while it is still available (`DeckBuilderCampaignData.optionalFreeze`, computed by
    // `deck-edit.ts` from `frozenNonCampaignCardsOf`'s own eligibility check). Opting in reuses MC16's frozen-deck
    // screen (`SCENES.campaignFrozenDeck`) rather than a bespoke summary.
    if (this.#campaign?.optionalFreeze?.eligible) {
      const freezeRect: Rect = { x: left, y, width: column, height: hit.target };
      const campaign = this.#campaign;
      // The opt-in itself is a small read-modify-write on the run record (`campaign-service.ts`'s
      // `optIntoDeckFreeze`), so this fires the async round trip and navigates once it settles — the same shape
      // `#save` already uses for `setSeatDeck`.
      const doFreeze = async (): Promise<void> => {
        const record = await campaignService().load(campaign.runId);
        if (record) await campaignService().optIntoDeckFreeze(record, campaign.seatNumber);
        goToScreen(this, SCENES.campaignFrozenDeck, {
          runId: campaign.runId,
          seatNumber: campaign.seatNumber,
          returnTo: campaign.returnTo,
          title: campaign.title,
        });
      };
      this.#button("freeze-deck", freezeRect, t("deckBuilder.freeze"), () => void doFreeze(), { look });
      y += hit.target + 16;
    }

    if (part === "actions") return y;
    return this.#drawSaveButton(left, y, column);
  }

  #drawSaveButton(left: number, y: number, column: number): number {
    const frozen = this.#campaignModel?.editingDisabled ?? false;
    const saveRect: Rect = { x: left, y, width: column, height: hit.primary };
    this.#button(
      "save",
      saveRect,
      this.#busy
        ? t("deckBuilder.saving")
        : this.#campaign
          ? t("deckBuilder.saveChanges")
          : this.#isDirty()
            ? t("deckBuilder.saveDeck")
            : t("deckBuilder.saved"),
      () => void this.#save(),
      {
        look: "primary",
        type: typeRole.barTitle,
        ...(this.#busy ? { disabled: true as const } : {}),
        ...(frozen ? { disabled: this.#campaignModel?.editingDisabledReason ?? true } : {}),
      },
    );
    return y + hit.primary + 16;
  }

  /**
   * The pool search row: the field (a real input with its own clear button), the ? that opens the cheat sheet, and the
   * Cards/List view toggle. The search matches every word against a card's name, traits, type and rules text
   * (`browsablePool`).
   */
  #drawFilterInput(left: number, top: number, column: number): number {
    const toggleWidth = 92;
    const helpWidth = hit.target;
    const fieldWidth = column - toggleWidth - CHIP_GAP - helpWidth - CHIP_GAP;
    const filterRect: Rect = { x: left, y: top, width: fieldWidth, height: hit.target };
    this.#b.search(filterRect, {
      key: "filter-text",
      value: this.#filterText,
      placeholder: t("deckBuilder.searchPlaceholder"),
      clearLabel: t("deckBuilder.clearSearch"),
    });
    this.#stop("filter-text", filterRect, () => this.#fieldElement("filter-text")?.focusInput());
    if (this.#filterText) {
      // The field's own clear button, as a stop for the keyboard and the pad.
      const clearRect: Rect = { x: left + fieldWidth - hit.target, y: top, width: hit.target, height: hit.target };
      this.#stop("filter-clear", clearRect, () => {
        this.#applyFilterText("");
        this.#rebuild();
      });
    }
    const helpRect: Rect = {
      x: left + column - toggleWidth - CHIP_GAP - helpWidth,
      y: top,
      width: helpWidth,
      height: hit.target,
    };
    this.#button("filter-help", helpRect, "?", () => this.#openSearchHelp((value) => this.#applyFilterText(value)), {
      type: typeRole.rowTitle,
      aria: t("deckBuilder.searchHelp"),
    });
    const toggleRect: Rect = { x: left + column - toggleWidth, y: top, width: toggleWidth, height: hit.target };
    const toggle = (): void => {
      this.#poolView = this.#poolView === "grid" ? "list" : "grid";
      this.#rememberView();
      this.#resetPool();
      this.#rebuild();
    };
    this.#button(
      "pool-view",
      toggleRect,
      this.#poolView === "grid" ? t("deckBuilder.listView") : t("deckBuilder.cardView"),
      toggle,
    );
    return top + hit.target + 16;
  }

  /** The pack or wave picker (issue #977): every press applies at once, so the pool behind it updates. */
  #openPoolPick(
    title: string,
    choices: readonly FilterChoice[],
    chosen: readonly string[] | null | undefined,
    onChange: (chosen: readonly string[]) => void,
  ): void {
    if (this.scene.isActive(SCENES.poolPick)) return;
    this.scene.launch(SCENES.poolPick, {
      from: this.scene.key,
      title,
      choices,
      chosen: chosen ?? [],
      onChange: (next) => {
        if (!this.sys.isActive()) return;
        onChange(next);
      },
      onClose: () => {
        if (!this.sys.isActive()) return;
        this.#rebuild();
      },
    } satisfies PoolPickSheetData);
  }

  /** The search cheat sheet (issue #531): Use puts an example in the search and closes it. */
  #openSearchHelp(applyText: (value: string) => void): void {
    if (this.scene.isActive(SCENES.searchHelp)) return;
    this.scene.launch(SCENES.searchHelp, {
      from: this.scene.key,
      onUse: (query) => applyText(query),
      onClose: () => {
        if (!this.sys.isActive()) return;
        this.#rebuild();
      },
    } satisfies SearchHelpSheetData);
  }

  /**
   * The pool, windowed: the list is one native scroller as tall as every row, and only the rows near the viewport are
   * parts (`POOL_OVERSCAN_ROWS` above and below); a scroll that moves the window rebuilds them (`#onScroll`). Every
   * card still gets a focus stop, whether or not its row is built, since a stop's rect comes from the layout, not the DOM.
   */
  #drawPoolList(listRect: Rect, deck: Deck, pool: readonly AnyCard[]): void {
    const b = this.#b;
    if (pool.length === 0) {
      const searched = this.#filterText.trim();
      this.#text(
        listRect.x + 10,
        listRect.y + 10,
        searched ? t("deckBuilder.noMatchSearch", { text: searched }) : t("deckBuilder.noMatch"),
        typeRole.body,
        surface.ink.hex,
        ink.meta,
        { wrapWidth: listRect.width - 20, key: "pool-empty" },
      );
      this.#poolRowCount = 0;
      this.#poolWindow = "";
      return;
    }
    const grid = this.#poolView === "grid";
    const geometry = grid ? this.#gridGeometry(listRect.width, pool.length) : null;
    const rowHeight = geometry ? geometry.cellHeight : this.#rows.cardRowHeight;
    const rowCount = geometry ? geometry.rows : pool.length;
    this.#poolRowHeight = rowHeight;
    this.#poolRowCount = rowCount;
    this.#poolViewHeight = listRect.height;
    const window = this.#poolWindowFor(this.#scrollTop(POOL_LIST));
    this.#poolWindow = window;
    const [start, end] = window.split("-").map(Number) as [number, number];
    const scope: Scope = { key: POOL_LIST, view: listRect };
    const rowRectOf = (index: number): Rect => ({
      x: listRect.x,
      y: index * rowHeight,
      width: listRect.width,
      height: rowHeight,
    });
    if (!grid) b.box(listRect, { stroke: surface.ink.hex, strokeWidth: 2 });
    b.scroll(POOL_LIST, listRect, rowCount * rowHeight, (inner) => {
      this.#b = inner;
      for (let index = start; index < end; index++) {
        if (geometry) this.#gridRow(rowRectOf(index), geometry, deck, pool, index);
        else this.#listRow(rowRectOf(index), deck, pool[index]!);
      }
      this.#b = b;
    });
    // A card is hovered over its picture and text, not its -/+ strip; only the part inside the list's window counts.
    this.#hoverLists.push(() => {
      const found: (readonly [string, HoverCardIdRect])[] = [];
      const top = this.#scrollTop(POOL_LIST);
      const first = Math.max(0, Math.floor(top / rowHeight));
      const last = Math.min(rowCount, Math.ceil((top + listRect.height) / rowHeight));
      for (let index = first; index < last; index++) {
        const at = rowRectOf(index);
        const cells = geometry ? Math.min(geometry.columns, pool.length - index * geometry.columns) : 1;
        for (let col = 0; col < cells; col++) {
          const card = pool[geometry ? index * geometry.columns + col : index]!;
          const cell = geometry ? poolCellRect(geometry, at, col) : at;
          const area: Rect = geometry
            ? {
                x: cell.x + 4,
                y: cell.y + 2,
                width: cell.width - 8,
                height: geometry.cellHeight - GRID_CONTROLS_HEIGHT - 4,
              }
            : { x: cell.x + 4, y: cell.y, width: cell.width - 8 - POOL_ROW_CONTROLS_WIDTH, height: rowHeight - 6 };
          const rect = clipHoverRect(this.#inScope(scope, area), listRect);
          const cardId = card.id as string;
          if (rect) found.push([hoverSlotOf(cardId, `pool${index}.${col}`), { ...rect, cardId, through: true }]);
        }
      }
      return found;
    });
    const before = this.#scope;
    this.#scope = scope;
    pool.forEach((card, index) => {
      const cardId = card.id as string;
      const rowIndex = geometry ? Math.floor(index / geometry.columns) : index;
      const at = rowRectOf(rowIndex);
      const rect = geometry ? poolCellRect(geometry, at, index % geometry.columns) : at;
      this.#stop(
        `card:${cardId}`,
        rect,
        // Keyboard/pad activation mirrors the card's own "+" button, including its campaign refusals: a stop still
        // exists for every browsable card (so its reason reads), but pressing it on a refused or frozen row is a no-op,
        // exactly like pressing a disabled "+".
        () => {
          const row = this.#campaignRowFor(cardId);
          if (
            (this.#campaignModel?.editingDisabled ?? false) ||
            (row?.refused ?? false) ||
            this.#ruleRefusal(deck, card.id, 1)
          )
            return;
          this.#setDeck(addCard(deck, card.id));
        },
        { inspect: () => this.#inspect(card, this.#campaignRowFor(cardId)?.face ?? null) },
      );
    });
    this.#scope = before;
  }

  /** Card view's geometry: `view/deck-pool-grid.ts`'s cells (the Decks screen's own), each with a −/qty/+ strip under its caption. */
  #gridGeometry(width: number, count: number): PoolGridGeometry {
    // A phone's column takes three smaller cards across rather than two big ones, so a screen shows more than one row.
    const { width: screenWidth, height: screenHeight } = this.scale.gameSize;
    const phoneScale = formFactorFor(screenWidth, screenHeight) === "phone" ? 0.8 : 1;
    const geometry = poolGridGeometry(
      width,
      count,
      false,
      cardSizeFactor(appSession().settings.cardSize) * phoneScale,
      POOL_MAX_COLUMNS,
    );
    return { ...geometry, cellHeight: geometry.cellHeight + GRID_CONTROLS_HEIGHT };
  }

  /** The rendered px size of a text spec on this screen (the desktop bump for sizes up to 12). */
  #px(size: number): number {
    return isDesktopType() && size <= 12 ? Math.min(13, size + 2) : size;
  }

  /** The card's title for a pool tile and the line below it that carries a subtitle the tile had no room for. */
  #titleOf(card: AnyCard, width: number): { readonly shown: string; readonly cut: string | null } {
    const full = localizedLabelOf(card, artLanguageNow());
    const subtitle = "subtitle" in card ? card.subtitle : null;
    const fits = full.length * this.#px(11) * 0.58 <= width;
    const short =
      subtitle && full.endsWith(`(${subtitle})`) ? full.slice(0, full.length - subtitle.length - 2).trim() : full;
    const shown = fits ? full : short;
    return { shown, cut: subtitleCutFrom(card, shown) };
  }

  /** A card's "−" and "+" as parts, with the refusals the campaign and the rule settings give. */
  #quantityButtons(deck: Deck, card: AnyCard, minusRect: Rect, plusRect: Rect, quantity: number, name: string): void {
    const cardId = card.id as string;
    const campaignRow = this.#campaignRowFor(cardId);
    const frozen = this.#campaignModel?.editingDisabled ?? false;
    // The rule settings (issue #531) only matter where nothing else already disables the button.
    const minusRefused = quantity > 0 ? this.#ruleRefusal(deck, card.id, -1) : null;
    const plusRefused = this.#ruleRefusal(deck, card.id, 1);
    const minusOff = !(quantity > 0 && !(campaignRow?.locked ?? false) && !frozen && minusRefused === null);
    const minusReason = frozen
      ? (this.#campaignModel?.editingDisabledReason ?? undefined)
      : (campaignRow?.lockedReason ?? minusRefused ?? undefined);
    const plusOff = (campaignRow?.refused ?? false) || frozen || plusRefused !== null;
    const plusReason = frozen
      ? (this.#campaignModel?.editingDisabledReason ?? undefined)
      : (campaignRow?.refusedReason ?? plusRefused ?? undefined);
    this.#b.button({
      key: `minus:${cardId}`,
      rect: minusRect,
      label: "−",
      look: "secondary",
      type: typeRole.rowTitle,
      aria: t("deckBuilder.removeCopy", { name }),
      ...(minusOff ? { disabled: minusReason ?? true } : {}),
    });
    this.#actions.set(`minus:${cardId}`, () => {
      if (!minusOff) this.#setDeck(removeCard(deck, card.id));
    });
    this.#b.button({
      key: `plus:${cardId}`,
      rect: plusRect,
      label: "+",
      look: "secondary",
      type: typeRole.rowTitle,
      aria: t("deckBuilder.addCopy", { name }),
      ...(plusOff ? { disabled: plusReason ?? true } : {}),
    });
    this.#actions.set(`plus:${cardId}`, () => {
      if (!plusOff) this.#setDeck(addCard(deck, card.id));
    });
  }

  /** One row of Card view (a row of cells), in the list's content space. */
  #gridRow(rowRect: Rect, geometry: PoolGridGeometry, deck: Deck, pool: readonly AnyCard[], rowIndex: number): void {
    const b = this.#b;
    const start = rowIndex * geometry.columns;
    const inRow = Math.min(geometry.columns, pool.length - start);
    const lang = artLanguageNow();
    for (let col = 0; col < inRow; col++) {
      const card = pool[start + col]!;
      const cardId = card.id as string;
      const cell = poolCellRect(geometry, rowRect, col);
      const cardRect: Rect = { x: cell.x + 4, y: cell.y + 2, width: cell.width - 8, height: cell.height - 6 };
      const quantity = deck.cards.find((line) => line.cardId === card.id)?.quantity ?? 0;
      const campaignRow = this.#campaignRowFor(cardId);
      b.box(cardRect, {
        fill: surface.card.hex,
        stroke: quantity > 0 ? accent.heroRed.hex : surface.ink.hex,
        strokeWidth: quantity > 0 ? 4 : 2,
        key: `cell:${cardId}`,
      });
      const artRect: Rect = {
        x: cardRect.x + 3,
        y: cardRect.y + 3,
        width: cardRect.width - 6,
        height: geometry.artHeight - 6,
      };
      const { shown, cut } = this.#titleOf(card, cardRect.width - 12);
      b.image(artRect, {
        src: artFor(card, { kind: "front" })?.url ?? null,
        fill: surface.parchment.hex,
        missing: localizedLabelOf(card, lang),
        key: `art:${cardId}`,
      });
      if ("cost" in card && typeof card.cost === "number") {
        const pipWidth = String(card.cost).length * 7 + 12;
        b.box(
          { x: artRect.x, y: artRect.y, width: pipWidth, height: 18 },
          { fill: surface.ink.hex, key: `cost-tab:${cardId}` },
        );
        b.text(artRect.x + 6, artRect.y + 9, String(card.cost), typeRole.label, {
          color: surface.paper.hex,
          origin: [0, 0.5],
          key: `cost:${cardId}`,
        });
      }
      const captionY = cardRect.y + geometry.artHeight;
      b.text(cardRect.x + 6, captionY, shown, typeRole.rowTitle, {
        color: surface.ink.hex,
        fitWidth: cardRect.width - 12,
        key: `name:${cardId}`,
      });
      const note = this.#campaign ? null : poolRowNote(card, this.#identity!, deck.aspects);
      const captionText = campaignRow?.locked
        ? t("deckBuilder.campaignGrant")
        : campaignRow?.refused
          ? t("deckBuilder.removedFromCampaign")
          : cut && note
            ? `${cut} · ${note}`
            : (note ?? cut ?? poolTypeLine(card));
      b.text(cardRect.x + 6, captionY + this.#px(11) * 1.25 + 2, captionText, typeRole.label, {
        color: surface.ink.hex,
        ...(note || campaignRow ? { alpha: ink.label } : { alpha: ink.meta }),
        fitWidth: cardRect.width - 12,
        key: `caption:${cardId}`,
      });
      // A tap on the picture or caption opens Inspect (a hold or a right-click does too), the full card with its keywords explained.
      b.tap(
        `open:${cardId}`,
        { x: cardRect.x, y: cardRect.y, width: cardRect.width, height: geometry.cellHeight - GRID_CONTROLS_HEIGHT - 4 },
        { inspect: true },
      );
      this.#actions.set(`open:${cardId}`, () => this.#inspect(card, campaignRow?.face ?? null));

      // The −, quantity and + strip along the cell's foot.
      const stripY = cell.y + geometry.cellHeight - GRID_CONTROLS_HEIGHT;
      const buttonWidth = Math.min(44, (cardRect.width - 12) / 3);
      const minusRect: Rect = { x: cardRect.x + 4, y: stripY, width: buttonWidth, height: hit.target };
      const plusRect: Rect = {
        x: cardRect.x + cardRect.width - 4 - buttonWidth,
        y: stripY,
        width: buttonWidth,
        height: hit.target,
      };
      this.#quantityButtons(deck, card, minusRect, plusRect, quantity, shown);
      b.text(
        cardRect.x + cardRect.width / 2,
        stripY + hit.target / 2,
        quantity > 0 ? `×${quantity}` : "",
        typeRole.rowTitle,
        {
          color: surface.ink.hex,
          ...(quantity > 0 ? {} : { alpha: ink.meta }),
          origin: [0.5, 0.5],
          key: `qty:${cardId}`,
        },
      );
    }
  }

  /** One row of List view: the picture, name, type line, why it is offered, its rules text, and the −, quantity and +. */
  #listRow(rect: Rect, deck: Deck, card: AnyCard): void {
    const b = this.#b;
    const cardId = card.id as string;
    const row: Rect = { x: rect.x + 4, y: rect.y, width: rect.width - 8, height: this.#rows.cardRowHeight - 6 };
    b.box(row, { fill: surface.card.hex, stroke: surface.ink.hex, strokeWidth: 2, key: `row:${cardId}` });
    const quantity = deck.cards.find((c) => c.cardId === card.id)?.quantity ?? 0;
    const campaignRow = this.#campaignRowFor(cardId);
    // The card's own picture, then its name, type line and what it does; a tap anywhere left of −/+ inspects it.
    b.image(
      { x: row.x + 6, y: row.y + 6, width: this.#rows.cardThumbWidth, height: row.height - 12 },
      {
        src: artFor(card, { kind: "front" })?.url ?? null,
        fill: surface.parchment.hex,
        missing: localizedLabelOf(card, artLanguageNow()),
        key: `art:${cardId}`,
      },
    );
    const textX = row.x + 6 + this.#rows.cardThumbWidth + 10;
    const textWidth = row.x + row.width - POOL_ROW_CONTROLS_WIDTH - textX;
    const { shown, cut } = this.#titleOf(card, textWidth);
    b.text(textX, row.y + 6, shown, typeRole.rowTitle, {
      color: surface.ink.hex,
      fitWidth: textWidth,
      key: `name:${cardId}`,
    });
    const typeBase = cut ? `${cut} · ${poolTypeLine(card)}` : poolTypeLine(card);
    // A card from an installed custom pack says so in words.
    const customBadge = customCardBadgeOf(cardId);
    const typeText = customBadge ? `${typeBase} · ${customBadge}` : typeBase;
    // Why a card is listed when the chosen aspect would not allow it, or why it is refused (held, but not allowed).
    const note = this.#campaign ? null : poolRowNote(card, this.#identity!, deck.aspects);
    // MC27 p. 22's Enhanced side (`CampaignDeckEditRow.face`): named on its own, in front of "campaign grant", so
    // the row never reads as an ordinary grant when the printed card in play is actually the flipped side.
    const faceLabel = campaignRow?.face ? ` · ${campaignRow.face} (Enhanced)` : "";
    const typeLineText = campaignRow?.locked
      ? `${typeText} · ${t("deckBuilder.campaignGrant")}${faceLabel}`
      : campaignRow?.refused
        ? `${typeText} · ${t("deckBuilder.removedFromCampaign")}`
        : typeText;
    const nameH = this.#px(11) * 1.25;
    const labelH = this.#px(9) * 1.2;
    const typeY = row.y + 6 + nameH + 2;
    b.text(textX, typeY, typeLineText, SENTENCE_LABEL, {
      color: surface.ink.hex,
      alpha: ink.meta,
      fitWidth: textWidth,
      key: `type:${cardId}`,
    });
    // Why the card is offered or refused: its own line, so the type line never cuts it off on a narrow row.
    let belowY = typeY + labelH;
    if (note) {
      b.text(textX, belowY + 1, note, SENTENCE_LABEL, {
        color: surface.ink.hex,
        alpha: ink.label,
        fitWidth: textWidth,
        key: `note:${cardId}`,
      });
      belowY += labelH + 1;
    }
    const rules = cardInspectModel(card, campaignRow?.face ? { kind: "flipSide" } : { kind: "front" }).rulesText;
    if (rules) {
      b.text(textX, belowY + 4, rules, SENTENCE_LABEL, {
        color: surface.ink.hex,
        wrapWidth: textWidth,
        maxLines: note ? CARD_TEXT_LINES - 1 : CARD_TEXT_LINES,
        key: `rules:${cardId}`,
      });
    }
    b.text(row.x + row.width - 128, row.y + row.height / 2, String(quantity), typeRole.rowTitle, {
      color: surface.ink.hex,
      origin: [0.5, 0.5],
      key: `qty:${cardId}`,
    });
    b.tap(
      `open:${cardId}`,
      { x: row.x, y: row.y, width: row.width - POOL_ROW_CONTROLS_WIDTH - 4, height: row.height },
      { inspect: true },
    );
    this.#actions.set(`open:${cardId}`, () => this.#inspect(card, campaignRow?.face ?? null));
    const minusRect: Rect = {
      x: row.x + row.width - 106,
      y: row.y + (row.height - hit.target) / 2,
      width: 40,
      height: hit.target,
    };
    const plusRect: Rect = { x: row.x + row.width - 46, y: minusRect.y, width: 40, height: hit.target };
    this.#quantityButtons(deck, card, minusRect, plusRect, quantity, shown);
  }

  /** The focal point to crop a hero's picture around: its `focus.json`, else the face-and-shoulders default. */
  #focusOf(identity: HeroIdentityCard): { readonly x: number; readonly y: number } {
    const focus = this.#identityArtFocus(identity);
    return { x: focus?.x ?? 0.5, y: focus?.y ?? 0.25 };
  }

  /**
   * The identity picker: a grid of hero tiles in one native scroller, so it scrolls by drag, wheel and paging, and a
   * swipe over it never picks the hero it lifts over. Every tile is the hero's own art (the picture Take your seats
   * shows, else the identity card's scan, loaded lazily) over a name bar; a tap on either picks the hero, a hold or a
   * right-click on the art inspects it.
   */
  #drawIdentityPicker(left: number, y: number, column: number): readonly HeroIdentityCard[] {
    const b = this.#b;
    this.#label(left, y, t("deckBuilder.pickHero"));
    y += 16;
    // The hero search: every word must appear in the hero's name, alter-ego name or traits.
    const searchRect: Rect = { x: left, y, width: column, height: hit.target };
    b.search(searchRect, {
      key: "identity-search",
      value: this.#identitySearch,
      placeholder: t("deckBuilder.searchHeroes"),
      clearLabel: t("deckBuilder.clearSearch"),
    });
    this.#stop("identity-search", searchRect, () => this.#fieldElement("identity-search")?.focusInput());
    y += hit.target + 12;
    const heroRanking = this.#identitySearch.trim() ? this.#heroRanking : null;
    const shown = heroRanking
      ? identities()
          .filter((identity) => heroRanking.has(identity.id as string))
          .sort((a, c) => heroRanking.get(c.id as string)! - heroRanking.get(a.id as string)!)
      : identities();
    if (shown.length === 0) {
      this.#text(
        left,
        y,
        t("deckBuilder.noHero", { text: this.#identitySearch.trim() }),
        typeRole.body,
        surface.ink.hex,
        ink.meta,
        {
          wrapWidth: column,
        },
      );
      return shown;
    }
    const { height } = this.scale.gameSize;
    const pad = formFactorFor(this.scale.gameSize.width, height) === "phone" ? 16 : 40;
    const gap = 12;
    const cols = Math.max(
      2,
      Math.min(6, Math.floor((column + gap) / ((200 * this.#rows.identityRowHeight) / 64 + gap))),
    );
    const tileWidth = (column - gap * (cols - 1)) / cols;
    const artHeight = Math.round(tileWidth / IDENTITY_THUMB_ASPECT);
    const rowHeight = artHeight + hit.target + gap;
    const rows = Math.ceil(shown.length / cols);
    const listRect: Rect = {
      x: left,
      y,
      width: column,
      height: Math.min(rows * rowHeight, Math.max(rowHeight, height - y - pad)),
    };
    const chooseAt = (index: number): void => {
      const identity = shown[index]!;
      // A hero with a published precon gets the "Start from" step; one without starts from its own cards.
      if (preconsFor(identity, currentStarterDecks()).length > 0) {
        this.#startFor = identity;
        this.#rebuild();
      } else this.#startWith(identity, null);
    };
    const tileRect = (index: number): Rect => ({
      x: left + (index % cols) * (tileWidth + gap),
      y: Math.floor(index / cols) * rowHeight,
      width: tileWidth,
      height: artHeight + hit.target,
    });
    this.#scrolled("list:identity", listRect, () => {
      shown.forEach((identity, index) => {
        const cardId = identity.id as string;
        const tile = tileRect(index);
        const artRect: Rect = { x: tile.x, y: tile.y, width: tile.width, height: artHeight };
        this.#b.box(tile, { fill: surface.card.hex, stroke: surface.ink.hex, strokeWidth: 2, key: `tile:${cardId}` });
        this.#b.pictureTile(
          { x: tile.x + 3, y: tile.y + 3, width: tile.width - 6, height: artHeight - 3 },
          {
            src: this.#identityArtUrl(identity),
            fit: "cover",
            focus: this.#focusOf(identity),
            frame: 0,
            missing: qualifiedHeroName(identity),
            key: `hero-art:${cardId}`,
          },
        );
        // The art is a tap that picks the hero (a hold inspects it); the name bar under it is the labelled button.
        this.#b.tap(`identity:${cardId}`, artRect, { inspect: true });
        this.#actions.set(`identity:${cardId}`, () => chooseAt(index));
        this.#holds.set(`identity:${cardId}`, () => this.#inspect(identity));
        this.#b.button({
          key: `identity-name:${cardId}`,
          rect: { x: tile.x, y: tile.y + artHeight, width: tile.width, height: hit.target },
          label: qualifiedHeroName(identity),
          look: "secondary",
          type: typeRole.rowTitle,
        });
        this.#actions.set(`identity-name:${cardId}`, () => chooseAt(index));
        this.#deckLines.push({ cardId, rect: artRect, scope: this.#scope });
      });
      return Math.ceil(shown.length / cols) * rowHeight;
    });
    const scope: Scope = { key: "list:identity", view: listRect };
    const before = this.#scope;
    this.#scope = scope;
    shown.forEach((identity, index) => {
      this.#stop(`identity:${identity.id as string}`, tileRect(index), () => chooseAt(index), {
        inspect: () => this.#inspect(identity),
      });
    });
    this.#scope = before;
    return shown;
  }

  /**
   * Asks the search worker to rank the pool for `text`; the list redraws when the newest answer arrives, and keeps the
   * previous results until then. Every card is a document (sent once per visit): the pool's other filters still apply
   * on this side, so a ranking never needs redoing when an aspect or chip changes.
   */
  #requestPoolSearch(text: string): void {
    const search = this.#poolSearch;
    if (!search) return;
    text = freeTextOf(text);
    if (text === "") {
      search.cancel();
      this.#poolRanking = null;
      this.#rebuild();
      return;
    }
    // The card language's names load on first use (English needs none); the search runs once they are in.
    const lang = artLanguageNow();
    if (!cardNamesReady(lang)) {
      void loadCardNames(lang).then(() => {
        // The field may have changed (or been cleared) while the names loaded: ask for what it holds now.
        if (this.sys.isActive() && this.#poolSearch === search) this.#requestPoolSearch(this.#filterText);
      });
      return;
    }
    search.setDocuments(POOL_SEARCH_DOCUMENTS(), `${poolKeyNow()}:${lang}`);
    search.search(text, (ranked) => {
      if (!this.sys.isActive()) return;
      this.#poolRanking = new Map(ranked.map((r) => [r.id, r.score]));
      this.#resetPool();
      this.#rebuild();
    });
    this.#rebuild();
  }

  /** The hero picker's search, ranked the same way: names first, then traits. */
  #requestHeroSearch(text: string): void {
    const search = this.#heroSearch;
    if (!search) return;
    if (text.trim() === "") {
      search.cancel();
      this.#heroRanking = null;
      this.#rebuild();
      return;
    }
    search.setDocuments(HERO_SEARCH_DOCUMENTS(), currentPoolKey());
    search.search(text, (ranked) => {
      if (!this.sys.isActive()) return;
      this.#heroRanking = new Map(ranked.map((r) => [r.id, r.score]));
      this.#resetPool();
      this.#rebuild();
    });
  }

  /** Opens the builder on `identity`'s new deck: empty (its signature cards) or a copy of `starter`. */
  #startWith(identity: HeroIdentityCard, starter: StarterDeck | null): void {
    this.#identity = identity;
    this.#startFor = null;
    this.#deck = startingDeckOf(
      identity,
      starter,
      currentPool(),
      `deck-${crypto.randomUUID()}`,
      POOL_VERSION,
      new Date().toISOString(),
    );
    this.#savedDeck = null;
    this.#resetPool();
    this.#rebuild();
  }

  /**
   * New deck's "Start from" step (issue #217): the hero's picture, then an empty deck (the hero's own cards) or the
   * player's own copy of one of its precons, each named with its aspect. Returns the stops it drew, in order.
   */
  #drawStartFrom(left: number, top: number, column: number, identity: HeroIdentityCard): readonly string[] {
    const ids: string[] = [];
    let y = top;
    this.#label(left, y, t("deckBuilder.startFrom", { hero: qualifiedHeroName(identity) }));
    y += 20;
    const width = Math.min(column, 560);
    const bannerHeight = Math.round(width / 2.4);
    const bannerRect: Rect = { x: left, y, width, height: bannerHeight };
    this.#b.pictureTile(bannerRect, {
      src: this.#identityArtUrl(identity),
      fit: "cover",
      focus: this.#focusOf(identity),
      frame: 2,
      missing: qualifiedHeroName(identity),
      key: "start-banner",
    });
    this.#deckLines.push({ cardId: identity.id as string, rect: bannerRect, scope: null });
    y += bannerHeight + 16;
    const add = (id: string, text: string, onClick: () => void, tint?: { fill: number; ink: number }): void => {
      const rect: Rect = { x: left, y, width, height: hit.primary };
      if (tint) this.#tintButton(id, rect, text, tint, onClick, { type: typeRole.rowTitle });
      else this.#button(id, rect, text, onClick, { type: typeRole.rowTitle });
      ids.push(id);
      y += hit.primary + 10;
    };
    add("start:empty", t("deckBuilder.startEmpty"), () => this.#startWith(identity, null));
    for (const starter of preconsFor(identity, currentStarterDecks())) {
      const aspects = starter.aspects.map((aspect) => aspectStampOf(aspect, artLanguageNow()).label).join(" + ");
      const stamp = starter.aspects[0] ? aspectStampOf(starter.aspects[0], artLanguageNow()) : null;
      add(
        `start:${starter.id as string}`,
        t("deckBuilder.startPrecon", { aspects }),
        () => this.#startWith(identity, starter),
        stamp ? { fill: stamp.fill, ink: stamp.ink } : undefined,
      );
    }
    y += 6;
    add("start:back", t("deckBuilder.startBack"), () => {
      this.#startFor = null;
      this.#rebuild();
    });
    return ids;
  }

  /**
   * The chosen identity above the builder (issue #920): one card-like row with the hero's picture, its name and a
   * "Read card" cue. A press on the row (a tap, never a lift) and the pad's stop open Inspect on the hero side, whose
   * toggle flips to the alter-ego (and any other forms), so a player can read what the hero does while building. On
   * desktop the picture opens the card popover too. Returns the y below the row.
   */
  #drawIdentityRow(left: number, top: number, column: number, identity: HeroIdentityCard): number {
    const b = this.#b;
    const phone = formFactorFor(this.scale.gameSize.width, this.scale.gameSize.height) === "phone";
    const inset = 4;
    const rowRect: Rect = { x: left, y: top, width: phone ? column : Math.min(column, 460), height: hit.target + 8 };
    const open = (): void => {
      this.scene.launch(SCENES.inspect, { card: { cardId: identity.id, face: { kind: "hero" } } });
    };
    b.box(rowRect, { fill: surface.card.hex, stroke: surface.ink.hex, strokeWidth: 2 });
    const thumbHeight = rowRect.height - inset * 2;
    const thumbRect: Rect = {
      x: rowRect.x + inset,
      y: rowRect.y + inset,
      width: Math.round(thumbHeight * IDENTITY_THUMB_ASPECT),
      height: thumbHeight,
    };
    b.pictureTile(thumbRect, {
      src: this.#identityArtUrl(identity),
      fit: "cover",
      focus: this.#focusOf(identity),
      frame: 0,
      key: "identity-art",
    });
    this.#deckLines.push({ cardId: identity.id as string, rect: thumbRect, scope: null, face: { kind: "hero" } });

    const right = rowRect.x + rowRect.width - 12;
    const cue = this.#text(
      right,
      rowRect.y + rowRect.height / 2,
      t("deckBuilder.readCard"),
      typeRole.label,
      surface.ink.hex,
      1,
      {
        origin: [1, 0.5],
      },
    );
    const textX = thumbRect.x + thumbRect.width + 10;
    this.#label(textX, rowRect.y + 6, t("deckBuilder.identity"));
    b.text(textX, rowRect.y + rowRect.height - 6, qualifiedHeroName(identity), typeRole.rowTitle, {
      color: surface.ink.hex,
      origin: [0, 1],
      fitWidth: Math.max(40, right - cue.width - 12 - textX),
    });
    b.tap("identity-card", rowRect, { inspect: true });
    this.#actions.set("identity-card", open);
    this.#stops.set("identity-card", { rect: rowRect, activate: open, inspect: open });
    return rowRect.y + rowRect.height + 12;
  }

  /** The identity row's picture: the hero's own art (`art/heroes/`), else the identity card's scan, else none. */
  #identityArtUrl(identity: HeroIdentityCard): string | null {
    return this.#identityArtOf(identity).url;
  }

  /** The hero art's focus point (`focus.json`); none for the identity card's own scan. */
  #identityArtFocus(identity: HeroIdentityCard): PictureFocus | undefined {
    return this.#identityArtOf(identity).focus;
  }

  #identityArtOf(identity: HeroIdentityCard): { url: string | null; focus?: PictureFocus } {
    const id = identity.id as string;
    // An installed pack hero's picture arrives after the first draw, so it is not remembered here.
    if (isCustomCard(id)) {
      return { url: packPictureFor("hero", id)?.url ?? artFor(identity, { kind: "hero" })?.url ?? null };
    }
    let art = this.#identityArt.get(id);
    if (!art) {
      const picture = heroArtForIdentity(HERO_ART, id, currentPool());
      art = picture
        ? { url: picture.url, ...(picture.focus ? { focus: picture.focus } : {}) }
        : { url: artFor(identity, { kind: "hero" })?.url ?? null };
      this.#identityArt.set(id, art);
    }
    return art;
  }

  /**
   * `face` names the granted face this card is on (`CampaignDeckEditRow.face`, MC27 p. 22's Enhanced side) — passed
   * straight to the shared inspect overlay's `{ kind: "flipSide" }`, which already reads a card's own `flipSide`
   * art/text/traits (`view/inspect-model.ts`). Null (every non-granted card, and most grants) inspects the front.
   */
  #inspect(card: AnyCard, face: string | null = null): void {
    this.scene.launch(SCENES.inspect, {
      card: { cardId: card.id, face: face ? { kind: "flipSide" } : { kind: "front" } },
    });
  }

  #setDeck(deck: Deck, rebuild = true): void {
    this.#deck = deck;
    if (this.#leaveArmed || this.#deleteArmed) {
      this.#leaveArmed = false;
      this.#deleteArmed = false;
      this.#status = null;
      rebuild = true;
    }
    if (rebuild) this.#rebuild();
  }

  /** The open deck differs from what storage holds (or was never saved), so leaving would lose something. */
  #isDirty(): boolean {
    return this.#deck !== null && this.#identity !== null && hasUnsavedChanges(this.#deck, this.#savedDeck);
  }

  /** Delete, from the builder: the first press asks, the second removes the saved deck and returns to Decks. */
  async #delete(): Promise<void> {
    const saved = this.#savedDeck;
    if (this.#busy || !saved || this.#campaign) return;
    if (!this.#deleteArmed) {
      this.#deleteArmed = true;
      this.#leaveArmed = false;
      this.#status = `Press Confirm delete to remove “${saved.name}” from your decks. This can't be undone.`;
      this.#rebuild();
      return;
    }
    this.#busy = true;
    this.#rebuild();
    await deckStorage().remove(saved.id);
    if (this.#returnTo) this.#leaveToReturn(false);
    else goToScreen(this, SCENES.decks);
  }

  /** Back to the screen that opened the builder, told which deck was just saved (it reopens on it). */
  #leaveToReturn(withSaved = true): void {
    const back = this.#returnTo;
    if (!back) return;
    const focusDeckId = withSaved ? this.#savedDeckId : null;
    goToScreen(this, back.key, { ...back.data, ...(focusDeckId ? { focusDeckId } : {}) });
  }

  async #save(): Promise<void> {
    if (this.#busy || !this.#deck) return;
    if (this.#campaignModel?.editingDisabled) return;
    this.#busy = true;
    this.#rebuild();
    if (this.#campaign) {
      await this.#saveCampaignDeck(this.#campaign, this.#deck);
      return;
    }
    const saved = touch(this.#deck, new Date().toISOString());
    // A deck already in your decks saved again is a change to it; a new one is a deck built (achievements).
    const resaved = this.#savedDeck !== null;
    await deckStorage().put(saved);
    if (noteDeckFeat(resaved ? "edited" : "built")) void refreshUnlocks().catch(() => false);
    this.#deck = saved;
    this.#savedDeck = saved;
    this.#savedDeckId = saved.id as string;
    this.#leaveArmed = false;
    this.#deleteArmed = false;
    this.#busy = false;
    this.#status = "Saved to your decks.";
    this.#rebuild();
  }

  /**
   * Between-issue save (`scenes/campaign/deck-edit.ts`): reloads the run fresh rather than trusting whatever record
   * `deck-edit.ts` happened to load before handing off, so a save can never write over a run that changed under it
   * (`campaignService().setSeatDeck` already refuses to write under a composed attempt for the same reason). Only
   * `identityCardId`/`aspects`/`cards` are read from `deck` — `campaignService().setSeatDeck`'s own doc comment.
   */
  async #saveCampaignDeck(campaign: DeckBuilderCampaignData, deck: Deck): Promise<void> {
    const record = await campaignService().load(campaign.runId);
    if (!record) {
      this.#busy = false;
      this.#status = "This campaign run is gone — nothing was saved.";
      this.#rebuild();
      return;
    }
    try {
      await campaignService().setSeatDeck(record, campaign.seatNumber, deck);
    } catch (error) {
      this.#busy = false;
      this.#status = error instanceof Error ? error.message : "This deck could not be saved.";
      this.#rebuild();
      return;
    }
    this.#busy = false;
    goToScreen(this, campaign.returnTo.key, campaign.returnTo.data);
  }
}

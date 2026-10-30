/**
 * The minimal deck builder (PLAN.md Phase 9): pick an identity and its
 * aspect(s), name the deck, search/filter the pool, add and remove cards, and
 * save — with live legality from the same `validateDeck` the Decks screen and
 * `createGame` use (`view/deck-builder-model.ts`'s `legalityOf`). This scene
 * decides nothing about what's legal; it only shows what the engine already
 * said.
 *
 * Two entries: `{ deck }` edits a saved deck (its identity is already fixed);
 * `{}` starts fresh, showing only the identity picker until one is chosen —
 * `Deck.identityCardId` is required, so there is no `Deck` to build against
 * until then (`view/deck-builder-model.ts`'s `newDeck` needs an identity).
 *
 * The pool browser is a long, filterable list — wave 1 more than doubles the
 * pool — so it is a `McVirtualList` (`ui/virtual-list.ts`), the same widget
 * the Decks screen's deck list uses: recreated fresh every `#rebuild()` (like
 * every other non-DOM control this scene draws), with only its scroll
 * position (`#listScroll`) surviving that.
 *
 * **Composition (fidelity pass, 2026-09-17), against D04.** D04 is a
 * three-column desktop layout — an aspect/filter rail (ending in the cost
 * curve) on the left, the card pool in the middle, "Your deck" on an ink
 * ground on the right — over one legality chip in the header. From
 * `WIDE_MIN_WIDTH` up this scene now draws exactly that split
 * (`#rebuildWide`); below it, every control still stacks in the one column
 * this scene always drew (`#rebuildNarrow`), unchanged. **What stayed a
 * deviation, deliberately:** D04 has no visible deck-name field or Save
 * button — its mockup deck is already named by identity+aspect and "saving"
 * reads as the next setup step ("Table setup ▸"), which doesn't exist yet
 * (W2). This build still needs to name and persist a deck with no setup flow
 * to hand it to, so the name field and a real Save button live at the top of
 * the right (ink) column instead of being dropped — the closest real
 * equivalent of "the deck's own identity" the mockup shows there. Every
 * number and legality string is still `view/deck-stats.ts`/`legalityOf`'s
 * own; this pass only rearranges where they're drawn.
 *
 * **Issue #217 (2026-10-17).** A precon handed to this scene is never edited in place (`editableDeckOf`): the player
 * edits their own copy, which Save adds to their decks. The pool shows as card pictures by default (Card view, the
 * Decks screen's own grid geometry, each cell with its own −/+), with List view keeping the old text rows. The search
 * matches every word against name, traits, type and rules text. Back warns once about unsaved changes, a saved deck
 * can be deleted here, and New deck picks a hero from searchable tiles, then starts from an empty deck or a copy of
 * one of that hero's precons.
 *
 * Unlike the other four W1/W4 screens in this fidelity pass, this scene has
 * no dedicated `view/*-layout.ts` pure layout module — every rect is computed
 * inline against a running `y` cursor per column, the same shape this file
 * already had. A future pass extracting that into a tested pure function
 * (the way `deck-check-layout.ts` already does for Deck check) is real,
 * unstarted work; this pass keeps the existing architecture rather than
 * introducing a new one under time pressure.
 */

import type { PictureFocus } from "../art/focus.js";
import Phaser from "phaser";
import type { AnyCard, CardType, CoreAspect, Deck, HeroIdentityCard, StarterDeck, Trait } from "@mc/content";
import { requiredIdentitySet, type CampaignDeckContext, type CampaignGrant } from "@mc/engine";
import type { CardId } from "@mc/content";
import {
  CARDS_BY_ID,
  POOL_CARDS,
  POOL_HERO_SHELF_PACKS,
  POOL_PACKS,
  POOL_STARTER_DECKS,
  POOL_VERSION,
} from "../content/pool.js";
import { cardDisplayName, qualifiedHeroName } from "../view/hero-names.js";
import { artFor } from "../art/art-source.js";
import { cardFaces } from "../art/card-face-baker.js";
import { HERO_ART, heroArtForIdentity } from "../art/hero-art.js";
import { renderArtThumb } from "./roster-panel.js";
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
  withCycle,
  browsablePool,
  editableDeckOf,
  hasUnsavedChanges,
  preconsFor,
  startingDeckOf,
  touch,
  poolRowNote,
  poolTypeLine,
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
import { costCurveBars, deckCountText, deckListGroupsOf, deckStatsOf, type DeckListEntry } from "../view/deck-stats.js";
import { CHIP_GAP, chipStripHeight, splitInfoSegment, wrapChipsToRows } from "../view/chip-layout.js";
import { deckBuilderFocusOrder } from "../view/screen-focus.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import {
  HoverPreview,
  hoverCardIdsOf,
  noteHoverCardId,
  resetHoverCards,
  screenHoverArea,
} from "../ui/card-hover-preview.js";
import { clipHoverRect, hoverSlotOf, visibleRowRange, type HoverCardIdRect } from "../view/card-hover.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { poolCellRect, poolColumnAt, poolGridGeometry, type PoolGridGeometry } from "../view/deck-pool-grid.js";
import { accent, dotGrid, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import {
  McButton,
  McTextInput,
  STAMP_CHIP_TYPE,
  clampLines,
  fitText,
  label,
  paintDotGrid,
  paintPanel,
} from "../ui/widgets.js";
import { drawCostCurveBars, drawGroupedCardList } from "../ui/deck-stats-widgets.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { fromYourGamesOf, type DeckInsights, type SuggestedCard } from "../view/deck-insights.js";
import { loadDeckInsights } from "../view/player-stats-client.js";
import { POOL_STATS_NAMES } from "../view/player-stats-names.js";
import { noteDeckFeat } from "../progression/deck-feats.js";
import { refreshUnlocks } from "../progression/progression.js";
import { appSession, campaignService, deckStorage } from "../session.js";
import { cardSizeFactor } from "../settings.js";
import { deckBuilderRowSizes, type DeckBuilderRowSizes } from "../view/deck-builder-rows.js";
import {
  campaignDeckContextWithGrants,
  campaignDeckEditModel,
  campaignDeckSizeLabel,
  campaignDeckSizeSplit,
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
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { drawAspectInfoSegment, drawAspectTipPanel } from "../ui/aspect-tip.js";
import { aspectTipContentOf, type AspectTipContent } from "../view/aspect-tip-model.js";
import { aspectStampOf } from "../view/aspect-stamp.js";
import { DeckSearchClient } from "../view/deck-search-client.js";
import { parsePoolQuery } from "../view/pool-query.js";
import { deckCopiesOf, drawOdds, oddsGroupsOf, oddsRowsOf, percentText } from "../view/deck-odds.js";
import { deckBuilderView, rememberDeckBuilderView } from "../platform/deck-builder-view.js";
import type { SearchDocument } from "../view/deck-search.js";
import { cardSearchDocumentOf } from "../view/card-search-document.js";

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
  /** Open on the deck rail's From your games tab (Decks & Collection's "Build my own from this" / "Edit with these"). */
  readonly railTab?: "deck" | "games";
}

/** The identity row's art window, wide for its height: a cover crop of the hero's face and shoulders. */
const IDENTITY_THUMB_ASPECT = 1.5;
/** The −, quantity and + at a pool row's right end. */
const POOL_ROW_CONTROLS_WIDTH = 146;
/** Card view: the −, quantity and + strip under each cell's caption. */
const GRID_CONTROLS_HEIGHT = hit.target + 8;
/** Lines of rules text a pool row shows before the ellipsis; Inspect has the rest. */
const CARD_TEXT_LINES = 3;
/** How many pool rows the narrow layout keeps on screen below its scrolling deck half (`#rebuildNarrow`). */
const NARROW_POOL_MIN_ROWS = 3;
/** Room left at the narrow deck region's right edge for its scrollbar (`ui/scroll-region.ts`), so no control sits under it. */
const NARROW_SCROLLBAR_GUTTER = 10;
const POOL: readonly AnyCard[] = POOL_CARDS;
const IDENTITIES: readonly HeroIdentityCard[] = identityOptions(POOL);

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
let poolSearchDocuments: readonly SearchDocument[] | null = null;
const POOL_SEARCH_DOCUMENTS = (): readonly SearchDocument[] =>
  (poolSearchDocuments ??= POOL.map((card) =>
    cardSearchDocumentOf(card, PACK_INFOS.find((pack) => pack.code === (card.setCode as string))?.name),
  ));
let heroSearchDocuments: readonly SearchDocument[] | null = null;
const HERO_SEARCH_DOCUMENTS = (): readonly SearchDocument[] =>
  (heroSearchDocuments ??= IDENTITIES.map((identity) => ({
    id: identity.id as string,
    primary: [qualifiedHeroName(identity), identity.name, identity.alterEgo.faceName],
    secondary: [...identity.hero.traits, ...identity.alterEgo.traits],
  })));

/** Every pack the pool knows, in release order, with its cycle — what the Pack/Cycle filter and the "pack" sort read. */
const PACK_INFOS: readonly PackInfo[] = POOL_PACKS.map((pack) => ({
  code: pack.code as string,
  name: pack.name,
  cycleId: POOL_HERO_SHELF_PACKS.find((p) => p.code === (pack.code as string))?.cycleId ?? (pack.cycleId as string),
  cycleName: POOL_HERO_SHELF_PACKS.find((p) => p.code === (pack.code as string))?.cycleName ?? (pack.cycleId as string),
}));

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

/** The wide left rail's Cost curve / Odds tabs: shorter than a touch target, as only a mouse reaches them there. */
const CHART_TAB_HEIGHT = 30;
const CARD_BY_ID: ReadonlyMap<string, AnyCard> = new Map(POOL.map((card) => [card.id as string, card]));

/** From this column width the quick filters fit one row: ten chips, then a trait stepper `QUICK_TRAIT_WIDTH` wide. */
const QUICK_ONE_ROW_MIN = 720;
const QUICK_TRAIT_WIDTH = 200;

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
  #identityInput: McTextInput | null = null;
  /** The pool search and the hero search, ranked off the main thread (`view/deck-search-client.ts`); new per visit. */
  #poolSearch: DeckSearchClient | null = null;
  #heroSearch: DeckSearchClient | null = null;
  /** The newest answer to the pool search (card id → score); null with no search text. */
  #poolRanking: ReadonlyMap<string, number> | null = null;
  #heroRanking: ReadonlyMap<string, number> | null = null;
  /** Unsubscribes the Start from step's wait for its hero picture. */
  #bannerBaked: (() => void) | null = null;
  #busy = false;
  #campaign: DeckBuilderCampaignData | null = null;
  /** Recomputed every `#rebuild` from `#deck`/`#campaign` — the row-level marks the pool list and "your deck" panel both read; `null` outside campaign mode. */
  #campaignModel: CampaignDeckEditModel | null = null;
  #nameInput: McTextInput | null = null;
  #filterInput: McTextInput | null = null;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();
  /** `#identityArtUrl`, per visit, so a redraw never reshuffles a hero with several pictures. */
  readonly #identityArt = new Map<string, { url: string | null; focus?: PictureFocus }>();
  /** The list itself is recreated every rebuild (`ui/virtual-list.ts`); only its scroll position persists, in this field. */
  #list: McVirtualList | null = null;
  #listScroll = new ListScroll();
  /** The narrow layout's scrolling deck half (`#drawNarrowDeckRegion`), recreated every rebuild; its offset persists. */
  #deckRegion: McScrollRegion | null = null;
  /** The narrow deck region's on-screen rect, and what else follows its scroll (the open aspect tip). */
  #deckRegionRect: Rect | null = null;
  #onDeckScroll: (() => void) | null = null;
  #deckScroll = new VariableListScroll();
  /** The wide rail's "Your deck" list scrolls in its own region once it outgrows the rail; its offset persists. */
  #yourDeckRegion: McScrollRegion | null = null;
  #yourDeckScroll = new VariableListScroll();
  /** The desktop hover popover over the pool rows, the identity picker and the "Your deck" lines. */
  #hover: HoverPreview | null = null;
  /**
   * What the player's finished games say about this hero's cards (`view/deck-insights.ts`, issue #529 C2), folded in
   * the stats worker when the screen opens; null until it answers.
   */
  #insights: DeckInsights | null = null;
  /** Which of the deck rail's two tabs shows: the deck list, or "From your games" (LB / RB). Not in campaign mode. */
  #railTab: "deck" | "games" = "deck";
  /** The rail tabs' and the From your games rows' stops, in the order drawn, for the focus route. */
  #railStops: string[] = [];
  #hints: GlyphHints | null = null;
  /** From your games' card scans not loaded at its last draw: an arrival redraws the builder only while one is. */
  #railArtMissing = 0;
  /** Each scrolling list's on-screen card rects, computed on demand from its scroll (a scroll draws nothing). */
  #hoverLists: (() => readonly (readonly [string, HoverCardIdRect])[])[] = [];
  /** The "Your deck" lines as drawn at zero scroll, and the scroll region (if any) that moves them. */
  #deckLines: { readonly cardId: string; readonly rect: Rect; readonly region: "none" | "narrow" | "rail" }[] = [];
  #yourDeckRect: Rect | null = null;
  /** Where `#drawNameField` last placed the name field, at zero scroll. */
  #nameFieldRect: Rect | null = null;
  /** Which aspect button's inline tip (G10b) is open, if any. */
  #aspectTipOpen: CoreAspect | null = null;
  /**
   * The open tip's anchor and content, recorded by `#drawAspectPicker` and drawn by `#drawOpenAspectTip` once the
   * whole screen is down. Drawn inline, the panel went under the aspect buttons drawn after it, and on the narrow
   * layout it was moved into the deck region with the rest of the deck half, where its depth no longer applied.
   * `scrolls` marks an anchor inside that region, given in the region's unscrolled coordinates.
   */
  #openAspectTip: { readonly anchor: Rect; readonly content: AspectTipContent; readonly scrolls: boolean } | null =
    null;

  constructor() {
    super(SCENES.deckBuilder);
  }

  create(data: DeckBuilderSceneData = {}): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#rows = deckBuilderRowSizes(cardSizeFactor(appSession().settings.cardSize));
    this.#campaign = data.campaign ?? null;
    const given = data.deck ?? null;
    // A precon is never edited in place (issue #217): the builder edits the player's own copy of it.
    this.#deck =
      given && !this.#campaign ? editableDeckOf(given, `deck-${crypto.randomUUID()}`, new Date().toISOString()) : given;
    this.#savedDeck = this.#campaign ? given : null;
    this.#leaveArmed = false;
    this.#deleteArmed = false;
    this.#startFor = null;
    this.#identitySearch = "";
    this.#poolRanking = null;
    this.#heroRanking = null;
    this.#poolSearch = new DeckSearchClient();
    this.#heroSearch = new DeckSearchClient();
    this.#identity = this.#deck ? (IDENTITIES.find((i) => i.id === this.#deck!.identityCardId) ?? null) : null;
    // The sort, kept filters and card/list view the player last left (issue #531).
    const view = deckBuilderView();
    this.#filter = { ...view.filter };
    this.#sort = view.sort;
    this.#poolView = view.poolView;
    this.#filterText = "";
    this.#status =
      given && this.#deck !== given
        ? "Editing your own copy of this precon. The published precon stays as it is; Save adds this deck to your decks."
        : null;
    this.#savedDeckId = null;
    this.#busy = false;
    this.#listScroll = new ListScroll();
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
    this.#deckScroll = new VariableListScroll();
    this.#insights = null;
    this.#railTab = data.railTab === "games" && !this.#campaign ? "games" : "deck";
    this.#hints = new GlyphHints(this);
    if (!this.#campaign) {
      void appSession()
        .store.listSaves()
        .then((saves) => loadDeckInsights(saves))
        .then((insights) => {
          if (!this.scene.isActive()) return;
          this.#insights = insights;
          if (this.#railTab === "games") this.#rebuild();
        })
        .catch(() => undefined);
    }

    const onResize = (): void => this.#rebuild();
    this.scale.on("resize", onResize, this);
    // From your games draws card scans; they arrive after its first draw (in batches, `art/card-art.ts`).
    const offArt = cardArt(this).onArrived(() => {
      if (this.#railTab === "games" && this.#railArtMissing > 0 && this.scene.isActive()) this.#rebuild();
    });
    resetHoverCards(this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCardIds(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      offArt();
      this.#hover?.destroy();
      this.#hover = null;
      this.#hints?.dispose();
      this.#hints = null;
      this.#nameInput?.destroy();
      this.#nameInput = null;
      this.#filterInput?.destroy();
      this.#filterInput = null;
      this.#identityInput?.destroy();
      this.#identityInput = null;
      this.#bannerBaked?.();
      this.#bannerBaked = null;
      this.#poolSearch?.destroy();
      this.#poolSearch = null;
      this.#heroSearch?.destroy();
      this.#heroSearch = null;
      this.#list?.destroy();
      this.#list = null;
      this.#deckRegion?.destroy();
      this.#deckRegion = null;
    });
    // A pad that put the caret in a field can take it out again (B, A or Start).
    for (const field of [() => this.#nameInput, () => this.#filterInput, () => this.#identityInput])
      bindTextFieldEscape(this, field, () => this.scene.isActive(SCENES.inspect));
    this.#route = new FocusRoute(this, {
      // B is the Back button (which asks to confirm when there are unsaved changes).
      onCancel: () => this.#stops.get("back")?.activate(),
      blocked: () =>
        this.scene.isActive(SCENES.inspect) ||
        (this.#nameInput?.focused ?? false) ||
        (this.#filterInput?.focused ?? false) ||
        (this.#identityInput?.focused ?? false),
      onPage: (direction) => this.#list?.scrollByPage(direction),
      // LB / RB: the deck rail's two tabs, Your deck and From your games.
      onTab: (direction) => {
        if (this.#campaign || !this.#identity) return;
        this.#setRailTab(direction > 0 ? "games" : "deck");
      },
      onScroll: (_dx, dy) => this.#list?.scrollByPx(dy),
      onHomeEnd: (edge) => (edge === "home" ? this.#list?.scrollToStart() : this.#list?.scrollToEnd()),
    });
    this.#rebuild();
    fadeScreenIn(this);
  }

  /** Every plain card the popover may open on: the lists' (clipped to their windows) and the "Your deck" lines. */
  #hoverCardIds(): ReadonlyMap<string, HoverCardIdRect> {
    const all = new Map(hoverCardIdsOf(this));
    for (const provider of this.#hoverLists) for (const [slot, rect] of provider()) all.set(slot, rect);
    this.#deckLines.forEach(({ cardId, rect, region }, index) => {
      const view = region === "narrow" ? this.#deckRegionRect : region === "rail" ? this.#yourDeckRect : null;
      const offset =
        region === "narrow" ? this.#deckScroll.offsetPx : region === "rail" ? this.#yourDeckScroll.offsetPx : 0;
      const at = { ...rect, y: rect.y - offset };
      const shown = view ? clipHoverRect(at, view) : at;
      if (shown) all.set(hoverSlotOf(cardId, `line${index}`), { ...shown, cardId, through: true });
    });
    return all;
  }

  #rebuild(): void {
    resetHoverCards(this);
    this.#hoverLists = [];
    this.#deckLines = [];
    this.#yourDeckRect = null;
    this.#railStops = [];
    this.#hints?.reset();
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();
    // The list is recreated fresh every rebuild, in the normal draw order
    // (`ui/virtual-list.ts` — reattaching it across a sweep put it ahead of
    // whatever the scene drew afterward). Its scroll position lives in
    // `#listScroll`, which survives this regardless.
    this.#list?.destroy();
    this.#list = null;
    this.#deckRegion?.destroy();
    this.#deckRegion = null;
    this.#yourDeckRegion?.destroy();
    this.#yourDeckRegion = null;
    this.#deckRegionRect = null;
    this.#onDeckScroll = null;
    this.#nameFieldRect = null;
    this.#openAspectTip = null;
    this.#nameInput?.setVisible(true);

    const kept = [
      ...(this.#nameInput ? [this.#nameInput.gameObject] : []),
      ...(this.#filterInput ? [this.#filterInput.gameObject] : []),
      ...(this.#identityInput ? [this.#identityInput.gameObject] : []),
    ];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const phone = formFactorFor(width, height) === "phone";
    const wide = !phone && width >= WIDE_MIN_WIDTH;
    const pad = phone ? 16 : 40;
    // The wide layout spans the whole window (issue #458): the rails keep their widths and the pool takes the rest,
    // adding columns as it grows (`POOL_MAX_COLUMNS`).
    const column = wide ? width - pad * 2 : Math.min(width - pad * 2, 720);
    const left = (width - column) / 2;
    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", dotGrid.onPaper);

    let y = pad;
    // Campaign mode's title (the run's own name plus the seat and its identity, `scenes/campaign/deck-edit.ts`)
    // can run to two lines on a narrow layout, unlike the standalone builder's fixed "DECK BUILDER" — so the next
    // row is placed from the title's own measured height, not a hardcoded single-line one, or the identity label
    // below it would sit under the title's wrapped second line.
    const titleText = this.#campaign ? this.#campaign.title.toUpperCase() : "DECK BUILDER";
    const titleObj = this.add
      .text(left, y, titleText, {
        ...textStyle(typeRole.screenTitle, surface.ink.hex),
        fontSize: phone ? "28px" : "38px",
      })
      .setWordWrapWidth(column - 108)
      .setLetterSpacing(2);
    const backRect: Rect = { x: left + column - 100, y: y + 2, width: 100, height: hit.target };
    const campaign = this.#campaign;
    const dirty = this.#isDirty();
    const goBack = (): void => {
      // Unsaved changes: the first Back says so, the second leaves without saving.
      if (this.#isDirty() && !this.#leaveArmed) {
        this.#leaveArmed = true;
        const again = inputDevice().mode === "pad" ? "press Leave (B) again" : "press Leave again";
        this.#status = `You have unsaved changes. Save the deck, or ${again} to leave without saving.`;
        this.#rebuild();
        return;
      }
      if (campaign) goToScreen(this, campaign.returnTo.key, campaign.returnTo.data);
      // After a Save, Decks opens on the deck just saved (its row selected and in view).
      else goToScreen(this, SCENES.decks, this.#savedDeckId ? { focusDeckId: this.#savedDeckId } : undefined);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: dirty && this.#leaveArmed ? "Leave" : "Back",
        type: typeRole.rowTitle,
        rect: backRect,
        onClick: goBack,
      }),
    );
    this.#stops.set("back", { rect: backRect, activate: goBack });
    y += Math.max(titleObj.height, phone ? 28 : 38) + 16;

    if (!this.#identity && this.#startFor) {
      this.#identityInput?.destroy();
      this.#identityInput = null;
      const startIds = this.#drawStartFrom(left, y, column, this.#startFor);
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

    this.#identityInput?.destroy();
    this.#identityInput = null;
    const deck = this.#deck!;
    this.#campaignModel = this.#campaign
      ? campaignDeckEditModel(deck, POOL, this.#campaign.context, this.#campaign.grants)
      : null;
    label(this, left, y, `identity — ${qualifiedHeroName(this.#identity)}`, typeRole.label, surface.ink.hex, ink.label);
    y += 20;

    const pool = wide ? this.#rebuildWide(left, y, column, deck) : this.#rebuildNarrow(left, y, column, deck);
    this.#drawOpenAspectTip();

    this.#route?.set(
      deckBuilderFocusOrder({
        identityChosen: true,
        identityIds: [],
        aspectIds: [...SELECTABLE_ASPECTS],
        typeFilterIds: TYPE_FILTERS.map((f) => f.id),
        quickFilterIds: QUICK_FILTERS.map((f) => f.id),
        chartIds: [...this.#stops.keys()].filter((key) => key.startsWith("chart:") || key.startsWith("odds:")),
        poolCardIds: pool.map((card) => card.id as string),
        showName: !this.#campaign,
        showPreconClear: !this.#campaign,
        showDelete: !this.#campaign && this.#savedDeck !== null,
        railIds: this.#railStops,
        filterExtraIds: [...(this.#filterText ? ["filter-clear"] : []), "pool-view"],
        rewardIds: (this.#campaignModel?.rewards ?? []).map((reward, at) => `${at}:${reward.cardId as string}`),
      }),
      this.#stops,
    );
    this.#hover?.onDraw();
  }

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
        refusal: deckRuleRefusals(deck, this.#identity, POOL, rules),
      };
    return this.#refusals!.refusal(cardId, step);
  }

  /** Keeps the pool's sort, filters and view for the next visit (`platform/deck-builder-view.ts`). */
  #rememberView(): void {
    rememberDeckBuilderView({ sort: this.#sort, filter: this.#filter, poolView: this.#poolView });
  }

  /** `deck`'s own campaign row, by card id — `null` outside campaign mode or for a card with no line yet. */
  #campaignRowFor(cardId: string): CampaignDeckEditRow | null {
    return this.#campaignModel?.rows.find((row) => (row.cardId as string) === cardId) ?? null;
  }

  /** `browsablePool`, narrowed for campaign mode: a removed card the deck doesn't currently hold is left out of what browsing turns up (`#removedFromCampaignIds`); one it still holds stays, so its row's own "−" can fix the deck. */
  #browsablePool(deck: Deck): readonly AnyCard[] {
    // A card the deck already holds stays listed even if its rules now refuse it (so its "-" can remove it); campaign
    // mode keeps its own marks for that (`#campaignModel`), and its granted lines are never browsable.
    const held = this.#campaign ? new Set<string>() : new Set(deck.cards.map((line) => line.cardId as string));
    const ranking = freeTextOf(this.#filterText) ? this.#poolRanking : null;
    const listed = browsablePool(
      POOL,
      this.#identity!,
      deck.aspects,
      withSearchClauses(this.#filter, this.#filterText),
      this.#sort,
      PACK_INFOS,
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
            requiredIdentitySet(this.#identity!, POOL)
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

  /**
   * The narrow (phone/tablet) layout: everything in the one column D04's own
   * canvas doesn't have room for below `WIDE_MIN_WIDTH` — aspect, filter
   * chips, name, legality, the stats panel, Preconstructed/Clear, Save, the
   * pool search, then the pool list filling whatever height is left. Returns
   * the browsable pool, for the caller's focus order.
   */
  #rebuildNarrow(left: number, top: number, column: number, deck: Deck): readonly AnyCard[] {
    const { height } = this.scale.gameSize;
    const pad = 16;
    // Everything above the pool search scrolls in its own region (`#drawNarrowDeckRegion`), capped so the pool
    // keeps `POOL_RESERVE` of the screen below it. A phone's column runs far taller than its screen, and drawn
    // flat the pool list started below the bottom edge with no way to scroll to it.
    const poolRows =
      this.#poolView === "grid"
        ? this.#gridGeometry(column, 1).cellHeight * 1.2
        : this.#rows.cardRowHeight * NARROW_POOL_MIN_ROWS;
    const poolReserve = 16 + hit.target + 16 + 16 + poolRows;
    const maxRegionHeight = Math.max(hit.target * 3, height - top - pad - poolReserve);
    let y = this.#drawNarrowDeckRegion(left, top, column, maxRegionHeight, deck);

    label(this, left, y, "search the pool", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    y = this.#drawFilterInput(left, y, column);
    const pool = this.#browsablePool(deck);
    label(
      this,
      left,
      y,
      `pool — ${pool.length} card${pool.length === 1 ? "" : "s"}`,
      typeRole.label,
      surface.ink.hex,
      ink.label,
    );
    y += 16;
    const listRect: Rect = { x: left, y, width: column, height: Math.max(this.#rows.cardRowHeight, height - y - pad) };
    this.#drawPoolList(listRect, deck, pool);
    return pool;
  }

  /**
   * The narrow layout's deck half — aspect, filter chips, pack and sort, name, legality, the stats panel,
   * Preconstructed/Clear and Save — drawn at its natural height, then moved into a `McScrollRegion` no taller than
   * `maxHeight`. Its controls are clipped to the region (`clipInteractive`), its focus stops follow the scroll, and
   * the DOM name field (which a Phaser mask can't hide) is placed and shown by hand. Returns the y below it.
   */
  #drawNarrowDeckRegion(left: number, top: number, column: number, maxHeight: number, deck: Deck): number {
    const before = this.children.list.length;
    const stopsBefore = new Set(this.#stops.keys());
    // The region's scrollbar runs down its right edge, so the controls stop short of it.
    const inner = column - NARROW_SCROLLBAR_GUTTER;
    let y = top;
    y = this.#drawAspectPicker(left, y, inner, deck, true);
    y = this.#drawTypeFilters(left, y, inner);
    y = this.#drawQuickFilters(left, y, inner, deck);
    y = this.#drawPackAndSort(left, y, inner, deck);
    if (!this.#campaign) y = this.#drawNameField(left, y, inner, deck);
    y = this.#drawLegalityLine(left, y, inner, deck);
    y = this.#drawRewardsStrip(left, y, inner, false);
    y = this.#drawCostCurve(left, y, inner, deck, false);
    label(this, left, y, "odds", typeRole.label, surface.ink.hex, ink.label);
    y = this.#drawOdds(left, y + 16, inner, deck, hit.target);
    if (!this.#campaign) y = this.#drawRailTabs(left, y, inner, false);
    y =
      this.#railTab === "games" && !this.#campaign
        ? this.#drawFromYourGames(left, y, inner, deck, false)
        : this.#drawYourDeckList(left, y, inner, deck, false);
    y = this.#drawPreconClearSave(left, y, inner, deck);
    const nameNode = this.#nameInput?.gameObject;
    const added = this.children.list.slice(before).filter((node) => node !== nameNode);

    const contentHeight = y - top;
    const rect: Rect = { x: left, y: top, width: column, height: Math.min(contentHeight, maxHeight) };
    const heights = [contentHeight];
    const nameRect = this.#nameFieldRect;
    const syncName = (): void => {
      if (!this.#nameInput || !nameRect) return;
      const screenY = nameRect.y - this.#deckScroll.offsetPx;
      this.#nameInput.layout({ ...nameRect, y: screenY });
      this.#nameInput.setVisible(screenY >= rect.y && screenY + nameRect.height <= rect.y + rect.height);
    };
    this.#deckRegion = new McScrollRegion(this, {
      rect,
      heights,
      scroll: this.#deckScroll,
      clipInteractive: true,
      onScroll: () => {
        syncName();
        this.#onDeckScroll?.();
      },
    });
    this.#deckRegionRect = rect;
    const region = this.#deckRegion;
    region.content.add(added);
    region.syncInteractivity();
    syncName();

    for (const [key, stop] of this.#stops) {
      if (stopsBefore.has(key) || typeof stop.rect === "function") continue;
      const at = stop.rect;
      this.#stops.set(key, {
        ...stop,
        rect: () => ({ ...at, y: at.y - this.#deckScroll.offsetPx }),
        ensureVisible: () => {
          const rowTop = at.y - rect.y;
          const offset = this.#deckScroll.offsetPx;
          if (rowTop < offset) region.scrollByPx(rowTop - offset);
          else if (rowTop + at.height > offset + rect.height)
            region.scrollByPx(rowTop + at.height - offset - rect.height);
        },
      });
    }
    return top + rect.height + 12;
  }

  /**
   * The wide (desktop) layout (D04): a left aspect/filter/cost-curve rail, the
   * card pool in the middle, "Your deck" on its own ink ground on the right.
   * Returns the browsable pool, for the caller's focus order.
   */
  #rebuildWide(left: number, top: number, column: number, deck: Deck): readonly AnyCard[] {
    const { height } = this.scale.gameSize;
    const pad = 40;
    const bottom = height - pad;

    const leftX = left;
    const midX = leftX + LEFT_RAIL_WIDTH + RAIL_GAP;
    const midWidth = Math.max(240, column - LEFT_RAIL_WIDTH - RIGHT_RAIL_WIDTH - RAIL_GAP * 2);
    const rightX = midX + midWidth + RAIL_GAP;

    // Left rail: aspect, filter, cost curve.
    let leftY = top;
    leftY = this.#drawAspectPicker(leftX, leftY, LEFT_RAIL_WIDTH, deck, false);
    leftY = this.#drawTypeFilters(leftX, leftY, LEFT_RAIL_WIDTH);
    leftY = this.#drawPackAndSort(leftX, leftY, LEFT_RAIL_WIDTH, deck);
    // The cost curve and the odds share the rail's last room behind two tabs (issue #531).
    const tabWidth = (LEFT_RAIL_WIDTH - CHIP_GAP) / 2;
    for (const [i, tab] of (["curve", "odds"] as const).entries()) {
      const rect: Rect = { x: leftX + i * (tabWidth + CHIP_GAP), y: leftY, width: tabWidth, height: CHART_TAB_HEIGHT };
      const pick = (): void => {
        this.#chartTab = tab;
        this.#rebuild();
      };
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: tab === "curve" ? "Cost curve" : "Odds",
          type: typeRole.label,
          rect,
          selected: this.#chartTab === tab,
          onClick: pick,
        }),
      );
      this.#stops.set(`chart:${tab}`, { rect, activate: pick });
    }
    leftY += CHART_TAB_HEIGHT + CHIP_GAP;
    if (this.#chartTab === "curve") this.#drawCostCurve(leftX, leftY, LEFT_RAIL_WIDTH, deck, true);
    else this.#drawOdds(leftX, leftY, LEFT_RAIL_WIDTH, deck, CHART_TAB_HEIGHT);

    // Right rail: name, legality, Your deck, Preconstructed/Clear, Save — one ink ground panel behind all of it.
    const rightPanel = this.add.graphics();
    paintPanel(
      rightPanel,
      { x: rightX, y: top - 8, width: RIGHT_RAIL_WIDTH, height: bottom - top + 8 },
      "onInk",
      "rest",
    );
    let rightY = top + 8;
    if (!this.#campaign) rightY = this.#drawNameField(rightX + 12, rightY, RIGHT_RAIL_WIDTH - 24, deck, true);
    rightY = this.#drawLegalityLine(rightX + 12, rightY, RIGHT_RAIL_WIDTH - 24, deck, true);
    rightY = this.#drawRewardsStrip(rightX + 12, rightY, RIGHT_RAIL_WIDTH - 24, true);
    rightY += 4;
    const actionsTop = bottom - hit.target * 2 - 24;
    if (!this.#campaign) rightY = this.#drawRailTabs(rightX + 12, rightY, RIGHT_RAIL_WIDTH - 24, true);
    rightY =
      this.#railTab === "games" && !this.#campaign
        ? this.#drawFromYourGames(rightX + 12, rightY, RIGHT_RAIL_WIDTH - 24, deck, true, actionsTop - 8)
        : this.#drawYourDeckList(rightX + 12, rightY, RIGHT_RAIL_WIDTH - 24, deck, true, actionsTop - 8 - rightY);
    this.#drawPreconClearSave(rightX + 12, actionsTop, RIGHT_RAIL_WIDTH - 24, deck, true);

    // Middle: the pool, search field above it.
    let midY = top;
    label(this, midX, midY, "card pool", typeRole.label, surface.ink.hex, ink.label);
    midY += 16;
    midY = this.#drawFilterInput(midX, midY, midWidth);
    // The quick filters sit under the search here: the left rail has no room left for them.
    midY = this.#drawQuickFilters(midX, midY - 4, midWidth, deck) - 4;
    const pool = this.#browsablePool(deck);
    label(
      this,
      midX,
      midY,
      `${pool.length} card${pool.length === 1 ? "" : "s"}`,
      typeRole.label,
      surface.ink.hex,
      ink.meta,
    );
    midY += 16;
    const listRect: Rect = {
      x: midX,
      y: midY,
      width: midWidth,
      height: Math.max(this.#rows.cardRowHeight, bottom - midY),
    };
    this.#drawPoolList(listRect, deck, pool);
    return pool;
  }

  #drawAspectPicker(left: number, top: number, column: number, deck: Deck, scrolls: boolean): number {
    let y = top;
    const maxAspects = aspectCountFor(this.#identity!);
    const frozen = this.#campaignModel?.editingDisabled ?? false;
    label(this, left, y, `aspect (choose ${maxAspects})`, typeRole.label, surface.ink.hex, ink.label);
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
      // G10b's tip: a split "i" segment at the cell's right-hand end (`ui/aspect-tip.ts`), independent of `toggle`.
      const content = aspectTipContentOf(aspect);
      const split = content ? splitInfoSegment(cellRect) : null;
      const rect = split?.main ?? cellRect;
      const selected = deck.aspects.includes(aspect);
      // The aspect's own card-frame color, the same stamp Seats' aspect chips and the hero cards wear.
      const stamp = aspectStampOf(aspect);
      const tint = { fill: stamp.fill, ink: stamp.ink };
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
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: stamp.label,
          type: STAMP_CHIP_TYPE,
          rect,
          selected,
          tint,
          enabled: !frozen,
          ...(frozen && this.#campaignModel?.editingDisabledReason
            ? { reason: this.#campaignModel.editingDisabledReason }
            : {}),
          onClick: toggle,
        }),
      );
      this.#stops.set(`aspect:${aspect}`, { rect, activate: toggle });

      if (content && split) {
        const isOpen = this.#aspectTipOpen === aspect;
        const infoRect = drawAspectInfoSegment(
          this,
          split.info,
          isOpen,
          () => {
            this.#aspectTipOpen = aspect;
            this.#rebuild();
          },
          () => {
            this.#aspectTipOpen = null;
            this.#rebuild();
          },
          { tint },
        );
        if (isOpen) this.#openAspectTip = { anchor: infoRect, content, scrolls };
      }
    });
    return y + aspectRows * (hit.target + 6) + 10;
  }

  /**
   * The open aspect tip (`#openAspectTip`), drawn last so it sits over everything else on the screen. One anchored in
   * the narrow deck region follows that region's scroll and hides once its "i" segment leaves the region.
   */
  #drawOpenAspectTip(): void {
    const open = this.#openAspectTip;
    if (!open) return;
    const { width, height } = this.scale.gameSize;
    const region = open.scrolls ? this.#deckRegionRect : null;
    const drawnAt = open.scrolls ? this.#deckScroll.offsetPx : 0;
    const anchor = { ...open.anchor, y: open.anchor.y - drawnAt };
    const panel = drawAspectTipPanel(this, anchor, open.content, { x: 0, y: 0, width, height });
    if (!region) return;
    const place = (): void => {
      const shift = drawnAt - this.#deckScroll.offsetPx;
      const top = anchor.y + shift;
      panel.setY(shift).setVisible(top >= region.y && top + anchor.height <= region.y + region.height);
    };
    place();
    this.#onDeckScroll = place;
  }

  #drawTypeFilters(left: number, top: number, column: number): number {
    let y = top;
    label(this, left, y, "filter", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const typeChipRows = wrapChipsToRows(TYPE_FILTERS, column);
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
          this.#listScroll.reset();
          this.#rebuild();
        };
        this.#buttons.push(
          new McButton(this, {
            kind: "secondary",
            label: chip.label,
            type: typeRole.label,
            rect,
            selected,
            onClick: applyFilter,
          }),
        );
        this.#stops.set(`type:${chip.id}`, { rect, activate: applyFilter });
      });
    });
    return y + chipStripHeight(typeChipRows.length) + 16;
  }

  /**
   * The quick filters under the type chips (issue #531): cost chips 0 to 5+, resource icon chips, and a trait stepper
   * (◂ name ▸, wrapping through "All traits") over the traits the pool holds under the other filters. Built for a tap
   * on a phone, where typing `o:2` is slow; each chip toggles.
   */
  #drawQuickFilters(left: number, top: number, column: number, deck: Deck): number {
    let y = top;
    label(this, left, y, "cost · icon · trait", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const apply = (next: PoolFilter): void => {
      this.#filter = next;
      this.#rememberView();
      this.#listScroll.reset();
      this.#rebuild();
    };
    const add = (id: string, rect: Rect, text: string, onClick: () => void, selected = false): void => {
      this.#buttons.push(
        new McButton(this, { kind: "secondary", label: text, type: typeRole.label, rect, selected, onClick }),
      );
      this.#stops.set(id, { rect, activate: onClick });
    };
    // A wide column takes every chip on one row with the trait stepper at its end; a narrow one stacks cost, icons
    // and the stepper.
    const oneRow = column >= QUICK_ONE_ROW_MIN;
    const stepperWidth = oneRow ? QUICK_TRAIT_WIDTH : column;
    const rows = oneRow
      ? [QUICK_FILTERS]
      : [QUICK_FILTERS.filter((f) => f.id.startsWith("cost:")), QUICK_FILTERS.filter((f) => f.id.startsWith("icon:"))];
    const chipsWidth = oneRow ? column - stepperWidth - CHIP_GAP : column;
    rows.forEach((row, rowIndex) => {
      // On one row the cost chips ("0" to "5+") take a square each and the icon names share what is left; elsewhere
      // a row's chips share it evenly.
      const isCost = (chip: (typeof row)[number]): boolean => oneRow && chip.id.startsWith("cost:");
      const costs = row.filter(isCost).length;
      const named = row.filter((chip) => !isCost(chip));
      const nameSpace = chipsWidth - costs * hit.target - (row.length - 1) * CHIP_GAP;
      // Names share their space by length, so "Physical" gets more than "Wild".
      const weight = (chip: (typeof row)[number]): number => (oneRow ? chip.text.length + 3 : 1);
      const totalWeight = named.reduce((sum, chip) => sum + weight(chip), 0);
      let x = left;
      row.forEach((chip) => {
        const width = isCost(chip) ? hit.target : (nameSpace * weight(chip)) / totalWeight;
        const rect: Rect = { x, y: y + rowIndex * (hit.target + CHIP_GAP), width, height: hit.target };
        x += width + CHIP_GAP;
        const on = chip.isOn(this.#filter);
        add(`quick:${chip.id}`, rect, chip.text, () => apply(chip.apply(this.#filter, !on)), on);
      });
    });
    if (!oneRow) y += chipStripHeight(rows.length) + CHIP_GAP;
    const stepperLeft = left + column - stepperWidth;

    const traits = traitFilterChoices(
      POOL,
      this.#identity!,
      deck.aspects,
      withSearchClauses(this.#filter, this.#filterText),
      PACK_INFOS,
    );
    const arrow = hit.target;
    // A kept trait no card shows under the other filters still names itself, so an empty pool says why.
    const traitName = this.#filter.trait ? traitLabelOf(this.#filter.trait) : "All traits";
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
   * The pool's Pack control, Cycle button and Sort button (PR #88 step 5). One combined control would have hidden
   * which wave a pack belongs to, so: a full-width pack stepper (◂ name ▸, wrapping through "All packs") over a
   * half-width cycle button and a half-width sort button — two rows, which is what fits a 375px column. Cycle narrows
   * the packs the stepper visits; both only offer what the pool holds for this deck's aspects (`packFilterChoices`).
   */
  #drawPackAndSort(left: number, top: number, column: number, deck: Deck): number {
    let y = top;
    label(this, left, y, "pack", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const choices = packFilterChoices(
      POOL,
      this.#identity!,
      deck.aspects,
      withSearchClauses(this.#filter, this.#filterText),
      PACK_INFOS,
    );
    const apply = (next: PoolFilter): void => {
      this.#filter = next;
      this.#rememberView();
      this.#listScroll.reset();
      this.#rebuild();
    };
    const arrow = hit.target;
    const packName = PACK_INFOS.find((p) => p.code === this.#filter.packCode)?.name ?? "All packs";
    const stepPack = (dir: 1 | -1) => (): void =>
      apply({ ...this.#filter, packCode: stepChoice(choices.packs, this.#filter.packCode, dir) });
    const prevRect: Rect = { x: left, y, width: arrow, height: hit.target };
    const nameRect: Rect = {
      x: left + arrow + CHIP_GAP,
      y,
      width: column - 2 * (arrow + CHIP_GAP),
      height: hit.target,
    };
    const nextRect: Rect = { x: left + column - arrow, y, width: arrow, height: hit.target };
    const add = (id: string, rect: Rect, text: string, onClick: () => void, selected = false): void => {
      this.#buttons.push(
        new McButton(this, { kind: "secondary", label: text, type: typeRole.label, rect, selected, onClick }),
      );
      this.#stops.set(id, { rect, activate: onClick });
    };
    add("pack:prev", prevRect, "<", stepPack(-1));
    add("pack:name", nameRect, packName, stepPack(1), this.#filter.packCode != null);
    add("pack:next", nextRect, ">", stepPack(1));
    y += hit.target + CHIP_GAP;

    const cycleName = choices.cycles.find((c) => c.id === this.#filter.cycleId)?.name ?? "All waves";
    add(
      "pack:cycle",
      { x: left, y, width: column, height: hit.target },
      cycleName,
      () => apply(withCycle(this.#filter, stepChoice(choices.cycles, this.#filter.cycleId, 1), PACK_INFOS)),
      this.#filter.cycleId != null,
    );
    y += hit.target + CHIP_GAP;

    // Sort, then a second key for its ties (issue #531): "Sort: Aspect" "Then: Type" lists by aspect, type, then name.
    const half = (column - CHIP_GAP) / 2;
    const resort = (next: PoolSort): void => {
      this.#sort = next;
      this.#rememberView();
      this.#listScroll.reset();
      this.#rebuild();
    };
    const { primary, secondary } = this.#sort;
    const sortAt = Math.max(
      0,
      SORT_CYCLE.findIndex((o) => o.sort === primary),
    );
    add(
      "pack:sort",
      { x: left, y, width: half, height: hit.target },
      `Sort: ${SORT_CYCLE[sortAt]!.label}`,
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
      `Then: ${SORT_CYCLE.find((o) => o.sort === secondary)?.label ?? "None"}`,
      () => resort({ primary, secondary: thenChoices[(thenAt + 1) % thenChoices.length] ?? null }),
      secondary !== null,
    );
    return y + hit.target + 16;
  }

  #drawNameField(left: number, top: number, column: number, deck: Deck, onDark = false): number {
    let y = top;
    label(
      this,
      left,
      y,
      "deck name",
      typeRole.label,
      onDark ? surface.paper.hex : surface.ink.hex,
      onDark ? ink.secondary : ink.label,
    );
    y += 16;
    const nameRect: Rect = { x: left, y, width: column, height: hit.target };
    this.#nameFieldRect = nameRect;
    if (this.#nameInput) this.#nameInput.layout(nameRect);
    else {
      this.#nameInput = new McTextInput(this, {
        rect: nameRect,
        value: deck.name,
        type: typeRole.rowTitle,
        onChange: (value) => this.#setDeck(setName(this.#deck!, value), false),
      });
    }
    this.#stops.set("name", { rect: nameRect, activate: () => this.#nameInput?.focus() });
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
    label(this, left, top, "campaign rewards", typeRole.label, ground, onDark ? ink.secondary : ink.label);
    let y = top + 18;
    const buttonWidth = Math.min(132, Math.floor(column * 0.4));
    rewards.forEach((reward, at) => {
      const card = POOL.find((candidate) => candidate.id === reward.cardId);
      const textWidth = column - buttonWidth - 8;
      const name = this.add
        .text(left, y, card ? cardDisplayName(card) : (reward.cardId as string), textStyle(typeRole.rowTitle, ground))
        .setWordWrapWidth(textWidth);
      const status = this.add
        .text(
          left,
          y + name.height + 2,
          `${reward.included ? "✓" : "–"} ${reward.status}`,
          textStyle(typeRole.body, ground, onDark ? ink.secondary : ink.label),
        )
        .setWordWrapWidth(textWidth);
      const textHeight = name.height + 2 + status.height;
      const rowHeight = Math.max(hit.target, textHeight);
      const rect: Rect = {
        x: left + column - buttonWidth,
        y: y + (rowHeight - hit.target) / 2,
        width: buttonWidth,
        height: hit.target,
      };
      const toggle = (): void => void this.#toggleReward(reward.cardId, !reward.included);
      this.#buttons.push(
        new McButton(this, {
          kind: onDark ? "onInk" : "secondary",
          label: reward.toggleLabel,
          type: typeRole.label,
          rect,
          enabled: !this.#busy && !frozen,
          ...(frozen && this.#campaignModel?.editingDisabledReason
            ? { reason: this.#campaignModel.editingDisabledReason }
            : {}),
          onClick: toggle,
        }),
      );
      this.#stops.set(`reward:${at}:${reward.cardId as string}`, { rect, activate: toggle });
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
    const verdict = this.#campaignModel ? this.#campaignModel.validation : legalityOf(deck, POOL);
    // Campaign mode's own count (the Briefing's "N cards + M pinned", MC10 p. 3): granted lines don't count toward
    // deck size, so the legal-count line says so rather than reading a plain total that includes them.
    const cardCountText = this.#campaignModel
      ? (() => {
          // A reward is counted apart too (MC45 p. 24): "40 cards + 1 reward".
          return campaignDeckSizeLabel(campaignDeckSizeSplit(this.#campaignModel!));
        })()
      : deckCountText(deckStatsOf(deck, POOL));
    const legalityText = verdict.ok
      ? `Legal — ${cardCountText}.`
      : `${verdict.problems.length} problem${verdict.problems.length === 1 ? "" : "s"}: ${verdict.problems.map((p) => p.message).join(" ")}`;
    const color = verdict.ok ? signal.heal.hex : accent.redDeep.hex;
    const legalityLine = this.add
      .text(left, y, legalityText, textStyle(typeRole.body, onDark ? surface.paper.hex : color))
      .setWordWrapWidth(column);
    if (onDark && verdict.ok) legalityLine.setColor(cssOf(signal.heal.hex));
    y += legalityLine.height + 12;

    if (this.#campaignModel?.editingDisabledReason) {
      const frozenLine = this.add
        .text(
          left,
          y,
          this.#campaignModel.editingDisabledReason,
          textStyle(typeRole.body, onDark ? surface.paper.hex : accent.redDeep.hex),
        )
        .setWordWrapWidth(column);
      y += frozenLine.height + 12;
    }

    if (!this.#status && !this.#campaign && this.#isDirty()) {
      const dirtyLine = this.add
        .text(
          left,
          y,
          this.#savedDeck ? "Unsaved changes." : "Not saved yet.",
          textStyle(typeRole.body, onDark ? surface.paper.hex : surface.ink.hex, ink.secondary),
        )
        .setWordWrapWidth(column);
      y += dirtyLine.height + 8;
    }

    if (this.#status) {
      const statusLine = this.add
        .text(
          left,
          y,
          this.#status,
          textStyle(typeRole.body, onDark ? surface.paper.hex : surface.ink.hex, ink.secondary),
        )
        .setWordWrapWidth(column);
      y += statusLine.height + 8;
    }
    return y;
  }

  /**
   * The cost curve chart alone (D04's own left-rail placement, wide layout) —
   * split out of what used to be one combined "stats panel" so the wide
   * layout can put it in the left rail while "Your deck" (`#drawYourDeckList`)
   * goes in the right one; the narrow layout still calls both back to back,
   * in the same order as before.
   */
  /**
   * The draw odds (issue #531, `view/deck-odds.ts`): a group stepper (◂ Gives physical ▸, Resource cards, a trait, a
   * title ...), a draw count stepper starting at the alter ego's hand size (the opening hand), then the chance of
   * drawing 0, 1, 2 and 3+ of the group and of at least one. Black Cat's top 2 is "Resource cards", draw 2.
   */
  #drawOdds(left: number, top: number, column: number, deck: Deck, rowHeight: number): number {
    let y = top;
    const copies = deckCopiesOf(deck, (id) => CARD_BY_ID.get(id));
    const groups = oddsGroupsOf(copies);
    const add = (id: string, rect: Rect, text: string, onClick: () => void, enabled = true): void => {
      this.#buttons.push(
        new McButton(this, { kind: "secondary", label: text, type: typeRole.label, rect, enabled, onClick }),
      );
      this.#stops.set(id, { rect, activate: () => enabled && onClick() });
    };
    if (groups.length === 0) {
      label(this, left, y, "Add cards to see their odds.", typeRole.body, surface.ink.hex, ink.meta);
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
      draws === hand ? `Draw ${draws} (opening hand)` : `Draw ${draws}`,
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
    label(this, left, y, line, typeRole.body, surface.ink.hex, ink.label);
    y += 18;
    label(this, left, y, `At least one: ${percentText(atLeastOne)}`, typeRole.body, surface.ink.hex, ink.label);
    return y + 26;
  }

  #drawCostCurve(left: number, top: number, column: number, deck: Deck, onDark: boolean): number {
    const stats = deckStatsOf(deck, POOL);
    const chartHeight = 74;
    drawCostCurveBars(this, { x: left, y: top, width: column, height: chartHeight }, costCurveBars(stats), onDark);
    return top + chartHeight + 16;
  }

  /** "Your deck", grouped Hero / aspect / Basic with a "+ N more" overflow (D04's right rail; the narrow layout's own stats panel). */
  #setRailTab(tab: "deck" | "games"): void {
    if (this.#railTab === tab) return;
    this.#railTab = tab;
    this.#rebuild();
    this.#route?.focusKey(`rail:${tab}`);
  }

  /** The deck rail's two tabs: Your deck (LB) and From your games (RB). Returns where they end. */
  #drawRailTabs(left: number, top: number, column: number, onDark: boolean): number {
    const gap = 6;
    const width = (column - gap) / 2;
    const tabs = [
      { id: "deck" as const, label: "Your deck", glyph: "zonePrevious" as const },
      { id: "games" as const, label: "From your games", glyph: "zoneNext" as const },
    ];
    tabs.forEach((tab, index) => {
      const rect: Rect = { x: left + index * (width + gap), y: top, width, height: hit.target };
      const selected = this.#railTab === tab.id;
      const open = (): void => this.#setRailTab(tab.id);
      const button = new McButton(this, {
        kind: selected ? "primary" : onDark ? "onInk" : "secondary",
        label: tab.label,
        type: typeRole.label,
        rect,
        onClick: open,
      });
      this.#buttons.push(button);
      // The bumper that reaches the other tab, on the tab it reaches.
      if (!selected) this.#hints?.button(button, [tab.glyph], onDark ? "ink" : "paper");
      this.#stops.set(`rail:${tab.id}`, { rect, activate: open });
      this.#railStops.push(`rail:${tab.id}`);
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
    const fg = onDark ? surface.paper.hex : surface.ink.hex;
    let y = top;
    if (!this.#insights) {
      label(this, left, y, "Reading your games…", typeRole.label, fg, ink.meta);
      return y + 24;
    }
    this.#railArtMissing = 0;
    const pool = new Set(this.#browsablePool(deck).map((card) => card.id as string));
    const view = fromYourGamesOf(
      this.#insights,
      deck.identityCardId as string,
      deck.cards.map((line) => line.cardId as string),
      deck.aspects,
      POOL_STATS_NAMES,
    );
    if (view.headline) {
      label(this, left, y, view.headline.toUpperCase(), typeRole.label, onDark ? signal.caution.hex : fg, 1);
      y += 18;
    }
    if (view.insight) {
      const text = this.add
        .text(left + 8, y + 6, view.insight, textStyle(typeRole.body, surface.ink.hex, 1))
        .setFontSize(12)
        .setWordWrapWidth(column - 16);
      const box = this.add.graphics();
      box.fillStyle(surface.paper.hex, 1).fillRect(left, y, column, text.height + 12);
      this.children.bringToTop(text);
      y += text.height + 20;
    }
    const thumb = { width: 30, height: 42 };
    const section = (
      title: string,
      cards: readonly SuggestedCard[],
      action: { readonly label: string; readonly run: (cardId: string) => void } | null,
    ): void => {
      if (cards.length === 0 || y + 20 + thumb.height > bottom) return;
      const head = this.add.text(left, y, title.toUpperCase(), {
        ...textStyle(typeRole.barTitle, fg),
        fontSize: "17px",
      });
      fitText(head, column, 17);
      const rule = this.add.graphics();
      rule.fillStyle(fg, 1).fillRect(left, y + head.height + 2, column, 2);
      y += head.height + 10;
      for (const entry of cards) {
        if (y + thumb.height > bottom) return;
        const card = CARDS_BY_ID.get(entry.cardId);
        const pic: Rect = { x: left, y, width: thumb.width, height: thumb.height };
        const frame = this.add.graphics();
        frame.fillStyle(surface.parchment.hex, 1).fillRect(pic.x, pic.y, pic.width, pic.height);
        if (!drawArt(this, cardArt(this).request(this, artFor(card, { kind: "front" })), pic)) this.#railArtMissing++;
        // With the deck lines, so the narrow layout's pictures follow its scrolling deck region.
        this.#deckLines.push({ cardId: entry.cardId, rect: pic, region: onDark ? "none" : "narrow" });
        const buttonWidth = action ? 70 : 0;
        const text = this.add
          .text(
            left + thumb.width + 8,
            y + 2,
            `${card?.name ?? entry.cardId}
${entry.detail}`,
            textStyle(typeRole.body, fg, onDark ? ink.body : 1),
          )
          .setFontSize(12)
          .setWordWrapWidth(column - thumb.width - 16 - buttonWidth);
        clampLines(text, 2);
        if (action) {
          const rect: Rect = {
            x: left + column - buttonWidth,
            y: y + (thumb.height - hit.target) / 2,
            width: buttonWidth,
            height: hit.target,
          };
          const key = `games:${action.label}:${entry.cardId}`;
          const run = (): void => action.run(entry.cardId);
          this.#buttons.push(
            new McButton(this, {
              kind: onDark ? "onInk" : "secondary",
              label: action.label,
              type: typeRole.label,
              rect,
              onClick: run,
            }),
          );
          this.#stops.set(key, { rect, activate: run });
          this.#railStops.push(key);
        }
        y += Math.max(thumb.height, hit.target) + 6;
      }
      y += 6;
    };
    section("Cut? Sits in your deck", view.cut, {
      label: "− Cut",
      run: (cardId) => this.#setDeck(removeCard(this.#deck!, cardId as CardId)),
    });
    section(
      "Try: cards you won with",
      view.tryCards.filter((entry) => pool.has(entry.cardId)),
      { label: "+ Add", run: (cardId) => this.#setDeck(addCard(this.#deck!, cardId as CardId)) },
    );
    section("Keep: your staples", view.keep, null);
    if (view.note && y + 30 < bottom) {
      const note = this.add
        .text(left, y, view.note, textStyle(typeRole.body, fg, onDark ? ink.secondary : ink.label))
        .setFontSize(12)
        .setWordWrapWidth(column);
      y += note.height + 8;
    }
    return y;
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
    label(
      this,
      left,
      top,
      "your deck",
      typeRole.label,
      onDark ? surface.paper.hex : surface.ink.hex,
      onDark ? ink.secondary : ink.label,
    );
    const groups = deckListGroupsOf(deck, POOL);
    const noteOf = this.#campaign
      ? (entry: DeckListEntry): string | null => {
          const row = this.#campaignRowFor(entry.cardId as string);
          const faceNote = row?.face ? `On its ${row.face} (Enhanced) side. ` : "";
          const reason = row?.lockedReason ?? row?.refusedReason ?? row?.rewardNote ?? null;
          return faceNote ? `${faceNote}${reason ?? ""}`.trim() : reason;
        }
      : undefined;
    // A campaign-granted line is otherwise a dead end for "what does this card actually do" — the pool grid never
    // lists it (nothing to add), so its "your deck" line here is the only place Deck Edit shows it at all. Tapping
    // it opens the same Inspect overlay the pool grid's own cards use, on its granted face (`#inspect`'s own
    // `flipSide` handling) — not just the ordinary deck's cards, which stay plain text as before.
    const onInspectOf = this.#campaign
      ? (entry: DeckListEntry): (() => void) | null => {
          const row = this.#campaignRowFor(entry.cardId as string);
          if (!row?.locked) return null;
          const card = POOL.find((candidate) => candidate.id === entry.cardId);
          return card ? () => this.#inspect(card, row.face ?? null) : null;
        }
      : undefined;
    // Every line is listed (none folded into "+ N more") and each has its own "-" while the deck can be edited.
    const frozen = this.#campaignModel?.editingDisabled ?? false;
    const drawRemove = (entry: DeckListEntry, rect: Rect): void => {
      const row = this.#campaignRowFor(entry.cardId as string);
      const locked = row?.locked ?? false;
      const refused = this.#ruleRefusal(deck, entry.cardId, -1);
      this.#buttons.push(
        new McButton(this, {
          kind: onDark ? "onInk" : "secondary",
          label: "−",
          type: typeRole.rowTitle,
          rect,
          enabled: !locked && !frozen && refused === null,
          ...(frozen
            ? { reason: this.#campaignModel?.editingDisabledReason ?? "" }
            : locked && row?.lockedReason
              ? { reason: row.lockedReason }
              : refused
                ? { reason: refused }
                : {}),
          onClick: () => this.#setDeck(removeCard(deck, entry.cardId)),
        }),
      );
    };
    const before = this.children.list.length;
    const bottom = drawGroupedCardList(
      this,
      left,
      top + 16,
      column,
      groups,
      Infinity,
      onDark,
      noteOf,
      onInspectOf,
      drawRemove,
      (entry, lineRect) =>
        this.#deckLines.push({
          cardId: entry.cardId as string,
          rect: lineRect,
          region: maxHeight === undefined ? "narrow" : "rail",
        }),
    );
    if (maxHeight === undefined || bottom - top <= maxHeight) return bottom;
    const rect: Rect = { x: left, y: top + 16, width: column, height: Math.max(hit.target * 2, maxHeight - 16) };
    const added = this.children.list.slice(before);
    this.#yourDeckRect = rect;
    const region = new McScrollRegion(this, {
      rect,
      heights: [bottom - rect.y],
      scroll: this.#yourDeckScroll,
      clipInteractive: true,
    });
    this.#yourDeckRegion = region;
    region.content.add(added);
    region.syncInteractivity();
    return rect.y + rect.height + 8;
  }

  #drawPreconClearSave(left: number, top: number, column: number, deck: Deck, onDark = false): number {
    let y = top;
    // Campaign mode (MC10 p. 3): Preconstructed and Clear both replace `deck.cards` wholesale, which would drop
    // the campaign's own granted lines — a player can never remove those by hand, so the screen never offers a
    // control that would do it as a side effect. `showPreconClear: false` already keeps them out of the focus
    // route; this keeps them off the canvas too.
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
        const doDelete = (): void => void this.#delete();
        this.#buttons.push(
          new McButton(this, {
            kind: onDark ? "onInk" : "secondary",
            label: this.#deleteArmed ? "Confirm delete" : "Delete",
            type: typeRole.label,
            rect: deleteRect,
            selected: this.#deleteArmed,
            enabled: !this.#busy,
            onClick: doDelete,
          }),
        );
        this.#stops.set("delete", { rect: deleteRect, activate: doDelete });
      }
      const precon = resetToPrecon(deck, this.#identity!, POOL_STARTER_DECKS);
      const doPrecon = (): void => {
        if (precon) this.#setDeck(precon);
      };
      this.#buttons.push(
        new McButton(this, {
          kind: onDark ? "onInk" : "secondary",
          label: canDelete ? "Precon" : "Preconstructed",
          type: typeRole.label,
          rect: preconRect,
          enabled: precon !== null,
          ...(precon === null ? { reason: "This hero has no published precon to reset to." } : {}),
          onClick: doPrecon,
        }),
      );
      this.#stops.set("preconstructed", { rect: preconRect, activate: doPrecon });
      const doClear = (): void => this.#setDeck(resetToIdentitySet(deck, this.#identity!, POOL));
      this.#buttons.push(
        new McButton(this, {
          kind: onDark ? "onInk" : "secondary",
          label: "Clear",
          type: typeRole.label,
          rect: clearRect,
          onClick: doClear,
        }),
      );
      this.#stops.set("clear", { rect: clearRect, activate: doClear });
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
      // `optIntoDeckFreeze`) rather than a synchronous `localStorage` write, so this scene's `onClick` fires the
      // async round trip and navigates once it settles — the same shape `#save` already uses for `setSeatDeck`.
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
      this.#buttons.push(
        new McButton(this, {
          kind: onDark ? "onInk" : "secondary",
          label: "Freeze deck for the rest of the campaign (optional, MC27 p. 6)",
          type: typeRole.label,
          rect: freezeRect,
          onClick: () => void doFreeze(),
        }),
      );
      this.#stops.set("freeze-deck", { rect: freezeRect, activate: doFreeze });
      y += hit.target + 16;
    }

    const frozen = this.#campaignModel?.editingDisabled ?? false;
    const saveRect: Rect = { x: left, y, width: column, height: hit.primary };
    const doSave = (): void => void this.#save();
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: this.#busy ? "Saving…" : this.#campaign ? "Save changes" : this.#isDirty() ? "Save deck" : "Saved ✓",
        type: typeRole.barTitle,
        rect: saveRect,
        enabled: !this.#busy && !frozen,
        ...(frozen && this.#campaignModel?.editingDisabledReason
          ? { reason: this.#campaignModel.editingDisabledReason }
          : {}),
        onClick: doSave,
      }),
    );
    this.#stops.set("save", { rect: saveRect, activate: doSave });
    return y + hit.primary + 16;
  }

  /**
   * The pool search row: the field, a clear button while it holds text, and the Cards/List view toggle. The search
   * matches every word against a card's name, traits, type and rules text (`browsablePool`).
   */
  #drawFilterInput(left: number, top: number, column: number): number {
    const toggleWidth = 92;
    const clearWidth = this.#filterText ? hit.target : 0;
    const fieldWidth = column - toggleWidth - CHIP_GAP - (clearWidth ? clearWidth + CHIP_GAP : 0);
    const filterRect: Rect = { x: left, y: top, width: fieldWidth, height: hit.target };
    const applyText = (value: string): void => {
      this.#filterText = value;
      this.#listScroll.reset();
      this.#requestPoolSearch(value);
    };
    if (this.#filterInput) this.#filterInput.layout(filterRect);
    else {
      this.#filterInput = new McTextInput(this, {
        rect: filterRect,
        value: this.#filterText,
        placeholder: "Search, or o:2 t:ally kw:guard",
        onChange: applyText,
      });
    }
    this.#stops.set("filter-text", { rect: filterRect, activate: () => this.#filterInput?.focus() });
    if (clearWidth) {
      const clearRect: Rect = { x: left + fieldWidth + CHIP_GAP, y: top, width: clearWidth, height: hit.target };
      const clear = (): void => {
        this.#filterInput?.setValue("");
        applyText("");
      };
      this.#buttons.push(
        new McButton(this, { kind: "secondary", label: "×", type: typeRole.rowTitle, rect: clearRect, onClick: clear }),
      );
      this.#stops.set("filter-clear", { rect: clearRect, activate: clear });
    }
    const toggleRect: Rect = { x: left + column - toggleWidth, y: top, width: toggleWidth, height: hit.target };
    const toggle = (): void => {
      this.#poolView = this.#poolView === "grid" ? "list" : "grid";
      this.#rememberView();
      this.#listScroll.reset();
      this.#rebuild();
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: this.#poolView === "grid" ? "List view" : "Card view",
        type: typeRole.label,
        rect: toggleRect,
        onClick: toggle,
      }),
    );
    this.#stops.set("pool-view", { rect: toggleRect, activate: toggle });
    return top + hit.target + 16;
  }

  /** The pool, virtualized: `McVirtualList` owns which rows are live game objects; every card still gets a focus stop regardless of whether it's currently drawn. */
  #drawPoolList(listRect: Rect, deck: Deck, pool: readonly AnyCard[]): void {
    if (pool.length === 0) {
      const searched = this.#filterText.trim();
      this.add
        .text(
          listRect.x + 10,
          listRect.y + 10,
          searched ? `No cards match “${searched}”.` : "No cards match this filter.",
          textStyle(typeRole.body, surface.ink.hex, ink.meta),
        )
        .setWordWrapWidth(listRect.width - 20);
    }
    if (this.#poolView === "grid") {
      this.#drawPoolGrid(listRect, deck, pool);
      return;
    }
    const renderRow = (index: number, rect: Rect): VirtualListRow => this.#renderCardRow(rect, deck, pool[index]!);
    this.#list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: this.#rows.cardRowHeight,
      count: pool.length,
      renderRow,
      scroll: this.#listScroll,
      // A tap on the card's picture or text (not its −/+) opens Inspect, the full card with its keywords explained.
      onRowActivate: (index, pointer) => {
        const card = pool[index];
        const list = this.#list;
        if (!card || !list || pointer.x >= list.rect.x + list.rect.width - 4 - POOL_ROW_CONTROLS_WIDTH) return;
        this.#inspect(card, this.#campaignRowFor(card.id as string)?.face ?? null);
      },
    });
    const list = this.#list;
    list.onDestroy(cardFaces(this).onBaked(() => list.layout(list.rect)));
    // A pool row is hovered over its picture and text, not its -/+ column. The rows have no zone of their own, so the
    // cards are `through`, and only the part inside the list's window counts.
    this.#hoverLists.push(() => {
      const found: (readonly [string, HoverCardIdRect])[] = [];
      const view = list.rect;
      const height = this.#rows.cardRowHeight;
      const { start, end } = visibleRowRange(view.y - list.rectFor(0).y, height, view.height, pool.length);
      for (let index = start; index < end; index++) {
        const at = list.rectFor(index);
        const rect = clipHoverRect(
          { x: at.x + 4, y: at.y, width: at.width - 8 - POOL_ROW_CONTROLS_WIDTH, height: height - 6 },
          view,
        );
        const cardId = pool[index]!.id as string;
        if (rect) found.push([hoverSlotOf(cardId, `row${index}`), { ...rect, cardId, through: true }]);
      }
      return found;
    });
    pool.forEach((card, index) => {
      const cardId = card.id as string;
      this.#stops.set(`card:${cardId}`, {
        rect: () => list.rectFor(index),
        // Keyboard/pad activation mirrors the row's own "+" button, including its campaign refusals: a stop still
        // exists for every browsable card (so its reason reads with `I`), but pressing it on a refused or frozen
        // row is a no-op, exactly like clicking a disabled "+".
        activate: () => {
          const row = this.#campaignRowFor(cardId);
          const frozen = this.#campaignModel?.editingDisabled ?? false;
          if (frozen || (row?.refused ?? false) || this.#ruleRefusal(deck, card.id, 1)) return;
          this.#setDeck(addCard(deck, card.id));
        },
        inspect: () => this.#inspect(card, this.#campaignRowFor(cardId)?.face ?? null),
        ensureVisible: () => list.scrollIntoView(index),
      });
    });
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

  /**
   * Card view (issue #217): the pool as card pictures, a row of the virtual list per grid row. A tap on a picture
   * opens Inspect, hovering it on desktop opens the card popover, and each cell's own −/+ edits the deck.
   */
  #drawPoolGrid(listRect: Rect, deck: Deck, pool: readonly AnyCard[]): void {
    const geometry = this.#gridGeometry(listRect.width, pool.length);
    const controlsTop = (rowRect: Rect): number => rowRect.y + geometry.cellHeight - GRID_CONTROLS_HEIGHT;
    this.#list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: geometry.cellHeight,
      count: pool.length === 0 ? 0 : geometry.rows,
      renderRow: (rowIndex, rowRect) => this.#renderGridRow(rowRect, geometry, deck, pool, rowIndex),
      scroll: this.#listScroll,
      background: false,
      onRowActivate: (rowIndex, pointer) => {
        const list = this.#list;
        if (!list) return;
        const rowRect = list.rectFor(rowIndex);
        if (pointer.y >= controlsTop(rowRect)) return;
        const start = rowIndex * geometry.columns;
        const col = poolColumnAt(geometry, rowRect, pointer.x, Math.min(geometry.columns, pool.length - start));
        const card = col === null ? undefined : pool[start + col];
        if (card) this.#inspect(card, this.#campaignRowFor(card.id as string)?.face ?? null);
      },
    });
    const list = this.#list;
    list.onDestroy(cardFaces(this).onBaked(() => list.layout(list.rect)));
    // A cell is hovered over its picture and caption, not its −/+ strip; only the part inside the list's window counts.
    this.#hoverLists.push(() => {
      const found: (readonly [string, HoverCardIdRect])[] = [];
      const view = list.rect;
      const rows = visibleRowRange(view.y - list.rectFor(0).y, geometry.cellHeight, view.height, geometry.rows);
      for (let rowIndex = rows.start; rowIndex < rows.end; rowIndex++) {
        const at = list.rectFor(rowIndex);
        const inRow = Math.min(geometry.columns, pool.length - rowIndex * geometry.columns);
        for (let col = 0; col < inRow; col++) {
          const cardId = pool[rowIndex * geometry.columns + col]!.id as string;
          const cell = poolCellRect(geometry, at, col);
          const rect = clipHoverRect(
            { x: cell.x + 4, y: cell.y + 2, width: cell.width - 8, height: controlsTop(at) - cell.y - 4 },
            view,
          );
          if (rect) found.push([hoverSlotOf(cardId, `cell${rowIndex}.${col}`), { ...rect, cardId, through: true }]);
        }
      }
      return found;
    });
    pool.forEach((card, index) => {
      const cardId = card.id as string;
      const rowIndex = Math.floor(index / geometry.columns);
      const col = index % geometry.columns;
      this.#stops.set(`card:${cardId}`, {
        rect: () => poolCellRect(geometry, list.rectFor(rowIndex), col),
        activate: () => {
          const row = this.#campaignRowFor(cardId);
          if ((this.#campaignModel?.editingDisabled ?? false) || (row?.refused ?? false)) return;
          if (this.#ruleRefusal(deck, card.id, 1)) return;
          this.#setDeck(addCard(deck, card.id));
        },
        inspect: () => this.#inspect(card, this.#campaignRowFor(cardId)?.face ?? null),
        ensureVisible: () => list.scrollIntoView(rowIndex),
      });
    });
  }

  #renderGridRow(
    rowRect: Rect,
    geometry: PoolGridGeometry,
    deck: Deck,
    pool: readonly AnyCard[],
    rowIndex: number,
  ): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const start = rowIndex * geometry.columns;
    const inRow = Math.min(geometry.columns, pool.length - start);
    const clip = (): Rect | null => this.#list?.rect ?? null;
    const suppressClick = (): boolean => this.#list?.isDragSuppressingClick ?? false;
    const frozen = this.#campaignModel?.editingDisabled ?? false;
    for (let col = 0; col < inRow; col++) {
      const card = pool[start + col]!;
      const cell = poolCellRect(geometry, rowRect, col);
      const cardRect: Rect = { x: cell.x + 4, y: cell.y + 2, width: cell.width - 8, height: cell.height - 6 };
      const quantity = deck.cards.find((line) => line.cardId === card.id)?.quantity ?? 0;
      const campaignRow = this.#campaignRowFor(card.id as string);
      const g = this.add.graphics();
      paintPanel(g, cardRect, "card", quantity > 0 ? "selected" : "rest");
      objects.push(g);

      const artRect: Rect = {
        x: cardRect.x + 3,
        y: cardRect.y + 3,
        width: cardRect.width - 6,
        height: geometry.artHeight - 6,
      };
      objects.push(renderArtThumb(this, artRect, artFor(card, { kind: "front" })?.url ?? null, 0));
      if ("cost" in card && typeof card.cost === "number") {
        const pip = label(this, 0, 0, String(card.cost), typeRole.label, surface.paper.hex, 1);
        const pipWidth = Math.ceil(pip.width) + 12;
        const pipBg = this.add.graphics();
        pipBg.fillStyle(surface.ink.hex, 1).fillRect(artRect.x, artRect.y, pipWidth, 18);
        pip.setPosition(artRect.x + 6, artRect.y + 9).setOrigin(0, 0.5);
        objects.push(pipBg, pip);
      }

      const captionY = cardRect.y + geometry.artHeight;
      const name = this.add.text(cardRect.x + 6, captionY, card.name, textStyle(typeRole.rowTitle, surface.ink.hex));
      fitText(name, cardRect.width - 12);
      objects.push(name);
      const note = this.#campaign ? null : poolRowNote(card, this.#identity!, deck.aspects);
      const captionText = campaignRow?.locked
        ? "campaign grant"
        : campaignRow?.refused
          ? "removed from campaign"
          : (note ?? poolTypeLine(card));
      const caption = label(
        this,
        cardRect.x + 6,
        captionY + name.height + 2,
        captionText,
        typeRole.label,
        surface.ink.hex,
        note || campaignRow ? ink.label : ink.meta,
      );
      fitText(caption, cardRect.width - 12);
      objects.push(caption);

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
      // The rule settings (issue #531) only matter where nothing else already disables the button.
      const minusRefused = quantity > 0 ? this.#ruleRefusal(deck, card.id, -1) : null;
      const plusRefused = this.#ruleRefusal(deck, card.id, 1);
      const minusReason = frozen
        ? (this.#campaignModel?.editingDisabledReason ?? undefined)
        : (campaignRow?.lockedReason ?? minusRefused ?? undefined);
      const minus = new McButton(this, {
        kind: "secondary",
        label: "−",
        type: typeRole.rowTitle,
        rect: minusRect,
        enabled: quantity > 0 && !(campaignRow?.locked ?? false) && !frozen && minusRefused === null,
        ...(minusReason ? { reason: minusReason } : {}),
        onClick: () => this.#setDeck(removeCard(deck, card.id)),
        clip,
        suppressClick,
      });
      const plusReason = frozen
        ? (this.#campaignModel?.editingDisabledReason ?? undefined)
        : (campaignRow?.refusedReason ?? plusRefused ?? undefined);
      const plus = new McButton(this, {
        kind: "secondary",
        label: "+",
        type: typeRole.rowTitle,
        rect: plusRect,
        enabled: !(campaignRow?.refused ?? false) && !frozen && plusRefused === null,
        ...(plusReason ? { reason: plusReason } : {}),
        onClick: () => this.#setDeck(addCard(deck, card.id)),
        clip,
        suppressClick,
      });
      const qty = label(
        this,
        cardRect.x + cardRect.width / 2,
        stripY + hit.target / 2,
        quantity > 0 ? `×${quantity}` : "",
        typeRole.rowTitle,
        surface.ink.hex,
        quantity > 0 ? 1 : ink.meta,
      ).setOrigin(0.5);
      fitText(qty, plusRect.x - (minusRect.x + minusRect.width) - 4);
      objects.push(minus.container, plus.container, qty);
    }
    return { objects };
  }

  /**
   * The identity picker: a `McVirtualList` like the pool, so it scrolls by drag, wheel and paging. Every playable
   * identity drawn as a plain column of buttons ran far below a phone's screen with no way to reach the rest, and a
   * drag over it only moved the hover highlight. Rows are `McButton`s wired to the list's `clip`/`suppressClick`,
   * so a drag that scrolls never also picks the identity it lifts over.
   */
  #drawIdentityPicker(left: number, y: number, column: number): readonly HeroIdentityCard[] {
    label(this, left, y, "pick a hero", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    // The hero search: every word must appear in the hero's name, alter-ego name or traits.
    const searchRect: Rect = { x: left, y, width: column, height: hit.target };
    if (this.#identityInput) this.#identityInput.layout(searchRect);
    else {
      this.#identityInput = new McTextInput(this, {
        rect: searchRect,
        value: this.#identitySearch,
        placeholder: "Search heroes",
        onChange: (value) => {
          this.#identitySearch = value;
          this.#listScroll.reset();
          this.#requestHeroSearch(value);
        },
      });
    }
    this.#stops.set("identity-search", { rect: searchRect, activate: () => this.#identityInput?.focus() });
    y += hit.target + 12;
    const heroRanking = this.#identitySearch.trim() ? this.#heroRanking : null;
    const shown = heroRanking
      ? IDENTITIES.filter((identity) => heroRanking.has(identity.id as string)).sort(
          (a, b) => heroRanking.get(b.id as string)! - heroRanking.get(a.id as string)!,
        )
      : IDENTITIES;
    if (shown.length === 0) {
      this.add
        .text(
          left,
          y,
          `No hero matches “${this.#identitySearch.trim()}”.`,
          textStyle(typeRole.body, surface.ink.hex, ink.meta),
        )
        .setWordWrapWidth(column);
      return shown;
    }
    const { height } = this.scale.gameSize;
    const pad = formFactorFor(this.scale.gameSize.width, height) === "phone" ? 16 : 40;
    // A grid of hero tiles: the hero's own art (the picture Take your seats shows, else the identity card's scan),
    // baked small off the main thread, over a name bar that takes the tap; a tap on the art picks the hero too.
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
    const clip = (): Rect | null => this.#list?.rect ?? null;
    const suppressClick = (): boolean => this.#list?.isDragSuppressingClick ?? false;
    const chooseAt = (index: number): void => {
      const identity = shown[index]!;
      // A hero with a published precon gets the "Start from" step; one without starts from its own cards.
      if (preconsFor(identity, POOL_STARTER_DECKS).length > 0) {
        this.#startFor = identity;
        this.#rebuild();
      } else this.#startWith(identity, null);
    };
    const tileRect = (rowRect: Rect, col: number): Rect => ({
      x: rowRect.x + col * (tileWidth + gap),
      y: rowRect.y,
      width: tileWidth,
      height: artHeight + hit.target,
    });
    const renderRow = (rowIndex: number, rowRect: Rect): VirtualListRow => {
      const objects: Phaser.GameObjects.GameObject[] = [];
      for (let col = 0; col < cols; col++) {
        const index = rowIndex * cols + col;
        const identity = shown[index];
        if (!identity) break;
        const tile = tileRect(rowRect, col);
        const frame = this.add.graphics();
        paintPanel(frame, tile, "card", "rest");
        objects.push(frame);
        objects.push(
          renderArtThumb(
            this,
            { x: tile.x + 3, y: tile.y + 3, width: tile.width - 6, height: artHeight - 3 },
            this.#identityArtUrl(identity),
            0.2,
            this.#identityArtFocus(identity),
          ),
        );
        const button = new McButton(this, {
          kind: "secondary",
          label: qualifiedHeroName(identity),
          type: typeRole.rowTitle,
          rect: { x: tile.x, y: tile.y + artHeight, width: tile.width, height: hit.target },
          onClick: () => chooseAt(index),
          clip,
          suppressClick,
        });
        objects.push(button.container);
      }
      return { objects };
    };
    this.#list = new McVirtualList(this, {
      rect: listRect,
      rowHeight,
      count: rows,
      renderRow,
      scroll: this.#listScroll,
      background: false,
      onRowActivate: (rowIndex, pointer) => {
        const list = this.#list;
        if (!list) return;
        const rowRect = list.rectFor(rowIndex);
        if (pointer.y >= rowRect.y + artHeight) return;
        const col = Math.floor((pointer.x - rowRect.x) / (tileWidth + gap));
        const index = rowIndex * cols + col;
        if (col >= 0 && col < cols && pointer.x - tileRect(rowRect, col).x <= tileWidth && shown[index])
          chooseAt(index);
      },
    });
    const list = this.#list;
    list.onDestroy(cardFaces(this).onBaked(() => list.layout(list.rect)));
    // Each tile's art opens the hero's card popover; only the part inside the list's window counts.
    this.#hoverLists.push(() => {
      const found: (readonly [string, HoverCardIdRect])[] = [];
      const view = list.rect;
      const { start, end } = visibleRowRange(view.y - list.rectFor(0).y, rowHeight, view.height, rows);
      for (let rowIndex = start; rowIndex < end; rowIndex++) {
        const at = list.rectFor(rowIndex);
        for (let col = 0; col < cols; col++) {
          const identity = shown[rowIndex * cols + col];
          if (!identity) break;
          const tile = tileRect(at, col);
          const rect = clipHoverRect({ x: tile.x, y: tile.y, width: tile.width, height: artHeight }, view);
          const cardId = identity.id as string;
          if (rect) found.push([hoverSlotOf(cardId, `identity${rowIndex}.${col}`), { ...rect, cardId, through: true }]);
        }
      }
      return found;
    });
    shown.forEach((identity, index) => {
      const rowIndex = Math.floor(index / cols);
      this.#stops.set(`identity:${identity.id as string}`, {
        rect: () => tileRect(list.rectFor(rowIndex), index % cols),
        activate: () => chooseAt(index),
        inspect: () => this.#inspect(identity),
        ensureVisible: () => list.scrollIntoView(rowIndex),
      });
    });
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
    search.setDocuments(POOL_SEARCH_DOCUMENTS(), POOL_VERSION);
    search.search(text, (ranked) => {
      if (!this.sys.isActive()) return;
      this.#poolRanking = new Map(ranked.map((r) => [r.id, r.score]));
      this.#listScroll.reset();
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
    search.setDocuments(HERO_SEARCH_DOCUMENTS(), POOL_VERSION);
    search.search(text, (ranked) => {
      if (!this.sys.isActive()) return;
      this.#heroRanking = new Map(ranked.map((r) => [r.id, r.score]));
      this.#listScroll.reset();
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
      POOL_CARDS,
      `deck-${crypto.randomUUID()}`,
      POOL_VERSION,
      new Date().toISOString(),
    );
    this.#savedDeck = null;
    this.#listScroll.reset();
    this.#rebuild();
  }

  /**
   * New deck's "Start from" step (issue #217): the hero's picture, then an empty deck (the hero's own cards) or the
   * player's own copy of one of its precons, each named with its aspect. Returns the stops it drew, in order.
   */
  #drawStartFrom(left: number, top: number, column: number, identity: HeroIdentityCard): readonly string[] {
    const ids: string[] = [];
    let y = top;
    label(
      this,
      left,
      y,
      `start a ${qualifiedHeroName(identity)} deck from`,
      typeRole.label,
      surface.ink.hex,
      ink.label,
    );
    y += 20;
    const width = Math.min(column, 560);
    const bannerHeight = Math.round(width / 2.4);
    renderArtThumb(
      this,
      { x: left, y, width, height: bannerHeight },
      this.#identityArtUrl(identity),
      0.2,
      this.#identityArtFocus(identity),
    );
    // The picture is baked off the main thread: once it lands, redraw this step (once) to show it.
    this.#bannerBaked?.();
    this.#bannerBaked = cardFaces(this).onBaked(() => {
      this.#bannerBaked?.();
      this.#bannerBaked = null;
      if (this.#startFor === identity) this.#rebuild();
    });
    const bannerRect: Rect = { x: left, y, width, height: bannerHeight };
    noteHoverCardId(this, identity.id as string, bannerRect, true);
    y += bannerHeight + 16;
    const add = (id: string, text: string, onClick: () => void, tint?: { fill: number; ink: number }): void => {
      const rect: Rect = { x: left, y, width, height: hit.primary };
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: text,
          type: typeRole.rowTitle,
          rect,
          ...(tint ? { tint } : {}),
          onClick,
        }),
      );
      this.#stops.set(id, { rect, activate: onClick });
      ids.push(id);
      y += hit.primary + 10;
    };
    add("start:empty", "Empty deck: hero cards only", () => this.#startWith(identity, null));
    for (const starter of preconsFor(identity, POOL_STARTER_DECKS)) {
      const aspects = starter.aspects.map((aspect) => aspectStampOf(aspect).label).join(" + ");
      const stamp = starter.aspects[0] ? aspectStampOf(starter.aspects[0]) : null;
      add(
        `start:${starter.id as string}`,
        `Copy of the ${aspects} precon`,
        () => this.#startWith(identity, starter),
        stamp ? { fill: stamp.fill, ink: stamp.ink } : undefined,
      );
    }
    y += 6;
    add("start:back", "Pick another hero", () => {
      this.#startFor = null;
      this.#rebuild();
    });
    return ids;
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
    let art = this.#identityArt.get(id);
    if (!art) {
      const picture = heroArtForIdentity(HERO_ART, id, POOL_CARDS);
      art = picture
        ? { url: picture.url, ...(picture.focus ? { focus: picture.focus } : {}) }
        : { url: artFor(identity, { kind: "hero" })?.url ?? null };
      this.#identityArt.set(id, art);
    }
    return art;
  }

  #renderCardRow(rect: Rect, deck: Deck, card: AnyCard): VirtualListRow {
    const row: Rect = { x: rect.x + 4, y: rect.y, width: rect.width - 8, height: this.#rows.cardRowHeight - 6 };
    const objects: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics();
    paintPanel(g, row, "card", "rest");
    objects.push(g);
    const quantity = deck.cards.find((c) => c.cardId === card.id)?.quantity ?? 0;
    const campaignRow = this.#campaignRowFor(card.id as string);
    const frozen = this.#campaignModel?.editingDisabled ?? false;

    // The card's own picture, then its name, type line and what it does; a tap anywhere left of −/+ inspects it
    // (`#drawPoolList`'s `onRowActivate`).
    objects.push(
      renderArtThumb(
        this,
        { x: row.x + 6, y: row.y + 6, width: this.#rows.cardThumbWidth, height: row.height - 12 },
        artFor(card, { kind: "front" })?.url ?? null,
        0,
      ),
    );
    const textX = row.x + 6 + this.#rows.cardThumbWidth + 10;
    const textWidth = row.x + row.width - POOL_ROW_CONTROLS_WIDTH - textX;
    const name = this.add.text(textX, row.y + 6, card.name, textStyle(typeRole.rowTitle, surface.ink.hex));
    fitText(name, textWidth);
    objects.push(name);
    const typeText = poolTypeLine(card);
    // Why a card is listed when the chosen aspect would not allow it, or why it is refused (held, but not allowed).
    const note = this.#campaign ? null : poolRowNote(card, this.#identity!, deck.aspects);
    // MC27 p. 22's Enhanced side (`CampaignDeckEditRow.face`): named on its own, in front of "campaign grant", so
    // the row never reads as an ordinary grant when the printed card in play is actually the flipped side.
    const faceLabel = campaignRow?.face ? ` · ${campaignRow.face} (Enhanced)` : "";
    const typeLineText = campaignRow?.locked
      ? `${typeText} · campaign grant${faceLabel}`
      : campaignRow?.refused
        ? `${typeText} · removed from campaign`
        : typeText;
    const typeLine = this.add.text(
      textX,
      row.y + 6 + name.height + 2,
      typeLineText,
      textStyle(typeRole.label, surface.ink.hex, ink.meta),
    );
    fitText(typeLine, textWidth);
    objects.push(typeLine);
    // Why the card is offered or refused (an identity's off-aspect rule, a card the deck holds but may not): its own
    // line, so the type line never cuts it off on a narrow row.
    let belowY = typeLine.y + typeLine.height;
    if (note) {
      const noteLine = this.add.text(textX, belowY + 1, note, textStyle(typeRole.label, surface.ink.hex, ink.label));
      fitText(noteLine, textWidth);
      objects.push(noteLine);
      belowY = noteLine.y + noteLine.height;
    }
    const rules = cardInspectModel(card, campaignRow?.face ? { kind: "flipSide" } : { kind: "front" }).rulesText;
    if (rules) {
      const rulesText = this.add
        .text(textX, belowY + 4, rules, textStyle(typeRole.label, surface.ink.hex))
        .setWordWrapWidth(textWidth, true);
      clampLines(rulesText, note ? CARD_TEXT_LINES - 1 : CARD_TEXT_LINES);
      objects.push(rulesText);
    }

    const qtyText = label(
      this,
      row.x + row.width - 128,
      row.y + row.height / 2,
      String(quantity),
      typeRole.rowTitle,
      surface.ink.hex,
    ).setOrigin(0.5);
    objects.push(qtyText);

    // `clip`/`suppressClick` read `this.#list` lazily (see decks.ts's
    // `#renderRow` for why it can't be a value captured up front): a row
    // reparented into the list's masked layer is still fully hit-testable
    // outside the mask, and a drag that just scrolled the list must not also
    // add or remove a card it happened to end over.
    const clip = (): Rect | null => this.#list?.rect ?? null;
    const suppressClick = (): boolean => this.#list?.isDragSuppressingClick ?? false;

    const minusRect: Rect = {
      x: row.x + row.width - 106,
      y: row.y + (row.height - hit.target) / 2,
      width: 40,
      height: hit.target,
    };
    // Campaign mode: a granted line can't be removed by the player (MC10 p. 3) and nothing is added while the
    // deck is frozen (MC16 p. 5 / MC27 p. 6) — both disable with the row's own reason, read the same way any
    // other unavailable control's reason reads (`McButton.reason`).
    const minusRefused = quantity > 0 ? this.#ruleRefusal(deck, card.id, -1) : null;
    const plusRefused = this.#ruleRefusal(deck, card.id, 1);
    const minusDisabledReason = frozen
      ? (this.#campaignModel?.editingDisabledReason ?? undefined)
      : (campaignRow?.lockedReason ?? minusRefused ?? undefined);
    const doRemove = (): void => this.#setDeck(removeCard(deck, card.id));
    const minusButton = new McButton(this, {
      kind: "secondary",
      label: "−",
      type: typeRole.rowTitle,
      rect: minusRect,
      enabled: quantity > 0 && !(campaignRow?.locked ?? false) && !frozen && minusRefused === null,
      ...(minusDisabledReason ? { reason: minusDisabledReason } : {}),
      onClick: doRemove,
      clip,
      suppressClick,
    });
    objects.push(minusButton.container);

    const plusDisabledReason = frozen
      ? (this.#campaignModel?.editingDisabledReason ?? undefined)
      : (campaignRow?.refusedReason ?? plusRefused ?? undefined);
    const plusRect: Rect = { x: row.x + row.width - 46, y: minusRect.y, width: 40, height: hit.target };
    const doAdd = (): void => this.#setDeck(addCard(deck, card.id));
    const plusButton = new McButton(this, {
      kind: "secondary",
      label: "+",
      type: typeRole.rowTitle,
      rect: plusRect,
      enabled: !(campaignRow?.refused ?? false) && !frozen && plusRefused === null,
      ...(plusDisabledReason ? { reason: plusDisabledReason } : {}),
      onClick: doAdd,
      clip,
      suppressClick,
    });
    objects.push(plusButton.container);

    return { objects };
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
    goToScreen(this, SCENES.decks);
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

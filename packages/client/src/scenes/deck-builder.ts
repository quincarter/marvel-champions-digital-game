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
 * Unlike the other four W1/W4 screens in this fidelity pass, this scene has
 * no dedicated `view/*-layout.ts` pure layout module — every rect is computed
 * inline against a running `y` cursor per column, the same shape this file
 * already had. A future pass extracting that into a tested pure function
 * (the way `deck-check-layout.ts` already does for Deck check) is real,
 * unstarted work; this pass keeps the existing architecture rather than
 * introducing a new one under time pressure.
 */

import Phaser from "phaser";
import type { AnyCard, CardType, CoreAspect, Deck, HeroIdentityCard } from "@mc/content";
import type { CampaignDeckContext, CampaignGrant } from "@mc/engine";
import { POOL_CARDS, POOL_HERO_SHELF_PACKS, POOL_PACKS, POOL_STARTER_DECKS, POOL_VERSION } from "../content/pool.js";
import { qualifiedHeroName } from "../view/hero-names.js";
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
  stepChoice,
  withCycle,
  browsablePool,
  poolRowNote,
  poolTypeLine,
  identityOptions,
  legalityOf,
  newDeck,
  removeCard,
  resetToIdentitySet,
  resetToPrecon,
  setAspects,
  setName,
  type PackInfo,
  type PoolFilter,
  type PoolSort,
} from "../view/deck-builder-model.js";
import { costCurveBars, deckCountText, deckListGroupsOf, deckStatsOf, type DeckListEntry } from "../view/deck-stats.js";
import { CHIP_GAP, chipStripHeight, splitInfoSegment, wrapChipsToRows } from "../view/chip-layout.js";
import { deckBuilderFocusOrder } from "../view/screen-focus.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
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
import { campaignService, deckStorage } from "../session.js";
import {
  campaignDeckEditModel,
  campaignDeckSizeSplit,
  prohibitedCampaignCardIds,
  removedFromCampaignCardIds,
  type CampaignDeckEditModel,
  type CampaignDeckEditRow,
} from "../view/campaign-deck-edit-model.js";
import type { CampaignReturn } from "./campaign/routes.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { drawAspectInfoSegment, drawAspectTipPanel } from "../ui/aspect-tip.js";
import { aspectTipContentOf, type AspectTipContent } from "../view/aspect-tip-model.js";
import { aspectStampOf } from "../view/aspect-stamp.js";

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
}

/** Tall enough for the hero's art to read beside the name. */
const IDENTITY_ROW_HEIGHT = 64;
/** The identity row's art window, wide for its height: a cover crop of the hero's face and shoulders. */
const IDENTITY_THUMB_ASPECT = 1.5;
/** Tall enough for the card's own picture and a few lines of what it does. */
const CARD_ROW_HEIGHT = 104;
/** The card picture's width in a pool row, at the printed card's own proportions (63 × 88 mm). */
const CARD_THUMB_WIDTH = Math.round((CARD_ROW_HEIGHT - 6 - 12) * (63 / 88));
/** The −, quantity and + at a pool row's right end. */
const POOL_ROW_CONTROLS_WIDTH = 146;
/** Lines of rules text a pool row shows before the ellipsis; Inspect has the rest. */
const CARD_TEXT_LINES = 3;
/** How many pool rows the narrow layout keeps on screen below its scrolling deck half (`#rebuildNarrow`). */
const NARROW_POOL_MIN_ROWS = 3;
/** Room left at the narrow deck region's right edge for its scrollbar (`ui/scroll-region.ts`), so no control sits under it. */
const NARROW_SCROLLBAR_GUTTER = 10;
const POOL: readonly AnyCard[] = POOL_CARDS;
const IDENTITIES: readonly HeroIdentityCard[] = identityOptions(POOL);

/** Every pack the pool knows, in release order, with its cycle — what the Pack/Cycle filter and the "pack" sort read. */
const PACK_INFOS: readonly PackInfo[] = POOL_PACKS.map((pack) => ({
  code: pack.code as string,
  name: pack.name,
  cycleId: POOL_HERO_SHELF_PACKS.find((p) => p.code === (pack.code as string))?.cycleId ?? (pack.cycleId as string),
  cycleName: POOL_HERO_SHELF_PACKS.find((p) => p.code === (pack.code as string))?.cycleName ?? (pack.cycleId as string),
}));

/** The pool-sort button's cycle; `default` (alphabetical) shows as "Name". */
const SORT_CYCLE: readonly { readonly sort: PoolSort; readonly label: string }[] = [
  { sort: "default", label: "Name" },
  { sort: "cost", label: "Cost" },
  { sort: "pack", label: "Pack" },
];

/** Below this, the three-column desktop split doesn't have room to breathe and the scene stacks into one column instead. */
const WIDE_MIN_WIDTH = 1000;
const LEFT_RAIL_WIDTH = 230;
const RIGHT_RAIL_WIDTH = 300;
const RAIL_GAP = 24;

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

export class DeckBuilderScene extends Phaser.Scene {
  #identity: HeroIdentityCard | null = null;
  #deck: Deck | null = null;
  #filter: PoolFilter = {};
  #filterText = "";
  #sort: PoolSort = "default";
  #status: string | null = null;
  /** The id of the deck this visit last saved, so Back can hand it to Decks to select. */
  #savedDeckId: string | null = null;
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
  readonly #identityArt = new Map<string, string | null>();
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
    this.#campaign = data.campaign ?? null;
    this.#deck = data.deck ?? null;
    this.#identity = this.#deck ? (IDENTITIES.find((i) => i.id === this.#deck!.identityCardId) ?? null) : null;
    this.#filter = {};
    this.#filterText = "";
    this.#status = null;
    this.#savedDeckId = null;
    this.#busy = false;
    this.#listScroll = new ListScroll();
    this.#deckScroll = new VariableListScroll();

    const onResize = (): void => this.#rebuild();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#nameInput?.destroy();
      this.#nameInput = null;
      this.#filterInput?.destroy();
      this.#filterInput = null;
      this.#list?.destroy();
      this.#list = null;
      this.#deckRegion?.destroy();
      this.#deckRegion = null;
    });
    this.#route = new FocusRoute(this, {
      blocked: () =>
        this.scene.isActive(SCENES.inspect) ||
        (this.#nameInput?.focused ?? false) ||
        (this.#filterInput?.focused ?? false),
      onPage: (direction) => this.#list?.scrollByPage(direction),
      onHomeEnd: (edge) => (edge === "home" ? this.#list?.scrollToStart() : this.#list?.scrollToEnd()),
    });
    this.#rebuild();
    fadeScreenIn(this);
  }

  #rebuild(): void {
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
    ];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const phone = formFactorFor(width, height) === "phone";
    const wide = !phone && width >= WIDE_MIN_WIDTH;
    const pad = phone ? 16 : 40;
    const column = Math.min(width - pad * 2, wide ? 1200 : 720);
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
    const goBack = (): void => {
      if (campaign) goToScreen(this, campaign.returnTo.key, campaign.returnTo.data);
      // After a Save, Decks opens on the deck just saved (its row selected and in view).
      else goToScreen(this, SCENES.decks, this.#savedDeckId ? { focusDeckId: this.#savedDeckId } : undefined);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Back",
        type: typeRole.rowTitle,
        rect: backRect,
        onClick: goBack,
      }),
    );
    this.#stops.set("back", { rect: backRect, activate: goBack });
    y += Math.max(titleObj.height, phone ? 28 : 38) + 16;

    if (!this.#identity) {
      this.#drawIdentityPicker(left, y, column);
      this.#route?.set(
        deckBuilderFocusOrder({
          identityChosen: false,
          identityIds: IDENTITIES.map((identity) => identity.id as string),
          aspectIds: [],
          typeFilterIds: [],
          poolCardIds: [],
        }),
        this.#stops,
      );
      return;
    }

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
        poolCardIds: pool.map((card) => card.id as string),
        showName: !this.#campaign,
        showPreconClear: !this.#campaign,
      }),
      this.#stops,
    );
  }

  /** Cards this screen must never offer to *add*: RRG 1.8 p. 29 removals from the campaign this deck belongs to. A line already in the deck from before a removal still shows (in "your deck" and, so a player can remove it, in the pool list) via `#campaignModel`'s own `refused` mark — this only narrows what browsing turns up. `null` outside campaign mode. */
  #removedFromCampaignIds(): ReadonlySet<string> | null {
    return this.#campaign ? new Set([...removedFromCampaignCardIds(this.#campaign.context)].map(String)) : null;
  }

  /** Cards this screen must never offer to *add*: MC27 p. 4's `Campaign.prohibited.cardIds` (Venom the ally 27190, Symbiote Suit 27191). Same narrowing rule as `#removedFromCampaignIds` — a line the deck already holds still shows, so its own refused "+"/"−" can fix it. `null` outside campaign mode. */
  #prohibitedCampaignIds(): ReadonlySet<string> | null {
    return this.#campaign ? new Set([...prohibitedCampaignCardIds(this.#campaign.context)].map(String)) : null;
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
    const pool = browsablePool(POOL, this.#identity!, deck.aspects, this.#filter, this.#sort, PACK_INFOS, held);
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
    const poolReserve = 16 + hit.target + 16 + 16 + CARD_ROW_HEIGHT * NARROW_POOL_MIN_ROWS;
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
    const listRect: Rect = { x: left, y, width: column, height: Math.max(CARD_ROW_HEIGHT, height - y - pad) };
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
    y = this.#drawPackAndSort(left, y, inner, deck);
    if (!this.#campaign) y = this.#drawNameField(left, y, inner, deck);
    y = this.#drawLegalityLine(left, y, inner, deck);
    y = this.#drawCostCurve(left, y, inner, deck, false);
    y = this.#drawYourDeckList(left, y, inner, deck, false);
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
    label(this, leftX, leftY, "cost curve", typeRole.label, surface.ink.hex, ink.label);
    leftY += 16;
    this.#drawCostCurve(leftX, leftY, LEFT_RAIL_WIDTH, deck, true);

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
    rightY += 4;
    const actionsTop = bottom - hit.target * 2 - 24;
    rightY = this.#drawYourDeckList(rightX + 12, rightY, RIGHT_RAIL_WIDTH - 24, deck, true, actionsTop - 8 - rightY);
    this.#drawPreconClearSave(rightX + 12, actionsTop, RIGHT_RAIL_WIDTH - 24, deck, true);

    // Middle: the pool, search field above it.
    let midY = top;
    label(this, midX, midY, "card pool", typeRole.label, surface.ink.hex, ink.label);
    midY += 16;
    midY = this.#drawFilterInput(midX, midY, midWidth);
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
    const listRect: Rect = { x: midX, y: midY, width: midWidth, height: Math.max(CARD_ROW_HEIGHT, bottom - midY) };
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
   * The pool's Pack control, Cycle button and Sort button (PR #88 step 5). One combined control would have hidden
   * which wave a pack belongs to, so: a full-width pack stepper (◂ name ▸, wrapping through "All packs") over a
   * half-width cycle button and a half-width sort button — two rows, which is what fits a 375px column. Cycle narrows
   * the packs the stepper visits; both only offer what the pool holds for this deck's aspects (`packFilterChoices`).
   */
  #drawPackAndSort(left: number, top: number, column: number, deck: Deck): number {
    let y = top;
    label(this, left, y, "pack", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const choices = packFilterChoices(POOL, this.#identity!, deck.aspects, this.#filter, PACK_INFOS);
    const apply = (next: PoolFilter): void => {
      this.#filter = next;
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

    const half = (column - CHIP_GAP) / 2;
    const cycleName = choices.cycles.find((c) => c.id === this.#filter.cycleId)?.name ?? "All waves";
    add(
      "pack:cycle",
      { x: left, y, width: half, height: hit.target },
      cycleName,
      () => apply(withCycle(this.#filter, stepChoice(choices.cycles, this.#filter.cycleId, 1), PACK_INFOS)),
      this.#filter.cycleId != null,
    );
    const sortAt = Math.max(
      0,
      SORT_CYCLE.findIndex((o) => o.sort === this.#sort),
    );
    add(
      "pack:sort",
      { x: left + half + CHIP_GAP, y, width: half, height: hit.target },
      `Sort: ${SORT_CYCLE[sortAt]!.label}`,
      () => {
        this.#sort = SORT_CYCLE[(sortAt + 1) % SORT_CYCLE.length]!.sort;
        this.#listScroll.reset();
        this.#rebuild();
      },
      this.#sort !== "default",
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

  #drawLegalityLine(left: number, top: number, column: number, deck: Deck, onDark = false): number {
    let y = top;
    const verdict = this.#campaignModel ? this.#campaignModel.validation : legalityOf(deck, POOL);
    // Campaign mode's own count (the Briefing's "N cards + M pinned", MC10 p. 3): granted lines don't count toward
    // deck size, so the legal-count line says so rather than reading a plain total that includes them.
    const cardCountText = this.#campaignModel
      ? (() => {
          const split = campaignDeckSizeSplit(this.#campaignModel!);
          const pinnedSuffix = split.pinned > 0 ? ` + ${split.pinned} pinned` : "";
          return `${split.counted} cards${pinnedSuffix}`;
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
  #drawCostCurve(left: number, top: number, column: number, deck: Deck, onDark: boolean): number {
    const stats = deckStatsOf(deck, POOL);
    const chartHeight = 74;
    drawCostCurveBars(this, { x: left, y: top, width: column, height: chartHeight }, costCurveBars(stats), onDark);
    return top + chartHeight + 16;
  }

  /** "Your deck", grouped Hero / aspect / Basic with a "+ N more" overflow (D04's right rail; the narrow layout's own stats panel). */
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
          const reason = row?.lockedReason ?? row?.refusedReason ?? null;
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
      this.#buttons.push(
        new McButton(this, {
          kind: onDark ? "onInk" : "secondary",
          label: "−",
          type: typeRole.rowTitle,
          rect,
          enabled: !locked && !frozen,
          ...(frozen
            ? { reason: this.#campaignModel?.editingDisabledReason ?? "" }
            : locked && row?.lockedReason
              ? { reason: row.lockedReason }
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
    );
    if (maxHeight === undefined || bottom - top <= maxHeight) return bottom;
    const rect: Rect = { x: left, y: top + 16, width: column, height: Math.max(hit.target * 2, maxHeight - 16) };
    const added = this.children.list.slice(before);
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
      const resetCellWidth = (column - resetRowGap) / 2;
      const preconRect: Rect = { x: left, y, width: resetCellWidth, height: hit.target };
      const clearRect: Rect = {
        x: left + resetCellWidth + resetRowGap,
        y,
        width: resetCellWidth,
        height: hit.target,
      };
      const precon = resetToPrecon(deck, this.#identity!, POOL_STARTER_DECKS);
      const doPrecon = (): void => {
        if (precon) this.#setDeck(precon);
      };
      this.#buttons.push(
        new McButton(this, {
          kind: onDark ? "onInk" : "secondary",
          label: "Preconstructed",
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
        label: this.#busy ? "Saving…" : this.#campaign ? "Save changes" : "Save deck",
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

  #drawFilterInput(left: number, top: number, column: number): number {
    const filterRect: Rect = { x: left, y: top, width: column, height: hit.target };
    if (this.#filterInput) this.#filterInput.layout(filterRect);
    else {
      this.#filterInput = new McTextInput(this, {
        rect: filterRect,
        value: this.#filterText,
        placeholder: "name, trait or type",
        onChange: (value) => {
          this.#filterText = value;
          this.#filter = { ...this.#filter, text: value };
          this.#listScroll.reset();
          this.#rebuild();
        },
      });
    }
    this.#stops.set("filter-text", { rect: filterRect, activate: () => this.#filterInput?.focus() });
    return top + hit.target + 16;
  }

  /** The pool, virtualized: `McVirtualList` owns which rows are live game objects; every card still gets a focus stop regardless of whether it's currently drawn. */
  #drawPoolList(listRect: Rect, deck: Deck, pool: readonly AnyCard[]): void {
    if (pool.length === 0) {
      this.add.text(
        listRect.x + 10,
        listRect.y + 10,
        "No cards match this filter.",
        textStyle(typeRole.body, surface.ink.hex, ink.meta),
      );
    }
    const renderRow = (index: number, rect: Rect): VirtualListRow => this.#renderCardRow(rect, deck, pool[index]!);
    this.#list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: CARD_ROW_HEIGHT,
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
          if (frozen || (row?.refused ?? false)) return;
          this.#setDeck(addCard(deck, card.id));
        },
        inspect: () => this.#inspect(card, this.#campaignRowFor(cardId)?.face ?? null),
        ensureVisible: () => list.scrollIntoView(index),
      });
    });
  }

  /**
   * The identity picker: a `McVirtualList` like the pool, so it scrolls by drag, wheel and paging. Every playable
   * identity drawn as a plain column of buttons ran far below a phone's screen with no way to reach the rest, and a
   * drag over it only moved the hover highlight. Rows are `McButton`s wired to the list's `clip`/`suppressClick`,
   * so a drag that scrolls never also picks the identity it lifts over.
   */
  #drawIdentityPicker(left: number, y: number, column: number): void {
    label(this, left, y, "pick an identity", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const { height } = this.scale.gameSize;
    const pad = formFactorFor(this.scale.gameSize.width, height) === "phone" ? 16 : 40;
    const rowHeight = IDENTITY_ROW_HEIGHT + 6;
    const listRect: Rect = {
      x: left,
      y,
      width: column,
      height: Math.min(IDENTITIES.length * rowHeight + 6, Math.max(rowHeight, height - y - pad)),
    };
    const clip = (): Rect | null => this.#list?.rect ?? null;
    const suppressClick = (): boolean => this.#list?.isDragSuppressingClick ?? false;
    const chooseAt = (index: number): void => {
      const identity = IDENTITIES[index]!;
      this.#identity = identity;
      this.#deck = newDeck(identity, POOL_CARDS, `deck-${crypto.randomUUID()}`, POOL_VERSION, new Date().toISOString());
      this.#listScroll.reset();
      this.#rebuild();
    };
    // Each row leads with the hero's own art (the picture Take your seats shows, else the identity card's scan),
    // baked small off the main thread; drawn over the button, which still takes the tap.
    const renderRow = (index: number, rect: Rect): VirtualListRow => {
      const identity = IDENTITIES[index]!;
      const buttonRect: Rect = { x: rect.x + 6, y: rect.y + 6, width: rect.width - 12, height: IDENTITY_ROW_HEIGHT };
      const thumbWidth = Math.round(IDENTITY_ROW_HEIGHT * IDENTITY_THUMB_ASPECT);
      const button = new McButton(this, {
        kind: "secondary",
        label: qualifiedHeroName(identity),
        type: typeRole.rowTitle,
        rect: buttonRect,
        onClick: () => chooseAt(index),
        clip,
        suppressClick,
        labelInset: thumbWidth,
      });
      const thumb = renderArtThumb(
        this,
        { x: buttonRect.x + 4, y: buttonRect.y + 4, width: thumbWidth - 8, height: IDENTITY_ROW_HEIGHT - 8 },
        this.#identityArtUrl(identity),
      );
      return { objects: [button.container, thumb] };
    };
    this.#list = new McVirtualList(this, {
      rect: listRect,
      rowHeight,
      count: IDENTITIES.length,
      renderRow,
      scroll: this.#listScroll,
    });
    const list = this.#list;
    list.onDestroy(cardFaces(this).onBaked(() => list.layout(list.rect)));
    IDENTITIES.forEach((identity, index) => {
      this.#stops.set(`identity:${identity.id as string}`, {
        rect: () => {
          const row = list.rectFor(index);
          return { x: row.x + 6, y: row.y + 6, width: row.width - 12, height: IDENTITY_ROW_HEIGHT };
        },
        activate: () => chooseAt(index),
        ensureVisible: () => list.scrollIntoView(index),
      });
    });
  }

  /** The identity row's picture: the hero's own art (`art/heroes/`), else the identity card's scan, else none. */
  #identityArtUrl(identity: HeroIdentityCard): string | null {
    const id = identity.id as string;
    if (!this.#identityArt.has(id)) {
      const picture = heroArtForIdentity(HERO_ART, id, POOL_CARDS);
      this.#identityArt.set(id, picture?.url ?? artFor(identity, { kind: "hero" })?.url ?? null);
    }
    return this.#identityArt.get(id) ?? null;
  }

  #renderCardRow(rect: Rect, deck: Deck, card: AnyCard): VirtualListRow {
    const row: Rect = { x: rect.x + 4, y: rect.y, width: rect.width - 8, height: CARD_ROW_HEIGHT - 6 };
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
        { x: row.x + 6, y: row.y + 6, width: CARD_THUMB_WIDTH, height: row.height - 12 },
        artFor(card, { kind: "front" })?.url ?? null,
        0,
      ),
    );
    const textX = row.x + 6 + CARD_THUMB_WIDTH + 10;
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
    const minusDisabledReason = frozen
      ? (this.#campaignModel?.editingDisabledReason ?? undefined)
      : campaignRow?.lockedReason;
    const doRemove = (): void => this.#setDeck(removeCard(deck, card.id));
    const minusButton = new McButton(this, {
      kind: "secondary",
      label: "−",
      type: typeRole.rowTitle,
      rect: minusRect,
      enabled: quantity > 0 && !(campaignRow?.locked ?? false) && !frozen,
      ...(minusDisabledReason ? { reason: minusDisabledReason } : {}),
      onClick: doRemove,
      clip,
      suppressClick,
    });
    objects.push(minusButton.container);

    const plusDisabledReason = frozen
      ? (this.#campaignModel?.editingDisabledReason ?? undefined)
      : (campaignRow?.refusedReason ?? undefined);
    const plusRect: Rect = { x: row.x + row.width - 46, y: minusRect.y, width: 40, height: hit.target };
    const doAdd = (): void => this.#setDeck(addCard(deck, card.id));
    const plusButton = new McButton(this, {
      kind: "secondary",
      label: "+",
      type: typeRole.rowTitle,
      rect: plusRect,
      enabled: !(campaignRow?.refused ?? false) && !frozen,
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
    if (rebuild) this.#rebuild();
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
    await deckStorage().put(this.#deck);
    this.#savedDeckId = this.#deck.id as string;
    this.#busy = false;
    this.#status = "Saved.";
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

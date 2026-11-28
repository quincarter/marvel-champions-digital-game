/**
 * Deck check (W1, docs/phase4-screen-gaps.md §3, P04/D04): a deck's resource curve, composition, legality and full card
 * list at a glance, with "Edit deck" back into the builder and "Start game ▸" into the setup flow — reached from the
 * Decks screen's "Check" button on every row and from Seats' "Deck check ▸" for the active seat.
 *
 * Wide (D04's own three columns, read-only; `view/deck-check-layout.ts` has the accounting): an ink header (Back,
 * "HERO — ASPECT", a green/red "N CARDS · LEGAL" badge) over a rail (aspect tiles with their tips, the type filter chips,
 * the cost curve pinned at its foot), the deck's own cards (`mc-card-sections`) and the ink "YOUR DECK" list
 * (`mc-line-list`) with Edit deck and Start game ▸ at its foot. Narrow (P04): a "YOUR DECK · N" header, a Curve / Cards /
 * Aspect tab strip and a footer with Edit deck and Start game ▸. The Curve tab's bars are one chart (`mc-bar-chart`,
 * its commonest cost in red) rather than the Phaser screen's per-bucket rainbow.
 *
 * Everything under the header is Lit panels over the canvas (`dom/dom-region.ts`): one sheet for the header, the rail,
 * the panel, the tabs and the footer (with the kit's stat tiles, bar chart and line list as sheet parts), and the card
 * sections as a panel of their own over it, scrolling natively. The scene keeps the focus route (ring in the panel
 * layer) and the card hover popover. The card list's one action is Inspect: a tap opens it.
 *
 * Every number comes from `view/deck-stats.ts` and `@mc/engine`'s own legality verdict (`view/deck-list-model.ts`): this
 * scene only draws what those computed. The rail's type filter chips are a display filter only, like the builder's.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { BarChartBar, CardCellModel, CardSection, McCardSections, McSheet, PictureSource, StatTile } from "@mc/ui";
import type { CoreAspect, Deck } from "@mc/content";
import { POOL_VERSION, currentCardsById, currentDeps, currentPool } from "../content/pool.js";
import { artFor, artLanguageNow, type ArtSource } from "../art/art-source.js";
import { PackLeases, refreshPackArt } from "../art/pack-art.js";
import { SELECTABLE_ASPECTS } from "../view/deck-builder-model.js";
import {
  costCurveBars,
  deckCountText,
  deckListGroupsOf,
  outsideDeckGroupsOf,
  deckListSortLabel,
  nextDeckListSort,
  deckStatsOf,
  filterDeckListGroups,
  type DeckListEntry,
  type DeckListGroup,
  type DeckListSort,
  type PlayerCardType,
} from "../view/deck-stats.js";
import { deckFaceGroupLayout, deckFaceGroups } from "../view/deck-faces.js";
import { deckOptionOf } from "../view/deck-list-model.js";
import { identityLabelOf } from "../view/deck-names.js";
import { addCommunityDeck, testedEntryOf } from "../view/community-decks-model.js";
import { onArtChange, onLanguageChange } from "../language-change.js";
import { testedCatalog } from "../view/seatable-decks.js";
import { deckStatusOf, type DeckStatusTone } from "../view/deck-status.js";
import type { CampaignDeckVerdict } from "../view/campaign-deck-edit-model.js";
import { aspectLabelOf } from "../view/seat-slots.js";
import { deckCheckFocusOrder } from "../view/screen-focus.js";
import { deckCheckLayout, type DeckCheckLayout, type DeckCheckTab } from "../view/deck-check-layout.js";
import { poolGridGeometry } from "../view/deck-pool-grid.js";
import { appSession } from "../session.js";
import { cardSizeFactor } from "../settings.js";
import { CHIP_GAP, wrapChipsToRows } from "../view/chip-layout.js";
import type { Rect } from "../view/layout.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { deckBuilderView, rememberDeckListSort } from "../platform/deck-builder-view.js";
import { accent, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { costPipColor } from "../ui/deck-stats-widgets.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import type { DeckBuilderSceneData } from "./deck-builder.js";
import { SCENES, type SceneKey } from "./keys.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { tipPlacement, tipWidthFor } from "../dom/aspect-tip-sheet.js";
import { aspectTipContentOf } from "../view/aspect-tip-model.js";
import { t, type MessageKey } from "../i18n/translate.js";
import { cardTypeWordOf } from "../view/card-type-word.js";
import { aspectName } from "../view/aspect-stamp.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder, sheetColor } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { isDesktopType } from "../ui/desktop-type.js";

/** The sort control: wide enough for its longest words, "Sort: Aspect". */
const SORT_WIDTH = 132;

export interface DeckCheckSceneData {
  readonly deck: Deck;
  /** Where Back returns — defaults to the Decks screen, so a caller that only has a deck can still open this. */
  readonly returnTo?: { readonly scene: SceneKey; readonly data?: object };
  /**
   * "Start game ▸"'s handler; W2's Seats supplies one that continues to Table setup. It receives *this* scene so
   * the handler can `from.scene.start(...)` and thereby stop Deck check — a closure over the caller's own (already
   * stopped) scene would start the next screen underneath this one. Absent: Start game draws unavailable with its
   * reason rather than being omitted.
   */
  readonly onStartGame?: (from: Phaser.Scene) => void;
  /** The count and status to show instead of the loose-deck rules': a campaign deck is judged by its campaign. */
  readonly verdict?: CampaignDeckVerdict;
  /** The narrow layout's tab to open on (dev jumps and tests); defaults to Curve. */
  readonly tab?: DeckCheckTab;
}

/** How tall a group-header slot is, and the room a face tile's caption takes (as `view/deck-faces.ts`). */
const FACES_INSET = 4;
const RAIL_CHIP_HEIGHT = 26;
/** Matches `scenes/deck-builder.ts`'s own `STATS_LIST_ENTRY_CAP` for its identical right rail. */
const PANEL_LIST_ENTRY_CAP = 12;
const CURVE_CARD_HEIGHT = 150;
const PAGE = 0.85;

const TONE_COLOR: Readonly<Record<DeckStatusTone, number>> = {
  legal: signal.heal.hex,
  illegal: accent.heroRed.hex,
  unscripted: signal.caution.hex,
  poolChanged: signal.caution.hex,
};

/** D04's own left-rail filter chips: the same seven `scenes/deck-builder.ts`'s `TYPE_FILTERS` offers. */
const TYPE_FILTERS: readonly {
  readonly id: string;
  readonly label: MessageKey;
  readonly type: PlayerCardType | null;
}[] = [
  { id: "all", label: "deckCheck.all", type: null },
  { id: "ally", label: "cardType.ally", type: "ally" },
  { id: "event", label: "cardType.event", type: "event" },
  { id: "upgrade", label: "cardType.upgrade", type: "upgrade" },
  { id: "support", label: "cardType.support", type: "support" },
  { id: "resource", label: "cardType.resource", type: "resource" },
  { id: "scheme", label: "cardType.sideScheme", type: "player_side_scheme" },
];

/** One flattened, unwrapped line of a card's rules text, for a cell's own short strip — the full text is a tap away, in Inspect. */
function truncate(text: string, maxChars: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > maxChars ? `${flat.slice(0, maxChars - 1)}…` : flat;
}

/**
 * What "Edit deck" opens. A tested community deck is an offer, never stored, so the builder gets the player's own
 * editable copy of it (a new id, credited to its MarvelCDB decklist) rather than a deck it would save under the
 * offer's id. Any other deck is edited as it is.
 */
function editableCopyOf(deck: Deck): Deck {
  const entry = testedEntryOf(deck, testedCatalog());
  return entry
    ? addCommunityDeck(entry, {
        poolVersion: POOL_VERSION,
        now: () => new Date().toISOString(),
        newId: () => crypto.randomUUID(),
      })
    : deck;
}

export class DeckCheckScene extends Phaser.Scene {
  #deck!: Deck;
  #returnTo!: { readonly scene: SceneKey; readonly data?: object };
  #deckSort: DeckListSort = "aspect";
  #onStartGame: ((from: Phaser.Scene) => void) | undefined;
  #verdict: DeckCheckSceneData["verdict"];
  #activeTab: DeckCheckTab = "curve";
  /** Wide only: the rail's own type filter, applied to the grid (a display filter, never a deckbuilding rule). */
  #typeFilter: PlayerCardType | null = null;
  #alive = false;
  #sheet: DomRegion<McSheet> | null = null;
  #cards: DomRegion<McCardSections> | null = null;
  readonly #leases = new PackLeases();
  #actions = new Map<string, () => void>();
  #route: FocusRoute | null = null;
  #glyphs!: SheetGlyphs;
  #stops = new Map<string, FocusStop>();
  /** Which aspect tile's inline tip is open, if any — wide only. */
  #aspectTipOpen: CoreAspect | null = null;
  /** The open aspect tip, laid out and drawn last so it stays above the controls below its row. */
  #pendingTip: { readonly rect: Rect; readonly text: string; readonly viewport: Rect } | null = null;
  #hover: HoverPreview | null = null;
  /** The cards' box on screen: what a hover popover is clipped to. */
  #view: Rect = { x: 0, y: 0, width: 0, height: 0 };
  /** The face each face tile shows, by its `face:<id>` key, for the hover popover and Inspect. */
  #faces = new Map<string, { readonly cardId: string; readonly face: object }>();
  /** The cards list reads from its top on the next compose (a new filter, sort or tab). */
  #fromTop = false;
  #leaving = false;

  constructor() {
    super(SCENES.deckCheck);
  }

  create(data: DeckCheckSceneData): void {
    this.#alive = true;
    this.#leaving = false;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#deck = data.deck;
    this.#returnTo = data.returnTo ?? { scene: SCENES.decks };
    this.#deckSort = deckBuilderView().deckSort;
    this.#onStartGame = data.onStartGame;
    this.#verdict = data.verdict;
    this.#activeTab = data.tab ?? "curve";
    this.#typeFilter = null;
    this.#aspectTipOpen = null;
    this.#sheet = null;
    this.#cards = null;
    this.#glyphs = new SheetGlyphs(this, () => this.#compose());
    this.scale.on("resize", this.#compose, this);
    // A pack picture that resolves later, or a card language switch (#390), reads the screen again.
    const artOff = onArtChange(() => {
      if (this.sys.isActive()) this.#compose();
    });
    const languageOff = onLanguageChange(() => {
      if (this.sys.isActive()) this.#compose();
    });
    resetHoverCards(this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCards(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#compose, this);
      artOff();
      languageOff();
      this.#hover?.destroy();
      this.#hover = null;
      this.#glyphs.dispose();
      this.#leases.dispose();
      this.#sheet = null;
      this.#cards = null;
    });
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.scene.isActive(SCENES.inspect),
      onCancel: () => {
        // An open aspect tip closes first; the next B leaves.
        if (this.#aspectTipOpen !== null) {
          this.#aspectTipOpen = null;
          this.#compose();
        } else this.#stops.get("back")?.activate();
      },
      // LB / RB step Curve, Cards and Aspect on a narrow screen; the wide layout has no strip, so they page the cards.
      onTab: (direction) => {
        if (this.#wide()) {
          this.#page(direction);
          return;
        }
        const order: readonly DeckCheckTab[] = ["curve", "cards", "aspect"];
        const next = order[order.indexOf(this.#activeTab) + direction];
        if (next) this.#setTab(next);
      },
      onScroll: (_dx, dy) => this.#cards?.element.scroller?.scrollBy({ top: dy }),
      onPage: (direction) => this.#page(direction),
      onHomeEnd: (edge) =>
        this.#cards?.element.scroller?.scrollTo({ top: edge === "home" ? 0 : Number.MAX_SAFE_INTEGER }),
    });
    this.#compose();
    fadeScreenIn(this);
  }

  #wide(): boolean {
    const { width, height } = this.scale.gameSize;
    return deckCheckLayout({ width, height }).wide;
  }

  #page(direction: 1 | -1): void {
    const scroller = this.#cards?.element.scroller;
    scroller?.scrollBy({ top: direction * scroller.clientHeight * PAGE });
  }

  #setTab(tab: DeckCheckTab): void {
    if (tab === this.#activeTab) return;
    this.#activeTab = tab;
    this.#fromTop = true;
    this.#compose();
  }

  #goBack(): void {
    if (this.#leaving) return;
    this.#leaving = true;
    goToScreen(this, this.#returnTo.scene, this.#returnTo.data);
  }

  /** Back in the builder when it opened this screen, on the deck it handed over; else a builder opened on this deck. */
  #edit(): void {
    if (this.#leaving) return;
    this.#leaving = true;
    if (this.#returnTo.scene === SCENES.deckBuilder) goToScreen(this, SCENES.deckBuilder, this.#returnTo.data);
    else goToScreen(this, SCENES.deckBuilder, { deck: editableCopyOf(this.#deck) } satisfies DeckBuilderSceneData);
  }

  #sort(): void {
    this.#deckSort = nextDeckListSort(this.#deckSort);
    rememberDeckListSort(this.#deckSort);
    this.#fromTop = true;
    this.#compose();
  }

  #inspectFace(key: string): void {
    const found = this.#faces.get(key);
    if (found) this.scene.launch(SCENES.inspect, { card: { cardId: found.cardId, face: found.face } });
  }

  #inspect(entry: DeckListEntry): void {
    this.scene.launch(SCENES.inspect, { card: { cardId: entry.cardId, face: { kind: "front" } } });
  }

  #liveRect(region: DomRegion<McSheet> | DomRegion<McCardSections> | null, key: string, fallback: Rect): Rect {
    const found = (region?.element as { elementOf(key: string): HTMLElement | null } | undefined)?.elementOf(key);
    return found && region ? region.rectOf(found) : fallback;
  }

  #wire<E extends McSheet | McCardSections>(element: E, rect: Rect): DomRegion<E> {
    element.addEventListener("mc-activate", (event) => {
      if (this.#leaving) return;
      this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
    });
    element.addEventListener("mc-image-error", (event) => {
      const { key, src } = (event as CustomEvent<{ key?: string; src: string | null }>).detail;
      if (key) refreshPackArt(key, src ?? undefined);
    });
    const region = new DomRegion<E>(this, element, rect);
    // The hover popover is drawn in the canvas, so its box is left out of the panel.
    region.forwardMouseMoves(() => this.#hover?.suppress());
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
    return region;
  }

  /** A scan's picture: its URL (held while shown) cropped toward the top, where a card's art and title sit. */
  #pictureOf(source: ArtSource | null): PictureSource {
    const held = this.#leases.image(source);
    return {
      src: held.src,
      cover: { x: 0.5, y: 0.2 },
      missing: t("deckCheck.noScan"),
      ...(held.retry !== undefined ? { retry: held.retry } : {}),
    };
  }

  /** Builds the panels from the deck and the filters, and the focus stops that walk them. */
  #compose(): void {
    if (!this.#alive) return;
    this.#actions = new Map();
    this.#stops = new Map();
    this.#faces = new Map();
    this.#glyphs.reset();
    this.#leases.begin();
    resetHoverCards(this);
    const { width, height } = this.scale.gameSize;
    const layout = deckCheckLayout({ width, height });
    const option = deckOptionOf(this.#deck, currentPool(), POOL_VERSION, currentDeps());
    const stats = deckStatsOf(this.#deck, currentPool());
    // The Curve and Aspect tabs read the deck by aspect whatever the card list's sort.
    const groups = deckListGroupsOf(this.#deck, currentPool(), undefined, false, artLanguageNow());
    const sorted = deckListGroupsOf(this.#deck, currentPool(), this.#deckSort, true, artLanguageNow());
    const status = this.#verdict?.status ?? deckStatusOf(option, artLanguageNow());
    const inFlow = this.#returnTo.scene === SCENES.seats;

    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    // Ground: paper body under the same full-width ink header bar every setup-flow screen shares.
    b.box({ x: 0, y: 0, width, height }, { fill: surface.paper.hex });
    b.dots({ x: 0, y: layout.headerBar.height, width, height: height - layout.headerBar.height }, "paper", 6, 1, 0.1);
    b.box(layout.headerBar, { fill: surface.ink.hex });
    this.#glyphs.button(b, {
      key: "back",
      rect: layout.back,
      label: this.#returnTo.scene === SCENES.seats ? t("deckCheck.backToSeats") : t("scenario.back"),
      look: "onInk",
      type: typeRole.backLabel,
      ids: ["cancel"],
      ground: "ink",
    });
    this.#actions.set("back", () => this.#goBack());
    this.#stops.set("back", { rect: layout.back, activate: () => this.#goBack() });
    const titleX = layout.back.x + layout.back.width + 16;
    if (layout.wide) this.#drawWideHeader(b, titleX, layout, identityLabelOf(option), stats, status);
    else this.#drawNarrowHeader(b, titleX, layout, stats, status, inFlow);

    let cardRect: Rect | null = null;
    let cardGroups: readonly DeckListGroup[] = [];
    let sortRect: Rect | null = null;
    if (layout.wide) {
      cardRect = layout.cards!;
      cardGroups = filterDeckListGroups(sorted, this.#typeFilter);
      this.#drawRail(b, layout.rail!, stats, { x: 0, y: 0, width, height });
      sortRect = this.#drawPanel(b, layout.panel!, layout.editDeck, layout.startGame, sorted);
    } else {
      const tabs = layout.tabs!;
      const tabList = [
        { id: "curve", label: t("deckCheck.tabCurve") },
        { id: "cards", label: t("deckCheck.tabCards") },
        { id: "aspect", label: t("deckCheck.tabAspect") },
      ] as const;
      b.tabRail(
        tabs,
        tabList.map((tab) => ({ id: tab.id, label: tab.label, selected: tab.id === this.#activeTab })),
        { prefix: "tab:" },
      );
      const tabWidth = tabs.width / 3;
      tabList.forEach((tab, index) => {
        const go = (): void => this.#setTab(tab.id);
        this.#actions.set(`tab:${tab.id}`, go);
        this.#stops.set(`tab:${tab.id}`, {
          rect: { ...tabs, x: tabs.x + tabWidth * index, width: tabWidth },
          activate: go,
        });
      });
      const content = layout.content!;
      if (this.#activeTab === "curve") this.#drawCurveTab(b, content, stats, groups);
      else if (this.#activeTab === "aspect") this.#drawAspectTab(b, content, groups);
      else {
        sortRect = { x: content.x, y: content.y, width: SORT_WIDTH, height: hit.target };
        const top = content.y + hit.target + 8;
        cardRect = { ...content, y: top, height: Math.max(0, content.y + content.height - top) };
        cardGroups = sorted;
        this.#drawSortButton(b, sortRect, "secondary");
      }
      b.box(layout.footer!, { fill: surface.ink.hex });
      this.#drawActions(b, layout.editDeck, layout.startGame);
    }

    this.#drawAspectTipPlate(b);

    const full: Rect = { x: 0, y: 0, width, height };
    const sheet = (this.#sheet ??= this.#wire(document.createElement("mc-sheet") as McSheet, full));
    sheet.setRect(full);
    sheet.element.nodes = b.nodes;
    renderNow(sheet.element);

    let cardIds: readonly string[] = [];
    let faceIds: readonly string[] = [];
    if (cardRect && cardRect.height > 0) {
      const mounted = this.#mountCards(cardRect, cardGroups);
      cardIds = mounted.cardIds;
      faceIds = mounted.faceIds;
    } else {
      this.#cards?.setHidden(true);
      this.#view = { x: 0, y: 0, width: 0, height: 0 };
    }
    // The sheet's buttons keep their fixed rects; the sort button lives where it was drawn.
    this.#route?.set(
      deckCheckFocusOrder({
        wide: layout.wide,
        activeTab: this.#activeTab,
        cardIds,
        faceIds,
        filterChipIds: layout.wide ? TYPE_FILTERS.map((f) => f.id) : [],
        showSort: layout.wide || this.#activeTab === "cards",
      }),
      this.#stops,
    );
    this.#leases.end();
    this.#hover?.onDraw();
  }

  // ------------------------------------------------------------------------------------------------------------
  // Header: wide draws D04's own "HERO — ASPECT" title and green/red "N CARDS · LEGAL" badge; narrow draws P04's
  // own "YOUR DECK · N" title and step fraction — two real, different headers rather than one shape stretched.
  // ------------------------------------------------------------------------------------------------------------
  #drawWideHeader(
    b: SheetBuilder,
    titleX: number,
    layout: DeckCheckLayout,
    identityName: string | null | undefined,
    stats: ReturnType<typeof deckStatsOf>,
    status: ReturnType<typeof deckStatusOf>,
  ): void {
    const count = this.#verdict?.count ?? deckCountText(stats, artLanguageNow());
    const badgeText = `${count.toUpperCase()} · ${status.text.toUpperCase()}`;
    const badgeType = { ...typeRole.barTitle, size: 18 };
    const badgeWidth = Math.ceil(b.measure(badgeText, badgeType).width) + 24;
    const badge: Rect = {
      x: layout.headerBar.width - 16 - badgeWidth,
      y: (layout.headerBar.height - 32) / 2,
      width: badgeWidth,
      height: 32,
    };
    b.box(badge, { fill: TONE_COLOR[status.tone] });
    b.text(badge.x + badge.width / 2, badge.y + badge.height / 2, badgeText, badgeType, {
      color: surface.paper.hex,
      origin: [0.5, 0.5],
    });
    const title = `${identityName ?? t("deckCheck.unknown")} — ${aspectLabelOf(this.#deck.aspects, artLanguageNow()).toUpperCase()}`;
    b.text(titleX, layout.headerBar.height / 2, title, typeRole.pageTitle, {
      color: surface.paper.hex,
      origin: [0, 0.5],
      // Clear of the dark mode toggle at the bar's centre when there is room left of it (a tablet's long title shrinks).
      fitWidth: Math.min(badge.x - titleX - 16, Math.max(260, layout.headerBar.width / 2 - 30 - titleX)),
    });
  }

  #drawNarrowHeader(
    b: SheetBuilder,
    titleX: number,
    layout: DeckCheckLayout,
    stats: ReturnType<typeof deckStatsOf>,
    status: ReturnType<typeof deckStatusOf>,
    inFlow: boolean,
  ): void {
    // On a phone the title sits below the dark mode tab that hangs from the top edge, as Scenario select's does.
    const phone = layout.headerBar.width < 600;
    b.text(
      titleX,
      phone ? 44 : layout.headerBar.height / 2,
      t("deckCheck.yourDeckCount", { count: this.#verdict?.counted ?? stats.countedCards }),
      typeRole.pageTitle,
      {
        color: surface.paper.hex,
        origin: [0, 0.5],
        fitWidth: layout.meta.x - titleX - 12,
        ...(phone ? { size: 18 } : {}),
      },
    );
    const count = this.#verdict?.count ?? deckCountText(stats, artLanguageNow());
    const metaWords = inFlow ? "3/4" : `${count.toUpperCase()} · ${status.text.toUpperCase()}`;
    b.text(layout.meta.x + layout.meta.width, layout.headerBar.height / 2, metaWords, typeRole.label, {
      color: surface.paper.hex,
      alpha: ink.label,
      origin: [1, 0.5],
      fitWidth: layout.meta.width,
    });
  }

  /**
   * The open aspect tip as a plate over everything: below its row, or above where there is no room, clamped inside the
   * screen and wrapped to its width (`tipPlacement`). It takes the presses on it (a tap shuts it), so none reaches the
   * filter chips or the chart beneath.
   */
  #drawAspectTipPlate(b: SheetBuilder): void {
    const open = this.#pendingTip;
    this.#pendingTip = null;
    if (!open) return;
    const width = tipWidthFor(open.viewport);
    const size = b.measure(open.text, typeRole.body, { wrapWidth: width - 20 });
    const placement = tipPlacement(open.rect, Math.ceil(size.height) + 20, open.viewport, width);
    const box = placement.panel;
    b.box(box, { fill: surface.card.hex, stroke: surface.ink.hex, strokeWidth: 2 });
    b.text(box.x + 10, box.y + 10, open.text, typeRole.body, { color: surface.ink.hex, wrapWidth: width - 20 });
    const key = "aspect-tip-plate";
    b.tap(key, box);
    this.#actions.set(key, () => {
      this.#aspectTipOpen = null;
      this.#compose();
    });
  }

  // ------------------------------------------------------------------------------------------------------------
  // The left rail (wide only, D04): aspect tiles (read-only, with their tips), the type filter chips (filtering the
  // cards, never the deck), and the cost curve pinned at the rail's foot.
  // ------------------------------------------------------------------------------------------------------------
  #drawRail(b: SheetBuilder, rect: Rect, stats: ReturnType<typeof deckStatsOf>, viewport: Rect): void {
    const left = rect.x;
    const column = rect.width;
    let y = rect.y;
    const labelOf = (text: string, at: number): void => {
      b.text(left, at, text, typeRole.label, { color: surface.ink.hex, alpha: ink.label });
    };
    labelOf(t("deckCheck.aspect"), y);
    y += 16;
    const aspectGap = 7;
    let tip: { readonly rect: Rect; readonly text: string } | null = null;
    SELECTABLE_ASPECTS.forEach((aspect, index) => {
      const full: Rect = { x: left, y: y + index * (hit.target + aspectGap), width: column, height: hit.target };
      const content = aspectTipContentOf(aspect);
      // G10b's tip: an "i" segment at the tile's right-hand end opens it. The tiles are read-only, so it only opens the tip.
      const info: Rect | null = content
        ? { x: full.x + full.width - hit.target, y: full.y, width: hit.target, height: full.height }
        : null;
      const tile: Rect = info ? { ...full, width: full.width - hit.target } : full;
      const chosen = this.#deck.aspects.includes(aspect);
      b.box(tile, {
        ...(chosen ? { fill: signal.heal.hex } : {}),
        stroke: surface.ink.hex,
        strokeWidth: 2,
        ...(chosen ? {} : { alpha: 0.7 }),
      });
      b.text(
        tile.x + 11,
        tile.y + tile.height / 2,
        aspectName(aspect, artLanguageNow()).toUpperCase(),
        typeRole.barTitle,
        {
          size: 16,
          color: chosen ? surface.paper.hex : surface.ink.hex,
          alpha: chosen ? 1 : ink.disabled,
          origin: [0, 0.5],
          fitWidth: tile.width - 22,
        },
      );
      if (content && info) {
        const open = this.#aspectTipOpen === aspect;
        const key = `aspect-info:${aspect}`;
        b.button({
          key,
          rect: info,
          label: "i",
          look: "secondary",
          selected: open,
          aria: content.title,
          type: typeRole.rowTitle,
        });
        this.#actions.set(key, () => {
          this.#aspectTipOpen = open ? null : aspect;
          this.#compose();
        });
        if (open) tip = { rect: full, text: `${content.title}. ${content.tagline}. ${content.tipLine}` };
      }
    });
    y += SELECTABLE_ASPECTS.length * (hit.target + aspectGap) + 3;
    // Drawn last (`#drawAspectTipPlate`), over everything, so the chips and chart below it never paint over its words.
    this.#pendingTip = tip === null ? null : { ...(tip as { rect: Rect; text: string }), viewport };
    b.box({ x: left, y, width: column, height: 3 }, { fill: surface.ink.hex });
    y += 16;

    labelOf(t("deckCheck.filter"), y);
    y += 16;
    const chipRows = wrapChipsToRows(
      TYPE_FILTERS.map((f) => ({ id: f.id, text: t(f.label) })),
      column,
    );
    const activeFilterId = TYPE_FILTERS.find((f) => f.type === this.#typeFilter)?.id ?? "all";
    chipRows.forEach((row, rowIndex) => {
      const cellWidth = (column - (row.length - 1) * CHIP_GAP) / row.length;
      row.forEach((chip, index) => {
        const def = TYPE_FILTERS.find((f) => f.id === chip.id)!;
        const chipRect: Rect = {
          x: left + index * (cellWidth + CHIP_GAP),
          y: y + rowIndex * (RAIL_CHIP_HEIGHT + CHIP_GAP),
          width: cellWidth,
          height: RAIL_CHIP_HEIGHT,
        };
        const apply = (): void => {
          this.#typeFilter = def.type;
          this.#fromTop = true;
          this.#compose();
        };
        const key = `filter:${chip.id}`;
        b.button({
          key,
          rect: chipRect,
          label: t(def.label),
          look: "secondary",
          type: typeRole.label,
          selected: chip.id === activeFilterId,
        });
        this.#actions.set(key, apply);
        this.#stops.set(key, { rect: chipRect, activate: apply });
      });
    });

    // The cost curve, pinned at the rail's foot regardless of how tall the groups above ended up.
    const chartHeight = 74;
    const curveTop = rect.y + rect.height - 16 - chartHeight;
    labelOf(t("deckCheck.costCurve"), curveTop);
    b.barChart({ x: left, y: curveTop + 16, width: column, height: chartHeight }, this.#barsOf(stats));
  }

  /** The cost curve as bars, its commonest cost standing out in red (or, with `rainbow`, each in its cost's own hue). */
  #barsOf(stats: ReturnType<typeof deckStatsOf>, rainbow = false): readonly BarChartBar[] {
    const bars = costCurveBars(stats);
    const peak = Math.max(0, ...bars.map((bar) => bar.count));
    return bars.map((bar, cost) => ({
      label: bar.label,
      count: bar.count,
      highlight: !rainbow && peak > 0 && bar.count === peak,
      // P04's per-bucket bars: each in its own printed-cost hue.
      ...(rainbow ? { tint: sheetColor(costPipColor(cost), "fill") } : {}),
    }));
  }

  /** The card list's sort (issue #594), the builder's own kept setting. */
  #drawSortButton(b: SheetBuilder, rect: Rect, look: "onInk" | "secondary"): void {
    b.button({
      key: "deck-sort",
      rect,
      label: deckListSortLabel(this.#deckSort, artLanguageNow()),
      look,
      type: typeRole.label,
    });
    this.#actions.set("deck-sort", () => this.#sort());
    this.#stops.set("deck-sort", { rect, activate: () => this.#sort() });
  }

  /** Edit deck and Start game ▸, the foot of the panel (wide) or the footer (narrow). */
  #drawActions(b: SheetBuilder, editRect: Rect, startRect: Rect): void {
    b.button({ key: "edit-deck", rect: editRect, label: t("deckCheck.editDeck"), look: "onInk", type: typeRole.label });
    this.#actions.set("edit-deck", () => this.#edit());
    this.#stops.set("edit-deck", { rect: editRect, activate: () => this.#edit() });
    const canStart = this.#onStartGame !== undefined;
    b.button({
      key: "start",
      rect: startRect,
      label: t("deckCheck.startGame"),
      look: "primary",
      type: typeRole.barTitle,
      ...(canStart ? {} : { disabled: t("deckCheck.startUnavailable") }),
    });
    const start = (): void => {
      if (this.#leaving) return;
      this.#leaving = true;
      this.#onStartGame?.(this);
    };
    this.#actions.set("start", start);
    this.#stops.set("start", { rect: startRect, activate: start });
  }

  // ------------------------------------------------------------------------------------------------------------
  // The right ink panel (wide only, D04): "YOUR DECK", the grouped list (`mc-line-list`), then Edit deck and Start
  // game ▸ pinned at the panel's foot.
  // ------------------------------------------------------------------------------------------------------------
  #drawPanel(b: SheetBuilder, rect: Rect, editRect: Rect, startRect: Rect, groups: readonly DeckListGroup[]): Rect {
    b.box(rect, { fill: surface.ink.hex });
    const left = rect.x + 16;
    const column = rect.width - 32;
    b.text(left, rect.y + 16, t("deckCheck.yourDeck").toUpperCase(), typeRole.label, {
      color: surface.paper.hex,
      alpha: ink.secondary,
    });
    const sortRect: Rect = { x: left + column - SORT_WIDTH, y: rect.y + 8, width: SORT_WIDTH, height: hit.target };
    this.#drawSortButton(b, sortRect, "onInk");
    // The first lines up to the cap, the rest as "+ N more".
    let room = PANEL_LIST_ENTRY_CAP;
    let more = 0;
    const lines = groups
      .map((group) => {
        const shown = group.entries.slice(0, Math.max(0, room));
        room -= shown.length;
        more += group.entries.length - shown.length;
        return {
          label: `${group.label} · ${group.count}`,
          entries: shown.map((entry) => ({
            name: entry.name,
            quantity: entry.quantity,
            hover: entry.cardId as string,
          })),
        };
      })
      .filter((group) => group.entries.length > 0);
    const listTop = rect.y + 16 + hit.target;
    b.lineList({ x: left, y: listTop, width: column, height: Math.max(0, editRect.y - 8 - listTop) }, lines, true);
    if (more > 0) {
      b.text(left, editRect.y - 28, t("deckList.more", { count: more }), typeRole.label, {
        color: surface.paper.hex,
        alpha: ink.label,
      });
    }
    this.#drawActions(b, editRect, startRect);
    return sortRect;
  }

  // ------------------------------------------------------------------------------------------------------------
  // Narrow's Curve tab (P04): the "RESOURCE CURVE" card, three sample tiles (Resources/Allies/Events), then the deck's
  // lines that fit under them (the rest are "+ N more"; the full list lives on Cards).
  // ------------------------------------------------------------------------------------------------------------
  #drawCurveTab(
    b: SheetBuilder,
    rect: Rect,
    stats: ReturnType<typeof deckStatsOf>,
    groups: readonly DeckListGroup[],
  ): void {
    const chart: Rect = { x: rect.x, y: rect.y, width: rect.width, height: CURVE_CARD_HEIGHT };
    b.box(chart, { fill: surface.card.hex, stroke: surface.ink.hex, strokeWidth: 3 });
    b.text(chart.x + 12, chart.y + 10, t("deckCheck.resourceCurve"), typeRole.barTitle, {
      size: 18,
      color: surface.ink.hex,
    });
    if (stats.averageCost !== null) {
      b.text(
        chart.x + chart.width - 12,
        chart.y + 20,
        t("deckCheck.average", { avg: stats.averageCost.toFixed(1) }),
        typeRole.label,
        {
          color: surface.ink.hex,
          alpha: ink.meta,
          origin: [1, 0.5],
        },
      );
    }
    b.barChart(
      { x: chart.x + 12, y: chart.y + 38, width: chart.width - 24, height: chart.height - 44 },
      this.#barsOf(stats, true),
    );
    let y = chart.y + chart.height + 12;
    const tile = (label: string, count: number): StatTile => ({ id: label, text: `${label} ${count}` });
    const tiles: readonly StatTile[] = [
      tile(t("deckTypes.resource"), stats.countsByType.resource ?? 0),
      tile(t("deckTypes.ally"), stats.countsByType.ally ?? 0),
      tile(t("deckTypes.event"), stats.countsByType.event ?? 0),
    ];
    b.statTiles({ x: rect.x, y, width: rect.width, height: 46 }, [tiles]);
    y += 46 + 12;
    // As many lines as the tab has room for (at least three), the rest named by a "+ N more" that points at Cards.
    const all = groups.flatMap((g) => g.entries);
    const room = Math.floor((rect.y + rect.height - y) / 32);
    const fit = Math.max(3, all.length > room ? room - 1 : room);
    for (const entry of all.slice(0, fit)) {
      const row: Rect = { x: rect.x, y, width: rect.width, height: 26 };
      b.box(row, { fill: surface.card.hex, stroke: surface.ink.hex, strokeWidth: 2 });
      b.box(
        { x: row.x, y: row.y, width: 26, height: row.height },
        {
          fill: entry.cost !== null ? costPipColor(entry.cost) : surface.ink.hex,
        },
      );
      if (entry.cost !== null) {
        b.text(row.x + 13, row.y + 13, String(entry.cost), typeRole.rowTitle, {
          color: surface.paper.hex,
          origin: [0.5, 0.5],
        });
      }
      b.text(row.x + 34, row.y + 13, entry.name, typeRole.body, {
        color: surface.ink.hex,
        origin: [0, 0.5],
        fitWidth: row.width - 34 - 50,
      });
      b.text(row.x + row.width - 10, row.y + 13, `×${entry.quantity}`, typeRole.label, {
        color: surface.ink.hex,
        alpha: ink.secondary,
        origin: [1, 0.5],
      });
      y += 32;
    }
    if (all.length > fit) {
      b.text(rect.x, y + 4, t("deckList.more", { count: all.length - fit }), typeRole.label, {
        color: surface.ink.hex,
        alpha: ink.label,
      });
    }
  }

  #drawAspectTab(b: SheetBuilder, rect: Rect, groups: readonly DeckListGroup[]): void {
    b.text(rect.x, rect.y, t("deckCheck.composition"), typeRole.label, { color: surface.ink.hex, alpha: ink.label });
    if (groups.length === 0) {
      b.text(rect.x, rect.y + 20, t("deckCheck.noCards"), typeRole.body, { color: surface.ink.hex, alpha: ink.meta });
      return;
    }
    const tiles: StatTile[] = groups.map((g) => ({ id: g.key, text: `${g.label} ${g.count}` }));
    const rows: StatTile[][] = [];
    for (let i = 0; i < tiles.length; i += 3) rows.push(tiles.slice(i, i + 3));
    b.statTiles(
      { x: rect.x, y: rect.y + 16, width: rect.width, height: rows.length * 46 + (rows.length - 1) * 7 },
      rows,
    );
  }

  // ------------------------------------------------------------------------------------------------------------
  // The card sections: the deck's own cards (narrowed by the rail's type filter, on wide), grouped by signature set or
  // aspect, with the identity's faces above them and what the identity brings beside the deck under them.
  // ------------------------------------------------------------------------------------------------------------
  #mountCards(
    rect: Rect,
    groups: readonly DeckListGroup[],
  ): { readonly cardIds: readonly string[]; readonly faceIds: readonly string[] } {
    const totalCount = groups.reduce((sum, g) => sum + g.entries.length, 0);
    const geometry = poolGridGeometry(
      rect.width,
      totalCount,
      isDesktopType(),
      cardSizeFactor(appSession().settings.cardSize),
    );
    const sections: CardSection[] = [];
    const faceIds: string[] = [];
    const cardIds: string[] = [];
    // The identity's faces and every multi-faced card's, above the cards; a type filter narrows to cards alone.
    const faceWidth = rect.width - 8 - FACES_INSET * 2;
    if (this.#typeFilter === null) {
      deckFaceGroups(this.#deck, currentCardsById()).forEach((group, _groupIndex) => {
        const layout = deckFaceGroupLayout(faceWidth, group.tiles.length);
        const count = group.tiles.length;
        const art = layout.art[0];
        sections.push({
          kind: "faces",
          title: group.identity
            ? t("deckCheck.identityFaces", { count })
            : t("deckCheck.cardFaces", { title: group.title.toUpperCase(), count }),
          tileWidth: art?.width ?? 84,
          tileHeight: art?.height ?? 118,
          tiles: group.tiles.map((tile, i) => {
            const id = `${group.cardId}:${(tile.face as { kind?: string } | undefined)?.kind ?? "front"}:${i}`;
            faceIds.push(id);
            this.#faces.set(`face:${id}`, { cardId: group.cardId, face: tile.face });
            this.#actions.set(`face:${id}`, () => this.#inspectFace(`face:${id}`));
            return { id, cardId: group.cardId, picture: this.#pictureOf(tile.art), label: tile.label, name: tile.name };
          }),
        });
      });
    }
    // The identity's faces stay on screen when the card list is empty; the message goes under them.
    if (groups.length === 0) sections.push({ kind: "note", text: t("deckCheck.noMatch") });
    // What the identity brings besides the deck (#960), under the deck's own cards and never counted in it.
    const outside =
      this.#typeFilter === null ? outsideDeckGroupsOf(this.#deck.identityCardId, currentPool(), artLanguageNow()) : [];
    for (const group of [...groups, ...outside]) {
      sections.push({
        kind: "cards",
        title: `${group.label.toUpperCase()} · ${group.count}`,
        cells: group.entries.map((entry) => this.#cellOf(entry)),
      });
      for (const entry of group.entries) {
        const id = entry.cardId as string;
        if (this.#actions.has(`card:${id}`)) continue;
        cardIds.push(id);
        this.#actions.set(`card:${id}`, () => this.#inspect(entry));
      }
    }
    const fresh = this.#cards === null;
    const region = (this.#cards ??= this.#wire(document.createElement("mc-card-sections") as McCardSections, rect));
    region.setRect(rect);
    region.setHidden(false);
    region.element.model = {
      sections,
      contentWidth: rect.width - 8,
      columns: geometry.columns,
      cellHeight: geometry.cellHeight,
      gap: 8,
    };
    renderNow(region.element);
    if (this.#fromTop || fresh) {
      const scroller = region.element.scroller;
      if (scroller) scroller.scrollTop = 0;
      this.#fromTop = false;
    }
    this.#view = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    for (const id of faceIds) this.#stopOf(region, `face:${id}`, rect);
    for (const id of cardIds) this.#stopOf(region, `card:${id}`, rect);
    return { cardIds, faceIds };
  }

  #stopOf(region: DomRegion<McCardSections>, key: string, view: Rect): void {
    const activate = this.#actions.get(key) ?? (() => undefined);
    this.#stops.set(key, {
      rect: () => this.#liveRect(region, key, view),
      activate,
      inspect: activate,
      view: () => view,
      ensureVisible: () => region.element.elementOf(key)?.scrollIntoView({ block: "nearest" }),
    });
  }

  /** One card a deck runs, as a cell: cost pip, name, type, scan, a short strip of rules and its copies. */
  #cellOf(entry: DeckListEntry): CardCellModel {
    const card = currentCardsById().get(entry.cardId as string);
    const rules =
      card && "text" in card ? truncate((card as unknown as { text: { current: string } }).text.current, 120) : "";
    return {
      id: entry.cardId as string,
      cardId: entry.cardId as string,
      cost: entry.cost,
      costColor: sheetColor(entry.cost !== null ? costPipColor(entry.cost) : surface.ink.hex, "fill"),
      name: entry.name,
      typeWord: cardTypeWordOf(entry.type),
      picture: this.#pictureOf(artFor(card, { kind: "front" })),
      rules,
      quantity: entry.quantity,
    };
  }

  /** The cards and the panel's "Your deck" lines on screen, for the hover popover. */
  #hoverCards(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const view = this.#view;
    const cards = this.#cards;
    if (cards && view.width > 0) {
      for (const { cardId, element, key } of cards.element.hoverFaces()) {
        const rect = clipHoverRect(cards.rectOf(element), view);
        if (!rect) continue;
        const face = this.#faces.get(key)?.face;
        found.set(hoverSlotOf(cardId, key), {
          ...rect,
          cardId,
          through: true,
          ...(face ? { face: face as never } : {}),
        });
      }
    }
    const sheet = this.#sheet;
    const list = sheet?.element.renderRoot.querySelector("mc-line-list");
    if (sheet && list) {
      list.hoverEntries().forEach(({ cardId, element }, index) => {
        const rect = sheet.rectOf(element);
        if (rect.width > 0) found.set(hoverSlotOf(cardId, `line${index}`), { ...rect, cardId, through: true });
      });
    }
    return found;
  }
}

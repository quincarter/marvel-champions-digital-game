/**
 * Deck check (W1, docs/phase4-screen-gaps.md §3, P04/D04): a deck's resource
 * curve, composition, legality and full card list at a glance, with "Edit
 * deck" back into the builder and "Start game ▸" into the setup flow —
 * reached today from the Decks screen's own "Check" button on every row,
 * precon or saved, and from Seats' "Deck check ▸" for the active seat.
 *
 * **Rebuilt 2026-09-18 for the owner's fidelity note: "The 'Deck Check'
 * screens and elements there don't flow well with the design."** — and
 * rebuilt again the same day once a real screenshot of D04
 * (`artifacts/design-screenshots/individual/screens-desktop.dc/04-s04.png`)
 * showed what the first rebuild guessed wrong: D04 ("Deck builder — live
 * validation against the 40–50 rule") **is** this step's own desktop
 * composition, the same canvas `scenes/deck-builder.ts` already draws —
 * this screen draws the read-only "check" version of exactly that
 * three-column layout, not an unrelated two-column shape. See
 * `view/deck-check-layout.ts`'s own doc comment for the column-by-column
 * accounting; the short version: an ink header (Back, "HERO — ASPECT",
 * a green/red "N CARDS · LEGAL" badge) over `rail` (aspect tiles, read-only;
 * type filter chips, live; the cost curve, pinned at the rail's own foot) ·
 * `cards` (the deck's own card grid, real scans) · `panel` (the full ink
 * "YOUR DECK" list, with Edit deck and Start game ▸ pinned at its foot) —
 * `scenes/deck-builder.ts`'s own rail/pool/rail widths reused verbatim so
 * the two screens' columns line up when a player moves between them.
 *
 * Narrow (phone/tabletPortrait) stays P04's own shape: a "YOUR DECK · N"
 * header with a step fraction, a Curve/Cards/Aspect tab strip, and a footer
 * (Edit deck, Start game ▸). The Curve tab draws P04's own per-bucket
 * rainbow bars (`ui/deck-stats-widgets.ts`'s `drawRainbowCurveBars`) — a
 * genuinely different chart from the wide rail's "ink bars, peak cost in
 * red" one (`drawStatCurveBars`, the same chart Decks & Collection's own ink
 * stats rail draws), not a simplification of it — plus the three sample
 * tiles (Resources/Allies/Events) and a short few-card preview P04 itself
 * shows there; the full list lives one tab over. The amber advice banner
 * P04 also draws is skipped (docs/phase4-screen-gaps.md §4: advice text is
 * unsettled/out of scope).
 *
 * **The entry point is deliberately caller-agnostic**: `DeckCheckSceneData`
 * takes a `Deck` plus an optional `returnTo` (defaults to the Decks screen)
 * and an optional `onStartGame`. The header's Back label and narrow's step
 * fraction both read `returnTo.scene` to tell whether this is a step in
 * Seats' own setup flow or a standalone visit from Decks — nothing else
 * about this scene depends on which. Until Seats supplies `onStartGame`,
 * "Start game ▸" draws unavailable with its reason, per §0's "dashed = not
 * yet real" rather than being omitted.
 *
 * Every number comes from `view/deck-stats.ts` (`deckStatsOf`, `costCurveBars`,
 * `deckListGroupsOf`, `filterDeckListGroups`) and `@mc/engine`'s own legality
 * verdict (`view/deck-list-model.ts`'s `deckOptionOf`) — this scene only
 * draws what those already computed, the same "client renders, never
 * computes" rule `deck-builder.ts` follows. The rail's type filter chips are
 * a display filter only (which of the deck's own cards the grid shows), like
 * the builder's own pool filter — never a deckbuilding rule.
 *
 * **Multi-seat note**: Seats can have several filled seats, but neither P04
 * nor D04 draws a seat switcher for this step — there is nowhere in the
 * design for one, and inventing a control the tile doesn't show risks
 * exactly the "doesn't flow with the design" complaint this pass is fixing.
 * Checking a different seat's deck means going Back to Seats, selecting that
 * seat, and reopening "Deck check ▸" — a real gap, left for a follow-up
 * rather than guessed at here.
 *
 * **Tap-to-inspect, not tap-plus-hold.** The card grid's only action is
 * Inspect, so a tap alone opens it (`McVariableList#onRowActivate`, the same
 * "a row with no button of its own" pattern Decks' and Rules' own card grids
 * already use — `scenes/decks.ts`'s `#drawPoolPane`, `scenes/rules.ts`'s
 * `#drawCardListTab`) rather than wiring `ui/hold-target.ts`'s separate
 * tap/long-press gesture for a second action this screen has no use for.
 */
import Phaser from "phaser";
import type { Deck } from "@mc/content";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS, POOL_VERSION } from "../content/pool.js";
import { artFor } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { SELECTABLE_ASPECTS } from "../view/deck-builder-model.js";
import { costCurveBars, deckListGroupsOf, deckStatsOf, filterDeckListGroups, type DeckListEntry, type DeckListGroup, type PlayerCardType } from "../view/deck-stats.js";
import { deckOptionOf } from "../view/deck-list-model.js";
import { deckStatusOf, type DeckStatusTone } from "../view/deck-status.js";
import { aspectLabelOf } from "../view/seat-slots.js";
import { deckCheckFocusOrder } from "../view/screen-focus.js";
import { deckCheckLayout, type DeckCheckTab } from "../view/deck-check-layout.js";
import { poolCellRect, poolColumnAt, poolGridGeometry, type PoolGridGeometry } from "../view/deck-pool-grid.js";
import { CHIP_GAP, wrapChipsToRows } from "../view/chip-layout.js";
import type { Rect } from "../view/layout.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { McVariableList } from "../ui/variable-list.js";
import type { VirtualListRow } from "../ui/virtual-list.js";
import { accent, border, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTabs, fitText, label, paintDotGrid, paintPanel } from "../ui/widgets.js";
import { costPipColor, drawGroupedCardList, drawRainbowCurveBars, drawStatCurveBars, drawStatTiles } from "../ui/deck-stats-widgets.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import type { DeckBuilderSceneData } from "./deck-builder.js";
import { SCENES, type SceneKey } from "./keys.js";
import { destroyChildren } from "../ui/destroy-children.js";

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
}

/** One flattened slot of the card grid's `McVariableList`: a group's own header, or one row of that group's cards. */
type CardGridSlot =
  | { readonly kind: "header"; readonly group: DeckListGroup }
  | { readonly kind: "gridRow"; readonly group: DeckListGroup; readonly startIndex: number; readonly count: number };

/** How tall a group-header slot is (Bangers label + rule + count) — matches `scenes/rules.ts`'s own `SET_HEADER_HEIGHT` for the identical shape. */
const GROUP_HEADER_HEIGHT = 34;
/** A card cell's own header strip (cost pip, name, type) and footer strip (a short line of rules text) — D04's own card-cell shape, header above the art rather than a caption below it. */
const CELL_HEADER_HEIGHT = 28;
const CELL_FOOTER_HEIGHT = 24;

/** Matches `scenes/deck-builder.ts`'s own `LEFT_RAIL_WIDTH`/`RIGHT_RAIL_WIDTH`/`RAIL_GAP` — see `view/deck-check-layout.ts`. */
const RAIL_CHIP_HEIGHT = 26;
/** Matches `scenes/deck-builder.ts`'s own `STATS_LIST_ENTRY_CAP` for its identical right rail. */
const PANEL_LIST_ENTRY_CAP = 12;
/** The narrow Curve tab's own "RESOURCE CURVE" card (P04). */
const CURVE_CARD_HEIGHT = 150;

const TONE_COLOR: Readonly<Record<DeckStatusTone, number>> = {
  legal: signal.heal.hex,
  illegal: accent.heroRed.hex,
  unscripted: signal.caution.hex,
  poolChanged: signal.caution.hex,
};

/**
 * D04's own left-rail filter chips: the same six `scenes/deck-builder.ts`'s `TYPE_FILTERS` offers, redeclared here
 * (that constant isn't exported — the builder's own doc comment notes it has no shared layout module to export one
 * from) rather than filtering the deck's own pool of *card types* by name a second, different way.
 */
const TYPE_FILTERS: readonly { readonly id: string; readonly label: string; readonly type: PlayerCardType | null }[] = [
  { id: "all", label: "All", type: null },
  { id: "ally", label: "Ally", type: "ally" },
  { id: "event", label: "Event", type: "event" },
  { id: "upgrade", label: "Upgrade", type: "upgrade" },
  { id: "support", label: "Support", type: "support" },
  { id: "resource", label: "Resource", type: "resource" },
];

/** One flattened, unwrapped line of a card's rules text, for a cell's own short footer strip — the full text is always one tap away, in Inspect. */
function truncate(text: string, maxChars: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > maxChars ? `${flat.slice(0, maxChars - 1)}…` : flat;
}

export class DeckCheckScene extends Phaser.Scene {
  #deck!: Deck;
  #returnTo!: { readonly scene: SceneKey; readonly data?: object };
  #onStartGame: ((from: Phaser.Scene) => void) | undefined;
  /** Narrow only — wide shows every tab's content at once, so this is ignored there. */
  #activeTab: DeckCheckTab = "curve";
  /** Wide only: the rail's own type filter, applied to the grid (a display filter, never a deckbuilding rule). */
  #typeFilter: PlayerCardType | null = null;
  #buttons: McButton[] = [];
  #tabs: McTabs | null = null;
  #cardList: McVariableList | null = null;
  #cardListScroll = new VariableListScroll();
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();

  constructor() {
    super(SCENES.deckCheck);
  }

  create(data: DeckCheckSceneData): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#deck = data.deck;
    this.#returnTo = data.returnTo ?? { scene: SCENES.decks };
    this.#onStartGame = data.onStartGame;
    this.#activeTab = "curve";
    this.#typeFilter = null;
    this.#cardListScroll = new VariableListScroll();

    const onResize = (): void => this.#rebuild();
    this.scale.on("resize", onResize, this);
    const artOff = cardArt(this).onArrived(() => this.#rebuild());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      artOff();
      this.#tabs?.destroy();
      this.#tabs = null;
      this.#cardList?.destroy();
      this.#cardList = null;
    });
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect),
      onPage: (direction) => this.#cardList?.scrollByPage(direction),
      onHomeEnd: (edge) => (edge === "home" ? this.#cardList?.scrollToStart() : this.#cardList?.scrollToEnd()),
    });
    this.#rebuild();
  }

  #setTab(tab: DeckCheckTab): void {
    if (tab === this.#activeTab) return;
    this.#activeTab = tab;
    this.#cardListScroll.reset();
    this.#rebuild();
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();
    this.#tabs?.destroy();
    this.#tabs = null;
    // The card grid only exists on wide, or on narrow's Cards tab; recreated fresh every rebuild like every other
    // non-DOM widget (`ui/virtual-list.ts`'s own doc comment) — only its scroll position (`#cardListScroll`) survives.
    this.#cardList?.destroy();
    this.#cardList = null;
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const layout = deckCheckLayout({ width, height });

    const option = deckOptionOf(this.#deck, POOL_CARDS, POOL_VERSION, POOL_DEPS);
    const stats = deckStatsOf(this.#deck, POOL_CARDS);
    const groups = deckListGroupsOf(this.#deck, POOL_CARDS);
    const status = deckStatusOf(option);
    const inFlow = this.#returnTo.scene === SCENES.seats;

    // Ground: paper body under the same full-width ink header bar every setup-flow screen shares.
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    paintDotGrid(this, { x: 0, y: layout.headerBar.height, width, height: height - layout.headerBar.height }, "paper", { spacing: 6, radius: 1, alpha: 0.1 });
    this.add.rectangle(layout.headerBar.x, layout.headerBar.y, layout.headerBar.width, layout.headerBar.height, surface.ink.hex).setOrigin(0, 0);

    const backLabel = this.#returnTo.scene === SCENES.seats ? "◂ Seats" : "◂ Back";
    const goBack = (): void => {
      this.scene.start(this.#returnTo.scene, this.#returnTo.data);
    };
    this.#buttons.push(new McButton(this, { kind: "onInk", label: backLabel, type: typeRole.backLabel, rect: layout.back, onClick: goBack }));
    this.#stops.set("back", { rect: layout.back, activate: goBack });

    const titleX = layout.back.x + layout.back.width + 16;
    if (layout.wide) this.#drawWideHeader(titleX, layout, this.#deck, option, stats, status);
    else this.#drawNarrowHeader(titleX, layout, stats, status, inFlow);

    let cardIds: readonly string[] = [];
    let filterChipIds: readonly string[] = [];
    if (layout.wide) {
      filterChipIds = TYPE_FILTERS.map((f) => f.id);
      const filteredGroups = filterDeckListGroups(groups, this.#typeFilter);
      cardIds = this.#drawCardGrid(layout.cards!, filteredGroups);
      this.#drawRail(layout.rail!, this.#deck, stats);
      this.#drawPanel(layout.panel!, layout.editDeck, layout.startGame, groups);
    } else {
      this.#tabs = new McTabs(this, {
        rect: layout.tabs!,
        tabs: [
          { id: "curve", label: "Curve" },
          { id: "cards", label: "Cards" },
          { id: "aspect", label: "Aspect" },
        ],
        activeId: this.#activeTab,
        onSelect: (id) => this.#setTab(id as DeckCheckTab),
      });
      const tabWidth = layout.tabs!.width / 3;
      this.#stops.set("tab:curve", { rect: { ...layout.tabs!, width: tabWidth }, activate: () => this.#setTab("curve") });
      this.#stops.set("tab:cards", { rect: { ...layout.tabs!, x: layout.tabs!.x + tabWidth, width: tabWidth }, activate: () => this.#setTab("cards") });
      this.#stops.set("tab:aspect", { rect: { ...layout.tabs!, x: layout.tabs!.x + tabWidth * 2, width: tabWidth }, activate: () => this.#setTab("aspect") });

      if (this.#activeTab === "curve") this.#drawCurveTab(layout.content!, stats, groups);
      else if (this.#activeTab === "aspect") this.#drawAspectTab(layout.content!, groups);
      else cardIds = this.#drawCardGrid(layout.content!, groups);

      const footerBg = this.add.graphics();
      paintPanel(footerBg, layout.footer!, "onInk", "rest");
      const openEdit = (): void => {
        this.scene.start(SCENES.deckBuilder, { deck: this.#deck } satisfies DeckBuilderSceneData);
      };
      this.#buttons.push(new McButton(this, { kind: "onInk", label: "Edit deck", type: typeRole.label, rect: layout.editDeck, onClick: openEdit }));
      this.#stops.set("edit-deck", { rect: layout.editDeck, activate: openEdit });

      const canStart = this.#onStartGame !== undefined;
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: "Start game ▸",
          type: typeRole.barTitle,
          rect: layout.startGame,
          enabled: canStart,
          ...(canStart ? {} : { reason: "Setup flow isn't built yet — coming with the title-menu rework (W2)." }),
          onClick: () => this.#onStartGame?.(this),
        }),
      );
      this.#stops.set("start", { rect: layout.startGame, activate: () => this.#onStartGame?.(this) });
    }

    this.#route?.set(deckCheckFocusOrder({ wide: layout.wide, activeTab: this.#activeTab, cardIds, filterChipIds }), this.#stops);
  }

  // ------------------------------------------------------------------------------------------------------------
  // Header: wide draws D04's own "HERO — ASPECT" title and green/red "N CARDS · LEGAL" badge; narrow draws P04's
  // own "YOUR DECK · N" title and step fraction — two real, different headers rather than one shape stretched.
  // ------------------------------------------------------------------------------------------------------------
  #drawWideHeader(
    titleX: number,
    layout: ReturnType<typeof deckCheckLayout>,
    deck: Deck,
    option: ReturnType<typeof deckOptionOf>,
    stats: ReturnType<typeof deckStatsOf>,
    status: ReturnType<typeof deckStatusOf>,
  ): void {
    const badgeText = `${stats.totalCards} CARDS · ${status.text.toUpperCase()}`;
    const badgeTextStyle = { ...textStyle(typeRole.barTitle, surface.paper.hex), fontSize: "18px" };
    // The background graphics object is created (and so z-ordered) *before* the text it sits behind — these two
    // calls aren't reparented into a container that would reorder them by array position (unlike a virtualized
    // row's own `objects`), so draw order here follows `scene.add` call order alone. Creating the text first to
    // measure it, then the background, left the badge's own fill painted *over* its text every time.
    const badgeBg = this.add.graphics();
    const measure = this.add.text(0, 0, badgeText, badgeTextStyle).setLetterSpacing(typeRole.barTitle.letterSpacing);
    const badgeWidth = Math.ceil(measure.width) + 24;
    const badgeHeight = 32;
    const badgeRect: Rect = { x: layout.headerBar.width - 16 - badgeWidth, y: (layout.headerBar.height - badgeHeight) / 2, width: badgeWidth, height: badgeHeight };
    badgeBg.fillStyle(TONE_COLOR[status.tone], 1).fillRect(badgeRect.x, badgeRect.y, badgeRect.width, badgeRect.height);
    measure.setPosition(badgeRect.x + badgeRect.width / 2, badgeRect.y + badgeRect.height / 2).setOrigin(0.5);

    const title = `${option.identityName ?? "Unknown"} — ${aspectLabelOf(deck.aspects).toUpperCase()}`;
    const titleText = this.add.text(titleX, layout.headerBar.height / 2, title, textStyle(typeRole.pageTitle, surface.paper.hex)).setOrigin(0, 0.5);
    fitText(titleText, badgeRect.x - titleX - 16, typeRole.pageTitle.size);
  }

  #drawNarrowHeader(titleX: number, layout: ReturnType<typeof deckCheckLayout>, stats: ReturnType<typeof deckStatsOf>, status: ReturnType<typeof deckStatusOf>, inFlow: boolean): void {
    const title = this.add.text(titleX, layout.headerBar.height / 2, `Your deck · ${stats.totalCards}`, textStyle(typeRole.pageTitle, surface.paper.hex)).setOrigin(0, 0.5);
    fitText(title, layout.meta.x - titleX - 12, typeRole.pageTitle.size);

    const metaWords = inFlow ? "3/4" : `${stats.totalCards} CARDS · ${status.text.toUpperCase()}`;
    const metaText = this.add.text(layout.meta.x + layout.meta.width, layout.headerBar.height / 2, metaWords, textStyle(typeRole.label, surface.paper.hex, ink.label)).setOrigin(1, 0.5);
    fitText(metaText, layout.meta.width, typeRole.label.size);
  }

  // ------------------------------------------------------------------------------------------------------------
  // The left parchment rail (wide only, D04): aspect tiles (read-only — this screen never edits a deck's
  // aspects), the type filter chips (filtering `cards`, never the deck), and the cost curve pinned at the rail's
  // own foot ("ink bars, peak cost in red" — Decks & Collection's own chart, not P04's rainbow).
  // ------------------------------------------------------------------------------------------------------------
  #drawRail(rect: Rect, deck: Deck, stats: ReturnType<typeof deckStatsOf>): void {
    const left = rect.x;
    const column = rect.width;
    let y = rect.y;

    label(this, left, y, "Aspect", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const aspectGap = 7;
    SELECTABLE_ASPECTS.forEach((aspect, index) => {
      const tileRect: Rect = { x: left, y: y + index * (hit.target + aspectGap), width: column, height: hit.target };
      const chosen = deck.aspects.includes(aspect);
      const g = this.add.graphics();
      if (chosen) g.fillStyle(signal.heal.hex, 1).fillRect(tileRect.x, tileRect.y, tileRect.width, tileRect.height);
      g.lineStyle(border.object, surface.ink.hex, chosen ? 1 : 0.4).strokeRect(tileRect.x, tileRect.y, tileRect.width, tileRect.height);
      const text = this.add
        .text(tileRect.x + 11, tileRect.y + tileRect.height / 2, aspect.toUpperCase(), { ...textStyle(typeRole.barTitle, chosen ? surface.paper.hex : surface.ink.hex), fontSize: "16px" })
        .setOrigin(0, 0.5);
      if (!chosen) text.setAlpha(ink.disabled);
    });
    y += SELECTABLE_ASPECTS.length * (hit.target + aspectGap) + 3;

    const rule = this.add.graphics();
    rule.fillStyle(surface.ink.hex, 1).fillRect(left, y, column, 3);
    y += 16;

    label(this, left, y, "Filter", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const chipRows = wrapChipsToRows(TYPE_FILTERS.map((f) => ({ id: f.id, text: f.label })), column);
    const activeFilterId = TYPE_FILTERS.find((f) => f.type === this.#typeFilter)?.id ?? "all";
    chipRows.forEach((row, rowIndex) => {
      const cellWidth = (column - (row.length - 1) * CHIP_GAP) / row.length;
      row.forEach((chip, index) => {
        const chipDef = TYPE_FILTERS.find((f) => f.id === chip.id)!;
        const chipRect: Rect = { x: left + index * (cellWidth + CHIP_GAP), y: y + rowIndex * (RAIL_CHIP_HEIGHT + CHIP_GAP), width: cellWidth, height: RAIL_CHIP_HEIGHT };
        const selected = chip.id === activeFilterId;
        const apply = (): void => {
          this.#typeFilter = chipDef.type;
          this.#cardListScroll.reset();
          this.#rebuild();
        };
        this.#buttons.push(new McButton(this, { kind: "secondary", label: chipDef.label, type: typeRole.label, rect: chipRect, selected, onClick: apply }));
        this.#stops.set(`filter:${chip.id}`, { rect: chipRect, activate: apply });
      });
    });

    // The cost curve, pinned at the rail's own foot regardless of how tall the aspect/filter groups above ended up
    // (D04's own `margin-top:auto` on this block) — computed bottom-up rather than continuing the `y` cursor.
    const chartHeight = 74;
    const curveBlockTop = rect.y + rect.height - 16 - chartHeight;
    label(this, left, curveBlockTop, "Cost curve", typeRole.label, surface.ink.hex, ink.label);
    drawStatCurveBars(this, { x: left, y: curveBlockTop + 16, width: column, height: chartHeight }, costCurveBars(stats), false);
  }

  // ------------------------------------------------------------------------------------------------------------
  // The right ink rail (wide only, D04): "YOUR DECK", the grouped list (`scenes/deck-builder.ts`'s own
  // `drawGroupedCardList`, so the two screens' right rails read identically), then Edit deck and Start game ▸
  // pinned at the rail's own foot.
  // ------------------------------------------------------------------------------------------------------------
  #drawPanel(rect: Rect, editDeckRect: Rect, startGameRect: Rect, groups: readonly DeckListGroup[]): void {
    const bg = this.add.graphics();
    paintPanel(bg, rect, "onInk", "rest");

    const left = rect.x + 16;
    const column = rect.width - 32;
    label(this, left, rect.y + 16, "Your deck", typeRole.label, surface.paper.hex, ink.secondary);
    drawGroupedCardList(this, left, rect.y + 36, column, groups, PANEL_LIST_ENTRY_CAP, true);

    const openEdit = (): void => {
      this.scene.start(SCENES.deckBuilder, { deck: this.#deck } satisfies DeckBuilderSceneData);
    };
    this.#buttons.push(new McButton(this, { kind: "onInk", label: "Edit deck", type: typeRole.label, rect: editDeckRect, onClick: openEdit }));
    this.#stops.set("edit-deck", { rect: editDeckRect, activate: openEdit });

    const canStart = this.#onStartGame !== undefined;
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: "Start game ▸",
        type: typeRole.barTitle,
        rect: startGameRect,
        enabled: canStart,
        ...(canStart ? {} : { reason: "Setup flow isn't built yet — coming with the title-menu rework (W2)." }),
        onClick: () => this.#onStartGame?.(this),
      }),
    );
    this.#stops.set("start", { rect: startGameRect, activate: () => this.#onStartGame?.(this) });
  }

  // ------------------------------------------------------------------------------------------------------------
  // Narrow's Curve tab (P04): the "RESOURCE CURVE" card (P04's own per-bucket rainbow bars, `avg N.N` at its own
  // right), three sample tiles (Resources/Allies/Events, P04's own three — not every non-empty type), then a short
  // few-card preview in the simple cost-pip/name/qty row P04 itself draws there. The full list lives on Cards.
  // ------------------------------------------------------------------------------------------------------------
  #drawCurveTab(rect: Rect, stats: ReturnType<typeof deckStatsOf>, groups: readonly DeckListGroup[]): void {
    const chartRect: Rect = { x: rect.x, y: rect.y, width: rect.width, height: CURVE_CARD_HEIGHT };
    const panel = this.add.graphics();
    paintPanel(panel, chartRect, "card", "rest");
    const heading = this.add
      .text(chartRect.x + 12, chartRect.y + 10, "RESOURCE CURVE", { ...textStyle(typeRole.barTitle, surface.ink.hex), fontSize: "18px" });
    if (stats.averageCost !== null) {
      label(this, chartRect.x + chartRect.width - 12, chartRect.y + 10 + heading.height / 2, `avg ${stats.averageCost.toFixed(1)}`, typeRole.label, surface.ink.hex, ink.meta).setOrigin(1, 0.5);
    }
    drawRainbowCurveBars(this, { x: chartRect.x + 12, y: chartRect.y + 34, width: chartRect.width - 24, height: chartRect.height - 34 - 6 }, costCurveBars(stats));

    let y = chartRect.y + chartRect.height + 12;
    const threeTiles = [
      { id: "resource", label: "Resources", count: stats.countsByType.resource ?? 0 },
      { id: "ally", label: "Allies", count: stats.countsByType.ally ?? 0 },
      { id: "event", label: "Events", count: stats.countsByType.event ?? 0 },
    ];
    y = drawStatTiles(this, rect.x, y, rect.width, threeTiles, false, 3) + 12;

    const preview = groups.flatMap((g) => g.entries).slice(0, 3);
    for (const entry of preview) y = this.#drawPreviewRow(rect.x, y, rect.width, entry);
  }

  /** One of the Curve tab's few sample rows: a cost pip, the name, and its quantity — P04's own small preview shape, distinct from the full-scan grid the Cards tab draws. */
  #drawPreviewRow(left: number, y: number, width: number, entry: DeckListEntry): number {
    const rowHeight = 32;
    const rowRect: Rect = { x: left, y, width, height: rowHeight - 6 };
    const g = this.add.graphics();
    paintPanel(g, rowRect, "card", "rest");
    const pipWidth = 26;
    const pipColor = entry.cost !== null ? costPipColor(entry.cost) : surface.ink.hex;
    const pipBg = this.add.graphics();
    pipBg.fillStyle(pipColor, 1).fillRect(rowRect.x, rowRect.y, pipWidth, rowRect.height);
    if (entry.cost !== null) label(this, rowRect.x + pipWidth / 2, rowRect.y + rowRect.height / 2, String(entry.cost), typeRole.rowTitle, surface.paper.hex, 1).setOrigin(0.5);
    const name = this.add.text(rowRect.x + pipWidth + 8, rowRect.y + rowRect.height / 2, entry.name, textStyle(typeRole.body, surface.ink.hex)).setOrigin(0, 0.5);
    fitText(name, width - pipWidth - 8 - 50);
    label(this, rowRect.x + width - 10, rowRect.y + rowRect.height / 2, `×${entry.quantity}`, typeRole.label, surface.ink.hex, ink.secondary).setOrigin(1, 0.5);
    return y + rowHeight;
  }

  #drawAspectTab(rect: Rect, groups: readonly DeckListGroup[]): void {
    label(this, rect.x, rect.y, "COMPOSITION BY ASPECT", typeRole.label, surface.ink.hex, ink.label);
    if (groups.length === 0) {
      this.add.text(rect.x, rect.y + 20, "This deck has no cards yet.", textStyle(typeRole.body, surface.ink.hex, ink.meta));
      return;
    }
    drawStatTiles(this, rect.x, rect.y + 16, rect.width, groups.map((g) => ({ id: g.key, label: g.label, count: g.count })), false);
  }

  // ------------------------------------------------------------------------------------------------------------
  // The card grid: the deck's own cards (already narrowed by the rail's type filter, on wide), as a real-scan
  // grid grouped by signature-set/aspect, a Bangers header (with its own rule and count) per group. Virtualized
  // at grid-row granularity (`ui/variable-list.ts`'s `McVariableList` — a plain `McVirtualList` can't mix a short
  // header slot with a taller grid-row slot in one uniform-height list, the same reason `scenes/rules.ts`'s own
  // Card list tab uses it).
  // ------------------------------------------------------------------------------------------------------------
  #drawCardGrid(rect: Rect, groups: readonly DeckListGroup[]): readonly string[] {
    if (groups.length === 0) {
      this.add.text(rect.x + 10, rect.y + 10, "No cards match this filter.", textStyle(typeRole.body, surface.ink.hex, ink.meta));
      return [];
    }

    const totalCount = groups.reduce((sum, g) => sum + g.entries.length, 0);
    const geometry = poolGridGeometry(rect.width, totalCount);
    const slots: CardGridSlot[] = [];
    for (const group of groups) {
      slots.push({ kind: "header", group });
      const rows = Math.max(1, Math.ceil(group.entries.length / geometry.columns));
      for (let r = 0; r < rows; r++) {
        const startIndex = r * geometry.columns;
        slots.push({ kind: "gridRow", group, startIndex, count: Math.min(geometry.columns, group.entries.length - startIndex) });
      }
    }

    const heights = slots.map((slot) => (slot.kind === "header" ? GROUP_HEADER_HEIGHT : geometry.cellHeight));
    const renderRow = (index: number, rowRect: Rect): VirtualListRow => this.#renderCardGridSlot(rowRect, slots[index]!, geometry);
    const onRowActivate = (index: number, pointer: Phaser.Input.Pointer): void => {
      const slot = slots[index];
      if (slot?.kind !== "gridRow") return;
      const list = this.#cardList;
      if (!list) return;
      const column = poolColumnAt(geometry, list.rectFor(index), pointer.x, slot.count);
      if (column === null) return;
      const entry = slot.group.entries[slot.startIndex + column];
      if (entry) this.#inspect(entry);
    };
    this.#cardList = new McVariableList(this, { rect, heights, renderRow, scroll: this.#cardListScroll, onRowActivate, background: false });
    const list = this.#cardList;

    const cardIds: string[] = [];
    slots.forEach((slot, index) => {
      if (slot.kind !== "gridRow") return;
      for (let col = 0; col < slot.count; col++) {
        const entry = slot.group.entries[slot.startIndex + col];
        if (!entry) continue;
        const id = entry.cardId as string;
        cardIds.push(id);
        this.#stops.set(`card:${id}`, {
          rect: () => poolCellRect(geometry, list.rectFor(index), col),
          activate: () => this.#inspect(entry),
          inspect: () => this.#inspect(entry),
          ensureVisible: () => list.scrollIntoView(index),
        });
      }
    });
    return cardIds;
  }

  #renderCardGridSlot(rect: Rect, slot: CardGridSlot, geometry: PoolGridGeometry): VirtualListRow {
    if (slot.kind === "header") return this.#renderGroupHeaderRow(rect, slot.group);
    const objects: Phaser.GameObjects.GameObject[] = [];
    for (let col = 0; col < slot.count; col++) {
      const entry = slot.group.entries[slot.startIndex + col];
      if (!entry) continue;
      const cell = poolCellRect(geometry, rect, col);
      const cardRect: Rect = { x: cell.x + 4, y: cell.y + 2, width: cell.width - 8, height: cell.height - 4 };
      objects.push(...this.#renderCardCell(cardRect, entry));
    }
    return { objects };
  }

  /**
   * A group's own header slot: Bangers label, a rule to the row's own right edge, and its count — visually
   * `ui/widgets.ts`'s `sectionHeader`, but returning every object it drew (`sectionHeader` itself adds straight to
   * the scene's root display list and returns none) so `McVariableList` can reparent them into its own scrolled,
   * masked layer and destroy them when the row recycles out of view, the same as every other row this list draws.
   */
  #renderGroupHeaderRow(rect: Rect, group: DeckListGroup): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const heading = this.add
      .text(rect.x + 4, rect.y + 4, `${group.label.toUpperCase()} · ${group.count}`, { ...textStyle(typeRole.barTitle, surface.ink.hex), fontSize: "19px" });
    objects.push(heading);
    const ruleX = rect.x + 4 + heading.width + 10;
    if (ruleX < rect.x + rect.width) {
      const rule = this.add.graphics();
      rule.fillStyle(surface.ink.hex, 1).fillRect(ruleX, rect.y + 4 + heading.height / 2 - 1.5, rect.x + rect.width - 4 - ruleX, 3);
      objects.push(rule);
    }
    return { objects };
  }

  /**
   * One card cell, D04's own shape: a header strip (a coloured cost pip, the card's own Bangers name, its type),
   * the art, a short one-line strip of its rules text, and a green "×N" copies badge floating over the cell's own
   * top-right corner — not the caption-under-the-art shape Decks' and Rules' own pool grids draw, since those are
   * browsing a *pool*, not reading a card this deck already runs. A missing scan draws "no scan" rather than
   * blocking anything — art availability never blocks this screen (CLAUDE.md).
   */
  #renderCardCell(cardRect: Rect, entry: DeckListEntry): readonly Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics();
    paintPanel(g, cardRect, "card", "rest");
    objects.push(g);

    const headerRect: Rect = { x: cardRect.x, y: cardRect.y, width: cardRect.width, height: CELL_HEADER_HEIGHT };
    const pipWidth = 22;
    const pipColor = entry.cost !== null ? costPipColor(entry.cost) : surface.ink.hex;
    const pipG = this.add.graphics();
    pipG.fillStyle(pipColor, 1).fillRect(headerRect.x, headerRect.y, pipWidth, headerRect.height);
    objects.push(pipG);
    if (entry.cost !== null) {
      const pipText = label(this, headerRect.x + pipWidth / 2, headerRect.y + headerRect.height / 2, String(entry.cost), typeRole.rowTitle, surface.paper.hex, 1).setOrigin(0.5);
      objects.push(pipText);
    }
    const nameX = headerRect.x + pipWidth + 6;
    const name = this.add.text(nameX, headerRect.y + 2, entry.name, { ...textStyle(typeRole.barTitle, surface.ink.hex), fontSize: "12px" });
    fitText(name, cardRect.width - pipWidth - 6 - 32, 12);
    objects.push(name);
    const typeText = label(this, nameX, headerRect.y + 2 + 13, entry.type.replace(/_/g, " "), typeRole.label, surface.ink.hex, ink.meta);
    objects.push(typeText);

    const headerRuleY = headerRect.y + headerRect.height;
    const headerRule = this.add.graphics();
    headerRule.fillStyle(surface.ink.hex, 1).fillRect(cardRect.x, headerRuleY, cardRect.width, 2);
    objects.push(headerRule);

    const artRect: Rect = { x: cardRect.x + 2, y: headerRuleY + 2, width: cardRect.width - 4, height: Math.max(0, cardRect.height - CELL_HEADER_HEIGHT - CELL_FOOTER_HEIGHT - 6) };
    const artFill = this.add.graphics();
    artFill.fillStyle(surface.parchment.hex, 1).fillRect(artRect.x, artRect.y, artRect.width, artRect.height);
    objects.push(artFill);
    const card = CARDS_BY_ID.get(entry.cardId as string);
    const key = cardArt(this).request(this, artFor(card, { kind: "front" }));
    const art = drawArt(this, key, artRect);
    if (art) objects.push(art);
    else objects.push(label(this, artRect.x + artRect.width / 2, artRect.y + artRect.height / 2, "no scan", typeRole.label, surface.ink.hex, ink.meta).setOrigin(0.5));

    const footerRuleY = artRect.y + artRect.height + 2;
    const footerRule = this.add.graphics();
    footerRule.fillStyle(surface.ink.hex, 1).fillRect(cardRect.x, footerRuleY, cardRect.width, 2);
    objects.push(footerRule);
    const ruleText = card && "text" in card ? truncate((card as unknown as { text: { current: string } }).text.current, 64) : "";
    if (ruleText) objects.push(this.add.text(cardRect.x + 6, footerRuleY + 4, ruleText, textStyle(typeRole.label, surface.ink.hex, ink.meta)).setWordWrapWidth(cardRect.width - 12).setMaxLines(2));

    // The "×N" copies badge, floating over the cell's own top-right corner (D04's own absolute-positioned badge).
    const qtyLabel = `×${entry.quantity}`;
    const qtyText = label(this, 0, 0, qtyLabel, typeRole.label, surface.paper.hex, 1);
    const qtyWidth = Math.ceil(qtyText.width) + 10;
    const qtyHeight = 16;
    const qtyBg = this.add.graphics();
    qtyBg.fillStyle(signal.heal.hex, 1).fillRect(cardRect.x + cardRect.width - qtyWidth, cardRect.y - 2, qtyWidth, qtyHeight);
    qtyText.setPosition(cardRect.x + cardRect.width - qtyWidth / 2, cardRect.y - 2 + qtyHeight / 2).setOrigin(0.5);
    objects.push(qtyBg, qtyText);

    return objects;
  }

  #inspect(entry: DeckListEntry): void {
    this.scene.launch(SCENES.inspect, { card: { cardId: entry.cardId, face: { kind: "front" } } });
  }
}

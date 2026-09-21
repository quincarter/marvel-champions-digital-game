/**
 * The Decks & Collection screen (PLAN.md Phase 9 / W9b, docs/phase4-screen-gaps.md
 * §3, D14): every precon plus every saved or imported deck, each with its
 * legality/playability status; a searchable, filterable list (S8); the
 * *selected* deck's own browsable card pool; its stats; import by paste
 * (works everywhere) and by MarvelCDB URL/id (dev/preview through the
 * same-origin route `vite-marvelcdb-import.ts` adds, and in a packaged app
 * through native HTTP — `platform/deck-fetch.ts`); save, delete, duplicate,
 * export, and "Play this deck ▸".
 *
 * **The composition, read straight off D14's own markup** (`ScreensDesktop_12`/
 * `_13`.png plus `Marvel Champions game screens/Screens - Desktop.dc.html`'s
 * `#s14` — see `view/decks-layout.ts`'s own header comment for the full
 * reasoning): an ink chrome bar (Back, a large Bangers screen title, a
 * right-aligned pool-count label) over a paper ground, then three columns —
 * **"YOUR DECKS"** (the list *owns* the column — search plus a collapsed-by-
 * default "Filters" toggle in one compact row, then deck cards filling
 * whatever's left, ink-filled selected with its record shown only there,
 * red-bordered illegal/WIP, "+ NEW DECK" as the list's own last row, a small
 * group label folded into the top of each group's first card rather than its
 * own full-height row, then a *compact* parchment Import/Export box pinned to
 * the column's bottom with its paste/MarvelCDB/export fields collapsed behind
 * three small buttons), **"CARD POOL"** (the *selected* deck's own browsable
 * legal cards, filter chips right-aligned on the header's own rule line, each
 * cell's art, a cost pip, and an uppercase "TYPE · X OF Y IN DECK" caption),
 * and the **ink stats rail** (a large Bangers deck title, curve bars with the
 * deck's most-common costs in red, composition tiles as a label over a
 * Bangers number, "Recently changed", ending in DUPLICATE + the single red
 * "PLAY THIS DECK ▸"). Narrow screens get the same three groups behind a
 * "Decks"/"Cards"/"Stats" tab strip.
 *
 * **Deliberately not the mock, each noted where it happens:** the mock's
 * Import/Export box shows description text only — this build already has
 * paste-import, MarvelCDB-import and export, so those controls live inside
 * that box, collapsed behind small buttons so the box stays compact by
 * default. The deck note and owned-card tracking are both skipped per
 * docs/phase4-screen-gaps.md §4 (advice text and owned-card tracking are
 * undecided/out of scope) — the header's right-aligned label says the real
 * pool size ("CARD POOL · N CARDS") rather than the mock's "Core Set · N of N
 * owned" wording, since this pool already spans Core and wave 1 and "Core
 * Set" would misstate that (docs/phase4-screen-gaps.md §5's own standard).
 * S8's search field and quick-filter chips (added after D14 was drawn) sit
 * above the deck list, collapsed by default so they cost one compact row
 * rather than crowding the list out. A precon's card title is its short
 * "HERO / ASPECT" form (its long printed name moves into the meta line);
 * a saved/imported deck's title is simply its own name, already short because
 * a player chose it. Check/Edit/Delete — real, needed actions the mock
 * doesn't draw at all — live as a row of small buttons in the stats rail,
 * under the composition tiles, so the rail's own footer still ends in exactly
 * Duplicate + the red Play button, as designed. The pool's art area draws a
 * real card's own 2.5:3.5 shape rather than the mock's arbitrarily-tall
 * placeholder box (`view/deck-pool-grid.ts`'s own header comment). Not
 * reproduced: the mock's red ring on a hovered/focused pool cell — this
 * screen's per-cell objects are torn down and redrawn on every scene
 * `#rebuild()` (`ui/virtual-list.ts`'s own documented pattern), so a
 * pointer-move-driven highlight would need a lighter-weight redraw path than
 * that; left as a follow-up rather than added under this pass's time budget.
 *
 * A deck row's tap **selects** it (updates the pool and stats panes) rather
 * than navigating away; a pool card's tap opens Inspect (this screen never
 * edits a deck's contents — that's `scenes/deck-builder.ts`, reached from
 * "Edit"). Every legality/playability/record fact shown here is `@mc/engine`'s
 * own (`view/deck-list-model.ts`'s `deckOptionsOf`, `view/deck-status.ts` for
 * the chip's words, `view/results-history.ts` for the record) — this scene
 * never decides whether a deck is legal or what its record is.
 */

import Phaser from "phaser";
import {
  parseMarvelCdbReference,
  type AnyCard,
  type CoreAspect,
  type Deck,
  type DeckId,
  type HeroIdentityCard,
} from "@mc/content";
import { DECK_MIN_CARDS } from "@mc/engine";
import { POOL_CARDS, POOL_DEPS, POOL_VERSION } from "../content/pool.js";
import { cardArt } from "../art/card-art.js";
import { artFor } from "../art/art-source.js";
import { drawArt } from "../art/card-art.js";
import { browsablePool, duplicateDeck, type PoolFilter } from "../view/deck-builder-model.js";
import {
  exportDecklistText,
  importFromMarvelCdbResponseText,
  importFromPasteText,
  type ImportEnv,
  type ImportOutcome,
} from "../view/deck-import-model.js";
import { deckOptionsOf, type DeckOption } from "../view/deck-list-model.js";
import { sortByRecency } from "../view/deck-recency.js";
import {
  compositionTilesOf,
  costCurveBars,
  deckStatsOf,
  type CompositionTile,
  type CostCurveBar,
} from "../view/deck-stats.js";
import { deckStatusOf } from "../view/deck-status.js";
import { cardTitleOf, deckMetaLine, SOURCE_LABEL } from "../view/deck-title.js";
import { decksLayout, type DecksTab } from "../view/decks-layout.js";
import { poolCellRect, poolColumnAt, poolGridGeometry, type PoolGridGeometry } from "../view/deck-pool-grid.js";
import {
  deckSourcesOf,
  heroAspectsOf,
  heroRosterMatches,
  withSelectionPinned,
  type RosterFilter,
} from "../view/roster-filter.js";
import { decksFocusOrder } from "../view/screen-focus.js";
import { deckKeyToString, resultsHistoryOf, type DeckKey, type ResultsHistory } from "../view/results-history.js";
import { CHIP_GAP, minChipCellWidth } from "../view/chip-layout.js";
import { estimateWrappedLines, type Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { accent, border, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { caseOf, cssOf, textStyle } from "../ui/theme.js";
import {
  McButton,
  McMultilineInput,
  McTabs,
  McTextInput,
  fitText,
  label,
  paintDotGrid,
  paintPanel,
  sectionHeader,
} from "../ui/widgets.js";
import { appSession, deckStorage } from "../session.js";
import type { DeckBuilderSceneData } from "./deck-builder.js";
import type { DeckCheckSceneData } from "./deck-check.js";
import type { TitleSceneData } from "./title.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { fetchMarvelCdbDeck } from "../platform/deck-fetch.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";

/** What a caller (Title, on an `illegal_deck` refusal) hands over on launch. */
export interface DecksSceneData {
  /** Selected and scrolled into view; named in `message` — the deck `createGame` just refused. */
  readonly focusDeckId?: string | null;
  readonly message?: string | null;
}

/** Tall enough for a 1-line title + a 2-line precon meta + a selected row's record line, comfortably. */
const ROW_HEIGHT = 84;
/** How much of a group-starting row's own top is given to its small group label instead of the card. */
const GROUP_LABEL_HEIGHT = 16;
const CARDS_BY_ID = new Map<string, AnyCard>(POOL_CARDS.map((card) => [card.id as string, card]));

const IMPORT_EXPORT_DESCRIPTION =
  "Paste a decklist or drop a .txt from MarvelCDB. Exports carry the aspect and hero set.";

/** A compact chip/button row's own height — smaller than `hit.target`'s 44px touch target, matching D14's small filter/action controls (point 2/3/5 of the 2026-09-18 fidelity pass). Still comfortably tappable. */
const COMPACT_ROW = 28;

/** A deck card's own Bangers title, sized for a compact list row (`typeRole.barTitle` at the screen-title 22px doesn't fit two decks' worth of name on one row's own line). */
const CARD_TITLE_TYPE = { ...typeRole.barTitle, size: 18, letterSpacing: 0.6 };

/** One row of the deck list: a deck row (optionally the first of a group, carrying that group's small label) or the trailing "+ New deck" tile (never filtered out, always the list's own last row) — see the module doc comment for why a group no longer gets its own full-height row. */
type DeckRow =
  | { readonly kind: "deck"; readonly option: DeckOption; readonly groupLabel?: string }
  | { readonly kind: "newDeck" }
  | { readonly kind: "message"; readonly text: string };

/** `deck`'s namespaced record key — the same one `view/results-history.ts` keys `DeckRecord` by. */
function keyOf(deck: Deck): DeckKey {
  return deck.source.kind === "precon"
    ? { kind: "starter", starterDeckId: deck.source.starterDeckId as string }
    : { kind: "custom", deckId: deck.id as string };
}

/** One chip/button's own natural width — never less than it needs (`minChipCellWidth`'s own estimate is deliberately conservative), so a row of these can never truncate the way equal-width division could. */
interface ChipDef {
  readonly id: string;
  readonly text: string;
  readonly selected: boolean;
  readonly onClick: () => void;
}

interface PlacedChip {
  readonly chip: ChipDef;
  readonly rect: Rect;
}

/**
 * Packs `chips` at their own natural width (2026-09-18 fidelity pass, point 6: the truncation this screen's own
 * quick-filter and pool-filter chips used to show came from dividing a row's width *equally* among every chip in
 * it — `view/chip-layout.ts`'s `wrapChipsToRows`, built for exactly that shape — rather than from the width
 * estimate itself being wrong. Giving each chip exactly the width `minChipCellWidth` already says it needs removes
 * the truncation risk structurally, without touching that estimate or the other screens still using equal-width
 * rows). `align: "right"` packs each row from the row's own right edge backward (D14's own pool-filter placement).
 */
function packChipsNatural(
  chips: readonly ChipDef[],
  x: number,
  y: number,
  maxWidth: number,
  rowHeight: number,
  align: "left" | "right" = "left",
): { readonly placed: readonly PlacedChip[]; readonly bottom: number } {
  const rows: { chip: ChipDef; width: number }[][] = [];
  let current: { chip: ChipDef; width: number }[] = [];
  let currentWidth = 0;
  for (const chip of chips) {
    const width = minChipCellWidth(chip.text);
    const needed = current.length === 0 ? width : currentWidth + CHIP_GAP + width;
    if (current.length > 0 && needed > maxWidth) {
      rows.push(current);
      current = [{ chip, width }];
      currentWidth = width;
    } else {
      current.push({ chip, width });
      currentWidth = needed;
    }
  }
  if (current.length > 0) rows.push(current);

  const placed: PlacedChip[] = [];
  rows.forEach((row, rowIndex) => {
    const rowY = y + rowIndex * (rowHeight + CHIP_GAP);
    const rowWidth = row.reduce((sum, entry, index) => sum + entry.width + (index > 0 ? CHIP_GAP : 0), 0);
    let cursorX = align === "right" ? x + maxWidth - rowWidth : x;
    for (const { chip, width } of row) {
      placed.push({ chip, rect: { x: cursorX, y: rowY, width, height: rowHeight } });
      cursorX += width + CHIP_GAP;
    }
  });
  return { placed, bottom: rows.length === 0 ? y : y + rows.length * (rowHeight + CHIP_GAP) - CHIP_GAP };
}

/** How tall the compact Import/Export box needs to be at `column` px wide, in its current accordion state — used both to reserve room above it and to draw it, so the two can't drift apart. */
function importExportBoxHeight(column: number, open: "paste" | "marvelcdb" | null): number {
  const pad = 12;
  const descLines = estimateWrappedLines(IMPORT_EXPORT_DESCRIPTION, column - pad * 2, 4.6);
  let height = pad * 2 + 16 + descLines * 13 + 8 + COMPACT_ROW + 8; // padding + heading + description + button row
  if (open === "paste") height += 64 + 8 + COMPACT_ROW + 8; // textarea + its own Import button
  if (open === "marvelcdb") height += COMPACT_ROW + 8 + COMPACT_ROW + 8; // URL field + its own Import button
  return height;
}

export class DecksScene extends Phaser.Scene {
  #savedDecks: readonly Deck[] = [];
  #data: DecksSceneData = {};
  /** The banner under the header. A success and a failure look different: an import that worked was drawn in error red. */
  #status: { readonly text: string; readonly tone: "success" | "error" } | null = null;
  #busy = false;
  #pasteText = "";
  #marvelcdbText = "";
  #pasteInput: McMultilineInput | null = null;
  #marvelcdbInput: McTextInput | null = null;
  #searchInput: McTextInput | null = null;
  #filter: RosterFilter = { text: "" };
  /** Collapsed by default (2026-09-18 fidelity pass, point 2): the quick-filter chips cost nothing until asked for, so the deck list itself gets the column's room. */
  #filtersExpanded = false;
  /** Which of the Import/Export box's two fields is open, if either — collapsed by default so the box stays compact and pinned at the column's bottom. */
  #importExportOpen: "paste" | "marvelcdb" | null = null;
  #poolAspectFilter: CoreAspect | "basic" | "identity" | null = null;
  #poolSortByCost = false;
  #selectedDeckId: string | null = null;
  #activeTab: DecksTab = "decks";
  #history: ResultsHistory | null = null;
  #buttons: McButton[] = [];
  #tabs: McTabs | null = null;
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();
  /** Both lists are recreated every rebuild (`ui/virtual-list.ts`); only their scroll positions persist, in these fields. */
  #list: McVirtualList | null = null;
  #listScroll = new ListScroll();
  #poolList: McVirtualList | null = null;
  #poolListScroll = new ListScroll();
  #focusedOnce = false;

  constructor() {
    super(SCENES.decks);
  }

  create(data: DecksSceneData = {}): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#data = data;
    // Title only sends a message here when a deck could not be seated.
    this.#status = data.message ? { text: data.message, tone: "error" } : null;
    this.#savedDecks = [];
    this.#busy = false;
    this.#pasteText = "";
    this.#marvelcdbText = "";
    this.#filter = { text: "" };
    this.#filtersExpanded = false;
    this.#importExportOpen = null;
    this.#poolAspectFilter = null;
    this.#poolSortByCost = false;
    this.#selectedDeckId = data.focusDeckId ?? null;
    this.#activeTab = "decks";
    this.#history = null;
    this.#listScroll = new ListScroll();
    this.#poolListScroll = new ListScroll();
    this.#focusedOnce = false;

    const onResize = (): void => this.#rebuild();
    this.scale.on("resize", onResize, this);
    appSession().music?.playTitle();
    const artOff = cardArt(this).onArrived(() => this.#rebuild());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      artOff();
      this.#pasteInput?.destroy();
      this.#pasteInput = null;
      this.#marvelcdbInput?.destroy();
      this.#marvelcdbInput = null;
      this.#searchInput?.destroy();
      this.#searchInput = null;
      this.#tabs?.destroy();
      this.#tabs = null;
      this.#list?.destroy();
      this.#list = null;
      this.#poolList?.destroy();
      this.#poolList = null;
    });
    this.#route = new FocusRoute(this, {
      blocked: () =>
        this.scene.isActive(SCENES.inspect) ||
        (this.#pasteInput?.focused ?? false) ||
        (this.#marvelcdbInput?.focused ?? false) ||
        (this.#searchInput?.focused ?? false),
      onPage: (direction) =>
        this.#activeTab === "cards" ? this.#poolList?.scrollByPage(direction) : this.#list?.scrollByPage(direction),
      onHomeEnd: (edge) => {
        const list = this.#activeTab === "cards" ? this.#poolList : this.#list;
        if (edge === "home") list?.scrollToStart();
        else list?.scrollToEnd();
      },
    });

    this.#rebuild();
    fadeScreenIn(this);
    void deckStorage()
      .list()
      .then((decks) => {
        if (!this.sys.isActive()) return;
        this.#savedDecks = decks;
        this.#rebuild();
      });
    void appSession()
      .store.listSaves()
      .then((saves) => {
        if (!this.sys.isActive()) return;
        this.#history = resultsHistoryOf(saves);
        this.#rebuild();
      });
  }

  /** Precons (fixed order) plus saved decks, most recently changed first (W9's "Recently changed") — `deckOptionsOf` already puts precons ahead of whatever list it's given. */
  #deckOptions(): readonly DeckOption[] {
    return deckOptionsOf(sortByRecency(this.#savedDecks), POOL_CARDS, POOL_VERSION, POOL_DEPS);
  }

  #identityOf(deck: Deck): HeroIdentityCard | null {
    const card = CARDS_BY_ID.get(deck.identityCardId as string);
    return card?.type === "hero_identity" ? card : null;
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();
    this.#tabs?.destroy();
    this.#tabs = null;
    // Both lists are recreated fresh every rebuild, in the normal draw order (`ui/virtual-list.ts` — reattaching
    // one across a sweep put it ahead of whatever the scene drew afterward, so a later background panel ended up
    // on top of it). Their scroll positions live in `#listScroll`/`#poolListScroll`, which survive this regardless.
    this.#list?.destroy();
    this.#list = null;
    this.#poolList?.destroy();
    this.#poolList = null;

    const { width, height } = this.scale.gameSize;
    const layout = decksLayout({ width, height });

    // The three list-pane DOM text fields (search, paste, MarvelCDB) belong to whatever draws the "Decks" group on
    // this pass — wide always draws them; narrow only while the "Decks" tab is active. They aren't Phaser
    // display-list objects (`McTextInput`/`McMultilineInput` are DOM-backed rexUI), so switching tabs and never
    // destroying them would leave them floating over another pane forever, invisible to
    // `destroyChildren(scene)` below — found in the browser switching tabs at a narrow width.
    const showListFields = layout.wide || this.#activeTab === "decks";
    if (!showListFields) {
      this.#searchInput?.destroy();
      this.#searchInput = null;
      this.#pasteInput?.destroy();
      this.#pasteInput = null;
      this.#marvelcdbInput?.destroy();
      this.#marvelcdbInput = null;
    }

    // The surviving DOM text fields survive the sweep: every object they draw with is detached first and handed
    // back after, in the same order. The paste field is a rexUI sizer with children of its own in the display
    // list, so its root alone is not enough (`McMultilineInput.gameObjects`).
    const kept = [
      ...(this.#pasteInput?.gameObjects ?? []),
      ...(this.#marvelcdbInput ? [this.#marvelcdbInput.gameObject] : []),
      ...(this.#searchInput ? [this.#searchInput.gameObject] : []),
    ];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);

    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", { spacing: 6, radius: 1, alpha: 0.1 });

    // The ink chrome bar behind Back and the title, over the paper ground everything else draws on.
    const chrome = this.add.graphics();
    paintPanel(chrome, { x: 0, y: 0, width, height: layout.header.y + layout.header.height + 16 }, "onInk", "rest");

    const backRect: Rect = { x: layout.header.x, y: layout.header.y, width: 100, height: layout.header.height };
    const goBack = (): void => {
      goToScreen(this, SCENES.title);
    };
    this.#buttons.push(
      new McButton(this, { kind: "onInk", label: "◂ Title", type: typeRole.rowTitle, rect: backRect, onClick: goBack }),
    );
    this.#stops.set("back", { rect: backRect, activate: goBack });

    // The header's right-aligned meta label: the real pool size, never an owned-card claim (docs/phase4-screen-gaps.md
    // §4/§5) — worded "CARD POOL", not the mock's "Core Set", since this pool already spans Core and wave 1. Skipped
    // at phone width: it isn't essential there, and crowding the actual screen title into truncating for its sake
    // would be a legibility loss for a "nice to have" line.
    const poolMeta =
      layout.formFactor === "phone"
        ? null
        : label(
            this,
            layout.header.x + layout.header.width,
            layout.header.y + layout.header.height / 2,
            `Card pool · ${POOL_CARDS.length} cards`,
            typeRole.label,
            surface.paper.hex,
            ink.label,
          ).setOrigin(1, 0.5);

    // A large Bangers screen title beside the Back button (point 1 of the 2026-09-18 fidelity pass: D14's own
    // title reads far bigger than a bar-title chip's usual 22px).
    const title = this.add.text(
      backRect.x + backRect.width + 12,
      layout.header.y + layout.header.height / 2,
      "DECKS & COLLECTION",
      { ...textStyle(typeRole.barTitle, surface.paper.hex), fontSize: "28px" },
    );
    title.setOrigin(0, 0.5);
    fitText(title, layout.header.width - backRect.width - 24 - (poolMeta ? poolMeta.width + 16 : 0), 28);

    const allOptions = this.#deckOptions();
    if (this.#selectedDeckId === null || !allOptions.some((o) => (o.deck.id as string) === this.#selectedDeckId)) {
      const wanted = !this.#focusedOnce ? this.#data.focusDeckId : null;
      this.#selectedDeckId =
        (wanted && allOptions.some((o) => (o.deck.id as string) === wanted)
          ? wanted
          : (allOptions[0]?.deck.id as string | undefined)) ?? null;
    }
    const selected = allOptions.find((o) => (o.deck.id as string) === this.#selectedDeckId) ?? null;

    if (layout.wide) {
      const deckIds = this.#drawListPane(layout.listPane!, allOptions, selected);
      const poolCardIds = this.#drawPoolPane(layout.poolPane!, selected);
      this.#drawStatsPane(layout.statsPane!, selected);
      this.#route?.set(
        decksFocusOrder({
          showMarvelCdbImport: true,
          deckIds,
          chipIds: this.#chipDefs(allOptions).map((c) => c.id),
          poolCardIds,
          poolChipIds: selected ? this.#poolChipDefs(selected.deck).map((c) => c.id) : [],
          wide: true,
          activeTab: this.#activeTab,
          hasSelection: selected !== null,
          editable: selected !== null && selected.deck.source.kind !== "precon",
          filtersExpanded: this.#filtersExpanded,
          importOpen: this.#importExportOpen,
        }),
        this.#stops,
      );
    } else {
      this.#tabs = new McTabs(this, {
        rect: layout.tabs!,
        tabs: [
          { id: "decks", label: "Decks" },
          { id: "cards", label: "Cards" },
          { id: "stats", label: "Stats" },
        ],
        activeId: this.#activeTab,
        onSelect: (id) => this.#setTab(id as DecksTab),
      });
      const tabCell = (index: number): Rect => ({
        ...layout.tabs!,
        x: layout.tabs!.x + (index * layout.tabs!.width) / 3,
        width: layout.tabs!.width / 3,
      });
      this.#stops.set("tab:decks", { rect: tabCell(0), activate: () => this.#setTab("decks") });
      this.#stops.set("tab:cards", { rect: tabCell(1), activate: () => this.#setTab("cards") });
      this.#stops.set("tab:stats", { rect: tabCell(2), activate: () => this.#setTab("stats") });

      let deckIds: readonly string[] = [];
      let poolCardIds: readonly string[] = [];
      if (this.#activeTab === "decks") deckIds = this.#drawListPane(layout.content!, allOptions, selected);
      else if (this.#activeTab === "cards") poolCardIds = this.#drawPoolPane(layout.content!, selected);
      else this.#drawStatsPane(layout.content!, selected);

      this.#route?.set(
        decksFocusOrder({
          showMarvelCdbImport: true,
          deckIds,
          chipIds: this.#activeTab === "decks" ? this.#chipDefs(allOptions).map((c) => c.id) : [],
          poolCardIds,
          poolChipIds:
            this.#activeTab === "cards" && selected ? this.#poolChipDefs(selected.deck).map((c) => c.id) : [],
          wide: false,
          activeTab: this.#activeTab,
          hasSelection: selected !== null,
          editable: selected !== null && selected.deck.source.kind !== "precon",
          filtersExpanded: this.#filtersExpanded,
          importOpen: this.#importExportOpen,
        }),
        this.#stops,
      );
    }
  }

  #setTab(tab: DecksTab): void {
    if (tab === this.#activeTab) return;
    this.#activeTab = tab;
    this.#listScroll.reset();
    this.#poolListScroll.reset();
    this.#rebuild();
  }

  // ------------------------------------------------------------------------------------------------------------
  // The deck list pane (2026-09-18 fidelity pass, point 2): search plus a collapsed-by-default "Filters" toggle
  // in one compact row, then the list itself — the pane's dominant element — ending in "+ New deck", then a
  // compact, bottom-pinned Import/Export box. Returns the deck ids actually offered as rows, in list order, for
  // the focus route.
  // ------------------------------------------------------------------------------------------------------------
  #drawListPane(rect: Rect, allOptions: readonly DeckOption[], selected: DeckOption | null): readonly string[] {
    const left = rect.x;
    const column = rect.width;
    let y = sectionHeader(this, rect.x, rect.y, column, "Your decks");

    if (this.#status) {
      const banner = this.add
        .text(
          left,
          y,
          this.#status.text,
          textStyle(typeRole.body, this.#status.tone === "error" ? accent.redDeep.hex : signal.heal.hex),
        )
        .setWordWrapWidth(column);
      y += banner.height + 10;
    }

    // Search plus the "Filters" toggle share one compact row (point 2: "keep search as one compact row").
    const filtersToggleWidth = 78;
    const searchRect: Rect = { x: left, y, width: column - filtersToggleWidth - CHIP_GAP, height: COMPACT_ROW };
    if (this.#searchInput) this.#searchInput.layout(searchRect);
    else {
      this.#searchInput = new McTextInput(this, {
        rect: searchRect,
        value: this.#filter.text,
        placeholder: "search decks…",
        onChange: (value) => {
          this.#filter = { ...this.#filter, text: value };
          this.#rebuild();
        },
      });
    }
    this.#stops.set("deck-search", { rect: searchRect, activate: () => this.#searchInput?.focus() });
    const filtersToggleRect: Rect = {
      x: left + column - filtersToggleWidth,
      y,
      width: filtersToggleWidth,
      height: COMPACT_ROW,
    };
    const toggleFilters = (): void => {
      this.#filtersExpanded = !this.#filtersExpanded;
      this.#rebuild();
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: this.#filtersExpanded ? "Filters ▴" : "Filters ▾",
        type: typeRole.label,
        rect: filtersToggleRect,
        selected: this.#filtersExpanded,
        onClick: toggleFilters,
      }),
    );
    this.#stops.set("filters-toggle", { rect: filtersToggleRect, activate: toggleFilters });
    y += COMPACT_ROW + 8;

    const chipDefs = this.#filtersExpanded ? this.#chipDefs(allOptions) : [];
    if (chipDefs.length > 0) {
      const packed = packChipsNatural(chipDefs, left, y, column, COMPACT_ROW);
      for (const { chip, rect: cell } of packed.placed) {
        this.#buttons.push(
          new McButton(this, {
            kind: "secondary",
            label: chip.text,
            type: typeRole.label,
            rect: cell,
            selected: chip.selected,
            onClick: chip.onClick,
          }),
        );
        this.#stops.set(`deck-chip:${chip.id}`, { rect: cell, activate: chip.onClick });
      }
      y = packed.bottom + 10;
    }

    // Reserve fixed room at the bottom for the Import/Export box, so the list gets exactly whatever's left.
    const boxHeight = importExportBoxHeight(column, this.#importExportOpen);
    const listTop = y;
    const listHeight = Math.max(ROW_HEIGHT, rect.y + rect.height - boxHeight - 12 - listTop);
    const listRect: Rect = { x: left, y: listTop, width: column, height: listHeight };

    const rows = this.#buildRows(allOptions);
    const deckIds = rows
      .filter((r): r is Extract<DeckRow, { kind: "deck" }> => r.kind === "deck")
      .map((r) => r.option.deck.id as string);

    const renderRow = (index: number, rowRect: Rect): VirtualListRow => this.#renderDeckRow(rowRect, rows[index]!);
    // Rows carry no button of their own (every action lives in the stats pane, acting on the selection, and the
    // deck-editing entry is "Edit" there), so a tap or click reaches a row only through the list's
    // `onRowActivate`. Without it the keyboard could select a deck and the pointer could not. Right-click is the
    // desktop Inspect gesture, as everywhere else.
    const onRowActivate = (index: number, pointer: Phaser.Input.Pointer): void => {
      const row = rows[index];
      if (row?.kind === "newDeck") {
        this.#openBuilder();
        return;
      }
      if (row?.kind !== "deck") return;
      if (pointer.rightButtonReleased()) {
        this.#inspectDeck(row.option);
        return;
      }
      this.#selectedDeckId = row.option.deck.id as string;
      this.#rebuild();
    };
    this.#list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: ROW_HEIGHT,
      count: rows.length,
      renderRow,
      scroll: this.#listScroll,
      onRowActivate,
    });
    const list = this.#list;
    if (!this.#focusedOnce && this.#data.focusDeckId) {
      const index = rows.findIndex(
        (row) => row.kind === "deck" && (row.option.deck.id as string) === this.#data.focusDeckId,
      );
      if (index >= 0) list.scrollIntoView(index);
      this.#focusedOnce = true;
    }
    rows.forEach((row, index) => {
      if (row.kind === "newDeck") {
        this.#stops.set("new-deck", {
          rect: () => list.rectFor(index),
          activate: () => this.#openBuilder(),
          ensureVisible: () => list.scrollIntoView(index),
        });
        return;
      }
      if (row.kind === "message") return;
      const deckId = row.option.deck.id as string;
      const ensureVisible = (): void => list.scrollIntoView(index);
      const select = (): void => {
        this.#selectedDeckId = deckId;
        this.#rebuild();
      };
      const doInspect = (): void => this.#inspectDeck(row.option);
      this.#stops.set(`deck:${deckId}`, {
        rect: () => list.rectFor(index),
        activate: select,
        inspect: doInspect,
        ensureVisible,
      });
    });
    y = listRect.y + listRect.height + 12;

    this.#drawImportExportBox({ x: left, y, width: column, height: boxHeight }, selected);

    return deckIds;
  }

  #openBuilder(): void {
    goToScreen(this, SCENES.deckBuilder, {} satisfies DeckBuilderSceneData);
  }

  /** S8's quick-filter chips for this list: aspect, source, and "Legal only" (this screen's own version of "playable now" — a deck's own legality, not a seating question). Only asked for while the "Filters" toggle is expanded. */
  #chipDefs(allOptions: readonly DeckOption[]): readonly ChipDef[] {
    const decks = allOptions.map((o) => o.deck);
    const defs: ChipDef[] = [];
    for (const aspect of heroAspectsOf(decks)) {
      defs.push({
        id: `aspect:${aspect}`,
        text: aspect,
        selected: this.#filter.aspect === aspect,
        onClick: () => {
          this.#filter = { ...this.#filter, aspect: this.#filter.aspect === aspect ? null : aspect };
          this.#rebuild();
        },
      });
    }
    for (const source of deckSourcesOf(decks)) {
      defs.push({
        id: `source:${source}`,
        text: SOURCE_LABEL[source],
        selected: this.#filter.source === source,
        onClick: () => {
          this.#filter = { ...this.#filter, source: this.#filter.source === source ? null : source };
          this.#rebuild();
        },
      });
    }
    defs.push({
      id: "legal-only",
      text: "Legal only",
      selected: this.#filter.playableOnly === true,
      onClick: () => {
        this.#filter = { ...this.#filter, playableOnly: !this.#filter.playableOnly };
        this.#rebuild();
      },
    });
    return defs;
  }

  /**
   * `allOptions` grouped into Preconstructed / Your decks (recently changed first), filtered by search + chips,
   * with the selected deck pinned into view even if the filter would otherwise hide it, then "+ New deck" as the
   * list's own last row (never filtered out). A group's label rides on its own first card (`groupLabel`) rather
   * than a separate full-height row — see the module doc comment for why.
   */
  #buildRows(allOptions: readonly DeckOption[]): readonly DeckRow[] {
    const identityOf = (option: DeckOption): AnyCard | undefined =>
      CARDS_BY_ID.get(option.deck.identityCardId as string);
    const matches = (option: DeckOption): boolean =>
      heroRosterMatches(option.deck, identityOf(option), this.#filter, option.blockedReason);
    const isSelected = (option: DeckOption): boolean => (option.deck.id as string) === this.#selectedDeckId;

    const precons = allOptions.filter((o) => o.deck.source.kind === "precon");
    const saved = allOptions.filter((o) => o.deck.source.kind !== "precon");
    const filteredPrecons = withSelectionPinned(precons, matches, isSelected);
    const filteredSaved = withSelectionPinned(saved, matches, isSelected);

    const rows: DeckRow[] = [];
    filteredPrecons.forEach((option, index) =>
      rows.push({ kind: "deck", option, ...(index === 0 ? { groupLabel: "Preconstructed" } : {}) }),
    );
    filteredSaved.forEach((option, index) =>
      rows.push({
        kind: "deck",
        option,
        ...(index === 0 ? { groupLabel: "Your decks · recently changed first" } : {}),
      }),
    );
    if (rows.length === 0) rows.push({ kind: "message", text: "No decks match this search." });
    rows.push({ kind: "newDeck" });
    return rows;
  }

  #renderDeckRow(rect: Rect, row: DeckRow): VirtualListRow {
    if (row.kind === "message") {
      const text = this.add
        .text(rect.x + 4, rect.y + 8, row.text, textStyle(typeRole.body, surface.ink.hex, ink.meta))
        .setWordWrapWidth(rect.width - 8);
      return { objects: [text] };
    }

    if (row.kind === "newDeck") {
      const tileRect: Rect = { x: rect.x + 4, y: rect.y + 2, width: rect.width - 8, height: rect.height - 4 };
      const g = this.add.graphics();
      paintPanel(g, tileRect, "quiet", "unavailable");
      const text = label(
        this,
        tileRect.x + tileRect.width / 2,
        tileRect.y + tileRect.height / 2,
        "+ New deck",
        typeRole.rowTitle,
        surface.ink.hex,
        ink.body,
      ).setOrigin(0.5);
      return { objects: [g, text] };
    }

    const option = row.option;
    const selected = (option.deck.id as string) === this.#selectedDeckId;
    const status = deckStatusOf(option);
    const illegal = status.tone === "illegal";
    const objects: Phaser.GameObjects.GameObject[] = [];

    // A group-starting row gives its own top `GROUP_LABEL_HEIGHT` to a small label instead of a separate
    // full-height row (2026-09-18 fidelity pass, point 2: "group headers stay as small labels without eating a
    // whole row's height").
    let cardTop = rect.y + 2;
    if (row.groupLabel) {
      const groupText = label(this, rect.x + 4, rect.y + 2, row.groupLabel, typeRole.label, surface.ink.hex, ink.label);
      objects.push(groupText);
      cardTop = rect.y + GROUP_LABEL_HEIGHT;
    }
    const card: Rect = { x: rect.x + 4, y: cardTop, width: rect.width - 8, height: rect.y + rect.height - 4 - cardTop };

    // D14's own three row states: the selected deck is ink-filled with paper text (`#s14`'s
    // `background:#14110E;color:#F4EFE3`), an illegal/WIP deck gets a red border and red title, everything else
    // is plain paper with an ink border. Custom-painted rather than `paintPanel("card", …)`, whose own "selected"
    // state fills white with a red ring (the board's own selection look) — this row's ink fill is D14's own,
    // different convention for "this is the one you're looking at".
    const g = this.add.graphics();
    const fill = selected ? surface.ink.hex : surface.card.hex;
    const stroke = illegal ? accent.heroRed.hex : surface.ink.hex;
    g.fillStyle(fill, 1).fillRect(card.x, card.y, card.width, card.height);
    g.lineStyle(selected || illegal ? border.object : border.control, stroke, 1).strokeRect(
      card.x,
      card.y,
      card.width,
      card.height,
    );
    objects.push(g);

    const titleColor = selected ? surface.paper.hex : illegal ? accent.heroRed.hex : surface.ink.hex;
    const metaColor = selected ? surface.paper.hex : surface.ink.hex;
    const metaAlpha = selected ? ink.secondary : ink.meta;

    // The short "HERO / ASPECT" title for a precon, or the deck's own name otherwise (`cardTitleOf`) — Bangers,
    // fit to width rather than truncated mid-word where that's avoidable (point 2).
    const name = this.add.text(
      card.x + 10,
      card.y + 8,
      caseOf(CARD_TITLE_TYPE, cardTitleOf(option)),
      textStyle(CARD_TITLE_TYPE, titleColor),
    );
    fitText(name, card.width - 20, CARD_TITLE_TYPE.size);
    objects.push(name);
    const meta = this.add.text(
      card.x + 10,
      card.y + 8 + name.height + 3,
      deckMetaLine(option, POOL_CARDS),
      textStyle(typeRole.label, metaColor, metaAlpha),
    );
    // One line, shrunk or clipped to fit: a wrapped meta line ran into the selected card's record line.
    fitText(meta, card.width - 20, typeRole.label.size);
    objects.push(meta);

    // Only the *selected* row shows its record (D14's own placement, `#s14`: the "Last played · record" line sits
    // inside the deck row, not the stats rail).
    if (selected) {
      const record =
        this.#history?.decks.find((r) => deckKeyToString(r.key) === deckKeyToString(keyOf(option.deck))) ?? null;
      const recordText =
        record && record.gamesPlayed > 0
          ? `Last played ${record.lastPlayedAt ? new Date(record.lastPlayedAt).toLocaleDateString() : "—"} · ${record.wins}–${record.losses} record`
          : "Never played.";
      objects.push(
        this.add.text(
          card.x + 10,
          card.y + card.height - 16,
          recordText,
          textStyle(typeRole.label, surface.paper.hex, ink.meta),
        ),
      );
    }

    return { objects };
  }

  /**
   * The Import/Export box (2026-09-18 fidelity pass, point 2): a compact parchment box pinned to the column's
   * bottom, matching D14's own footprint — a heading, two lines of description, and one row of small "Paste" /
   * "MarvelCDB" / "Export" buttons. Paste and MarvelCDB are an accordion: clicking one opens its own field (and
   * closes the other, so the box never shows both at once); Export always acts immediately on the selected deck.
   */
  #drawImportExportBox(rect: Rect, selected: DeckOption | null): void {
    const g = this.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(border.object, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);

    const left = rect.x + 12;
    const column = rect.width - 24;
    let y = rect.y + 12;

    label(this, left, y, "import / export", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const desc = this.add
      .text(left, y, IMPORT_EXPORT_DESCRIPTION, {
        ...textStyle(typeRole.body, surface.ink.hex, ink.secondary),
        fontSize: "10px",
      })
      .setWordWrapWidth(column);
    y += desc.height + 8;

    const toggle = (which: "paste" | "marvelcdb"): void => {
      this.#importExportOpen = this.#importExportOpen === which ? null : which;
      this.#rebuild();
    };
    const buttonGap = 6;
    const buttonWidth = (column - buttonGap * 2) / 3;
    const pasteToggleRect: Rect = { x: left, y, width: buttonWidth, height: COMPACT_ROW };
    const mcdbToggleRect: Rect = { x: left + buttonWidth + buttonGap, y, width: buttonWidth, height: COMPACT_ROW };
    const exportRect: Rect = { x: left + (buttonWidth + buttonGap) * 2, y, width: buttonWidth, height: COMPACT_ROW };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Paste",
        type: typeRole.label,
        rect: pasteToggleRect,
        selected: this.#importExportOpen === "paste",
        onClick: () => toggle("paste"),
      }),
    );
    this.#stops.set("ie-paste-toggle", { rect: pasteToggleRect, activate: () => toggle("paste") });
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "CDB link",
        type: typeRole.label,
        rect: mcdbToggleRect,
        selected: this.#importExportOpen === "marvelcdb",
        onClick: () => toggle("marvelcdb"),
      }),
    );
    this.#stops.set("ie-marvelcdb-toggle", { rect: mcdbToggleRect, activate: () => toggle("marvelcdb") });
    const doExport = (): void => {
      if (selected) this.#exportToClipboard(selected.deck);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Export",
        type: typeRole.label,
        rect: exportRect,
        enabled: selected !== null,
        ...(selected ? {} : { reason: "Select a deck first." }),
        onClick: doExport,
      }),
    );
    this.#stops.set("ie-export", { rect: exportRect, activate: doExport });
    y += COMPACT_ROW + 8;

    if (this.#importExportOpen === "paste") {
      const pasteRect: Rect = { x: left, y, width: column, height: 64 };
      if (this.#pasteInput) this.#pasteInput.layout(pasteRect);
      else {
        this.#pasteInput = new McMultilineInput(this, {
          rect: pasteRect,
          value: this.#pasteText,
          placeholder: "Hero: Spider-Man\nAspect: Justice\n2x Web-Shooter\n...",
          onChange: (value) => {
            this.#pasteText = value;
          },
        });
      }
      this.#stops.set("paste-field", { rect: pasteRect, activate: () => this.#pasteInput?.focus() });
      y += 64 + 8;
      const pasteImportRect: Rect = { x: left, y, width: column, height: COMPACT_ROW };
      const doPasteImport = (): void => void this.#importPaste();
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: this.#busy ? "Importing…" : "Import this decklist",
          type: typeRole.label,
          rect: pasteImportRect,
          enabled: !this.#busy,
          onClick: doPasteImport,
        }),
      );
      this.#stops.set("paste-import", { rect: pasteImportRect, activate: doPasteImport });
    } else {
      this.#pasteInput?.destroy();
      this.#pasteInput = null;
    }

    if (this.#importExportOpen === "marvelcdb") {
      // Always offered, not gated on `import.meta.env.DEV`: `vite preview` serves the same production bundle a
      // real deploy would (a genuine production deploy 404s instead — see `vite-marvelcdb-import.ts`).
      const mcdbFieldRect: Rect = { x: left, y, width: column, height: COMPACT_ROW };
      if (this.#marvelcdbInput) this.#marvelcdbInput.layout(mcdbFieldRect);
      else {
        this.#marvelcdbInput = new McTextInput(this, {
          rect: mcdbFieldRect,
          value: this.#marvelcdbText,
          type: typeRole.mono,
          placeholder: "marvelcdb.com/decklist/view/1234/... or a bare id",
          onChange: (value) => {
            this.#marvelcdbText = value;
          },
        });
      }
      this.#stops.set("marvelcdb-field", { rect: mcdbFieldRect, activate: () => this.#marvelcdbInput?.focus() });
      y += COMPACT_ROW + 8;
      const mcdbImportRect: Rect = { x: left, y, width: column, height: COMPACT_ROW };
      const doMcdbImport = (): void => void this.#importMarvelCdb();
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: this.#busy ? "Importing…" : "Import from MarvelCDB",
          type: typeRole.label,
          rect: mcdbImportRect,
          enabled: !this.#busy,
          onClick: doMcdbImport,
        }),
      );
      this.#stops.set("marvelcdb-import", { rect: mcdbImportRect, activate: doMcdbImport });
    } else {
      this.#marvelcdbInput?.destroy();
      this.#marvelcdbInput = null;
    }
  }

  // ------------------------------------------------------------------------------------------------------------
  // The card pool pane (D14): the *selected* deck's own browsable legal pool — its aspect(s), Basic and Hero
  // cards — filtered by one of those (radio-style; "all" clears it) and sortable by cost. Read-only browsing:
  // editing a deck's contents is `scenes/deck-builder.ts`'s job, reached from "Edit" in the stats pane.
  // ------------------------------------------------------------------------------------------------------------
  #drawPoolPane(rect: Rect, selected: DeckOption | null): readonly string[] {
    const left = rect.x;
    const column = rect.width;

    if (!selected) {
      const y = sectionHeader(this, left, rect.y, column, "Card pool");
      this.add
        .text(left, y, "Select a deck to browse its card pool.", textStyle(typeRole.body, surface.ink.hex, ink.meta))
        .setWordWrapWidth(column);
      return [];
    }
    const identity = this.#identityOf(selected.deck);
    if (!identity) {
      const y = sectionHeader(this, left, rect.y, column, "Card pool");
      this.add
        .text(
          left,
          y,
          "This deck's identity card isn't in the pool.",
          textStyle(typeRole.body, surface.ink.hex, ink.meta),
        )
        .setWordWrapWidth(column);
      return [];
    }

    // D14's own header shape (point 3 of the 2026-09-18 fidelity pass): small filter chips right-aligned on the
    // *same* line as "CARD POOL", the rule running only between the label and the first chip — not a full-width
    // rule followed by a separate row of full-height buttons.
    let y = this.#drawPoolHeader(left, rect.y, column, this.#poolChipDefs(selected.deck));

    const cards = this.#poolCards(selected.deck, identity);
    if (cards.length === 0) {
      this.add.text(left, y, "No cards match this filter.", textStyle(typeRole.body, surface.ink.hex, ink.meta));
      return [];
    }

    const geometry = poolGridGeometry(column, cards.length);
    const gridRect: Rect = {
      x: left,
      y,
      width: column,
      height: Math.max(geometry.cellHeight, rect.y + rect.height - y),
    };
    const renderRow = (rowIndex: number, rowRect: Rect): VirtualListRow =>
      this.#renderPoolRow(rowRect, geometry, cards, rowIndex, selected.deck);
    const onRowActivate = (rowIndex: number, pointer: Phaser.Input.Pointer): void => {
      const list = this.#poolList;
      if (!list) return;
      const startIndex = rowIndex * geometry.columns;
      const countInRow = Math.min(geometry.columns, cards.length - startIndex);
      const column2 = poolColumnAt(geometry, list.rectFor(rowIndex), pointer.x, countInRow);
      if (column2 === null) return;
      const card = cards[startIndex + column2];
      if (card) this.#inspectCard(card);
    };
    this.#poolList = new McVirtualList(this, {
      rect: gridRect,
      rowHeight: geometry.cellHeight,
      count: geometry.rows,
      renderRow,
      scroll: this.#poolListScroll,
      onRowActivate,
      background: false,
    });
    const list = this.#poolList;
    cards.forEach((card, index) => {
      const rowIndex = Math.floor(index / geometry.columns);
      const col = index % geometry.columns;
      this.#stops.set(`pool-card:${card.id as string}`, {
        rect: () => poolCellRect(geometry, list.rectFor(rowIndex), col),
        activate: () => this.#inspectCard(card),
        ensureVisible: () => list.scrollIntoView(rowIndex),
      });
    });
    return cards.map((card) => card.id as string);
  }

  /**
   * "CARD POOL ─────" with its filter chips right-aligned on the same line (D14's own `#s14` markup: the rule is
   * a `<span style="flex:1">` sitting *between* the label and the chips, not a separate full-width rule with its
   * own row of chips below). Returns the next free `y`.
   */
  #drawPoolHeader(left: number, y: number, column: number, chipDefs: readonly ChipDef[]): number {
    const heading = this.add.text(left, y, "CARD POOL", {
      ...textStyle(typeRole.barTitle, surface.ink.hex),
      fontSize: "19px",
    });
    const chipHeight = COMPACT_ROW;
    const chipY = y + (heading.height - chipHeight) / 2;
    const packed = packChipsNatural(chipDefs, left, chipY, column, chipHeight, "right");
    for (const { chip, rect: cell } of packed.placed) {
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: chip.text,
          type: typeRole.label,
          rect: cell,
          selected: chip.selected,
          onClick: chip.onClick,
        }),
      );
      this.#stops.set(`pool-chip:${chip.id}`, { rect: cell, activate: chip.onClick });
    }
    const chipsLeftEdge = packed.placed.length > 0 ? Math.min(...packed.placed.map((p) => p.rect.x)) : left + column;
    const ruleStart = left + heading.width + 10;
    const ruleEnd = chipsLeftEdge - 10;
    if (ruleEnd > ruleStart) {
      const rule = this.add.graphics();
      rule.fillStyle(surface.ink.hex, 1).fillRect(ruleStart, y + heading.height / 2 - 1.5, ruleEnd - ruleStart, 3);
    }
    return Math.max(y + heading.height, packed.bottom + chipHeight) + 12;
  }

  /** D14's own pool filter chips: the deck's own chosen aspect(s), Basic, Hero — one active at a time, click again to clear back to "everything" — then a Cost sort toggle. Deviation from the mock's own static screenshot, noted in this scene's header comment: D14 draws its "Aggression" chip pre-filled while the grid still shows Basic/Hero cards too, which reads as a static label rather than a working filter; here every chip (aspect included) is a real, symmetric toggle. */
  #poolChipDefs(deck: Deck): readonly ChipDef[] {
    const defs: ChipDef[] = [];
    const toggleAspect = (value: CoreAspect | "basic" | "identity"): void => {
      this.#poolAspectFilter = this.#poolAspectFilter === value ? null : value;
      this.#poolListScroll.reset();
      this.#rebuild();
    };
    for (const aspect of deck.aspects) {
      defs.push({
        id: `aspect:${aspect}`,
        text: aspect,
        selected: this.#poolAspectFilter === aspect,
        onClick: () => toggleAspect(aspect),
      });
    }
    defs.push({
      id: "basic",
      text: "Basic",
      selected: this.#poolAspectFilter === "basic",
      onClick: () => toggleAspect("basic"),
    });
    defs.push({
      id: "hero",
      text: "Hero",
      selected: this.#poolAspectFilter === "identity",
      onClick: () => toggleAspect("identity"),
    });
    defs.push({
      id: "cost",
      text: "Cost ▾",
      selected: this.#poolSortByCost,
      onClick: () => {
        this.#poolSortByCost = !this.#poolSortByCost;
        this.#poolListScroll.reset();
        this.#rebuild();
      },
    });
    return defs;
  }

  #poolCards(deck: Deck, identity: HeroIdentityCard): readonly AnyCard[] {
    const filter: PoolFilter = this.#poolAspectFilter ? { aspect: this.#poolAspectFilter } : {};
    const pool = browsablePool(POOL_CARDS, identity, deck.aspects, filter);
    if (!this.#poolSortByCost) return pool;
    const costOf = (card: AnyCard): number =>
      "cost" in card ? (card as unknown as { cost: number }).cost : Number.POSITIVE_INFINITY;
    return [...pool].sort((a, b) => costOf(a) - costOf(b) || a.name.localeCompare(b.name));
  }

  #renderPoolRow(
    rowRect: Rect,
    geometry: PoolGridGeometry,
    cards: readonly AnyCard[],
    rowIndex: number,
    deck: Deck,
  ): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const startIndex = rowIndex * geometry.columns;
    const countInRow = Math.min(geometry.columns, cards.length - startIndex);
    for (let col = 0; col < countInRow; col++) {
      const card = cards[startIndex + col]!;
      const cell = poolCellRect(geometry, rowRect, col);
      const cardRect: Rect = { x: cell.x + 4, y: cell.y + 2, width: cell.width - 8, height: cell.height - 4 };
      const g = this.add.graphics();
      paintPanel(g, cardRect, "card", "rest");
      objects.push(g);

      const artRect: Rect = {
        x: cardRect.x + 2,
        y: cardRect.y + 2,
        width: cardRect.width - 4,
        height: cardRect.height - geometry.captionHeight - 4,
      };
      const artFill = this.add.graphics();
      artFill.fillStyle(surface.parchment.hex, 1).fillRect(artRect.x, artRect.y, artRect.width, artRect.height);
      objects.push(artFill);
      const key = cardArt(this).request(this, artFor(card, { kind: "front" }));
      const art = drawArt(this, key, artRect);
      if (art) objects.push(art);
      else
        objects.push(
          label(
            this,
            artRect.x + artRect.width / 2,
            artRect.y + artRect.height / 2,
            "no scan",
            typeRole.label,
            surface.ink.hex,
            ink.meta,
          ).setOrigin(0.5),
        );
      const ruleY = artRect.y + artRect.height + 2;
      const rule = this.add.graphics();
      rule.fillStyle(surface.ink.hex, 1).fillRect(cardRect.x, ruleY, cardRect.width, 2.5);
      objects.push(rule);

      if ("cost" in card) {
        const costText = String((card as unknown as { cost: number }).cost);
        const pipText = label(this, 0, 0, costText, typeRole.label, surface.paper.hex, 1);
        const pipWidth = Math.ceil(pipText.width) + 12;
        const pipBg = this.add.graphics();
        pipBg.fillStyle(surface.ink.hex, 1).fillRect(artRect.x, artRect.y, pipWidth, 18);
        pipText.setPosition(artRect.x + 6, artRect.y + 9).setOrigin(0, 0.5);
        objects.push(pipBg, pipText);
      }

      const entry = ("deckLimit" in card ? (card as unknown as { deckLimit: number }).deckLimit : null) ?? null;
      const inDeckQuantity = deck.cards.find((c) => (c.cardId as string) === (card.id as string))?.quantity ?? 0;
      const name = this.add.text(cardRect.x + 8, ruleY + 6, card.name, textStyle(typeRole.rowTitle, surface.ink.hex));
      fitText(name, cardRect.width - 16);
      objects.push(name);
      const typeLabel = card.type.replace(/_/g, " ");
      const caption = entry !== null ? `${typeLabel} · ${inDeckQuantity} of ${entry} in deck` : typeLabel;
      // `label()` (not a bare `this.add.text`) so `typeRole.label`'s own uppercase rule actually applies —
      // "EVENT · 2 OF 3 IN DECK", not the lowercase caption this cell used to draw (2026-09-18 fidelity pass, point 4).
      // Wrapped inside the cell, as D14 draws it; unwrapped it ran under the next card.
      objects.push(
        label(
          this,
          cardRect.x + 8,
          ruleY + 6 + name.height + 3,
          caption,
          typeRole.label,
          surface.ink.hex,
          ink.meta,
        ).setWordWrapWidth(cardRect.width - 16),
      );
    }
    return { objects };
  }

  #inspectCard(card: AnyCard): void {
    this.scene.launch(SCENES.inspect, { card: { cardId: card.id, face: { kind: "front" } } });
  }

  // ------------------------------------------------------------------------------------------------------------
  // The stats pane (2026-09-18 fidelity pass, point 5): a big Bangers deck title, one meta line (card count,
  // legality and source — dropping the separate "PRECON · <hero>" line the title's own short form now makes
  // redundant), a paper rule, red-highlighted curve bars, label-over-number composition tiles, Check/Edit/Delete
  // as a row of small buttons, "Recently changed", then the footer D14 itself draws: DUPLICATE beside the single
  // red "PLAY THIS DECK ▸".
  // ------------------------------------------------------------------------------------------------------------
  #drawStatsPane(rect: Rect, option: DeckOption | null): void {
    const bg = this.add.graphics();
    paintPanel(bg, rect, "onInk", "rest");

    const left = rect.x + 16;
    const column = rect.width - 32;
    let y = rect.y + 16;

    if (!option) {
      this.add
        .text(left, y, "Select a deck to see its stats.", textStyle(typeRole.body, surface.paper.hex, ink.body))
        .setWordWrapWidth(column);
      return;
    }

    const deck = option.deck;
    const stats = deckStatsOf(deck, POOL_CARDS);
    const status = deckStatusOf(option);

    const name = this.add
      .text(left, y, caseOf(typeRole.barTitle, cardTitleOf(option)), {
        ...textStyle(typeRole.barTitle, surface.paper.hex),
        fontSize: "26px",
      })
      .setWordWrapWidth(column);
    y += name.height + 6;
    label(
      this,
      left,
      y,
      `${stats.totalCards} CARDS · MINIMUM ${DECK_MIN_CARDS} · ${status.text.toUpperCase()} · ${SOURCE_LABEL[deck.source.kind].toUpperCase()}`,
      typeRole.label,
      surface.paper.hex,
      ink.label,
    );
    y += 20;

    const ruleG = this.add.graphics();
    ruleG.fillStyle(surface.paper.hex, 1).fillRect(left, y, column, 3);
    y += 16;

    const avgText = stats.averageCost === null ? "" : ` · avg ${stats.averageCost.toFixed(1)}`;
    label(this, left, y, `RESOURCE CURVE${avgText}`, typeRole.label, surface.paper.hex, ink.label);
    y += 16;
    const chartHeight = 84;
    this.#drawStatCurveBars(left, y, column, chartHeight, costCurveBars(stats));
    y += chartHeight + 16;

    label(this, left, y, "COMPOSITION", typeRole.label, surface.paper.hex, ink.label);
    y += 16;
    y = this.#drawStatTiles(left, y, column, compositionTilesOf(stats)) + 12;

    // Check/Edit/Delete: real, needed actions D14 itself doesn't draw (its mock has no notion of this build's
    // deck-check screen or in-place editing) — a row of small buttons, so the footer below still ends in exactly
    // Duplicate + the red Play button, as designed.
    const editable = deck.source.kind !== "precon";
    const actionDefs: readonly { readonly id: string; readonly text: string; readonly onClick: () => void }[] = [
      { id: "check", text: "Check", onClick: () => this.#openDeckCheck(deck) },
      ...(editable
        ? [
            {
              id: "edit",
              text: "Edit",
              onClick: () => goToScreen(this, SCENES.deckBuilder, { deck } satisfies DeckBuilderSceneData),
            },
          ]
        : []),
      ...(editable ? [{ id: "delete", text: "Delete", onClick: () => void this.#delete(deck.id) }] : []),
    ];
    const actionWidth = (column - CHIP_GAP * (actionDefs.length - 1)) / actionDefs.length;
    actionDefs.forEach((action, index) => {
      const cell: Rect = { x: left + index * (actionWidth + CHIP_GAP), y, width: actionWidth, height: COMPACT_ROW };
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: action.text,
          type: typeRole.label,
          rect: cell,
          onClick: action.onClick,
        }),
      );
      this.#stops.set(`stats-${action.id}`, { rect: cell, activate: action.onClick });
    });
    y += COMPACT_ROW + 14;

    // "Recently changed" (W9/S1): the minimal honest version — one timestamp, no revision history — drawn with
    // D14's own left-ruled line, or a single dim line when there's nothing to report.
    label(this, left, y, "RECENTLY CHANGED", typeRole.label, surface.paper.hex, ink.label);
    y += 16;
    if (deck.updatedAt) {
      const bar = this.add.graphics();
      bar.fillStyle(surface.paper.hex, 1).fillRect(left, y, 3, 15);
      this.add.text(
        left + 9,
        y,
        `Last changed ${new Date(deck.updatedAt).toLocaleDateString()}`,
        textStyle(typeRole.body, surface.paper.hex, ink.secondary),
      );
    } else {
      label(this, left, y, "No change history recorded for this deck.", typeRole.label, surface.paper.hex, ink.meta);
    }

    // Footer, pinned to the bottom of the pane regardless of how much the body above used — D14's own two bottom
    // controls, Duplicate beside the single red Play.
    const footerHeight = hit.primary;
    const footerY = rect.y + rect.height - footerHeight - 16;
    const footerRule = this.add.graphics();
    footerRule.fillStyle(surface.paper.hex, 1).fillRect(left, footerY - 13, column, 3);

    const duplicateWidth = column * 0.38;
    const duplicateRect: Rect = { x: left, y: footerY, width: duplicateWidth, height: footerHeight };
    const doDuplicate = (): void => this.#duplicate(deck);
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "Duplicate",
        type: typeRole.label,
        rect: duplicateRect,
        onClick: doDuplicate,
      }),
    );
    this.#stops.set("stats-duplicate", { rect: duplicateRect, activate: doDuplicate });

    const playRect: Rect = {
      x: left + duplicateWidth + CHIP_GAP,
      y: footerY,
      width: column - duplicateWidth - CHIP_GAP,
      height: footerHeight,
    };
    const canPlay = option.seatable;
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: "Play this deck ▸",
        type: typeRole.barTitle,
        rect: playRect,
        enabled: canPlay,
        ...(canPlay ? {} : { reason: option.blockedReason ?? "This deck is not legal." }),
        onClick: () => this.#playDeck(deck),
      }),
    );
    this.#stops.set("stats-play", { rect: playRect, activate: () => this.#playDeck(deck) });
  }

  /**
   * The resource curve, D14's own way (point 5): every bar is paper-colored except the deck's most-common
   * printed costs, which are Hero Red — `#s14`'s own chart colors costs 1 and 2 red where they're the two tallest
   * bars, everything else cream. Ties are included (every bar at either of the top two *count* values is
   * highlighted, not just the single tallest), and a bar with no cards at that cost is never highlighted even if
   * zero happens to be tied for a "top" value in an otherwise-empty curve.
   */
  #drawStatCurveBars(
    left: number,
    y: number,
    column: number,
    chartHeight: number,
    bars: readonly CostCurveBar[],
  ): void {
    const gap = 6;
    const barWidth = (column - gap * (bars.length - 1)) / bars.length;
    const maxCount = Math.max(1, ...bars.map((bar) => bar.count));
    const topCounts = new Set(
      [...new Set(bars.map((bar) => bar.count))]
        .filter((count) => count > 0)
        .sort((a, b) => b - a)
        .slice(0, 2),
    );
    bars.forEach((bar, index) => {
      const barHeight = Math.max(2, Math.round((bar.count / maxCount) * (chartHeight - 18)));
      const x = left + index * (barWidth + gap);
      const highlighted = topCounts.has(bar.count);
      const g = this.add.graphics();
      g.fillStyle(highlighted ? accent.heroRed.hex : surface.paper.hex, 1).fillRect(
        x,
        y + (chartHeight - 18 - barHeight),
        barWidth,
        barHeight,
      );
      label(
        this,
        x + barWidth / 2,
        y + chartHeight - 10,
        bar.label,
        typeRole.label,
        surface.paper.hex,
        ink.label,
      ).setOrigin(0.5, 0);
    });
  }

  /** Composition tiles D14's own way (point 5): a small uppercase label over a Bangers number, three per row — not the shared `ui/deck-stats-widgets.ts` combined-text tile other screens (D04) use. Returns the next free `y`. */
  #drawStatTiles(left: number, y: number, column: number, tiles: readonly CompositionTile[]): number {
    const perRow = 3;
    const gap = 7;
    const cellWidth = (column - (perRow - 1) * gap) / perRow;
    const cellHeight = 46;
    tiles.forEach((tile, index) => {
      const row = Math.floor(index / perRow);
      const col = index % perRow;
      const tileX = left + col * (cellWidth + gap);
      const tileY = y + row * (cellHeight + gap);
      const g = this.add.graphics();
      g.lineStyle(border.control, surface.paper.hex, 1).strokeRect(tileX, tileY, cellWidth, cellHeight);
      label(this, tileX + 8, tileY + 7, tile.label, typeRole.label, surface.paper.hex, ink.label);
      this.add.text(tileX + 8, tileY + 18, String(tile.count), {
        ...textStyle(typeRole.barTitle, surface.paper.hex),
        fontSize: "20px",
      });
    });
    const rows = Math.ceil(tiles.length / perRow);
    return rows === 0 ? y : y + rows * (cellHeight + gap) - gap;
  }

  /** "Play this deck ▸" (W9): hands the deck to the existing setup flow with it preselected for seat 1 (`view/setup-draft.ts`'s `withSeatOne`, applied inside `TitleScene#create` — see `scenes/title.ts`'s `TitleSceneData`). */
  #playDeck(deck: Deck): void {
    goToScreen(this, SCENES.title, {
      initialSeatDeckId: deck.id as string,
      initialSeatDeck: deck,
    } satisfies TitleSceneData);
  }

  /** Opens Deck check (W1) over this deck, returning here on Back. */
  #openDeckCheck(deck: Deck): void {
    goToScreen(this, SCENES.deckCheck, { deck, returnTo: { scene: SCENES.decks } } satisfies DeckCheckSceneData);
  }

  #duplicate(deck: Deck): void {
    if (this.#busy) return;
    this.#busy = true;
    void (async () => {
      const now = new Date().toISOString();
      const copy = duplicateDeck(deck, crypto.randomUUID(), now);
      await deckStorage().put(copy);
      this.#savedDecks = await deckStorage().list();
      this.#selectedDeckId = copy.id as string;
      this.#status = { text: `Duplicated as "${copy.name}".`, tone: "success" };
      this.#busy = false;
      this.#rebuild();
    })();
  }

  #exportToClipboard(deck: Deck): void {
    const text = exportDecklistText(deck, POOL_CARDS);
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clipboard?.writeText) {
      this.#status = {
        text: "Clipboard access isn't available here — open this deck in the builder to read its cards instead.",
        tone: "error",
      };
      this.#rebuild();
      return;
    }
    clipboard.writeText(text).then(
      () => {
        this.#status = { text: `Copied "${deck.name}"'s decklist to the clipboard.`, tone: "success" };
        this.#rebuild();
      },
      () => {
        this.#status = { text: "Couldn't copy to the clipboard.", tone: "error" };
        this.#rebuild();
      },
    );
  }

  #inspectDeck(option: DeckOption): void {
    const card = CARDS_BY_ID.get(option.deck.identityCardId as string);
    const face =
      card?.type === "villain"
        ? ({ kind: "villainStage", sideIndex: 0, stageIndex: 0 } as const)
        : ({ kind: "hero" } as const);
    const note = option.blockedReason ?? option.warning ?? null;
    this.scene.launch(SCENES.inspect, {
      card: { cardId: option.deck.identityCardId, face },
      ...(note ? { note } : {}),
    });
  }

  async #delete(id: DeckId): Promise<void> {
    await deckStorage().remove(id);
    this.#savedDecks = await deckStorage().list();
    this.#rebuild();
  }

  async #importPaste(): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    this.#rebuild();
    const outcome = importFromPasteText(this.#pasteText, this.#importEnv());
    await this.#applyImport(outcome);
  }

  async #importMarvelCdb(): Promise<void> {
    if (this.#busy) return;
    const ref = parseMarvelCdbReference(this.#marvelcdbText);
    if (!ref) {
      this.#status = { text: "That doesn't look like a MarvelCDB deck link or id.", tone: "error" };
      this.#rebuild();
      return;
    }
    this.#busy = true;
    this.#rebuild();
    try {
      // The dev/preview route on the web, native HTTP in a packaged app — a
      // 404 on a production web build is the designed fallback, not a bug
      // (see `vite-marvelcdb-import.ts`).
      const response = await fetchMarvelCdbDeck(ref.kind, ref.id);
      const text = response.body;
      if (response.status !== 200) {
        // A production deploy has no `vite-marvelcdb-import.ts` route at all
        // (dev/preview only) and 404s here with no JSON body — the one case
        // this build genuinely cannot tell apart from "MarvelCDB has nothing
        // at that id", so it gets its own message naming the real cause.
        let message =
          response.status === 404
            ? "MarvelCDB import by link isn't available in this deployment (or MarvelCDB has nothing at that id). Paste the decklist instead."
            : `MarvelCDB import failed (HTTP ${response.status}).`;
        try {
          const body = JSON.parse(text) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          /* the fallback message above already covers a non-JSON error body */
        }
        this.#status = { text: message, tone: "error" };
        this.#busy = false;
        this.#rebuild();
        return;
      }
      const outcome = importFromMarvelCdbResponseText(
        text,
        ref,
        `https://marvelcdb.com/${ref.kind}/view/${ref.id}`,
        this.#importEnv(),
      );
      await this.#applyImport(outcome);
    } catch (cause) {
      this.#status = { text: cause instanceof Error ? cause.message : String(cause), tone: "error" };
      this.#busy = false;
      this.#rebuild();
    }
  }

  #importEnv(): ImportEnv {
    return {
      pool: POOL_CARDS,
      poolVersion: POOL_VERSION,
      now: () => new Date().toISOString(),
      newId: () => crypto.randomUUID(),
    };
  }

  async #applyImport(outcome: ImportOutcome): Promise<void> {
    if (!outcome.ok) {
      this.#status = { text: outcome.problems.map((problem) => problem.message).join(" "), tone: "error" };
      this.#busy = false;
      this.#rebuild();
      return;
    }
    await deckStorage().put(outcome.deck);
    this.#pasteText = "";
    this.#pasteInput?.setValue("");
    this.#marvelcdbText = "";
    this.#marvelcdbInput?.setValue("");
    this.#status = { text: `Imported "${outcome.deck.name}".`, tone: "success" };
    this.#savedDecks = await deckStorage().list();
    this.#selectedDeckId = outcome.deck.id as string;
    this.#busy = false;
    this.#rebuild();
  }
}

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
 * reasoning): an ink chrome bar over a paper ground, then three columns —
 * **"YOUR DECKS"** (a scrollable list of deck cards, the selected one
 * ink-filled with its record shown only there, an illegal/WIP one red, "+
 * NEW DECK" as the list's own last row, then a parchment Import/Export box),
 * **"CARD POOL"** (the *selected* deck's own browsable legal cards, with art,
 * a cost pip, and "Type · X of Y in deck" — filtered by the deck's aspect(s),
 * Basic, Hero, and sortable by cost), and the **ink stats rail** (curve,
 * composition, "Recently changed", ending in DUPLICATE + the single red
 * "PLAY THIS DECK ▸"). Narrow screens get the same three groups behind a
 * "Decks"/"Cards"/"Stats" tab strip.
 *
 * **Deliberately not the mock, each noted where it happens:** the mock's
 * Import/Export box shows description text only — this build already has
 * paste-import, MarvelCDB-import and export, so those controls live inside
 * that box rather than being dropped. The deck note and "N of N cards owned"
 * line are both skipped per docs/phase4-screen-gaps.md §4 (advice text and
 * owned-card tracking are undecided/out of scope). S8's search field and
 * quick-filter chips (added after D14 was drawn) sit above the deck list.
 * Check/Edit/Delete — real, needed actions the mock doesn't draw at all —
 * live as a compact secondary row in the stats rail's header block, so the
 * rail's own footer still ends in exactly Duplicate + the red Play button, as
 * designed. The pool's art area draws a real card's own 2.5:3.5 shape rather
 * than the mock's arbitrarily-tall placeholder box (`view/deck-pool-grid.ts`'s
 * own header comment).
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
import { parseMarvelCdbReference, type AnyCard, type CoreAspect, type Deck, type DeckId, type HeroIdentityCard } from "@mc/content";
import { DECK_MIN_CARDS } from "@mc/engine";
import { POOL_CARDS, POOL_DEPS, POOL_VERSION } from "../content/pool.js";
import { cardArt } from "../art/card-art.js";
import { artFor } from "../art/art-source.js";
import { drawArt } from "../art/card-art.js";
import { browsablePool, duplicateDeck, type PoolFilter } from "../view/deck-builder-model.js";
import { exportDecklistText, importFromMarvelCdbResponseText, importFromPasteText, type ImportEnv, type ImportOutcome } from "../view/deck-import-model.js";
import { deckOptionsOf, type DeckOption } from "../view/deck-list-model.js";
import { sortByRecency } from "../view/deck-recency.js";
import { compositionTilesOf, costCurveBars, deckStatsOf } from "../view/deck-stats.js";
import { deckStatusOf, type DeckStatusTone } from "../view/deck-status.js";
import { decksLayout, type DecksTab } from "../view/decks-layout.js";
import { poolCellRect, poolColumnAt, poolGridGeometry, type PoolGridGeometry } from "../view/deck-pool-grid.js";
import { deckSourcesOf, heroAspectsOf, heroRosterMatches, withSelectionPinned, type DeckSourceKind, type RosterFilter } from "../view/roster-filter.js";
import { decksFocusOrder } from "../view/screen-focus.js";
import { deckKeyToString, resultsHistoryOf, type DeckKey, type ResultsHistory } from "../view/results-history.js";
import { CHIP_GAP, wrapChipsToRows } from "../view/chip-layout.js";
import { estimateWrappedLines, type Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { compositionTileDefs, drawCompositionTiles, drawCostCurveBars } from "../ui/deck-stats-widgets.js";
import { accent, border, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McMultilineInput, McTabs, McTextInput, fitText, label, paintDotGrid, paintPanel, sectionHeader } from "../ui/widgets.js";
import { appSession, deckStorage } from "../session.js";
import type { DeckBuilderSceneData } from "./deck-builder.js";
import type { DeckCheckSceneData } from "./deck-check.js";
import type { TitleSceneData } from "./title.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { fetchMarvelCdbDeck } from "../platform/deck-fetch.js";

/** What a caller (Title, on an `illegal_deck` refusal) hands over on launch. */
export interface DecksSceneData {
  /** Selected and scrolled into view; named in `message` — the deck `createGame` just refused. */
  readonly focusDeckId?: string | null;
  readonly message?: string | null;
}

const ROW_HEIGHT = 74;
const CARDS_BY_ID = new Map<string, AnyCard>(POOL_CARDS.map((card) => [card.id as string, card]));

const SOURCE_LABEL: Readonly<Record<DeckSourceKind, string>> = { precon: "Precon", imported: "Imported", userBuilt: "Built" };

const IMPORT_EXPORT_DESCRIPTION = "Paste a decklist or drop a .txt from MarvelCDB. Exports carry the aspect and hero set.";

/** One row of the deck list: a group header, a deck row, or the trailing "+ New deck" tile (never filtered out, always the list's last row). */
type DeckRow = { readonly kind: "header"; readonly label: string } | { readonly kind: "deck"; readonly option: DeckOption } | { readonly kind: "newDeck" };

/** `deck`'s namespaced record key — the same one `view/results-history.ts` keys `DeckRecord` by. */
function keyOf(deck: Deck): DeckKey {
  return deck.source.kind === "precon" ? { kind: "starter", starterDeckId: deck.source.starterDeckId as string } : { kind: "custom", deckId: deck.id as string };
}

/** How tall the fixed Import/Export box needs to be at `column` px wide — used both to reserve room above it and to draw it, so the two can't drift apart. */
function importExportBoxHeight(column: number, hasSelection: boolean): number {
  const pad = 14;
  const descLines = estimateWrappedLines(IMPORT_EXPORT_DESCRIPTION, column - pad * 2, 5.3);
  return (
    pad * 2 + // top/bottom padding
    20 + // "IMPORT / EXPORT" heading
    descLines * 14 +
    10 + // description
    16 +
    84 +
    10 + // "paste a decklist" label + textarea
    16 +
    hit.target +
    10 + // "import from marvelcdb" label + field
    (hasSelection ? hit.target + 10 : 0) // Export
  );
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
      blocked: () => this.scene.isActive(SCENES.inspect) || (this.#pasteInput?.focused ?? false) || (this.#marvelcdbInput?.focused ?? false) || (this.#searchInput?.focused ?? false),
      onPage: (direction) => (this.#activeTab === "cards" ? this.#poolList?.scrollByPage(direction) : this.#list?.scrollByPage(direction)),
      onHomeEnd: (edge) => {
        const list = this.#activeTab === "cards" ? this.#poolList : this.#list;
        if (edge === "home") list?.scrollToStart();
        else list?.scrollToEnd();
      },
    });

    this.#rebuild();
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
    // `children.removeAll(true)` below — found in the browser switching tabs at a narrow width.
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
    const kept = [...(this.#pasteInput?.gameObjects ?? []), ...(this.#marvelcdbInput ? [this.#marvelcdbInput.gameObject] : []), ...(this.#searchInput ? [this.#searchInput.gameObject] : [])];
    for (const node of kept) this.children.remove(node);
    this.children.removeAll(true);
    for (const node of kept) this.children.add(node);

    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", { spacing: 6, radius: 1, alpha: 0.1 });

    // The ink chrome bar behind Back and the title, over the paper ground everything else draws on.
    const chrome = this.add.graphics();
    paintPanel(chrome, { x: 0, y: 0, width, height: layout.header.y + layout.header.height + 16 }, "onInk", "rest");

    const backRect: Rect = { x: layout.header.x, y: layout.header.y, width: 100, height: layout.header.height };
    const goBack = (): void => { this.scene.start(SCENES.title); };
    this.#buttons.push(new McButton(this, { kind: "onInk", label: "◂ Title", type: typeRole.rowTitle, rect: backRect, onClick: goBack }));
    this.#stops.set("back", { rect: backRect, activate: goBack });
    const title = this.add.text(backRect.x + backRect.width + 12, layout.header.y + layout.header.height / 2, "DECKS & COLLECTION", textStyle(typeRole.barTitle, surface.paper.hex));
    title.setOrigin(0, 0.5).setLetterSpacing(typeRole.barTitle.letterSpacing);
    fitText(title, layout.header.width - backRect.width - 24);

    const allOptions = this.#deckOptions();
    if (this.#selectedDeckId === null || !allOptions.some((o) => (o.deck.id as string) === this.#selectedDeckId)) {
      const wanted = !this.#focusedOnce ? this.#data.focusDeckId : null;
      this.#selectedDeckId = (wanted && allOptions.some((o) => (o.deck.id as string) === wanted) ? wanted : (allOptions[0]?.deck.id as string | undefined)) ?? null;
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
      const tabCell = (index: number): Rect => ({ ...layout.tabs!, x: layout.tabs!.x + (index * layout.tabs!.width) / 3, width: layout.tabs!.width / 3 });
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
          poolChipIds: this.#activeTab === "cards" && selected ? this.#poolChipDefs(selected.deck).map((c) => c.id) : [],
          wide: false,
          activeTab: this.#activeTab,
          hasSelection: selected !== null,
          editable: selected !== null && selected.deck.source.kind !== "precon",
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
  // The deck list pane: search, quick-filter chips (S8), the virtualized list (grouped: Preconstructed, then
  // saved/imported decks — recently changed first, W9 — ending in "+ New deck"), then Import/Export. Returns the
  // deck ids actually offered as rows, in list order, for the focus route.
  // ------------------------------------------------------------------------------------------------------------
  #drawListPane(rect: Rect, allOptions: readonly DeckOption[], selected: DeckOption | null): readonly string[] {
    const left = rect.x;
    const column = rect.width;
    let y = rect.y;

    y = sectionHeader(this, left, y, column, "Your decks");

    if (this.#status) {
      const banner = this.add.text(left, y, this.#status.text, textStyle(typeRole.body, this.#status.tone === "error" ? accent.redDeep.hex : signal.heal.hex)).setWordWrapWidth(column);
      y += banner.height + 10;
    }

    const searchRect: Rect = { x: left, y, width: column, height: hit.target };
    if (this.#searchInput) this.#searchInput.layout(searchRect);
    else {
      this.#searchInput = new McTextInput(this, {
        rect: searchRect,
        value: this.#filter.text,
        placeholder: "search decks, heroes, aspects…",
        onChange: (value) => {
          this.#filter = { ...this.#filter, text: value };
          this.#rebuild();
        },
      });
    }
    this.#stops.set("deck-search", { rect: searchRect, activate: () => this.#searchInput?.focus() });
    y += hit.target + 8;

    const chipDefs = this.#chipDefs(allOptions);
    const chipRows = wrapChipsToRows(chipDefs, column);
    chipRows.forEach((row, rowIndex) => {
      const rowRect: Rect = { x: left, y: y + rowIndex * (hit.target + CHIP_GAP), width: column, height: hit.target };
      const cellWidth = (rowRect.width - (row.length - 1) * CHIP_GAP) / row.length;
      row.forEach((chip, index) => {
        const cell: Rect = { x: rowRect.x + index * (cellWidth + CHIP_GAP), y: rowRect.y, width: cellWidth, height: rowRect.height };
        this.#buttons.push(new McButton(this, { kind: "secondary", label: chip.text, type: typeRole.label, rect: cell, selected: chip.selected, onClick: chip.onClick }));
        this.#stops.set(`deck-chip:${chip.id}`, { rect: cell, activate: chip.onClick });
      });
    });
    y += (chipRows.length === 0 ? 0 : chipRows.length * hit.target + (chipRows.length - 1) * CHIP_GAP) + 12;

    // Reserve fixed room at the bottom for the Import/Export box, so the list gets exactly whatever's left.
    const boxHeight = importExportBoxHeight(column, selected !== null);
    const listTop = y;
    const listHeight = Math.max(ROW_HEIGHT, rect.y + rect.height - boxHeight - 12 - listTop);
    const listRect: Rect = { x: left, y: listTop, width: column, height: listHeight };

    const rows = this.#buildRows(allOptions);
    const deckIds = rows.filter((r): r is Extract<DeckRow, { kind: "deck" }> => r.kind === "deck").map((r) => r.option.deck.id as string);

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
    this.#list = new McVirtualList(this, { rect: listRect, rowHeight: ROW_HEIGHT, count: rows.length, renderRow, scroll: this.#listScroll, onRowActivate });
    const list = this.#list;
    if (!this.#focusedOnce && this.#data.focusDeckId) {
      const index = rows.findIndex((row) => row.kind === "deck" && (row.option.deck.id as string) === this.#data.focusDeckId);
      if (index >= 0) list.scrollIntoView(index);
      this.#focusedOnce = true;
    }
    rows.forEach((row, index) => {
      if (row.kind === "header") return;
      if (row.kind === "newDeck") {
        this.#stops.set("new-deck", { rect: () => list.rectFor(index), activate: () => this.#openBuilder(), ensureVisible: () => list.scrollIntoView(index) });
        return;
      }
      const deckId = row.option.deck.id as string;
      const ensureVisible = (): void => list.scrollIntoView(index);
      const select = (): void => {
        this.#selectedDeckId = deckId;
        this.#rebuild();
      };
      const doInspect = (): void => this.#inspectDeck(row.option);
      this.#stops.set(`deck:${deckId}`, { rect: () => list.rectFor(index), activate: select, inspect: doInspect, ensureVisible });
    });
    y = listRect.y + listRect.height + 12;

    this.#drawImportExportBox({ x: left, y, width: column, height: boxHeight }, selected);

    return deckIds;
  }

  #openBuilder(): void {
    this.scene.start(SCENES.deckBuilder, {} satisfies DeckBuilderSceneData);
  }

  /** S8's quick-filter chips for this list: aspect, source, and "Legal only" (this screen's own version of "playable now" — a deck's own legality, not a seating question). */
  #chipDefs(allOptions: readonly DeckOption[]): readonly { readonly id: string; readonly text: string; readonly selected: boolean; readonly onClick: () => void }[] {
    const decks = allOptions.map((o) => o.deck);
    const defs: { id: string; text: string; selected: boolean; onClick: () => void }[] = [];
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

  /** `allOptions` grouped into Preconstructed / Your decks (recently changed first), filtered by search + chips, with the selected deck pinned into view even if the filter would otherwise hide it, then "+ New deck" as the list's own last row (never filtered out). */
  #buildRows(allOptions: readonly DeckOption[]): readonly DeckRow[] {
    const identityOf = (option: DeckOption): AnyCard | undefined => CARDS_BY_ID.get(option.deck.identityCardId as string);
    const matches = (option: DeckOption): boolean => heroRosterMatches(option.deck, identityOf(option), this.#filter, option.blockedReason);
    const isSelected = (option: DeckOption): boolean => (option.deck.id as string) === this.#selectedDeckId;

    const precons = allOptions.filter((o) => o.deck.source.kind === "precon");
    const saved = allOptions.filter((o) => o.deck.source.kind !== "precon");
    const filteredPrecons = withSelectionPinned(precons, matches, isSelected);
    const filteredSaved = withSelectionPinned(saved, matches, isSelected);

    const rows: DeckRow[] = [];
    if (filteredPrecons.length > 0) {
      rows.push({ kind: "header", label: "Preconstructed" });
      for (const option of filteredPrecons) rows.push({ kind: "deck", option });
    }
    if (filteredSaved.length > 0) {
      rows.push({ kind: "header", label: "Your decks · recently changed first" });
      for (const option of filteredSaved) rows.push({ kind: "deck", option });
    }
    if (rows.length === 0) rows.push({ kind: "header", label: "No decks match this search." });
    rows.push({ kind: "newDeck" });
    return rows;
  }

  #renderDeckRow(rect: Rect, row: DeckRow): VirtualListRow {
    if (row.kind === "header") {
      const text = label(this, rect.x + 4, rect.y + rect.height / 2, row.label, typeRole.label, surface.ink.hex, ink.label);
      text.setOrigin(0, 0.5);
      return { objects: [text] };
    }

    if (row.kind === "newDeck") {
      const tileRect: Rect = { x: rect.x + 4, y: rect.y + 2, width: rect.width - 8, height: rect.height - 4 };
      const g = this.add.graphics();
      paintPanel(g, tileRect, "quiet", "unavailable");
      const text = label(this, tileRect.x + tileRect.width / 2, tileRect.y + tileRect.height / 2, "+ New deck", typeRole.rowTitle, surface.ink.hex, ink.body).setOrigin(0.5);
      return { objects: [g, text] };
    }

    const option = row.option;
    const selected = (option.deck.id as string) === this.#selectedDeckId;
    const status = deckStatusOf(option);
    const illegal = status.tone === "illegal";
    const card: Rect = { x: rect.x + 4, y: rect.y + 2, width: rect.width - 8, height: rect.height - 4 };
    const objects: Phaser.GameObjects.GameObject[] = [];

    // D14's own three row states: the selected deck is ink-filled with paper text (`#s14`'s
    // `background:#14110E;color:#F4EFE3`), an illegal/WIP deck gets a red border and red title, everything else
    // is plain paper with an ink border. Custom-painted rather than `paintPanel("card", …)`, whose own "selected"
    // state fills white with a red ring (the board's own selection look) — this row's ink fill is D14's own,
    // different convention for "this is the one you're looking at".
    const g = this.add.graphics();
    const fill = selected ? surface.ink.hex : surface.card.hex;
    const stroke = illegal ? accent.heroRed.hex : surface.ink.hex;
    g.fillStyle(fill, 1).fillRect(card.x, card.y, card.width, card.height);
    g.lineStyle(selected || illegal ? border.object : border.control, stroke, 1).strokeRect(card.x, card.y, card.width, card.height);
    objects.push(g);

    const titleColor = selected ? surface.paper.hex : illegal ? accent.heroRed.hex : surface.ink.hex;
    const metaColor = selected ? surface.paper.hex : surface.ink.hex;
    const metaAlpha = selected ? ink.secondary : ink.meta;

    const name = this.add.text(card.x + 10, card.y + 8, option.deck.name, textStyle(typeRole.rowTitle, titleColor));
    fitText(name, card.width - 20);
    objects.push(name);
    objects.push(
      this.add.text(card.x + 10, card.y + 8 + name.height + 3, `${option.identityName ?? "unknown identity"} · ${deckStatsOf(option.deck, POOL_CARDS).totalCards} cards · ${status.text.toLowerCase()}`, textStyle(typeRole.label, metaColor, metaAlpha)).setWordWrapWidth(card.width - 20),
    );

    // Only the *selected* row shows its record (D14's own placement, `#s14`: the "Last played · record" line sits
    // inside the deck row, not the stats rail).
    if (selected) {
      const record = this.#history?.decks.find((r) => deckKeyToString(r.key) === deckKeyToString(keyOf(option.deck))) ?? null;
      const recordText = record && record.gamesPlayed > 0 ? `Last played ${record.lastPlayedAt ? new Date(record.lastPlayedAt).toLocaleDateString() : "—"} · ${record.wins}–${record.losses} record` : "Never played.";
      objects.push(this.add.text(card.x + 10, card.y + card.height - 18, recordText, textStyle(typeRole.label, surface.paper.hex, ink.meta)));
    }

    return { objects };
  }

  #drawImportExportBox(rect: Rect, selected: DeckOption | null): void {
    const g = this.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(border.object, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);

    const left = rect.x + 14;
    const column = rect.width - 28;
    let y = rect.y + 14;

    label(this, left, y, "import / export", typeRole.label, surface.ink.hex, ink.label);
    y += 18;
    const desc = this.add.text(left, y, IMPORT_EXPORT_DESCRIPTION, textStyle(typeRole.body, surface.ink.hex, ink.secondary)).setWordWrapWidth(column);
    y += desc.height + 10;

    label(this, left, y, "paste a decklist", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const pasteRect: Rect = { x: left, y, width: column - 96, height: 84 };
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
    const pasteImportRect: Rect = { x: left + column - 86, y, width: 86, height: hit.target };
    const doPasteImport = (): void => void this.#importPaste();
    this.#buttons.push(new McButton(this, { kind: "secondary", label: this.#busy ? "Importing…" : "Import", type: typeRole.rowTitle, rect: pasteImportRect, enabled: !this.#busy, onClick: doPasteImport }));
    this.#stops.set("paste-import", { rect: pasteImportRect, activate: doPasteImport });
    y += 84 + 10;

    // Always shown, not gated on `import.meta.env.DEV`: `vite preview` serves the same production bundle a real
    // deploy would (a genuine production deploy 404s instead — see `vite-marvelcdb-import.ts`).
    label(this, left, y, "import from marvelcdb", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const mcdbFieldRect: Rect = { x: left, y, width: column - 96, height: hit.target };
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
    const mcdbImportRect: Rect = { x: left + column - 86, y, width: 86, height: hit.target };
    const doMcdbImport = (): void => void this.#importMarvelCdb();
    this.#buttons.push(new McButton(this, { kind: "secondary", label: this.#busy ? "Importing…" : "Import", type: typeRole.rowTitle, rect: mcdbImportRect, enabled: !this.#busy, onClick: doMcdbImport }));
    this.#stops.set("marvelcdb-import", { rect: mcdbImportRect, activate: doMcdbImport });
    y += hit.target + 10;

    if (selected) {
      const exportRect: Rect = { x: left, y, width: column, height: hit.target };
      const doExport = (): void => this.#exportToClipboard(selected.deck);
      this.#buttons.push(new McButton(this, { kind: "secondary", label: `Export "${selected.deck.name}"`, type: typeRole.rowTitle, rect: exportRect, onClick: doExport }));
      this.#stops.set("export-deck", { rect: exportRect, activate: doExport });
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
    let y = rect.y;
    y = sectionHeader(this, left, y, column, "Card pool");

    if (!selected) {
      this.add.text(left, y, "Select a deck to browse its card pool.", textStyle(typeRole.body, surface.ink.hex, ink.meta)).setWordWrapWidth(column);
      return [];
    }
    const identity = this.#identityOf(selected.deck);
    if (!identity) {
      this.add.text(left, y, "This deck's identity card isn't in the pool.", textStyle(typeRole.body, surface.ink.hex, ink.meta)).setWordWrapWidth(column);
      return [];
    }

    const chipDefs = this.#poolChipDefs(selected.deck);
    const chipRows = wrapChipsToRows(chipDefs, column);
    chipRows.forEach((row, rowIndex) => {
      const rowRect: Rect = { x: left, y: y + rowIndex * (hit.target + CHIP_GAP), width: column, height: hit.target };
      const cellWidth = (rowRect.width - (row.length - 1) * CHIP_GAP) / row.length;
      row.forEach((chip, index) => {
        const cell: Rect = { x: rowRect.x + index * (cellWidth + CHIP_GAP), y: rowRect.y, width: cellWidth, height: rowRect.height };
        this.#buttons.push(new McButton(this, { kind: "secondary", label: chip.text, type: typeRole.label, rect: cell, selected: chip.selected, onClick: chip.onClick }));
        this.#stops.set(`pool-chip:${chip.id}`, { rect: cell, activate: chip.onClick });
      });
    });
    y += (chipRows.length === 0 ? 0 : chipRows.length * hit.target + (chipRows.length - 1) * CHIP_GAP) + 10;

    const cards = this.#poolCards(selected.deck, identity);
    if (cards.length === 0) {
      this.add.text(left, y, "No cards match this filter.", textStyle(typeRole.body, surface.ink.hex, ink.meta));
      return [];
    }

    const geometry = poolGridGeometry(column, cards.length);
    const gridRect: Rect = { x: left, y, width: column, height: Math.max(geometry.cellHeight, rect.y + rect.height - y) };
    const renderRow = (rowIndex: number, rowRect: Rect): VirtualListRow => this.#renderPoolRow(rowRect, geometry, cards, rowIndex, selected.deck);
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
    this.#poolList = new McVirtualList(this, { rect: gridRect, rowHeight: geometry.cellHeight, count: geometry.rows, renderRow, scroll: this.#poolListScroll, onRowActivate, background: false });
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

  /** D14's own pool filter chips: the deck's own chosen aspect(s), Basic, Hero — one active at a time, click again to clear back to "everything" — then a Cost sort toggle. Deviation from the mock's own static screenshot, noted in this scene's header comment: D14 draws its "Aggression" chip pre-filled while the grid still shows Basic/Hero cards too, which reads as a static label rather than a working filter; here every chip (aspect included) is a real, symmetric toggle. */
  #poolChipDefs(deck: Deck): readonly { readonly id: string; readonly text: string; readonly selected: boolean; readonly onClick: () => void }[] {
    const defs: { id: string; text: string; selected: boolean; onClick: () => void }[] = [];
    const toggleAspect = (value: CoreAspect | "basic" | "identity"): void => {
      this.#poolAspectFilter = this.#poolAspectFilter === value ? null : value;
      this.#poolListScroll.reset();
      this.#rebuild();
    };
    for (const aspect of deck.aspects) {
      defs.push({ id: `aspect:${aspect}`, text: aspect, selected: this.#poolAspectFilter === aspect, onClick: () => toggleAspect(aspect) });
    }
    defs.push({ id: "basic", text: "Basic", selected: this.#poolAspectFilter === "basic", onClick: () => toggleAspect("basic") });
    defs.push({ id: "hero", text: "Hero", selected: this.#poolAspectFilter === "identity", onClick: () => toggleAspect("identity") });
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
    const costOf = (card: AnyCard): number => ("cost" in card ? (card as unknown as { cost: number }).cost : Number.POSITIVE_INFINITY);
    return [...pool].sort((a, b) => costOf(a) - costOf(b) || a.name.localeCompare(b.name));
  }

  #renderPoolRow(rowRect: Rect, geometry: PoolGridGeometry, cards: readonly AnyCard[], rowIndex: number, deck: Deck): VirtualListRow {
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

      const artRect: Rect = { x: cardRect.x + 2, y: cardRect.y + 2, width: cardRect.width - 4, height: cardRect.height - geometry.captionHeight - 4 };
      const artFill = this.add.graphics();
      artFill.fillStyle(surface.parchment.hex, 1).fillRect(artRect.x, artRect.y, artRect.width, artRect.height);
      objects.push(artFill);
      const key = cardArt(this).request(this, artFor(card, { kind: "front" }));
      const art = drawArt(this, key, artRect);
      if (art) objects.push(art);
      else objects.push(label(this, artRect.x + artRect.width / 2, artRect.y + artRect.height / 2, "no scan", typeRole.label, surface.ink.hex, ink.meta).setOrigin(0.5));
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
      objects.push(
        this.add.text(cardRect.x + 8, ruleY + 6 + name.height + 3, caption, { ...textStyle(typeRole.label, surface.ink.hex, ink.meta), fontStyle: "800" }).setLetterSpacing(0.8),
      );
    }
    return { objects };
  }

  #inspectCard(card: AnyCard): void {
    this.scene.launch(SCENES.inspect, { card: { cardId: card.id, face: { kind: "front" } } });
  }

  // ------------------------------------------------------------------------------------------------------------
  // The stats pane: the selected deck's curve, composition, "recently changed" (S4/W9 — honest and minimal, see
  // `view/deck-recency.ts`), Check/Edit/Delete as a compact secondary row, then the footer D14 itself draws:
  // DUPLICATE beside the single red "PLAY THIS DECK ▸".
  // ------------------------------------------------------------------------------------------------------------
  #drawStatsPane(rect: Rect, option: DeckOption | null): void {
    const bg = this.add.graphics();
    paintPanel(bg, rect, "onInk", "rest");

    const left = rect.x + 16;
    const column = rect.width - 32;
    let y = rect.y + 16;

    if (!option) {
      this.add.text(left, y, "Select a deck to see its stats.", textStyle(typeRole.body, surface.paper.hex, ink.body)).setWordWrapWidth(column);
      return;
    }

    const deck = option.deck;
    const stats = deckStatsOf(deck, POOL_CARDS);

    const name = this.add.text(left, y, deck.name, textStyle(typeRole.barTitle, surface.paper.hex));
    fitText(name, column);
    y += name.height + 4;
    label(this, left, y, `${SOURCE_LABEL[deck.source.kind]} · ${option.identityName ?? "unknown identity"}`, typeRole.label, surface.paper.hex, ink.label);
    y += 20;

    const status = deckStatusOf(option);
    label(this, left, y, `${stats.totalCards} CARDS · MINIMUM ${DECK_MIN_CARDS} · ${status.text.toUpperCase()}`, typeRole.label, surface.paper.hex, ink.label);
    y += 24;

    // Check/Edit/Delete: real, needed actions D14 itself doesn't draw (its mock has no notion of this build's
    // deck-check screen or in-place editing) — a compact secondary row here, so the footer below still ends in
    // exactly Duplicate + the red Play button, as designed.
    const editable = deck.source.kind !== "precon";
    const secondaryDefs: { readonly id: string; readonly text: string; readonly onClick: () => void }[] = [
      { id: "check", text: "Check", onClick: () => this.#openDeckCheck(deck) },
      ...(editable ? [{ id: "edit", text: "Edit", onClick: () => this.scene.start(SCENES.deckBuilder, { deck } satisfies DeckBuilderSceneData) }] : []),
      ...(editable ? [{ id: "delete", text: "Delete", onClick: () => void this.#delete(deck.id) }] : []),
    ];
    const secondaryRows = wrapChipsToRows(secondaryDefs, column);
    secondaryRows.forEach((row, rowIndex) => {
      const cellWidth = (column - (row.length - 1) * CHIP_GAP) / row.length;
      row.forEach((action, index) => {
        const cell: Rect = { x: left + index * (cellWidth + CHIP_GAP), y: y + rowIndex * (hit.target + CHIP_GAP), width: cellWidth, height: hit.target };
        this.#buttons.push(new McButton(this, { kind: "onInk", label: action.text, type: typeRole.label, rect: cell, onClick: action.onClick }));
        this.#stops.set(`stats-${action.id}`, { rect: cell, activate: action.onClick });
      });
    });
    y += secondaryRows.length * hit.target + Math.max(0, secondaryRows.length - 1) * CHIP_GAP + 14;

    const ruleG = this.add.graphics();
    ruleG.fillStyle(surface.paper.hex, 1).fillRect(left, y, column, 3);
    y += 16;

    const avgText = stats.averageCost === null ? "" : ` · avg ${stats.averageCost.toFixed(1)}`;
    label(this, left, y, `RESOURCE CURVE${avgText}`, typeRole.label, surface.paper.hex, ink.label);
    y += 16;
    const chartHeight = 84;
    drawCostCurveBars(this, { x: left, y, width: column, height: chartHeight }, costCurveBars(stats), true);
    y += chartHeight + 16;

    y = drawCompositionTiles(this, { x: left, y, width: column, height: hit.target * 2 + CHIP_GAP }, compositionTileDefs(compositionTilesOf(stats)), true) + 8;

    // "Recently changed" (W9): the minimal honest version — one timestamp, no revision history, said plainly
    // rather than pretending to a diff the client doesn't have.
    const changedText = deck.updatedAt ? `Last changed ${new Date(deck.updatedAt).toLocaleDateString()}` : "No change history recorded for this deck.";
    label(this, left, y, changedText, typeRole.label, surface.paper.hex, ink.meta);

    // Footer, pinned to the bottom of the pane regardless of how much the body above used — D14's own two bottom
    // controls, Duplicate beside the single red Play.
    const footerHeight = hit.primary;
    const footerY = rect.y + rect.height - footerHeight - 16;
    const footerRule = this.add.graphics();
    footerRule.fillStyle(surface.paper.hex, 1).fillRect(left, footerY - 13, column, 3);

    const duplicateWidth = column * 0.38;
    const duplicateRect: Rect = { x: left, y: footerY, width: duplicateWidth, height: footerHeight };
    const doDuplicate = (): void => this.#duplicate(deck);
    this.#buttons.push(new McButton(this, { kind: "onInk", label: "Duplicate", type: typeRole.label, rect: duplicateRect, onClick: doDuplicate }));
    this.#stops.set("stats-duplicate", { rect: duplicateRect, activate: doDuplicate });

    const playRect: Rect = { x: left + duplicateWidth + CHIP_GAP, y: footerY, width: column - duplicateWidth - CHIP_GAP, height: footerHeight };
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

  /** "Play this deck ▸" (W9): hands the deck to the existing setup flow with it preselected for seat 1 (`view/setup-draft.ts`'s `withSeatOne`, applied inside `TitleScene#create` — see `scenes/title.ts`'s `TitleSceneData`). */
  #playDeck(deck: Deck): void {
    this.scene.start(SCENES.title, { initialSeatDeckId: deck.id as string, initialSeatDeck: deck } satisfies TitleSceneData);
  }

  /** Opens Deck check (W1) over this deck, returning here on Back. */
  #openDeckCheck(deck: Deck): void {
    this.scene.start(SCENES.deckCheck, { deck, returnTo: { scene: SCENES.decks } } satisfies DeckCheckSceneData);
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
      this.#status = { text: "Clipboard access isn't available here — open this deck in the builder to read its cards instead.", tone: "error" };
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
    const face = card?.type === "villain" ? ({ kind: "villainStage", sideIndex: 0, stageIndex: 0 } as const) : ({ kind: "hero" } as const);
    const note = option.blockedReason ?? option.warning ?? null;
    this.scene.launch(SCENES.inspect, { card: { cardId: option.deck.identityCardId, face }, ...(note ? { note } : {}) });
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
      const outcome = importFromMarvelCdbResponseText(text, ref, `https://marvelcdb.com/${ref.kind}/view/${ref.id}`, this.#importEnv());
      await this.#applyImport(outcome);
    } catch (cause) {
      this.#status = { text: cause instanceof Error ? cause.message : String(cause), tone: "error" };
      this.#busy = false;
      this.#rebuild();
    }
  }

  #importEnv(): ImportEnv {
    return { pool: POOL_CARDS, poolVersion: POOL_VERSION, now: () => new Date().toISOString(), newId: () => crypto.randomUUID() };
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

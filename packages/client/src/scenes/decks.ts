/**
 * The Decks & Collection screen (PLAN.md Phase 9 / W9,
 * docs/phase4-screen-gaps.md §3, D14): every precon plus every saved or
 * imported deck, each with its legality/playability status; a searchable,
 * filterable list (S8) beside the selected deck's stats (S1); import by paste
 * (works everywhere) and by MarvelCDB URL/id (dev/preview through the
 * same-origin route `vite-marvelcdb-import.ts` adds, and in a packaged app
 * through native HTTP — `platform/deck-fetch.ts`); save, delete, and a
 * link into the builder to make or edit one.
 *
 * **The composition, read off D14** (`ScreensDesktop_12`/`_13`.png,
 * docs/design-reference.md): see `view/decks-layout.ts`'s own header comment
 * for the full reasoning. In short: an ink chrome bar over a paper ground,
 * then two panes on a wide screen — the deck list (with its own search field,
 * quick-filter chips, the import/export boxes and "New deck" folded in below
 * it) beside a dark ink sidebar holding the *selected* deck's stats, record,
 * "recently changed" note and its actions (Check, Duplicate, Export,
 * Edit/Delete when it's editable, and a red "Play this deck ▸"). Narrow
 * screens get the same two groups behind a "Decks"/"Stats" tab strip instead
 * of a second column (`decksLayout`'s own doc comment explains why a stacked
 * single column isn't used). **Not built**: D14's own middle "Card pool"
 * column (a second, live-editing card grid) — that's the deck builder's job
 * (`scenes/deck-builder.ts`, reached from "Edit"), not a second copy of it
 * here; and the deck note / owned-card tracking, left unticked per
 * docs/phase4-screen-gaps.md §4 pending the advice/collection decisions.
 *
 * A row's tap **selects** it (updates the stats pane) rather than
 * immediately navigating away — every action that changes or leaves the
 * screen (Edit, Check, Duplicate, Export, Delete, Play) lives in the stats
 * pane instead, acting on whichever deck is currently selected. This is a
 * deliberate change from this screen's previous shape (a tap on an editable
 * row used to open the builder immediately): with a stats pane to show, a
 * plain "look at this deck" action belongs on the row, and there's no longer
 * room on a card-sized row for four separate buttons.
 *
 * Every legality/playability/record fact shown here is `@mc/engine`'s own
 * (`view/deck-list-model.ts`'s `deckOptionsOf`, `view/deck-status.ts` for the
 * chip's words, `view/results-history.ts` for the record) — this scene never
 * decides whether a deck is legal or what its record is.
 */

import Phaser from "phaser";
import { parseMarvelCdbReference, type AnyCard, type Deck, type DeckId } from "@mc/content";
import { DECK_MIN_CARDS } from "@mc/engine";
import { POOL_CARDS, POOL_DEPS, POOL_VERSION } from "../content/pool.js";
import { cardArt } from "../art/card-art.js";
import { duplicateDeck } from "../view/deck-builder-model.js";
import { exportDecklistText, importFromMarvelCdbResponseText, importFromPasteText, type ImportEnv, type ImportOutcome } from "../view/deck-import-model.js";
import { deckOptionsOf, type DeckOption } from "../view/deck-list-model.js";
import { sortByRecency } from "../view/deck-recency.js";
import { compositionTilesOf, costCurveBars, deckStatsOf } from "../view/deck-stats.js";
import { deckStatusOf, type DeckStatusTone } from "../view/deck-status.js";
import { decksLayout, type DecksTab } from "../view/decks-layout.js";
import { deckSourcesOf, heroAspectsOf, heroRosterMatches, withSelectionPinned, type DeckSourceKind, type RosterFilter } from "../view/roster-filter.js";
import { decksFocusOrder } from "../view/screen-focus.js";
import { deckKeyToString, resultsHistoryOf, type DeckKey, type ResultsHistory } from "../view/results-history.js";
import { CHIP_GAP, wrapChipsToRows } from "../view/chip-layout.js";
import type { Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { compositionTileDefs, drawCompositionTiles, drawCostCurveBars } from "../ui/deck-stats-widgets.js";
import { accent, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McMultilineInput, McTabs, McTextInput, fitText, label, paintDotGrid, paintPanel } from "../ui/widgets.js";
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

const ROW_HEIGHT = 60;
const CARDS_BY_ID = new Map<string, AnyCard>(POOL_CARDS.map((card) => [card.id as string, card]));

const SOURCE_LABEL: Readonly<Record<DeckSourceKind, string>> = { precon: "Precon", imported: "Imported", userBuilt: "Built" };

/** One row of the deck list: a group header ("Preconstructed" / "Your decks · recently changed first" — never a focus stop) or a deck row. */
type DeckRow = { readonly kind: "header"; readonly label: string } | { readonly kind: "deck"; readonly option: DeckOption };

/** `deck`'s namespaced record key — the same one `view/results-history.ts` keys `DeckRecord` by. */
function keyOf(deck: Deck): DeckKey {
  return deck.source.kind === "precon" ? { kind: "starter", starterDeckId: deck.source.starterDeckId as string } : { kind: "custom", deckId: deck.id as string };
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
  #selectedDeckId: string | null = null;
  #activeTab: DecksTab = "decks";
  #history: ResultsHistory | null = null;
  #buttons: McButton[] = [];
  #tabs: McTabs | null = null;
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();
  /** The list itself is recreated every rebuild (`ui/virtual-list.ts`); only its scroll position persists, in this field. */
  #list: McVirtualList | null = null;
  #listScroll = new ListScroll();
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
    this.#selectedDeckId = data.focusDeckId ?? null;
    this.#activeTab = "decks";
    this.#history = null;
    this.#listScroll = new ListScroll();
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
    });
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect) || (this.#pasteInput?.focused ?? false) || (this.#marvelcdbInput?.focused ?? false) || (this.#searchInput?.focused ?? false),
      onPage: (direction) => this.#list?.scrollByPage(direction),
      onHomeEnd: (edge) => (edge === "home" ? this.#list?.scrollToStart() : this.#list?.scrollToEnd()),
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

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();
    this.#tabs?.destroy();
    this.#tabs = null;
    // The list is recreated fresh every rebuild, in the normal draw order
    // (`ui/virtual-list.ts` — reattaching it across a sweep put it ahead of
    // whatever the scene drew afterward, so a later background panel ended up
    // on top of it). Its scroll position lives in `#listScroll`, which
    // survives this regardless.
    this.#list?.destroy();
    this.#list = null;

    const { width, height } = this.scale.gameSize;
    const layout = decksLayout({ width, height });

    // The three list-pane DOM text fields (search, paste, MarvelCDB) belong to whatever draws `listPane`/`content`
    // on this pass — wide always draws them; narrow only while the "Decks" tab is active. They aren't Phaser
    // display-list objects (`McTextInput`/`McMultilineInput` are DOM-backed rexUI), so switching to the "Stats" tab
    // and never destroying them would leave them floating over the stats pane forever, invisible to
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
      const deckIds = this.#drawListPane(layout.listPane!, allOptions);
      this.#drawStatsPane(layout.statsPane!, selected);
      this.#route?.set(
        decksFocusOrder({
          showMarvelCdbImport: true,
          deckIds,
          chipIds: this.#chipDefs(allOptions).map((c) => c.id),
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
          { id: "stats", label: "Stats" },
        ],
        activeId: this.#activeTab,
        onSelect: (id) => this.#setTab(id as DecksTab),
      });
      this.#stops.set("tab:decks", { rect: { ...layout.tabs!, width: layout.tabs!.width / 2 }, activate: () => this.#setTab("decks") });
      this.#stops.set("tab:stats", { rect: { ...layout.tabs!, x: layout.tabs!.x + layout.tabs!.width / 2, width: layout.tabs!.width / 2 }, activate: () => this.#setTab("stats") });

      const deckIds = this.#activeTab === "decks" ? this.#drawListPane(layout.content!, allOptions) : [];
      if (this.#activeTab === "stats") this.#drawStatsPane(layout.content!, selected);
      this.#route?.set(
        decksFocusOrder({
          showMarvelCdbImport: true,
          deckIds,
          chipIds: this.#activeTab === "decks" ? this.#chipDefs(allOptions).map((c) => c.id) : [],
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
    this.#rebuild();
  }

  // ------------------------------------------------------------------------------------------------------------
  // The deck list pane: search, quick-filter chips (S8), the virtualized list (grouped: Preconstructed, then
  // saved/imported decks — recently changed first, W9), then Import/Export and New deck. Returns the deck ids
  // actually offered as rows, in list order, for the focus route.
  // ------------------------------------------------------------------------------------------------------------
  #drawListPane(rect: Rect, allOptions: readonly DeckOption[]): readonly string[] {
    const left = rect.x;
    const column = rect.width;
    let y = rect.y;

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

    // Reserve fixed room at the bottom for Import/Export and New deck, so the list gets exactly whatever's left.
    const pasteBlockHeight = 16 + 110;
    const mcdbBlockHeight = 16 + hit.target;
    const newDeckHeight = hit.target;
    const bottomReserved = pasteBlockHeight + 12 + mcdbBlockHeight + 12 + newDeckHeight;
    const listTop = y;
    const listHeight = Math.max(ROW_HEIGHT, rect.y + rect.height - bottomReserved - 12 - listTop);
    const listRect: Rect = { x: left, y: listTop, width: column, height: listHeight };

    const rows = this.#buildRows(allOptions);
    const deckIds = rows.filter((r): r is Extract<DeckRow, { kind: "deck" }> => r.kind === "deck").map((r) => r.option.deck.id as string);

    if (deckIds.length === 0) {
      this.add.text(listRect.x + 10, listRect.y + 10, "No decks match this search.", textStyle(typeRole.body, surface.ink.hex, ink.meta));
      const clearRect: Rect = { x: listRect.x + 10, y: listRect.y + 34, width: 100, height: hit.target };
      const doClear = (): void => {
        this.#filter = { text: "" };
        this.#rebuild();
      };
      this.#buttons.push(new McButton(this, { kind: "quiet", label: "Clear", type: typeRole.label, rect: clearRect, onClick: doClear }));
      this.#stops.set("deck-clear", { rect: clearRect, activate: doClear });
    } else {
      const renderRow = (index: number, rowRect: Rect): VirtualListRow => this.#renderDeckRow(rowRect, rows[index]!);
      this.#list = new McVirtualList(this, { rect: listRect, rowHeight: ROW_HEIGHT, count: rows.length, renderRow, scroll: this.#listScroll });
      const list = this.#list;
      if (!this.#focusedOnce && this.#data.focusDeckId) {
        const index = rows.findIndex((row) => row.kind === "deck" && (row.option.deck.id as string) === this.#data.focusDeckId);
        if (index >= 0) list.scrollIntoView(index);
        this.#focusedOnce = true;
      }
      rows.forEach((row, index) => {
        if (row.kind !== "deck") return;
        const deckId = row.option.deck.id as string;
        const ensureVisible = (): void => list.scrollIntoView(index);
        const select = (): void => {
          this.#selectedDeckId = deckId;
          this.#rebuild();
        };
        const doInspect = (): void => this.#inspect(row.option);
        this.#stops.set(`deck:${deckId}`, { rect: () => list.rectFor(index), activate: select, inspect: doInspect, ensureVisible });
      });
    }
    y = listRect.y + listRect.height + 12;

    label(this, left, y, "paste a decklist", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const pasteRect: Rect = { x: left, y, width: column - 116, height: 110 };
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
    const pasteImportRect: Rect = { x: left + column - 106, y, width: 106, height: hit.target };
    const doPasteImport = (): void => void this.#importPaste();
    this.#buttons.push(new McButton(this, { kind: "secondary", label: this.#busy ? "Importing…" : "Import", type: typeRole.rowTitle, rect: pasteImportRect, enabled: !this.#busy, onClick: doPasteImport }));
    this.#stops.set("paste-import", { rect: pasteImportRect, activate: doPasteImport });
    y += 110 + 16;

    // Always shown, not gated on `import.meta.env.DEV`: `vite preview` serves the same production bundle a real
    // deploy would (see the old note this file carried, unchanged): a genuine production deploy 404s instead.
    label(this, left, y, "import from marvelcdb (by url or id)", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const mcdbFieldRect: Rect = { x: left, y, width: column - 116, height: hit.target };
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
    const mcdbImportRect: Rect = { x: left + column - 106, y, width: 106, height: hit.target };
    const doMcdbImport = (): void => void this.#importMarvelCdb();
    this.#buttons.push(new McButton(this, { kind: "secondary", label: this.#busy ? "Importing…" : "Import", type: typeRole.rowTitle, rect: mcdbImportRect, enabled: !this.#busy, onClick: doMcdbImport }));
    this.#stops.set("marvelcdb-import", { rect: mcdbImportRect, activate: doMcdbImport });
    y += hit.target + 16;

    const newDeckRect: Rect = { x: left, y, width: column, height: hit.target };
    const openBuilder = (): void => { this.scene.start(SCENES.deckBuilder, {} satisfies DeckBuilderSceneData); };
    this.#buttons.push(new McButton(this, { kind: "secondary", label: "New deck…", type: typeRole.rowTitle, rect: newDeckRect, onClick: openBuilder }));
    this.#stops.set("new-deck", { rect: newDeckRect, activate: openBuilder });

    return deckIds;
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

  /** `allOptions` grouped into Preconstructed / Your decks (recently changed first), filtered by search + chips, with the selected deck pinned into view even if the filter would otherwise hide it. */
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
    return rows;
  }

  #renderDeckRow(rect: Rect, row: DeckRow): VirtualListRow {
    if (row.kind === "header") {
      const text = label(this, rect.x + 4, rect.y + rect.height / 2, row.label, typeRole.label, surface.ink.hex, ink.label);
      text.setOrigin(0, 0.5);
      return { objects: [text] };
    }

    const option = row.option;
    const selected = (option.deck.id as string) === this.#selectedDeckId;
    const card: Rect = { x: rect.x + 4, y: rect.y + 2, width: rect.width - 8, height: rect.height - 4 };
    const objects: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics();
    paintPanel(g, card, "card", selected ? "selected" : "rest");
    objects.push(g);

    const status = deckStatusOf(option);
    const tone: Record<DeckStatusTone, number> = { legal: signal.heal.hex, illegal: accent.heroRed.hex, unscripted: signal.caution.hex, poolChanged: signal.cost.hex };
    const chipText = label(this, 0, 0, status.text, typeRole.label, surface.paper.hex, 1);
    const chipWidth = Math.ceil(chipText.width) + 12;
    const chipRight = card.x + card.width - 8;
    const chipG = this.add.graphics();
    chipG.fillStyle(tone[status.tone], 1).fillRect(chipRight - chipWidth, card.y + 8, chipWidth, 18);
    chipText.setPosition(chipRight - chipWidth + 6, card.y + 17).setOrigin(0, 0.5);

    const name = this.add.text(card.x + 10, card.y + 6, option.deck.name, textStyle(typeRole.rowTitle, surface.ink.hex));
    fitText(name, chipRight - chipWidth - 8 - (card.x + 10));
    objects.push(name);
    objects.push(this.add.text(card.x + 10, card.y + 6 + name.height + 2, `${SOURCE_LABEL[option.deck.source.kind]} · ${option.identityName ?? "unknown identity"}`, textStyle(typeRole.label, surface.ink.hex, ink.meta)));
    objects.push(chipG, chipText);
    return { objects };
  }

  // ------------------------------------------------------------------------------------------------------------
  // The stats pane: the selected deck's curve, composition, legality, record and last played (S4), a "recently
  // changed" note (honest and minimal — see `view/deck-recency.ts`), and its actions.
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

    const avgText = stats.averageCost === null ? "" : ` · avg ${stats.averageCost.toFixed(1)}`;
    label(this, left, y, `RESOURCE CURVE${avgText}`, typeRole.label, surface.paper.hex, ink.label);
    y += 16;
    const chartHeight = 84;
    drawCostCurveBars(this, { x: left, y, width: column, height: chartHeight }, costCurveBars(stats), true);
    y += chartHeight + 16;

    y = drawCompositionTiles(this, { x: left, y, width: column, height: hit.target * 2 + CHIP_GAP }, compositionTileDefs(compositionTilesOf(stats)), true) + 8;

    const record = this.#history?.decks.find((r) => deckKeyToString(r.key) === deckKeyToString(keyOf(deck))) ?? null;
    const recordText =
      record && record.gamesPlayed > 0
        ? `Record: ${record.wins}–${record.losses} (${record.gamesPlayed} played) · Last played ${record.lastPlayedAt ? new Date(record.lastPlayedAt).toLocaleDateString() : "—"}`
        : "Never played.";
    const recordLine = this.add.text(left, y, recordText, textStyle(typeRole.body, surface.paper.hex, ink.secondary)).setWordWrapWidth(column);
    y += recordLine.height + 6;

    // "Recently changed" (W9): the minimal honest version — one timestamp, no revision history, and that's said
    // plainly rather than pretending to a diff the client doesn't have.
    const changedText = deck.updatedAt ? `Last changed ${new Date(deck.updatedAt).toLocaleDateString()}` : "No change history recorded for this deck.";
    label(this, left, y, changedText, typeRole.label, surface.paper.hex, ink.meta);
    y += 24;

    const editable = deck.source.kind !== "precon";
    const actionDefs: { readonly id: string; readonly text: string; readonly onClick: () => void }[] = [
      { id: "check", text: "Check", onClick: () => this.#openDeckCheck(deck) },
      { id: "duplicate", text: "Duplicate", onClick: () => this.#duplicate(deck) },
      { id: "export", text: "Export", onClick: () => this.#exportToClipboard(deck) },
      ...(editable ? [{ id: "edit", text: "Edit", onClick: () => this.scene.start(SCENES.deckBuilder, { deck } satisfies DeckBuilderSceneData) }] : []),
      ...(editable ? [{ id: "delete", text: "Delete", onClick: () => void this.#delete(deck.id) }] : []),
    ];
    const actionRows = wrapChipsToRows(actionDefs, column);
    actionRows.forEach((row, rowIndex) => {
      const cellWidth = (column - (row.length - 1) * CHIP_GAP) / row.length;
      row.forEach((action, index) => {
        const cell: Rect = { x: left + index * (cellWidth + CHIP_GAP), y: y + rowIndex * (hit.target + CHIP_GAP), width: cellWidth, height: hit.target };
        this.#buttons.push(new McButton(this, { kind: "onInk", label: action.text, type: typeRole.label, rect: cell, onClick: action.onClick }));
        this.#stops.set(`stats-${action.id}`, { rect: cell, activate: action.onClick });
      });
    });
    y += actionRows.length * hit.target + Math.max(0, actionRows.length - 1) * CHIP_GAP + 16;

    const playRect: Rect = { x: left, y, width: column, height: hit.primary };
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

  #inspect(option: DeckOption): void {
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

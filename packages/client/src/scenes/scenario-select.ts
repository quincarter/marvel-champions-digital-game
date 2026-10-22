/**
 * Scenario select (docs/phase4-screen-gaps.md §3 W2/W2b, D02/P02): a
 * searchable pack-shelf roster of every scenario in the pool (S8, the owner's
 * pack-shelves decision), drill-in to one pack as a full grid (the owner's
 * second-pass "drill into the packs" ask), a full-height detail panel for
 * whichever scenario is selected (stage boxes, the played record, data only —
 * §4: no blurb), Back to the Title menu, and "Choose heroes ▸" into
 * `SeatsScene`.
 */
import Phaser from "phaser";
import type { CardId, Scenario } from "@mc/content";
import {
  CARDS_BY_ID,
  POOL_ENCOUNTER_SETS,
  POOL_PACKS,
  POOL_SCENARIOS,
  POOL_VERSION,
  packNameOf,
} from "../content/pool.js";
import { ART_CATALOG, packCoverFor, villainArtFor } from "../art/scenario-art.js";
import type { Picture } from "../art/pictures.js";
import { artFor } from "../art/art-source.js";
import { hasRandomChosenVillain } from "../view/random-villain.js";
import { cardArt } from "../art/card-art.js";
import { accent, border, dotGrid, ink, signal, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { CAPTION_FLOOR, McButton, McTextInput, fitText, label, paintDotGrid } from "../ui/widgets.js";
import { McShelfRoster } from "../ui/shelf-roster.js";
import { McVirtualList } from "../ui/virtual-list.js";
import {
  encounterSetsCellText,
  lockCaptionOf,
  scenarioDetailOf,
  shelfSubtitleOf,
  type ScenarioDetail,
} from "../view/scenario-detail.js";
import { foeWord } from "../view/foe-words.js";
import { formatScaling } from "../view/scaling-text.js";
import { selectionAmongVisible } from "../view/scenario-selection.js";
import { scenarioProductsOf, withSelectionPinned } from "../view/roster-filter.js";
import { packCompactChipsToRows } from "../view/chip-layout.js";
import { DeckSearchClient } from "../view/deck-search-client.js";
import { rankShelvesByScore } from "../view/deck-search.js";
import { scenarioSearchDocumentOf } from "../view/scenario-search.js";
import { shelvesOf, flattenShelves, type Shelf, type ShelfCandidate } from "../view/roster-shelves.js";
import { ALL_PACKS, drillIntoPack, drillOut, type ShelfDrillState } from "../view/shelf-drill.js";
import { resultsHistoryOf, type ScenarioRecord } from "../view/results-history.js";
import { setScenario, setScenarioFilter, clearScenarioFilter, type SetupDraft } from "../view/setup-draft.js";
import {
  BUILD_YOUR_OWN_SUBTITLE,
  isCivilWarScenario,
  BUILD_YOUR_OWN_TITLE,
  customizeEntryOf,
  enterBuilder,
  setBuilderOrigin,
  isBuilderTile,
  shelvesWithBuilderTile,
  type RosterEntry,
} from "../view/civil-war-entry.js";
import type { CivilWarBuilderData } from "./civil-war-builder.js";
import { scenarioSelectFocusOrder } from "../view/screen-focus.js";
import {
  DETAIL_COLLAPSED_HEIGHT,
  FOOTER_HEIGHT,
  scenarioSelectLayout,
  detailPanelWidthFor,
} from "../view/scenario-select-layout.js";
import { estimateWrappedLines, type Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { appSession } from "../session.js";
import {
  drawCompactChipStrip,
  drawPackGrid,
  drawSearchField,
  drawSearchToggle,
  drawShelfRosterPanel,
  renderShelfCard,
  renderShelfHeader,
} from "./roster-panel.js";
import { McChipRail } from "../ui/chip-rail.js";
import { RailScroll } from "../view/rail-scroll.js";
import { onTap } from "../ui/tap.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { SeatsData } from "./seats.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { refreshUnlocks, unlocks } from "../progression/progression.js";
import { unlockCostOf, unlockOrAsk } from "./unlock-confirm.js";

export interface ScenarioSelectData {
  readonly draft: SetupDraft;
}

/** Matches `view/layout.ts`'s own `toggleRowHeight` constants — a conservative per-character estimate for `typeRole.body` at 11px, so a detail line's *real* wrapped height is known before a live text object exists to measure it. */
const DETAIL_CHAR_WIDTH = 5.4;
const DETAIL_LINE_PX = 15;
const DETAIL_TEXT_PAD = 24;
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"] as const;
const roman = (n: number): string => ROMAN[n] ?? String(n);

const scenarioCountCaption = (count: number): string => `${count} ${count === 1 ? "SCENARIO" : "SCENARIOS"}`;

export class ScenarioSelectScene extends Phaser.Scene {
  #draft!: SetupDraft;
  #buttons: McButton[] = [];
  #stops = new Map<string, FocusStop>();
  /** Whether the phone's stages panel is open. Shut by default: it is reading, not choosing, and it crowds a small screen. */
  #stagesOpen = false;
  /** Narrow only: whether the search field is shown (`ScenarioSelectLayout.searchToggle`). Off by default — the roster gets the row. */
  #searchOpen = false;
  #searchInput: McTextInput | null = null;
  /** Text search runs in a worker (view/deck-search-client.ts); #ranking is its last answer, shown until the next one arrives. Null when no search is active. */
  readonly #search = new DeckSearchClient();
  #ranking: ReadonlyMap<string, number> | null = null;
  #roster: McShelfRoster<RosterEntry> | null = null;
  #grid: McVirtualList | null = null;
  /** Narrow only: the sideways-scrolling product chip rail (`ScenarioSelectLayout.chipsScroll`). Null on wide, where the chips wrap. */
  #chipRail: McChipRail | null = null;
  #route: FocusRoute | null = null;
  #drill: ShelfDrillState = ALL_PACKS;
  /** Every scenario's played record, keyed by scenario id, so the side panel reads the *current* selection's row on each redraw (issue 141). */
  #history: ReadonlyMap<string, ScenarioRecord> = new Map();
  /** The record line last drawn in the side panel, for the dev e2e hook only. */
  #recordText = "";
  readonly #artCache = new Map<string, Picture | null>();
  /** Dev e2e hook only: every tile drawn so far (see `create`). */
  readonly #tileDebug = new Map<string, { id: string; title: string; villainArt: boolean; baked: boolean }>();
  readonly #coverCache = new Map<string, Picture | null>();
  readonly #gridScroll = new ListScroll();
  readonly #chipScroll = new RailScroll();

  constructor() {
    super(SCENES.scenarioSelect);
  }

  init(data: ScenarioSelectData): void {
    this.#draft = data.draft;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    appSession().music?.playTitle();
    this.scale.on("resize", this.#rebuild, this);
    // The villain stage-I card-scan fallback (`#renderScenarioCard`) is drawn through `cardArt(this).request`,
    // which only *asks* the loader — nothing about that call redraws the scene once the scan actually arrives.
    // Without this, a card whose own fallback happened to still be in flight when the last unrelated redraw ran
    // stayed a blank parchment box forever, even though the scan had long since loaded (found by fresh-navigating
    // and waiting several seconds with no interaction — the same "art hasn't arrived yet, draw the frame now,
    // redraw when it does" contract every other art-consuming scene already subscribes to this way).
    const artOff = cardArt(this).onArrived(() => this.#refreshArt());
    // Dev e2e hook (never referenced by product code): the tiles drawn so far (their printed title, whether the
    // scenario has villain art of its own, whether that face has been baked and drawn) and every control's rect.
    if (import.meta.env.DEV) {
      this.#tileDebug.clear();
      (window as unknown as { __mcScenarioSelectDebug?: unknown }).__mcScenarioSelectDebug = {
        tiles: () => [...this.#tileDebug.values()],
        selectedId: () => this.#draft.scenarioId,
        recordText: () => this.#recordText,
        stops: () =>
          [...this.#stops].map(([key, stop]) => ({
            key,
            ...(typeof stop.rect === "function" ? stop.rect() : stop.rect),
          })),
      };
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      artOff();
      this.#search.destroy();
      this.#searchInput?.destroy();
      this.#searchInput = null;
      this.#roster?.destroy();
      this.#roster = null;
      this.#grid?.destroy();
      this.#grid = null;
      this.#chipRail?.destroy();
      this.#chipRail = null;
    });
    this.#route = new FocusRoute(this, {
      blocked: () =>
        this.scene.isActive(SCENES.inspect) ||
        this.scene.isActive(SCENES.unlockConfirm) ||
        (this.#searchInput?.focused ?? false),
      onCancel: () => (this.#drill.packId !== null ? this.#drillOut() : this.#back()),
      onPage: (direction) => (this.#grid ?? this.#roster)?.scrollByPage(direction),
      onHomeEnd: (edge) => {
        const active = this.#grid ?? this.#roster;
        if (edge === "home") active?.scrollToStart();
        else active?.scrollToEnd();
      },
    });
    this.game.events.on("mc-choice-toggle", this.#onInspectChoose, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off("mc-choice-toggle", this.#onInspectChoose, this);
    });
    this.#search.setDocuments(
      POOL_SCENARIOS.map((s) => scenarioSearchDocumentOf(s, CARDS_BY_ID, POOL_ENCOUNTER_SETS, packNameOf)),
      POOL_VERSION + ":scenarios",
    );
    this.#rebuild();
    if (this.#draft.scenarioFilter.text.trim() !== "") this.#requestSearch(this.#draft.scenarioFilter.text);
    fadeScreenIn(this);
    void refreshUnlocks().then((changed) => {
      if (changed && this.sys.isActive()) this.#rebuild();
    });
    void appSession()
      .store.listSaves()
      .then((saves) => {
        if (!this.sys.isActive()) return;
        this.#history = new Map(resultsHistoryOf(saves).scenarios.map((r) => [r.scenarioId, r]));
        this.#rebuild();
      });
  }

  #back(): void {
    this.scale.off("resize", this.#rebuild, this);
    goToScreen(this, SCENES.title);
  }

  #drillOut(): void {
    this.#drill = drillOut();
    this.#rebuild();
  }

  #villainArtFor(scenario: Scenario): Picture | null {
    const id = scenario.id as string;
    if (!this.#artCache.has(id)) this.#artCache.set(id, villainArtFor(ART_CATALOG, id));
    return this.#artCache.get(id) ?? null;
  }

  #packCoverFor(packCode: string): Picture | null {
    if (!this.#coverCache.has(packCode)) this.#coverCache.set(packCode, packCoverFor(ART_CATALOG, packCode));
    return this.#coverCache.get(packCode) ?? null;
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();
    this.#roster?.destroy();
    this.#roster = null;
    this.#grid?.destroy();
    this.#grid = null;
    this.#chipRail?.destroy();
    this.#chipRail = null;

    const kept = this.#searchInput ? [this.#searchInput.gameObject] : [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    // The selection is always something the shelf shows: a chip or a search that hides it moves it to the first
    // scenario still visible (`view/scenario-selection.ts`); with none visible, "Choose heroes" is disabled.
    const shelves = this.#shelves();
    const selection = selectionAmongVisible(
      this.#draft.scenarioId,
      flattenShelves(shelves)
        .filter((entry): entry is Scenario => !isBuilderTile(entry))
        .map((entry) => entry.id as string),
    );
    const scenario = POOL_SCENARIOS.find((candidate) => (candidate.id as string) === selection.selectedId);
    this.#draft = setScenario(this.#draft, scenario, selection.selectedId);

    const chipDefs = scenarioProductsOf(POOL_SCENARIOS).map((code) => ({
      id: `product:${code}`,
      text: packNameOf(code),
      selected: this.#draft.scenarioFilter.product === code,
      onClick: () => {
        this.#draft = setScenarioFilter(this.#draft, {
          ...this.#draft.scenarioFilter,
          product: this.#draft.scenarioFilter.product === code ? null : code,
        });
        this.#rebuild();
      },
    }));

    const currentScenario = scenario ?? POOL_SCENARIOS[0]!;
    // "Customize this scenario": only on a ready-made Civil War scenario (inert until one is in the pool).
    const customize = customizeEntryOf(scenario);
    const detail = scenarioDetailOf(currentScenario, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    // The real wrapped line count against the panel's own text width, not a raw string count — a fixed
    // per-string budget clipped a long line against a ~300px side panel.
    const detailTextWidth = detailPanelWidthFor(width, height) - DETAIL_TEXT_PAD;

    // Two passes: the chips wrap against the roster column's own width, which only the layout knows — wrapping
    // against the full viewport width for the first estimate under-counted the rows (the column is at least two
    // gutters narrower, 300px+ on wide) and drew the extra row straight through the first shelf's header
    // (2026-09-19 phone check: "The Wrecking Crew" sat on top of "CORE SET").
    // A lock reason is a sentence: it wraps in the footer, and the layout gives the footer the height it measures.
    const lock = unlocks().scenarioLock(currentScenario);
    let footerHeight = FOOTER_HEIGHT;
    const layoutFor = (chipRowCount: number): ReturnType<typeof scenarioSelectLayout> =>
      scenarioSelectLayout({
        footerHeight,
        width,
        height,
        chipRows: chipRowCount,
        detailLines: 12,
        detailCollapsed: !this.#stagesOpen,
        searchOpen: this.#searchOpen,
        secondaryAction: customize !== null,
      });
    const estimatedRows = packCompactChipsToRows(chipDefs, width).length;
    const firstPass = layoutFor(estimatedRows);
    const chipRows = packCompactChipsToRows(chipDefs, firstPass.chips.width);
    let layout = chipRows.length === estimatedRows ? firstPass : layoutFor(chipRows.length);
    if (lock) {
      const probe = label(this, 0, 0, lock, typeRole.label, surface.paper.hex, 1);
      probe.setWordWrapWidth(layout.footer.width);
      footerHeight = Math.ceil(probe.height);
      probe.destroy();
      if (footerHeight > FOOTER_HEIGHT) layout = layoutFor(chipRows.length);
    }

    // Ground: paper body under a full-width ink header bar (docs/design-renders/ScreensDesktop_01-02.png).
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    paintDotGrid(
      this,
      { x: 0, y: layout.headerBar.height, width, height: height - layout.headerBar.height },
      "paper",
      dotGrid.onPaper,
    );
    this.add
      .rectangle(
        layout.headerBar.x,
        layout.headerBar.y,
        layout.headerBar.width,
        layout.headerBar.height,
        surface.ink.hex,
      )
      .setOrigin(0, 0);

    const back = (): void => this.#back();
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "◂ Back",
        type: typeRole.backLabel,
        rect: layout.back,
        onClick: back,
      }),
    );
    this.#stops.set("back", { rect: layout.back, activate: back });
    const titleX = layout.back.x + layout.back.width + 16;
    const title = this.add
      .text(titleX, layout.headerBar.height / 2, "Choose a scenario", textStyle(typeRole.pageTitle, surface.paper.hex))
      .setOrigin(0, 0.5);
    fitText(title, layout.step.x - titleX - 12, typeRole.pageTitle.size);
    this.add
      .text(
        layout.step.x + layout.step.width,
        layout.headerBar.height / 2,
        "STEP 1 OF 4",
        textStyle(typeRole.label, surface.paper.hex, ink.label),
      )
      .setOrigin(1, 0.5);

    this.#drawSearchAndChips(layout, chipDefs, chipRows);

    const cardMetrics = this.#cardMetrics(layout.shelves);
    let cardIds: readonly string[];
    if (this.#drill.packId !== null) {
      const shelf = shelves.find((s) => s.id === this.#drill.packId);
      const drillBack = (): void => this.#drillOut();
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "◂ All packs",
          type: typeRole.rowTitle,
          rect: { x: layout.shelves.x, y: layout.shelves.y, width: 130, height: 28 },
          onClick: drillBack,
        }),
      );
      this.#stops.set("drill-back", {
        rect: { x: layout.shelves.x, y: layout.shelves.y, width: 130, height: 28 },
        activate: drillBack,
      });
      this.add
        .text(
          layout.shelves.x + 140,
          layout.shelves.y + 14,
          shelf ? shelf.title.toUpperCase() : "",
          textStyle(typeRole.sectionHeader, surface.ink.hex),
        )
        .setOrigin(0, 0.5);
      const gridRect: Rect = {
        x: layout.shelves.x,
        y: layout.shelves.y + 36,
        width: layout.shelves.width,
        height: layout.shelves.height - 36,
      };
      const items = shelf?.items ?? [];
      this.#grid = drawPackGrid({
        scene: this,
        rect: gridRect,
        items,
        cardWidth: cardMetrics.cardWidth,
        cardHeight: cardMetrics.cardHeight,
        cardGap: cardMetrics.cardGap,
        rowGap: cardMetrics.shelfGap,
        scroll: this.#gridScroll,
        focusPrefix: "scenario",
        idOf: (s) => s.id as string,
        renderCard: (s, _index, rect) => this.#renderEntry(s, rect),
        onCardActivate: (s) => this.#activateEntry(s),
        inspect: (s) => this.#inspectEntry(s),
        onClear: () => this.#drillOut(),
        buttons: this.#buttons,
        stops: this.#stops,
      });
      cardIds = ["drill-back", ...items.map((s) => s.id as string)];
    } else {
      this.#roster = drawShelfRosterPanel({
        scene: this,
        rect: layout.shelves,
        shelves,
        metrics: cardMetrics,
        screen: "scenario-select",
        focusPrefix: "scenario",
        idOf: (s) => s.id as string,
        renderHeader: (shelf, rect) =>
          renderShelfHeader(
            this,
            shelf,
            rect,
            shelf.id === "your-decks" ? null : this.#packCoverFor(shelf.id),
            () => this.#roster?.refreshVisible(),
            scenarioCountCaption(shelf.items.filter((e) => !isBuilderTile(e)).length),
          ),
        renderCard: (s, _shelfIndex, _itemIndex, rect) => this.#renderEntry(s, rect),
        onCardActivate: (s) => this.#activateEntry(s),
        onHeaderActivate: (shelf) => {
          this.#drill = drillIntoPack(shelf.id);
          this.#rebuild();
        },
        inspect: (s) => this.#inspectEntry(s),
        onClear: () => {
          this.#draft = clearScenarioFilter(this.#draft);
          this.#searchInput?.setValue("");
          this.#rebuild();
        },
        buttons: this.#buttons,
        stops: this.#stops,
      });
      cardIds = flattenShelves(shelves).map((s) => s.id as string);
    }

    // Stat strip (D02's own band below the roster): main scheme, starting threat, villain HP (stage I), encounter sets — the same `detail` the ink panel already computed, so the two can't disagree.
    // Zero-height while the phone's disclosure is shut — the strip folds away with the stages.
    // (An open phone sheet draws the strip itself, over its own ground — see `#drawSidePanel`.)
    if (layout.statStrip.height > 0 && !layout.detailOverlay)
      this.#drawStatStrip(layout.statStrip, detail, layout.statStripRows);

    // The side panel (D02's own "SCENARIO STAGES" sidebar): a Bangers header, one outlined box per stage (bright at
    // the draft's current difficulty, dim otherwise), the played record, and the CTA pinned at the foot.
    this.#drawSidePanel(layout, detail, detailTextWidth);

    // Locked, the CTA becomes the door to unlocking this one scenario with champion points, right here.
    const unlockTarget = { kind: "scenario", scenarioId: currentScenario.id as string } as const;
    const next = (): void => {
      if (lock) {
        unlockOrAsk(this, unlockTarget, () => this.#rebuild());
        return;
      }
      this.scale.off("resize", this.#rebuild, this);
      goToScreen(this, SCENES.seats, { draft: this.#draft } satisfies SeatsData);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: lock ? `Unlock · ${unlockCostOf(unlockTarget)} pts` : "Choose heroes ▸",
        type: typeRole.barTitle,
        rect: layout.next,
        onClick: next,
        enabled: selection.canContinue,
      }),
    );
    this.#stops.set("next", { rect: layout.next, activate: selection.canContinue ? next : () => {} });
    if (customize && layout.secondary) {
      const open = (): void => this.#openBuilder("customize", customize.scenarioId);
      this.#buttons.push(
        new McButton(this, {
          kind: layout.wide ? "onInk" : "secondary",
          label: customize.label,
          type: typeRole.rowTitle,
          rect: layout.secondary,
          onClick: open,
        }),
      );
      this.#stops.set("customize", { rect: layout.secondary, activate: open });
    }
    // Locked: the footer says how to open it for free, since the CTA itself is the paid way.
    const footer = label(
      this,
      layout.footer.x,
      layout.footer.y,
      lock ?? "Step 1 of 4 · scenario",
      typeRole.label,
      // On the dark detail panel (wide) the caption is paper; on a phone it sits on the page's own ground.
      layout.wide ? surface.paper.hex : surface.ink.hex,
      lock ? 1 : ink.label,
    );
    if (lock) footer.setWordWrapWidth(layout.footer.width);

    this.#route?.set(
      scenarioSelectFocusOrder({
        scenarioIds: cardIds,
        scenarioChipIds: chipDefs.map((c) => c.id),
        stagesToggle: !layout.wide,
        searchToggle: !layout.wide,
        customize: customize !== null,
      }),
      this.#stops,
    );
  }

  /**
   * The search field and the product chips. Wide draws the field above wrapped chips, always. Narrow draws one
   * row — the search toggle at its head, the chips as a sideways rail beside it — and the field only while the
   * toggle is on (`view/scenario-select-layout.ts`'s `searchOpen`), so a phone's roster gets the row back.
   */
  #drawSearchAndChips(
    layout: ReturnType<typeof scenarioSelectLayout>,
    chipDefs: readonly { id: string; text: string; selected: boolean; onClick: () => void }[],
    chipRows: readonly (readonly { id: string; text: string; selected: boolean; onClick: () => void }[])[],
  ): void {
    const filter = this.#draft.scenarioFilter;
    if (layout.search.height > 0) {
      this.#searchInput = drawSearchField(
        this,
        layout.search,
        "scenario-search",
        filter.text,
        "search scenarios, villains, packs…",
        (value) => {
          this.#draft = setScenarioFilter(this.#draft, { ...this.#draft.scenarioFilter, text: value });
          this.#requestSearch(value);
        },
        this.#searchInput,
        this.#stops,
      );
      // The phone's open stages sheet covers this row, and a DOM field would show straight through it.
      this.#searchInput.setVisible(!layout.detailOverlay);
    } else if (this.#searchInput) {
      this.#searchInput.destroy();
      this.#searchInput = null;
    }
    if (layout.searchToggle) {
      drawSearchToggle(
        this,
        layout.searchToggle,
        "scenario-search-toggle",
        this.#searchOpen || filter.text.length > 0,
        () => this.#toggleSearch(),
        this.#buttons,
        this.#stops,
      );
    }
    if (layout.chipsScroll) {
      const rail = new McChipRail(this, { rect: layout.chips, chips: chipDefs, scroll: this.#chipScroll });
      this.#chipRail = rail;
      chipDefs.forEach((chip, index) => {
        this.#stops.set(`scenario-chip:${chip.id}`, {
          rect: () => rail.rectFor(index),
          activate: chip.onClick,
          ensureVisible: () => rail.scrollIntoView(index),
        });
      });
    } else {
      drawCompactChipStrip(this, layout.chips, chipRows, "scenario-chip", this.#buttons, this.#stops);
    }
  }

  /** Asks the worker to rank the scenarios for the text; the screen redraws when the newest answer arrives. An empty text clears the search at once. */
  #requestSearch(text: string): void {
    if (text.trim() === "") {
      this.#search.cancel();
      this.#ranking = null;
      this.#rebuild();
      return;
    }
    this.#search.search(text, (ranked) => {
      if (!this.sys.isActive()) return;
      this.#ranking = new Map(ranked.map((r) => [r.id, r.score]));
      this.#rebuild();
    });
  }

  #toggleSearch(): void {
    this.#searchOpen = !this.#searchOpen;
    // Shutting the field also clears its text: a filter whose field you can no longer see must not keep hiding
    // scenarios. The product chips are their own visible controls and stay as they were.
    if (!this.#searchOpen && this.#draft.scenarioFilter.text) {
      this.#draft = setScenarioFilter(this.#draft, { ...this.#draft.scenarioFilter, text: "" });
      this.#search.cancel();
      this.#ranking = null;
    }
    this.#rebuild();
    if (this.#searchOpen) this.#searchInput?.focus();
  }

  /** Card size: ~300px wide (D02's own roughly-300px-wide art-dominant cards), tall enough to fill most of the shelf viewport's own height, capped so it doesn't run away on a very tall monitor. */
  #cardMetrics(shelvesRect: Rect): {
    cardWidth: number;
    cardHeight: number;
    cardGap: number;
    headerHeight: number;
    headerToCardsGap: number;
    shelfGap: number;
  } {
    const headerHeight = 30;
    const headerToCardsGap = 8;
    const shelfGap = 20;
    const cardGap = 12;
    const cardWidth = Math.min(300, shelvesRect.width - 40);
    const available = shelvesRect.height - headerHeight - headerToCardsGap - shelfGap;
    const cardHeight = Math.max(220, Math.min(440, available));
    return { cardWidth, cardHeight, cardGap, headerHeight, headerToCardsGap, shelfGap };
  }

  #refreshArt(): void {
    this.#roster?.refreshVisible();
    if (this.#grid) this.#grid.layout(this.#grid.rect);
  }

  #renderScenarioCard(s: Scenario, rect: Rect): ReturnType<typeof renderShelfCard> {
    // The villain's scene art, or — with none yet (Klaw, Risky Business, Mutagen Formula today) — its own stage-I
    // card scan, cover-cropped, rather than an empty parchment box (second-pass item 7). Only the URL: the card-face
    // worker fetches and decodes it, downscaled to the card, and the roster redraws when the face arrives.
    const picture = this.#villainArtFor(s);
    const villainCard = picture || hasRandomChosenVillain(s) ? undefined : CARDS_BY_ID.get(s.villainCardId as string);
    const artUrl =
      picture?.url ??
      (villainCard ? artFor(villainCard, { kind: "villainStage", sideIndex: 0, stageIndex: 0 }) : null)?.url ??
      null;
    const cardDetail = scenarioDetailOf(s, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const subtitle = shelfSubtitleOf(cardDetail);
    const selected = this.#draft.scenarioId === (s.id as string);
    // A locked scenario stays selectable, so its stages can be read ahead of time; only "Choose heroes" refuses it.
    const lock = unlocks().scenarioLock(s);
    const row = renderShelfCard(this, rect, {
      artUrl,
      artFocusY: 0,
      titleRole: typeRole.villainTitle,
      title: cardDetail.tileTitle,
      subtitle,
      blockedBy: lock,
      warning: lock ? lockCaptionOf(lock, unlockCostOf({ kind: "scenario", scenarioId: s.id as string })) : null,
      subtitleLines: 2,
      tag: lock ? "LOCKED" : selected ? "SELECTED" : null,
      selected,
    });
    if (import.meta.env.DEV) {
      this.#tileDebug.set(s.id as string, {
        id: s.id as string,
        title: cardDetail.tileTitle,
        villainArt: picture !== null,
        baked: row.objects[0]?.type === "Image",
      });
    }
    return row;
  }

  /**
   * The band under the roster (D02): main scheme, starting threat, stage I HP, and the fixed encounter sets — all
   * read off the same `ScenarioDetail` the ink panel draws. Parchment ground with a 3px ink border and a vertical
   * ink divider between cells, Bangers values (second-pass item 9) — safe now that the roster above it has no
   * boxed background of its own to visually collide with (item 3).
   *
   * `rows` (`ScenarioSelectLayout.statStripRows`) lays four cells out across one row when there's room (wide) or
   * 2×2 when there isn't (narrow).
   */
  #drawStatStrip(rect: Rect, detail: ScenarioDetail, rows: 1 | 2): void {
    const g = this.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(3, surface.ink.hex, 1).strokeRect(rect.x + 1.5, rect.y + 1.5, rect.width - 3, rect.height - 3);
    const firstStage = detail.stages[0];
    const accelerating = detail.startingAcceleration.base > 0 || detail.startingAcceleration.perPlayer > 0;
    const accel = accelerating ? ` · accel ${formatScaling(detail.startingAcceleration)}` : "";
    const cells: readonly { readonly label: string; readonly value: string }[] = [
      { label: "Main scheme", value: detail.mainSchemeName },
      { label: "Starting threat", value: `${formatScaling(detail.startingThreat)} start${accel}` },
      {
        label: `${detail.foeWord} HP`,
        value: detail.villainIsRandom
          ? "Varies"
          : detail.stages.map((stage) => formatScaling(stage.hp).split(" ")[0]).join(" · ") ||
            (firstStage ? formatScaling(firstStage.hp) : "—"),
      },
      {
        label: "Encounter sets",
        value: encounterSetsCellText(detail),
      },
    ];
    const perRow = Math.ceil(cells.length / rows);
    const cellWidth = rect.width / perRow;
    const rowHeight = rect.height / rows;
    cells.forEach((cell, index) => {
      const col = index % perRow;
      const row = Math.floor(index / perRow);
      const x = rect.x + col * cellWidth;
      const y = rect.y + row * rowHeight;
      if (col > 0) g.lineStyle(2, surface.ink.hex, 1).lineBetween(x, y + 6, x, y + rowHeight - 6);
      if (row > 0) g.lineStyle(2, surface.ink.hex, 1).lineBetween(x, y, x + cellWidth, y);
      label(this, x + 12, y + 8, cell.label, typeRole.label, surface.ink.hex, ink.label);
      const value = this.add.text(x + 12, y + 22, cell.value, textStyle(typeRole.sectionHeader, surface.ink.hex));
      // One line at full size when it fits; else it wraps to the lines the cell has room for, stepping the type down
      // until it does. Never cut with an ellipsis.
      const room = rect.y + (row + 1) * rowHeight - 4 - value.y;
      value.setWordWrapWidth(cellWidth - 20);
      for (let size = Math.min(typeRole.sectionHeader.size, 16); size >= CAPTION_FLOOR; size--) {
        value.setFontSize(size);
        if (value.getWrappedText().length === 1 || value.height <= room) break;
      }
    });
  }

  /** The current difficulty's own stage range, so a stage box can read "used now" vs "the other mode". */
  #currentStageRange(detail: ScenarioDetail): readonly [number, number] {
    return this.#draft.difficulty === "standard" ? detail.villainStagesStandard : detail.villainStagesExpert;
  }

  #drawSidePanel(
    layout: ReturnType<typeof scenarioSelectLayout>,
    detail: ScenarioDetail,
    detailTextWidth: number,
  ): void {
    const rect = layout.detail;
    this.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.ink.hex).setOrigin(0, 0);
    let y = rect.y + 16;
    if (layout.wide) {
      this.add.text(rect.x + 16, y, "Scenario stages", textStyle(typeRole.sectionHeader, surface.paper.hex));
      y += 28;
    } else {
      // On a phone the panel is a disclosure: its bar is the control, it starts shut, and open it is a sheet
      // risen over the roster from that same bar (`view/scenario-select-layout.ts`). The bar names what is inside
      // even when shut, so the stages are one tap away rather than gone.
      const open = this.#stagesOpen;
      const bar: Rect = {
        x: rect.x,
        y: rect.y + rect.height - DETAIL_COLLAPSED_HEIGHT,
        width: rect.width,
        height: DETAIL_COLLAPSED_HEIGHT,
      };
      if (open) {
        // Swallows taps meant for the cards and chips the sheet is covering.
        this.add
          .zone(rect.x, rect.y, rect.width, rect.height - bar.height)
          .setOrigin(0, 0)
          .setInteractive();
        const rule = this.add.graphics();
        rule.lineStyle(1, surface.paper.hex, ink.disabled).lineBetween(bar.x, bar.y, bar.x + bar.width, bar.y);
      }
      const [from, to] = this.#currentStageRange(detail);
      const summary = `${detail.displayName.toUpperCase()} · STAGE ${roman(from)}${to > from ? `–${roman(to)}` : ""}`;
      this.add
        .text(
          bar.x + 16,
          bar.y + bar.height / 2,
          "Scenario stages",
          textStyle(typeRole.sectionHeader, surface.paper.hex),
        )
        .setOrigin(0, 0.5);
      this.add
        .text(
          bar.x + bar.width - 16,
          bar.y + bar.height / 2,
          open ? "▾" : "▴",
          textStyle(typeRole.sectionHeader, surface.paper.hex),
        )
        .setOrigin(1, 0.5);
      if (!open) {
        const hint = this.add
          .text(
            bar.x + bar.width - 40,
            bar.y + bar.height / 2,
            summary,
            textStyle(typeRole.label, surface.paper.hex, ink.label),
          )
          .setOrigin(1, 0.5);
        fitText(hint, bar.width - 40 - 170, typeRole.label.size);
      }
      const toggle = (): void => {
        this.#stagesOpen = !this.#stagesOpen;
        this.#rebuild();
      };
      // A tap, not any release: a thumb scrolling the roster above often lifts over this bar.
      onTap(
        this.add.zone(bar.x, bar.y, bar.width, bar.height).setOrigin(0, 0).setInteractive({ useHandCursor: true }),
        toggle,
      );
      this.#stops.set("stages-toggle", { rect: bar, activate: toggle });
      if (!open) return;
      this.#drawStatStrip(layout.statStrip, detail, layout.statStripRows);
      y = layout.statStrip.y + layout.statStrip.height + 14;
    }
    if (detail.otherVillainNames.length > 0) {
      const note = this.add.text(
        rect.x + 16,
        y,
        `+ ${detail.otherVillainNames.length} more: ${detail.otherVillainNames.join(", ")}`,
        textStyle(typeRole.label, surface.paper.hex, ink.label),
      );
      note.setWordWrapWidth(rect.width - 32);
      y += note.height + 8;
    }
    // Where the panel's own content has to stop: above the CTA on a wide layout, above its own bar on a phone sheet.
    const contentBottom = layout.wide
      ? (layout.secondary ?? layout.next).y - 8
      : rect.y + rect.height - DETAIL_COLLAPSED_HEIGHT - 8;
    const [rangeStart, rangeEnd] = this.#currentStageRange(detail);
    for (const stage of detail.villainIsRandom ? detail.stages.slice(0, 1) : detail.stages) {
      const boxHeight = 44;
      if (y + boxHeight > contentBottom) break;
      const current = stage.stageNumber >= rangeStart && stage.stageNumber <= rangeEnd;
      const box = this.add.graphics();
      box
        .lineStyle(current ? 2 : 1, surface.paper.hex, current ? 1 : ink.disabled)
        .strokeRect(rect.x + 16, y, rect.width - 32, boxHeight);
      const stageLabel = stage.stageLabel ?? roman(stage.stageNumber);
      this.add
        .text(
          rect.x + 24,
          y + 6,
          `${stageLabel} · ${(detail.villainChoices.length > 0 ? "your villain" : detail.villainName).toUpperCase()}`,
          textStyle(typeRole.sectionHeader, surface.paper.hex, current ? 1 : ink.disabled),
        )
        .setFontSize(15);
      this.add.text(
        rect.x + 24,
        y + 26,
        detail.villainIsRandom
          ? "Drawn at random"
          : `SCH ${stage.sch} · HP ${formatScaling(stage.hp)} · ATK ${stage.atk}`,
        textStyle(typeRole.label, surface.paper.hex, current ? ink.label : ink.disabled),
      );
      y += boxHeight + 8;
    }
    y += 8;
    if (y + 64 > contentBottom) return;
    const rule = this.add.graphics();
    rule.lineStyle(1, surface.paper.hex, ink.disabled).lineBetween(rect.x + 16, y, rect.x + rect.width - 16, y);
    y += 12;
    const record = this.#history.get(this.#draft.scenarioId) ?? null;
    const played = record !== null && record.combined.gamesPlayed > 0;
    const tally = played
      ? `${record.combined.wins} win${record.combined.wins === 1 ? "" : "s"} · ${record.combined.losses} loss${record.combined.losses === 1 ? "" : "es"}`
      : "Not played yet";
    const beaten = played && record.combined.wins > 0;
    const subline = !played
      ? null
      : record.combined.bestClearRounds !== null
        ? `Best clear: round ${record.combined.bestClearRounds}`
        : beaten
          ? null
          : "Not beaten yet";
    this.#recordText = played ? `Your record: ${tally}.${subline ? ` ${subline}.` : ""}` : "Not played yet.";
    // The record is a filled band, not a dim body line (issue 141 follow-up), at menu-button size so it reads from the
    // couch: win-state green once beaten, a deep red (darker than the Hero Red CTA) when played but never won, the
    // advisory yellow before it has been played.
    label(this, rect.x + 16, y, "Your record", typeRole.label, surface.paper.hex, ink.label);
    y += 16;
    const band = this.add.graphics();
    const textColor = played ? surface.paper.hex : surface.ink.hex;
    const tallyNode = this.add.text(rect.x + 28, y + 10, tally, textStyle(typeRole.menuButton, textColor));
    tallyNode.setWordWrapWidth(rect.width - 56);
    let bandHeight = tallyNode.height + 20;
    if (subline) {
      const sublineNode = this.add
        .text(rect.x + 28, y + 10 + tallyNode.height + 2, subline, textStyle(typeRole.emphasis, textColor))
        .setFontSize(13);
      bandHeight += sublineNode.height + 2;
    }
    band
      .fillStyle(beaten ? signal.heal.hex : played ? accent.redDeep.hex : signal.caution.hex, 1)
      .fillRect(rect.x + 16, y, rect.width - 32, bandHeight)
      .lineStyle(border.detail, surface.ink.hex, 1)
      .strokeRect(rect.x + 16, y, rect.width - 32, bandHeight);
    y += bandHeight + 14;
    // "Encounter sets" / "Recommended modular" as label-over-value blocks (second-pass item 5), matching the
    // seats panel's own OBLIGATION / NEMESIS SET treatment — not the old plain-text dump of every
    // `scenarioDetailLines` line (a per-stage "Stage 1: 12 per player HP · ATK 0…" that duplicated the stage boxes
    // above verbatim).
    const blocks: readonly { readonly heading: string; readonly value: string }[] = [
      { heading: "Encounter sets", value: detail.fixedEncounterSetNames.join(", ") || "None." },
      detail.modularSummary
        ? { heading: "Modular sets", value: detail.modularSummary }
        : { heading: "Recommended modular", value: detail.recommendedModularSetNames.join(", ") || "None." },
    ];
    for (const block of blocks) {
      if (y + 40 > contentBottom) break;
      label(this, rect.x + 16, y, block.heading, typeRole.label, surface.paper.hex, ink.label);
      y += 16;
      const value = this.add.text(rect.x + 16, y, block.value, textStyle(typeRole.body, surface.paper.hex));
      value.setWordWrapWidth(detailTextWidth);
      y += estimateWrappedLines(block.value, detailTextWidth, DETAIL_CHAR_WIDTH) * DETAIL_LINE_PX + 12;
    }
  }

  #onInspectChoose(rowId: string): void {
    const s = POOL_SCENARIOS.find((candidate) => (candidate.id as string) === rowId);
    if (s) {
      this.#draft = setScenario(this.#draft, s, s.id as string);
      this.#rebuild();
    }
  }

  #shelves(): readonly Shelf<RosterEntry>[] {
    const ranking = this.#ranking;
    const candidates: ShelfCandidate<Scenario>[] = withSelectionPinned(
      POOL_SCENARIOS,
      () => true,
      (s) => this.#draft.scenarioId === (s.id as string),
    ).map((s) => {
      const passesChips =
        (!this.#draft.scenarioFilter.product || (s.packCode as string) === this.#draft.scenarioFilter.product) &&
        (ranking === null || ranking.has(s.id as string));
      return {
        item: s,
        packCode: s.packCode as string,
        searchHaystacks: [],
        passesChips,
      };
    });
    const shelves = shelvesOf(
      candidates,
      POOL_PACKS.map((p) => p.code as string),
      packNameOf,
      "",
    );
    // A search puts the best match first, within each shelf and among the shelves.
    return shelvesWithBuilderTile(
      ranking ? rankShelvesByScore(shelves, (s) => ranking.get(s.id as string) ?? 0) : shelves,
    );
  }

  /** A roster entry's tap: a scenario becomes the draft's pick; the "Build your own" tile opens the builder. */
  #activateEntry(entry: RosterEntry): void {
    if (isBuilderTile(entry)) {
      const first = POOL_SCENARIOS.find((s) => isCivilWarScenario(s));
      if (first) this.#openBuilder("build", first.id as string);
      return;
    }
    this.#draft = setScenario(this.#draft, entry, entry.id as string);
    this.#rebuild();
  }

  /** The builder scene on the draft: "Customize" (this scenario as printed) or "Build your own" (the last build, or the first leader). */
  #openBuilder(kind: "build" | "customize", scenarioId: string): void {
    const entry = enterBuilder(kind, this.#draft, scenarioId);
    setBuilderOrigin("scenarioSelect");
    this.scale.off("resize", this.#rebuild, this);
    goToScreen(this, SCENES.civilWarBuilder, { draft: entry.draft, step: entry.step } satisfies CivilWarBuilderData);
  }

  #renderEntry(entry: RosterEntry, rect: Rect): ReturnType<typeof renderShelfCard> {
    if (!isBuilderTile(entry)) return this.#renderScenarioCard(entry, rect);
    // The box cover: Captain America against Iron Man over the flag, which says "pick a side" better than either
    // leader's own picture or a split of the four (those read as four ready-made scenarios, not a builder).
    const civilWar = POOL_SCENARIOS.find((s) => isCivilWarScenario(s));
    const cover = civilWar ? this.#packCoverFor(civilWar.packCode as string) : null;
    return renderShelfCard(this, rect, {
      artUrl: cover?.url ?? null,
      artFocusY: 0.25,
      titleRole: typeRole.villainTitle,
      title: BUILD_YOUR_OWN_TITLE,
      subtitle: BUILD_YOUR_OWN_SUBTITLE,
      blockedBy: null,
      warning: null,
      subtitleLines: 2,
      tag: "BUILDER",
      selected: false,
    });
  }

  #inspectEntry(entry: RosterEntry): void {
    if (!isBuilderTile(entry)) this.#inspectScenario(entry);
  }

  #inspectScenario(s: Scenario): void {
    // A villain drawn at random (Shadows in the Night) is not known yet, so the sheet shows the main scheme instead.
    const unknown = hasRandomChosenVillain(s);
    const shownId = unknown ? s.mainSchemeCardId : s.villainCardId;
    const card = CARDS_BY_ID.get(shownId as string);
    const face = unknown
      ? ({ kind: "mainSchemeStage", stageIndex: 0, side: "A" } as const)
      : card?.type === "villain"
        ? ({ kind: "villainStage", sideIndex: 0, stageIndex: 0 } as const)
        : ({ kind: "hero" } as const);
    this.scene.launch(SCENES.inspect, {
      card: { cardId: shownId as CardId, face },
      choice: {
        optionId: s.id as string,
        label: s.multipleVillains
          ? "Play this scenario"
          : `Play this ${foeWord(s, { cardsById: CARDS_BY_ID, lower: true })}`,
      },
    });
  }
}

/**
 * Scenario select (docs/phase4-screen-gaps.md §3 W2/W2b, D02/P02): a
 * searchable pack-shelf roster of every scenario in the pool (S8, the owner's
 * 2026-09-18 pack-shelves decision), a full-height detail panel for whichever
 * one is selected (`view/scenario-detail.ts` — §4: data only, no blurb), Back
 * to the Title menu, and "Choose heroes ▸" into `SeatsScene`.
 */
import Phaser from "phaser";
import type { CardId, Scenario } from "@mc/content";
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_PACKS, POOL_SCENARIOS, packNameOf } from "../content/pool.js";
import { ART_CATALOG, packCoverFor, villainArtFor } from "../art/scenario-art.js";
import { ensurePictureLoaded, type Picture } from "../art/pictures.js";
import { dotGrid, ink, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTextInput, label, paintDotGrid } from "../ui/widgets.js";
import { McShelfRoster } from "../ui/shelf-roster.js";
import { scenarioDetailLines, scenarioDetailOf, type ScenarioDetail } from "../view/scenario-detail.js";
import { formatScaling } from "../view/scaling-text.js";
import { scenarioProductsOf, withSelectionPinned } from "../view/roster-filter.js";
import { wrapChipsToRows } from "../view/chip-layout.js";
import { shelvesOf, flattenShelves, type ShelfCandidate } from "../view/roster-shelves.js";
import { setScenario, setScenarioFilter, clearScenarioFilter, type SetupDraft } from "../view/setup-draft.js";
import { scenarioSelectFocusOrder } from "../view/screen-focus.js";
import { scenarioSelectLayout, detailPanelWidthFor } from "../view/scenario-select-layout.js";
import { estimateWrappedLines } from "../view/layout.js";
import { drawChipStrip, drawSearchField, drawShelfRosterPanel, renderShelfCard, renderShelfHeader } from "./roster-panel.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { SeatsData } from "./seats.js";

export interface ScenarioSelectData {
  readonly draft: SetupDraft;
}

const CARD_METRICS = { cardWidth: 160, cardHeight: 220, cardGap: 10, headerHeight: 24, headerToCardsGap: 6, shelfGap: 16 };
/** Matches `view/layout.ts`'s own `toggleRowHeight` constants — a conservative per-character estimate for `typeRole.body` at 11px, so a detail line's *real* wrapped height is known before a live text object exists to measure it. */
const DETAIL_CHAR_WIDTH = 5.4;
const DETAIL_LINE_PX = 15;
const DETAIL_TEXT_PAD = 24;

export class ScenarioSelectScene extends Phaser.Scene {
  #draft!: SetupDraft;
  #buttons: McButton[] = [];
  #stops = new Map<string, FocusStop>();
  #searchInput: McTextInput | null = null;
  #roster: McShelfRoster<Scenario> | null = null;
  #route: FocusRoute | null = null;
  readonly #artCache = new Map<string, Picture | null>();
  readonly #coverCache = new Map<string, Picture | null>();

  constructor() {
    super(SCENES.scenarioSelect);
  }

  init(data: ScenarioSelectData): void {
    this.#draft = data.draft;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#rebuild, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      this.#searchInput?.destroy();
      this.#searchInput = null;
      this.#roster?.destroy();
      this.#roster = null;
    });
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect) || (this.#searchInput?.focused ?? false),
      onCancel: () => this.#back(),
      onPage: (direction) => this.#roster?.scrollByPage(direction),
      onHomeEnd: (edge) => (edge === "home" ? this.#roster?.scrollToStart() : this.#roster?.scrollToEnd()),
    });
    this.game.events.on("mc-choice-toggle", this.#onInspectChoose, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off("mc-choice-toggle", this.#onInspectChoose, this);
    });
    this.#rebuild();
  }

  #back(): void {
    this.scale.off("resize", this.#rebuild, this);
    this.scene.start(SCENES.title);
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

    const kept = this.#searchInput ? [this.#searchInput.gameObject] : [];
    for (const node of kept) this.children.remove(node);
    this.children.removeAll(true);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const scenario = POOL_SCENARIOS.find((candidate) => (candidate.id as string) === this.#draft.scenarioId);
    this.#draft = setScenario(this.#draft, scenario, this.#draft.scenarioId);

    const chipDefs = scenarioProductsOf(POOL_SCENARIOS).map((code) => ({
      id: `product:${code}`,
      text: code,
      selected: this.#draft.scenarioFilter.product === code,
      onClick: () => {
        this.#draft = setScenarioFilter(this.#draft, { ...this.#draft.scenarioFilter, product: this.#draft.scenarioFilter.product === code ? null : code });
        this.#rebuild();
      },
    }));

    const currentScenario = scenario ?? POOL_SCENARIOS[0]!;
    const detail = scenarioDetailOf(currentScenario, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const detailLines = scenarioDetailLines(detail);
    // The real wrapped line count against the panel's own text width, not the raw string count — a fixed
    // per-string budget clipped the first line that ran long against a ~300px side panel (2026-09-18 fidelity pass).
    const detailTextWidth = detailPanelWidthFor(width, height) - DETAIL_TEXT_PAD;
    const detailWrappedLines = detailLines.reduce((sum, line) => sum + estimateWrappedLines(line, detailTextWidth, DETAIL_CHAR_WIDTH), 0);

    const layout = scenarioSelectLayout({ width, height, chipRows: wrapChipsToRows(chipDefs, width).length, detailLines: detailWrappedLines });
    const chipRows = wrapChipsToRows(chipDefs, layout.chips.width);

    // Ground: paper body under a full-width ink header bar (docs/design-renders/ScreensDesktop_01-02.png).
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    paintDotGrid(this, { x: 0, y: layout.headerBar.height, width, height: height - layout.headerBar.height }, "paper", dotGrid.onPaper);
    this.add.rectangle(layout.headerBar.x, layout.headerBar.y, layout.headerBar.width, layout.headerBar.height, surface.ink.hex).setOrigin(0, 0);

    const back = (): void => this.#back();
    this.#buttons.push(new McButton(this, { kind: "onInk", label: "◂ Back", type: typeRole.rowTitle, rect: layout.back, onClick: back }));
    this.#stops.set("back", { rect: layout.back, activate: back });
    this.add.text(
      layout.back.x + layout.back.width + 12,
      layout.headerBar.height / 2,
      "Choose a scenario",
      textStyle(typeRole.rowTitle, surface.paper.hex),
    ).setOrigin(0, 0.5);
    this.add.text(layout.step.x + layout.step.width, layout.headerBar.height / 2, "STEP 1 OF 4", textStyle(typeRole.label, surface.paper.hex, ink.label)).setOrigin(1, 0.5);

    this.#searchInput = drawSearchField(
      this,
      layout.search,
      "scenario-search",
      this.#draft.scenarioFilter.text,
      "search scenarios, villains, packs…",
      (value) => {
        this.#draft = setScenarioFilter(this.#draft, { ...this.#draft.scenarioFilter, text: value });
        this.#rebuild();
      },
      this.#searchInput,
      this.#stops,
    );
    drawChipStrip(this, layout.chips, chipRows, "scenario-chip", this.#buttons, this.#stops);

    const shelves = this.#shelves();
    this.#roster = drawShelfRosterPanel({
      scene: this,
      rect: layout.shelves,
      shelves,
      metrics: CARD_METRICS,
      screen: "scenario-select",
      focusPrefix: "scenario",
      idOf: (s) => s.id as string,
      renderHeader: (shelf, rect) => renderShelfHeader(this, shelf, rect, shelf.id === "your-decks" ? null : this.#packCoverFor(shelf.id), () => this.#roster?.refreshVisible()),
      renderCard: (s, _shelfIndex, _itemIndex, rect) => this.#renderScenarioCard(s, rect),
      onCardActivate: (s) => {
        this.#draft = setScenario(this.#draft, s, s.id as string);
        this.#rebuild();
      },
      inspect: (s) => this.#inspectScenario(s),
      onClear: () => {
        this.#draft = clearScenarioFilter(this.#draft);
        this.#searchInput?.setValue("");
        this.#rebuild();
      },
      buttons: this.#buttons,
      stops: this.#stops,
    });

    // Stat strip (D02's own band below the roster): main scheme, starting threat, villain HP (stage I), encounter sets — the same `detail` the ink panel already computed, so the two can't disagree.
    this.#drawStatStrip(layout.statStrip, detail, layout.statStripRows);

    // The "stage panel" — full-height dark, matching D02's own scenario-stages sidebar. Each line wraps to its
    // own width and the cursor advances by its *real* wrapped height, so a long line (a multi-villain "Villain:"
    // line, say) pushes the next one down instead of running under it.
    this.add.rectangle(layout.detail.x, layout.detail.y, layout.detail.width, layout.detail.height, surface.ink.hex).setOrigin(0, 0);
    let detailCursorY = layout.detail.y + 8;
    for (const line of detailLines) {
      this.add.text(layout.detail.x + 12, detailCursorY, line, textStyle(typeRole.body, surface.paper.hex)).setWordWrapWidth(detailTextWidth);
      detailCursorY += estimateWrappedLines(line, detailTextWidth, DETAIL_CHAR_WIDTH) * DETAIL_LINE_PX;
    }

    const next = (): void => {
      this.scale.off("resize", this.#rebuild, this);
      this.scene.start(SCENES.seats, { draft: this.#draft } satisfies SeatsData);
    };
    this.#buttons.push(new McButton(this, { kind: "primary", label: "Choose heroes ▸", type: typeRole.barTitle, rect: layout.next, onClick: next }));
    this.#stops.set("next", { rect: layout.next, activate: next });

    this.#route?.set(
      scenarioSelectFocusOrder({ scenarioIds: flattenShelves(shelves).map((s) => s.id as string), scenarioChipIds: chipDefs.map((c) => c.id) }),
      this.#stops,
    );
  }

  #renderScenarioCard(s: Scenario, rect: import("../view/layout.js").Rect): ReturnType<typeof renderShelfCard> {
    const picture = this.#villainArtFor(s);
    const artKey = picture ? ensurePictureLoaded(this, picture, () => this.#roster?.refreshVisible()) : null;
    const villain = CARDS_BY_ID.get(s.villainCardId as string);
    const subtitle = s.multipleVillains ? `${packNameOf(s.packCode as string)} · ${s.packCode}` : villain ? `${villain.name} · ${s.packCode}` : s.packCode;
    const selected = this.#draft.scenarioId === (s.id as string);
    return renderShelfCard(this, rect, {
      artKey,
      title: s.name,
      subtitle,
      blockedBy: null,
      warning: null,
      tag: selected ? "SELECTED" : null,
      selected,
    });
  }

  /**
   * The band under the roster (D02): main scheme, starting threat, stage I HP, and the fixed encounter sets — all
   * read off the same `ScenarioDetail` the ink panel draws, so the two can never disagree.
   *
   * Deliberately **not** the roster's own "rail" (parchment) ground — a plain paper ground with its own
   * top/bottom rules is what D02 draws anyway, so the strip is a divider band, not a second recessed panel.
   *
   * **`rows`** (`ScenarioSelectLayout.statStripRows`) lays four cells out across one row when there's room
   * (wide) or 2×2 when there isn't (narrow): at four-across, a ~360px phone column gives each cell ~90px, nowhere
   * near enough for "Starting threat" or "Villain HP · stage I" even in the label's own 9px caps, so adjacent
   * cells' text ran into each other (2026-09-18 fidelity pass — it read as the roster's own last shelf overlapping
   * this strip, but no rect ever actually overlapped; it was this strip's own cells overlapping *themselves*).
   */
  #drawStatStrip(rect: import("../view/layout.js").Rect, detail: ScenarioDetail, rows: 1 | 2): void {
    const g = this.add.graphics();
    g.lineStyle(2, surface.ink.hex, ink.meta);
    g.lineBetween(rect.x, rect.y, rect.x + rect.width, rect.y);
    g.lineBetween(rect.x, rect.y + rect.height, rect.x + rect.width, rect.y + rect.height);
    const firstStage = detail.stages[0];
    const cells: readonly { readonly label: string; readonly value: string }[] = [
      { label: "Main scheme", value: detail.mainSchemeName },
      { label: "Starting threat", value: formatScaling(detail.startingThreat) },
      { label: "Villain HP · stage I", value: firstStage ? formatScaling(firstStage.hp) : "—" },
      { label: "Encounter sets", value: detail.fixedEncounterSetNames.join(", ") || "none" },
    ];
    const perRow = Math.ceil(cells.length / rows);
    const cellWidth = rect.width / perRow;
    const rowHeight = rect.height / rows;
    cells.forEach((cell, index) => {
      const col = index % perRow;
      const row = Math.floor(index / perRow);
      const x = rect.x + col * cellWidth;
      const y = rect.y + row * rowHeight;
      if (col > 0) g.lineStyle(1, surface.ink.hex, ink.disabled).lineBetween(x, y + 6, x, y + rowHeight - 6);
      if (row > 0) g.lineStyle(1, surface.ink.hex, ink.disabled).lineBetween(x, y, x + cellWidth, y);
      label(this, x + 10, y + 8, cell.label, typeRole.label, surface.ink.hex, ink.label);
      this.add.text(x + 10, y + 24, cell.value, textStyle(typeRole.rowTitle, surface.ink.hex)).setWordWrapWidth(cellWidth - 16);
    });
  }

  #onInspectChoose(rowId: string): void {
    const s = POOL_SCENARIOS.find((candidate) => (candidate.id as string) === rowId);
    if (s) {
      this.#draft = setScenario(this.#draft, s, s.id as string);
      this.#rebuild();
    }
  }

  #shelves(): readonly import("../view/roster-shelves.js").Shelf<Scenario>[] {
    const candidates: ShelfCandidate<Scenario>[] = withSelectionPinned(
      POOL_SCENARIOS,
      () => true,
      (s) => this.#draft.scenarioId === (s.id as string),
    ).map((s) => {
      const villain = CARDS_BY_ID.get(s.villainCardId as string);
      const passesChips = !this.#draft.scenarioFilter.product || (s.packCode as string) === this.#draft.scenarioFilter.product;
      return {
        item: s,
        packCode: s.packCode as string,
        searchHaystacks: [s.name, villain?.name, s.packCode as string],
        passesChips,
      };
    });
    return shelvesOf(
      candidates,
      POOL_PACKS.map((p) => p.code as string),
      packNameOf,
      this.#draft.scenarioFilter.text,
    );
  }

  #inspectScenario(s: Scenario): void {
    const card = CARDS_BY_ID.get(s.villainCardId as string);
    const face = card?.type === "villain" ? ({ kind: "villainStage", sideIndex: 0, stageIndex: 0 } as const) : ({ kind: "hero" } as const);
    this.scene.launch(SCENES.inspect, {
      card: { cardId: s.villainCardId as CardId, face },
      choice: { optionId: s.id as string, label: s.multipleVillains ? "Play this scenario" : "Play this villain" },
    });
  }
}

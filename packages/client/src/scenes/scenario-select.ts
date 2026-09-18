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
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_PACKS, POOL_SCENARIOS, packNameOf } from "../content/pool.js";
import { ART_CATALOG, packCoverFor, villainArtFor } from "../art/scenario-art.js";
import { ensurePictureLoaded, type Picture } from "../art/pictures.js";
import { artFor } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { dotGrid, ink, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTextInput, fitText, label, paintDotGrid } from "../ui/widgets.js";
import { McShelfRoster } from "../ui/shelf-roster.js";
import { McVirtualList } from "../ui/virtual-list.js";
import { scenarioDetailOf, type ScenarioDetail } from "../view/scenario-detail.js";
import { formatScaling } from "../view/scaling-text.js";
import { scenarioProductsOf, withSelectionPinned } from "../view/roster-filter.js";
import { packCompactChipsToRows } from "../view/chip-layout.js";
import { shelvesOf, flattenShelves, type Shelf, type ShelfCandidate } from "../view/roster-shelves.js";
import { ALL_PACKS, drillIntoPack, drillOut, type ShelfDrillState } from "../view/shelf-drill.js";
import { resultsHistoryOf, type ScenarioRecord } from "../view/results-history.js";
import { setScenario, setScenarioFilter, clearScenarioFilter, type SetupDraft } from "../view/setup-draft.js";
import { scenarioSelectFocusOrder } from "../view/screen-focus.js";
import { scenarioSelectLayout, detailPanelWidthFor } from "../view/scenario-select-layout.js";
import { estimateWrappedLines, type Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { appSession } from "../session.js";
import { drawCompactChipStrip, drawPackGrid, drawSearchField, drawShelfRosterPanel, renderShelfCard, renderShelfHeader } from "./roster-panel.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { SeatsData } from "./seats.js";

export interface ScenarioSelectData {
  readonly draft: SetupDraft;
}

/** Matches `view/layout.ts`'s own `toggleRowHeight` constants — a conservative per-character estimate for `typeRole.body` at 11px, so a detail line's *real* wrapped height is known before a live text object exists to measure it. */
const DETAIL_CHAR_WIDTH = 5.4;
const DETAIL_LINE_PX = 15;
const DETAIL_TEXT_PAD = 24;
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"] as const;
const roman = (n: number): string => ROMAN[n] ?? String(n);

export class ScenarioSelectScene extends Phaser.Scene {
  #draft!: SetupDraft;
  #buttons: McButton[] = [];
  #stops = new Map<string, FocusStop>();
  #searchInput: McTextInput | null = null;
  #roster: McShelfRoster<Scenario> | null = null;
  #grid: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  #drill: ShelfDrillState = ALL_PACKS;
  #history: ScenarioRecord | null = null;
  readonly #artCache = new Map<string, Picture | null>();
  readonly #coverCache = new Map<string, Picture | null>();
  readonly #gridScroll = new ListScroll();

  constructor() {
    super(SCENES.scenarioSelect);
  }

  init(data: ScenarioSelectData): void {
    this.#draft = data.draft;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#rebuild, this);
    // The villain stage-I card-scan fallback (`#renderScenarioCard`) is drawn through `cardArt(this).request`,
    // which only *asks* the loader — nothing about that call redraws the scene once the scan actually arrives.
    // Without this, a card whose own fallback happened to still be in flight when the last unrelated redraw ran
    // stayed a blank parchment box forever, even though the scan had long since loaded (found by fresh-navigating
    // and waiting several seconds with no interaction — the same "art hasn't arrived yet, draw the frame now,
    // redraw when it does" contract every other art-consuming scene already subscribes to this way).
    const artOff = cardArt(this).onArrived(() => this.#refreshArt());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      artOff();
      this.#searchInput?.destroy();
      this.#searchInput = null;
      this.#roster?.destroy();
      this.#roster = null;
      this.#grid?.destroy();
      this.#grid = null;
    });
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect) || (this.#searchInput?.focused ?? false),
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
    this.#rebuild();
    void appSession()
      .store.listSaves()
      .then((saves) => {
        if (!this.sys.isActive()) return;
        const history = resultsHistoryOf(saves);
        this.#history = history.scenarios.find((r) => r.scenarioId === this.#draft.scenarioId) ?? null;
        this.#rebuild();
      });
  }

  #back(): void {
    this.scale.off("resize", this.#rebuild, this);
    this.scene.start(SCENES.title);
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

    const kept = this.#searchInput ? [this.#searchInput.gameObject] : [];
    for (const node of kept) this.children.remove(node);
    this.children.removeAll(true);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const scenario = POOL_SCENARIOS.find((candidate) => (candidate.id as string) === this.#draft.scenarioId);
    this.#draft = setScenario(this.#draft, scenario, this.#draft.scenarioId);

    const chipDefs = scenarioProductsOf(POOL_SCENARIOS).map((code) => ({
      id: `product:${code}`,
      text: packNameOf(code),
      selected: this.#draft.scenarioFilter.product === code,
      onClick: () => {
        this.#draft = setScenarioFilter(this.#draft, { ...this.#draft.scenarioFilter, product: this.#draft.scenarioFilter.product === code ? null : code });
        this.#rebuild();
      },
    }));

    const currentScenario = scenario ?? POOL_SCENARIOS[0]!;
    const detail = scenarioDetailOf(currentScenario, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    // The real wrapped line count against the panel's own text width, not a raw string count — a fixed
    // per-string budget clipped a long line against a ~300px side panel.
    const detailTextWidth = detailPanelWidthFor(width, height) - DETAIL_TEXT_PAD;

    const layout = scenarioSelectLayout({ width, height, chipRows: packCompactChipsToRows(chipDefs, width).length, detailLines: 12 });
    const chipRows = packCompactChipsToRows(chipDefs, layout.chips.width);

    // Ground: paper body under a full-width ink header bar (docs/design-renders/ScreensDesktop_01-02.png).
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    paintDotGrid(this, { x: 0, y: layout.headerBar.height, width, height: height - layout.headerBar.height }, "paper", dotGrid.onPaper);
    this.add.rectangle(layout.headerBar.x, layout.headerBar.y, layout.headerBar.width, layout.headerBar.height, surface.ink.hex).setOrigin(0, 0);

    const back = (): void => this.#back();
    this.#buttons.push(new McButton(this, { kind: "onInk", label: "◂ Back", type: typeRole.backLabel, rect: layout.back, onClick: back }));
    this.#stops.set("back", { rect: layout.back, activate: back });
    const titleX = layout.back.x + layout.back.width + 16;
    const title = this.add.text(titleX, layout.headerBar.height / 2, "Choose a scenario", textStyle(typeRole.pageTitle, surface.paper.hex)).setOrigin(0, 0.5);
    fitText(title, layout.step.x - titleX - 12, typeRole.pageTitle.size);
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
    drawCompactChipStrip(this, layout.chips, chipRows, "scenario-chip", this.#buttons, this.#stops);

    const shelves = this.#shelves();
    const cardMetrics = this.#cardMetrics(layout.shelves);
    let cardIds: readonly string[];
    if (this.#drill.packId !== null) {
      const shelf = shelves.find((s) => s.id === this.#drill.packId);
      const drillBack = (): void => this.#drillOut();
      this.#buttons.push(new McButton(this, { kind: "quiet", label: "◂ All packs", type: typeRole.rowTitle, rect: { x: layout.shelves.x, y: layout.shelves.y, width: 130, height: 28 }, onClick: drillBack }));
      this.#stops.set("drill-back", { rect: { x: layout.shelves.x, y: layout.shelves.y, width: 130, height: 28 }, activate: drillBack });
      this.add.text(layout.shelves.x + 140, layout.shelves.y + 14, shelf ? shelf.title.toUpperCase() : "", textStyle(typeRole.sectionHeader, surface.ink.hex)).setOrigin(0, 0.5);
      const gridRect: Rect = { x: layout.shelves.x, y: layout.shelves.y + 36, width: layout.shelves.width, height: layout.shelves.height - 36 };
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
        renderCard: (s, _index, rect) => this.#renderScenarioCard(s, rect),
        onCardActivate: (s) => {
          this.#draft = setScenario(this.#draft, s, s.id as string);
          this.#rebuild();
        },
        inspect: (s) => this.#inspectScenario(s),
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
        renderHeader: (shelf, rect) => renderShelfHeader(this, shelf, rect, shelf.id === "your-decks" ? null : this.#packCoverFor(shelf.id), () => this.#roster?.refreshVisible(), `${shelf.items.length} ${shelf.items.length === 1 ? "SCENARIO" : "SCENARIOS"}`),
        renderCard: (s, _shelfIndex, _itemIndex, rect) => this.#renderScenarioCard(s, rect),
        onCardActivate: (s) => {
          this.#draft = setScenario(this.#draft, s, s.id as string);
          this.#rebuild();
        },
        onHeaderActivate: (shelf) => {
          this.#drill = drillIntoPack(shelf.id);
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
      cardIds = flattenShelves(shelves).map((s) => s.id as string);
    }

    // Stat strip (D02's own band below the roster): main scheme, starting threat, villain HP (stage I), encounter sets — the same `detail` the ink panel already computed, so the two can't disagree.
    this.#drawStatStrip(layout.statStrip, detail, layout.statStripRows);

    // The side panel (D02's own "SCENARIO STAGES" sidebar): a Bangers header, one outlined box per stage (bright at
    // the draft's current difficulty, dim otherwise), the played record, and the CTA pinned at the foot.
    this.#drawSidePanel(layout, detail, detailTextWidth);

    const next = (): void => {
      this.scale.off("resize", this.#rebuild, this);
      this.scene.start(SCENES.seats, { draft: this.#draft } satisfies SeatsData);
    };
    this.#buttons.push(new McButton(this, { kind: "primary", label: "Choose heroes ▸", type: typeRole.barTitle, rect: layout.next, onClick: next }));
    this.#stops.set("next", { rect: layout.next, activate: next });
    label(this, layout.footer.x, layout.footer.y, "Step 1 of 4 · scenario", typeRole.label, surface.paper.hex, ink.label);

    this.#route?.set(scenarioSelectFocusOrder({ scenarioIds: cardIds, scenarioChipIds: chipDefs.map((c) => c.id) }), this.#stops);
  }

  /** Card size: ~300px wide (D02's own roughly-300px-wide art-dominant cards), tall enough to fill most of the shelf viewport's own height, capped so it doesn't run away on a very tall monitor. */
  #cardMetrics(shelvesRect: Rect): { cardWidth: number; cardHeight: number; cardGap: number; headerHeight: number; headerToCardsGap: number; shelfGap: number } {
    const headerHeight = 30;
    const headerToCardsGap = 8;
    const shelfGap = 20;
    const cardWidth = Math.min(300, shelvesRect.width - 40);
    const available = shelvesRect.height - headerHeight - headerToCardsGap - shelfGap;
    const cardHeight = Math.max(220, Math.min(440, available));
    return { cardWidth, cardHeight, cardGap: 12, headerHeight, headerToCardsGap, shelfGap };
  }

  #refreshArt(): void {
    this.#roster?.refreshVisible();
    if (this.#grid) this.#grid.layout(this.#grid.rect);
  }

  #renderScenarioCard(s: Scenario, rect: Rect): ReturnType<typeof renderShelfCard> {
    const picture = this.#villainArtFor(s);
    let artKey = picture ? ensurePictureLoaded(this, picture, () => this.#refreshArt()) : null;
    if (!artKey) {
      // No custom scene art for this scenario yet (Klaw, Risky Business, Mutagen Formula today) — the villain's
      // own stage-I card scan, cover-cropped, rather than an empty parchment box (second-pass item 7). Redrawing
      // once this scan actually arrives is `#cardArtArrived`'s job (subscribed once in `create()`), not this
      // function's own — `cardArt(this).request` only *asks*, it never itself triggers a later redraw.
      const villainCard = CARDS_BY_ID.get(s.villainCardId as string);
      const source = villainCard ? artFor(villainCard, { kind: "villainStage", sideIndex: 0, stageIndex: 0 }) : null;
      artKey = cardArt(this).request(this, source);
    }
    const cardDetail = scenarioDetailOf(s, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const stageRange = `Stages ${roman(cardDetail.stages[0]?.stageNumber ?? 1)}–${roman(cardDetail.stages[cardDetail.stages.length - 1]?.stageNumber ?? 1)}`;
    const setName = cardDetail.recommendedModularSetNames[0] ?? cardDetail.fixedEncounterSetNames[0] ?? "";
    const subtitle = `${stageRange}${setName ? ` · ${setName}` : ""}`;
    const selected = this.#draft.scenarioId === (s.id as string);
    return renderShelfCard(this, rect, {
      artKey,
      titleRole: typeRole.villainTitle,
      title: cardDetail.villainName,
      subtitle,
      blockedBy: null,
      warning: null,
      tag: selected ? "SELECTED" : null,
      selected,
    });
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
    const accel = detail.stages.length > 1 ? ` · ${detail.stages.length - 1} accel` : "";
    const cells: readonly { readonly label: string; readonly value: string }[] = [
      { label: "Main scheme", value: detail.mainSchemeName },
      { label: "Starting threat", value: `${formatScaling(detail.startingThreat)} start${accel}` },
      { label: "Villain HP", value: detail.stages.map((stage) => formatScaling(stage.hp).split(" ")[0]).join(" · ") || (firstStage ? formatScaling(firstStage.hp) : "—") },
      { label: "Encounter sets", value: `${detail.villainName.toUpperCase()} · ${(detail.recommendedModularSetNames[0] ?? "").toUpperCase()}` },
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
      value.setFontSize(Math.min(typeRole.sectionHeader.size, 16));
      value.setWordWrapWidth(cellWidth - 20);
    });
  }

  /** The current difficulty's own stage range, so a stage box can read "used now" vs "the other mode". */
  #currentStageRange(detail: ScenarioDetail): readonly [number, number] {
    return this.#draft.difficulty === "standard" ? detail.villainStagesStandard : detail.villainStagesExpert;
  }

  #drawSidePanel(layout: ReturnType<typeof scenarioSelectLayout>, detail: ScenarioDetail, detailTextWidth: number): void {
    const rect = layout.detail;
    this.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.ink.hex).setOrigin(0, 0);
    let y = rect.y + 16;
    this.add.text(rect.x + 16, y, "Scenario stages", textStyle(typeRole.sectionHeader, surface.paper.hex));
    y += 28;
    if (detail.otherVillainNames.length > 0) {
      const note = this.add.text(rect.x + 16, y, `+ ${detail.otherVillainNames.length} more: ${detail.otherVillainNames.join(", ")}`, textStyle(typeRole.label, surface.paper.hex, ink.label));
      note.setWordWrapWidth(rect.width - 32);
      y += note.height + 8;
    }
    const [rangeStart, rangeEnd] = this.#currentStageRange(detail);
    for (const stage of detail.stages) {
      const boxHeight = 44;
      const current = stage.stageNumber >= rangeStart && stage.stageNumber <= rangeEnd;
      const box = this.add.graphics();
      box.lineStyle(current ? 2 : 1, surface.paper.hex, current ? 1 : ink.disabled).strokeRect(rect.x + 16, y, rect.width - 32, boxHeight);
      const stageLabel = stage.stageLabel ?? roman(stage.stageNumber);
      this.add.text(rect.x + 24, y + 6, `${stageLabel} · ${detail.villainName.toUpperCase()}`, textStyle(typeRole.sectionHeader, surface.paper.hex, current ? 1 : ink.disabled)).setFontSize(15);
      this.add.text(rect.x + 24, y + 26, `SCH ${stage.sch} · HP ${formatScaling(stage.hp)} · ATK ${stage.atk}`, textStyle(typeRole.label, surface.paper.hex, current ? ink.label : ink.disabled));
      y += boxHeight + 8;
    }
    y += 8;
    const rule = this.add.graphics();
    rule.lineStyle(1, surface.paper.hex, ink.disabled).lineBetween(rect.x + 16, y, rect.x + rect.width - 16, y);
    y += 12;
    const record = this.#history;
    const recordText =
      record && record.combined.gamesPlayed > 0
        ? `Your record: ${record.combined.wins} win${record.combined.wins === 1 ? "" : "s"} · ${record.combined.losses} loss${record.combined.losses === 1 ? "" : "es"}.${record.combined.bestClearRounds !== null ? ` Best clear: round ${record.combined.bestClearRounds}.` : ""}`
        : "Not played yet.";
    const recordNode = this.add.text(rect.x + 16, y, recordText, textStyle(typeRole.body, surface.paper.hex, ink.label));
    recordNode.setWordWrapWidth(rect.width - 32);
    y += recordNode.height + 14;
    // "Encounter sets" / "Recommended modular" as label-over-value blocks (second-pass item 5), matching the
    // seats panel's own OBLIGATION / NEMESIS SET treatment — not the old plain-text dump of every
    // `scenarioDetailLines` line (a per-stage "Stage 1: 12 per player HP · ATK 0…" that duplicated the stage boxes
    // above verbatim).
    const blocks: readonly { readonly heading: string; readonly value: string }[] = [
      { heading: "Encounter sets", value: detail.fixedEncounterSetNames.join(", ") || "None." },
      { heading: "Recommended modular", value: detail.recommendedModularSetNames.join(", ") || "None." },
    ];
    for (const block of blocks) {
      if (y > layout.next.y - 40) break;
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

  #shelves(): readonly Shelf<Scenario>[] {
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

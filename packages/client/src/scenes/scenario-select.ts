/**
 * Scenario select (docs/phase4-screen-gaps.md §3 W2, D02/P02): a searchable,
 * scrollable roster of every scenario in the pool (S8), a detail panel for
 * whichever one is selected (`view/scenario-detail.ts` — §4: data only, no
 * blurb), Back to the Title menu, and "Choose heroes ▸" into `SeatsScene`.
 */
import Phaser from "phaser";
import type { AnyCard, CardId, Scenario } from "@mc/content";
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_SCENARIOS, packNameOf } from "../content/pool.js";
import { dotGrid, ink, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTextInput, label, paintDotGrid } from "../ui/widgets.js";
import { McVirtualList } from "../ui/virtual-list.js";
import { ListScroll } from "../view/list-scroll.js";
import { scenarioDetailLines, scenarioDetailOf } from "../view/scenario-detail.js";
import { scenarioProductsOf, scenarioRosterMatches, withSelectionPinned } from "../view/roster-filter.js";
import { wrapChipsToRows } from "../view/chip-layout.js";
import { setScenario, setScenarioFilter, clearScenarioFilter, type SetupDraft } from "../view/setup-draft.js";
import { LABEL_ROOM, setupColumnWidth } from "../view/setup-metrics.js";
import { scenarioSelectFocusOrder } from "../view/screen-focus.js";
import { scenarioSelectLayout } from "../view/scenario-select-layout.js";
import { drawChipStrip, drawRosterList, drawSearchField, type RosterRow } from "./roster-panel.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { SeatsData } from "./seats.js";

export interface ScenarioSelectData {
  readonly draft: SetupDraft;
}

export class ScenarioSelectScene extends Phaser.Scene {
  #draft!: SetupDraft;
  #buttons: McButton[] = [];
  #stops = new Map<string, FocusStop>();
  #searchInput: McTextInput | null = null;
  #list: McVirtualList | null = null;
  #scroll = new ListScroll();
  #route: FocusRoute | null = null;

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
      this.#list?.destroy();
      this.#list = null;
    });
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect) || (this.#searchInput?.focused ?? false),
      onCancel: () => this.#back(),
      onPage: (direction) => this.#list?.scrollByPage(direction),
      onHomeEnd: (edge) => (edge === "home" ? this.#list?.scrollToStart() : this.#list?.scrollToEnd()),
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

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();
    this.#list?.destroy();
    this.#list = null;

    const kept = this.#searchInput ? [this.#searchInput.gameObject] : [];
    for (const node of kept) this.children.remove(node);
    this.children.removeAll(true);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const scenario = POOL_SCENARIOS.find((candidate) => (candidate.id as string) === this.#draft.scenarioId);
    this.#draft = setScenario(this.#draft, scenario, this.#draft.scenarioId);

    const chipColumn = setupColumnWidth(width, height);
    const chipDefs = scenarioProductsOf(POOL_SCENARIOS).map((code) => ({
      id: `product:${code}`,
      text: code,
      selected: this.#draft.scenarioFilter.product === code,
      onClick: () => {
        this.#draft = setScenarioFilter(this.#draft, { ...this.#draft.scenarioFilter, product: this.#draft.scenarioFilter.product === code ? null : code });
        this.#scroll.reset();
        this.#rebuild();
      },
    }));
    const chipRows = wrapChipsToRows(chipDefs, chipColumn);

    const currentScenario = scenario ?? POOL_SCENARIOS[0]!;
    const detail = scenarioDetailOf(currentScenario, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const detailLines = scenarioDetailLines(detail);

    const layout = scenarioSelectLayout({ width, height, chipRows: chipRows.length, detailLines: detailLines.length });

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

    label(this, layout.left, layout.search.y - LABEL_ROOM, "Scenario", typeRole.label, surface.ink.hex, ink.label);
    const rows = this.#rows();
    this.#searchInput = drawSearchField(
      this,
      layout.search,
      "scenario-search",
      this.#draft.scenarioFilter.text,
      "search scenarios, villains, packs…",
      (value) => {
        this.#draft = setScenarioFilter(this.#draft, { ...this.#draft.scenarioFilter, text: value });
        this.#scroll.reset();
        this.#rebuild();
      },
      this.#searchInput,
      this.#stops,
    );
    drawChipStrip(this, layout.chips, chipRows, "scenario-chip", this.#buttons, this.#stops);
    this.#list = drawRosterList(
      this,
      layout.list,
      rows,
      this.#scroll,
      "scenario",
      () => {
        this.#draft = clearScenarioFilter(this.#draft);
        this.#searchInput?.setValue("");
        this.#rebuild();
      },
      this.#buttons,
      this.#stops,
      (row) => this.#inspectRow(row),
    );

    // The "stage panel" — dark, matching the mock's own scenario-stages sidebar, rather than plain text on the paper ground.
    this.add.rectangle(layout.detail.x, layout.detail.y, layout.detail.width, layout.detail.height, surface.ink.hex).setOrigin(0, 0);
    detailLines.forEach((line, index) => {
      this.add.text(layout.detail.x + 12, layout.detail.y + 8 + index * 20, line, textStyle(typeRole.body, surface.paper.hex));
    });

    const next = (): void => {
      this.scale.off("resize", this.#rebuild, this);
      this.scene.start(SCENES.seats, { draft: this.#draft } satisfies SeatsData);
    };
    this.#buttons.push(new McButton(this, { kind: "primary", label: "Choose heroes ▸", type: typeRole.barTitle, rect: layout.next, onClick: next }));
    this.#stops.set("next", { rect: layout.next, activate: next });

    this.#route?.set(
      scenarioSelectFocusOrder({ scenarioIds: rows.map((r) => r.id), scenarioChipIds: chipDefs.map((c) => c.id) }),
      this.#stops,
    );
  }

  #rows(): readonly RosterRow[] {
    return withSelectionPinned(
      POOL_SCENARIOS,
      (s) => scenarioRosterMatches(s, this.#villainsOf(s), [], this.#draft.scenarioFilter),
      (s) => this.#draft.scenarioId === (s.id as string),
    ).map((s) => {
      const villain = CARDS_BY_ID.get(s.villainCardId as string);
      const subtitle = s.multipleVillains ? `${packNameOf(s.packCode as string)} · ${s.packCode}` : villain ? `${villain.name} · ${s.packCode}` : s.packCode;
      return {
        id: s.id as string,
        title: s.name,
        subtitle,
        selected: this.#draft.scenarioId === (s.id as string),
        blockedBy: null,
        warning: null,
        onClick: () => {
          this.#draft = setScenario(this.#draft, s, s.id as string);
          this.#rebuild();
        },
        inspectCardId: s.villainCardId,
        chooseLabel: s.multipleVillains ? "Play this scenario" : "Play this villain",
      };
    });
  }

  #onInspectChoose(rowId: string): void {
    const row = this.#rows().find((r) => r.id === rowId);
    if (row && !row.blockedBy) row.onClick();
  }

  #villainsOf(scenario: Scenario): readonly (AnyCard | undefined)[] {
    const villains = scenario.multipleVillains?.villains;
    if (villains) return villains.map((v) => CARDS_BY_ID.get(v.villainCardId as string));
    return [CARDS_BY_ID.get(scenario.villainCardId as string)];
  }

  #inspectRow(row: RosterRow): void {
    if (!row.inspectCardId) return;
    const card = CARDS_BY_ID.get(row.inspectCardId as string);
    const face = card?.type === "villain" ? ({ kind: "villainStage", sideIndex: 0, stageIndex: 0 } as const) : ({ kind: "hero" } as const);
    this.scene.launch(SCENES.inspect, { card: { cardId: row.inspectCardId as CardId, face }, choice: { optionId: row.id, label: row.chooseLabel } });
  }
}

/**
 * Table setup (docs/phase4-screen-gaps.md §3 W2, D05/P12), rebuilt 2026-09-18
 * against the owner's own D05 desktop screenshot and P12 phone screenshot
 * (`/Users/quincarter/Documents/Dev/marvel-champions-game/artifacts/design-
 * screenshots/individual/screens-desktop.dc/05-s05.png`,
 * `.../screens-phone.dc/12-p12-table-setup.png`) — see `view/table-setup-
 * layout.ts`'s own header for the exact composition this scene draws.
 *
 * Standard/Expert(/Extreme) with a real derived description, the modular set
 * picker (the scenario's own required set(s) ink-filled and fixed, every
 * candidate togglable up to `Scenario.modularSetCount`), seating and first
 * player (a deterministic "Random"), "the encounter deck you're building"
 * (S3's `compositionRowsOf`/`whatsInThereRowsOf`/`nemesisStandbyOf`), "the
 * game you'll get" (`gameSummaryRowsOf`), the seed with Reroll, and the one
 * red action, "Deal it out" — this is what actually starts the engine.
 *
 * **Red is spent exactly once** (the correction's own rule, reversing this
 * screen's very first pass): "Deal it out" is the only fill. A chosen
 * difficulty/modular set/first-player seat is marked with a 4px **red
 * border** on an otherwise-white card, never a red or ink fill.
 */
import Phaser from "phaser";
import type { Deck, Scenario } from "@mc/content";
import { buildScenario, CARDS_BY_ID, POOL_CARDS, POOL_DEPS, POOL_ENCOUNTER_SETS, POOL_SCENARIOS, POOL_VERSION } from "../content/pool.js";
import { accent, dotGrid, ink, signal, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTextInput, dashedRect, fitText, label, paintDotGrid, sectionHeader } from "../ui/widgets.js";
import { estimateWrappedLines, type Rect } from "../view/layout.js";
import { deckOptionsOf, type DeckOption } from "../view/deck-list-model.js";
import { corePlayerForSeat } from "../view/deck-seat.js";
import {
  cardCountForSet,
  descriptorForSet,
  modularCardLabel,
  modularSetOptionsFor,
  requiredCardLabel,
  requiredEncounterSetsFor,
  toggleModularSet,
  type ModularSetOption,
  type RequiredEncounterSet,
} from "../view/modular-sets.js";
import { scenarioDetailOf } from "../view/scenario-detail.js";
import { parseSeed, rollFirstPlayerIndex } from "../view/seed.js";
import {
  compositionRowsOf,
  difficultyCardsFor,
  gameSummaryRowsOf,
  nemesisStandbyOf,
  tableSetupPreviewOf,
  whatsInThereRowsOf,
  type CompositionRow,
  type DifficultyCard,
  type GameSummaryRow,
  type NemesisStandby,
} from "../view/table-setup-preview.js";
import { difficultyOptionsFor, setDifficulty, setFirstPlayerIndex, setSeed, rerollSeed, toSessionConfig, type SetupDraft } from "../view/setup-draft.js";
import { tableSetupFocusOrder } from "../view/screen-focus.js";
import {
  GAME_SUMMARY_ROW_COUNT,
  NARROW_MODULAR_GRID_GAP,
  PANEL_HEADER_HEIGHT,
  PANEL_PAD,
  PANEL_ROW_HEIGHT,
  ROW_GAP,
  tableSetupLayout,
  type TableSetupLayout,
} from "../view/table-setup-layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { appSession, deckStorage } from "../session.js";
import type { DecksSceneData } from "./decks.js";
import type { SeatsData } from "./seats.js";

export interface TableSetupData {
  readonly draft: SetupDraft;
}

interface SeatCell {
  readonly id: string;
  readonly name: string;
  readonly meta: string;
  readonly selected: boolean;
  readonly onClick: () => void;
}

export class TableSetupScene extends Phaser.Scene {
  #draft!: SetupDraft;
  #savedDecks: readonly Deck[] = [];
  #seedText = "";
  #buttons: McButton[] = [];
  #stops = new Map<string, FocusStop>();
  #seedInput: McTextInput | null = null;
  #status: Phaser.GameObjects.Text | null = null;
  #starting = false;
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.setup);
  }

  init(data: TableSetupData): void {
    this.#draft = data.draft;
    this.#seedText = String(data.draft.seed);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#rebuild, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      this.#seedInput?.destroy();
      this.#seedInput = null;
    });
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect) || (this.#seedInput?.focused ?? false),
      onCancel: () => this.#back(),
    });
    this.#starting = false;
    this.#savedDecks = [];
    this.#rebuild();
    void deckStorage()
      .list()
      .then((decks) => {
        if (!this.sys.isActive()) return;
        this.#savedDecks = decks;
        this.#rebuild();
      });
  }

  #back(): void {
    if (this.#starting) return;
    this.scale.off("resize", this.#rebuild, this);
    this.scene.start(SCENES.seats, { draft: this.#draft } satisfies SeatsData);
  }

  #deckOptions(): readonly DeckOption[] {
    return deckOptionsOf(this.#savedDecks, POOL_CARDS, POOL_VERSION, POOL_DEPS);
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();
    const kept = this.#seedInput ? [this.#seedInput.gameObject] : [];
    for (const node of kept) this.children.remove(node);
    this.children.removeAll(true);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === this.#draft.scenarioId)!;
    const difficultyCards = difficultyCardsFor(scenario);

    const deckOptions = this.#deckOptions();
    const seatedOptions = this.#draft.seats.map((deckId) => deckOptions.find((o) => (o.deck.id as string) === deckId)).filter((o): o is DeckOption => o !== undefined);
    const players = seatedOptions.map(corePlayerForSeat);

    const requiredSets = requiredEncounterSetsFor(scenario, CARDS_BY_ID);
    const modularOptions = modularSetOptionsFor(this.#draft, scenario, CARDS_BY_ID);
    const modularCardCount = requiredSets.length + modularOptions.length;
    const modularCap = scenario.modularSetCount ?? 1;

    let compositionRows: readonly CompositionRow[] = [];
    let whatsInThereRows: readonly CompositionRow[] = [];
    let nemesisStandby: NemesisStandby | null = null;
    let gameSummaryRows: readonly GameSummaryRow[] = [];
    let encounterDeckSize = 0;
    if (players.length > 0) {
      const config = buildScenario(this.#draft.scenarioId, toSessionConfig(this.#draft, players));
      const preview = tableSetupPreviewOf(config, scenario, this.#draft.difficulty, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
      compositionRows = compositionRowsOf(preview.encounterDeck);
      whatsInThereRows = whatsInThereRowsOf(preview.encounterDeck);
      nemesisStandby = nemesisStandbyOf(preview.encounterDeck);
      gameSummaryRows = gameSummaryRowsOf(preview);
      encounterDeckSize = preview.encounterDeckSize;
    }

    // The nemesis panel's own line count: the wrapped sentence plus one foot line for "N CARDS ON STANDBY" — a
    // conservative estimate against roughly a third of the body width (`view/layout.ts`'s own "estimate before a
    // live text object exists" rule; three side-by-side panels at wide, one full-width panel at narrow, so a third
    // of the column is the tighter, safer bound either way).
    const nemesisPanelWidthEstimate = Math.max(160, width / 3.4 - 24);
    const nemesisLines = nemesisStandby ? estimateWrappedLines(nemesisStandby.sentence, nemesisPanelWidthEstimate, 5.4) + 1 : 0;

    const layout = tableSetupLayout({
      width,
      height,
      difficultyCount: difficultyCards.length,
      modularCardCount,
      seatCount: this.#draft.seats.length,
      compositionRows: compositionRows.length,
      whatsInThereRows: whatsInThereRows.length,
      nemesisLines,
    });

    // Ground: paper body (dot grid) under the ink header on wide, where the body is a real paper page beside the
    // ink sidebar; on narrow the whole page is ink (no room for two grounds — `table-setup-layout.ts`'s own doc
    // comment), matching every other setup-flow screen's narrow treatment (Setup deal & mulligan, Villain phase).
    if (layout.wide) {
      this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
      paintDotGrid(this, { x: 0, y: layout.headerBar.height, width, height: height - layout.headerBar.height }, "paper", dotGrid.onPaper);
      this.add.rectangle(layout.sidebar!.x, layout.sidebar!.y, layout.sidebar!.width, layout.sidebar!.height, surface.ink.hex).setOrigin(0, 0);
    } else {
      this.add.rectangle(0, 0, width, height, surface.ink.hex).setOrigin(0, 0);
      paintDotGrid(this, { x: 0, y: layout.headerBar.height, width, height: height - layout.headerBar.height }, "ink", dotGrid.onInk);
    }
    this.add.rectangle(layout.headerBar.x, layout.headerBar.y, layout.headerBar.width, layout.headerBar.height, surface.ink.hex).setOrigin(0, 0);

    const back = (): void => this.#back();
    this.#buttons.push(new McButton(this, { kind: "onInk", label: "◂ Seats", type: typeRole.backLabel, rect: layout.back, onClick: back, enabled: !this.#starting }));
    this.#stops.set("back", { rect: layout.back, activate: back });
    const titleX = layout.back.x + layout.back.width + 16;
    const title = this.add.text(titleX, layout.headerBar.height / 2, "Set the table", textStyle(typeRole.pageTitle, surface.paper.hex)).setOrigin(0, 0.5);
    fitText(title, layout.step.x - titleX - 12, typeRole.pageTitle.size);
    this.add.text(layout.step.x + layout.step.width, layout.headerBar.height / 2, "STEP 4 OF 4", textStyle(typeRole.label, surface.paper.hex, ink.label)).setOrigin(1, 0.5);

    // The body's own text colour: ink on the wide layout's paper body, paper on the narrow layout's ink page. The
    // sidebar/"game you'll get" block is always on ink (the sidebar on wide, the same ink page on narrow), so its
    // own text is always paper — set separately below rather than following `bodyColor`.
    const bodyColor = layout.wide ? surface.ink.hex : surface.paper.hex;

    sectionHeader(this, layout.difficultyHeader.x, layout.difficultyHeader.y, layout.difficultyHeader.width, "Difficulty", bodyColor);
    this.#drawDifficultyRow(layout.difficultyRow, difficultyCards, layout.wide);

    const modularRight = `${requiredSets.length} required · ${modularCap} chosen`.toUpperCase();
    sectionHeader(this, layout.modularHeader.x, layout.modularHeader.y, layout.modularHeader.width, "Modular sets", bodyColor, modularRight);
    this.#drawModularGrid(layout, requiredSets, modularOptions, scenario);

    sectionHeader(this, layout.seatingHeader.x, layout.seatingHeader.y, layout.seatingHeader.width, "Seating & first player", bodyColor);
    const seatCells = this.#seatCells(deckOptions);
    if (layout.wide && layout.randomControl.width > 0) {
      const roll = (): void => {
        this.#draft = setFirstPlayerIndex(this.#draft, rollFirstPlayerIndex(this.#draft.seed, this.#draft.seats.length));
        this.#rebuild();
      };
      this.#buttons.push(new McButton(this, { kind: "quiet", label: "Random", type: typeRole.label, rect: layout.randomControl, onClick: roll }));
      this.#stops.set("first-player:random", { rect: layout.randomControl, activate: roll });
      this.#drawSeatingRow(layout.seatingRow, seatCells, bodyColor, false);
    } else {
      this.#drawSeatingRow(layout.seatingRow, seatCells, bodyColor, true);
    }

    const encounterRight = `${encounterDeckSize} cards · shuffled at deal`.toUpperCase();
    sectionHeader(this, layout.encounterHeader.x, layout.encounterHeader.y, layout.encounterHeader.width, "The encounter deck you're building", bodyColor, encounterRight);
    this.#drawEncounterPanels(layout, compositionRows, whatsInThereRows, nemesisStandby);

    // The sidebar/summary block: always paper-on-ink, regardless of form factor.
    sectionHeader(this, layout.gameSummaryHeader.x, layout.gameSummaryHeader.y, layout.gameSummaryHeader.width, "The game you'll get", surface.paper.hex);
    this.#drawGameSummaryRows(layout.gameSummaryRows, gameSummaryRows);
    if (layout.rule.height > 0) {
      const rule = this.add.graphics();
      rule.fillStyle(surface.paper.hex, ink.disabled).fillRect(layout.rule.x, layout.rule.y, layout.rule.width, layout.rule.height);
    }

    if (this.#seedInput) this.#seedInput.layout(layout.seed);
    else {
      this.#seedInput = new McTextInput(this, {
        rect: layout.seed,
        value: this.#seedText,
        type: typeRole.mono,
        numeric: true,
        maxLength: 9,
        placeholder: "seed",
        onChange: (value) => {
          this.#seedText = value;
          const parsed = parseSeed(value);
          if (parsed !== null) this.#draft = setSeed(this.#draft, parsed);
          this.#status?.setText(value.length > 0 && parsed === null ? "seed must be a whole number" : "");
        },
      });
    }
    this.#stops.set("seed", { rect: layout.seed, activate: () => this.#seedInput?.focus() });
    const reroll = (): void => {
      this.#draft = rerollSeed(this.#draft);
      this.#seedText = String(this.#draft.seed);
      this.#seedInput?.setValue(this.#seedText);
      this.#status?.setText("");
    };
    this.#buttons.push(new McButton(this, { kind: "onInk", label: "Reroll", type: typeRole.label, rect: layout.reroll, onClick: reroll }));
    this.#stops.set("reroll", { rect: layout.reroll, activate: reroll });
    if (layout.seedHelper.height > 8) {
      this.add
        .text(layout.seedHelper.x, layout.seedHelper.y, "Recorded in the game log — the same seed plus the same commands replays this game exactly.", textStyle(typeRole.body, surface.paper.hex, ink.label))
        .setWordWrapWidth(layout.seedHelper.width)
        .setMaxLines(Math.max(1, Math.floor(layout.seedHelper.height / 15)));
    }

    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: this.#starting ? "Dealing it out…" : "Deal it out",
        type: typeRole.barTitle,
        rect: layout.dealItOut,
        enabled: !this.#starting,
        onClick: () => void this.#start(players),
      }),
    );
    this.#stops.set("deal-it-out", { rect: layout.dealItOut, activate: () => void this.#start(players) });

    this.#status = this.add.text(layout.dealItOut.x, layout.dealItOut.y - 20, "", textStyle(typeRole.body, surface.paper.hex));

    this.#route?.set(
      tableSetupFocusOrder({
        difficulties: difficultyCards.map((c) => c.id),
        modularSetIds: modularOptions.map((o) => o.id),
        firstPlayerOptionIds: [...seatCells.map((c) => c.id), "random"],
      }),
      this.#stops,
    );
  }

  /**
   * DIFFICULTY: up to three equal-width cards (Heroic stays out of scope, §4), each with a real description
   * wrapped to as many lines as it needs. Wide reserves a third empty slot even at two real cards (D05's own
   * shape); narrow sizes cards to exactly `cards.length` instead — reserving a third of the row for nothing
   * would leave a real description ("Standard encounter set only. Starts at stage I.") only ~110px to wrap into,
   * clipping mid-sentence on a phone (`docs/design-renders` fidelity pass, 2026-09-18).
   */
  #drawDifficultyRow(rect: Rect, cards: readonly DifficultyCard[], wide: boolean): void {
    const slots = wide ? Math.max(3, cards.length) : cards.length;
    const gap = 12;
    const slotWidth = (rect.width - gap * (slots - 1)) / slots;
    cards.forEach((card, index) => {
      const cardRect: Rect = { x: rect.x + index * (slotWidth + gap), y: rect.y, width: slotWidth, height: rect.height };
      const selected = this.#draft.difficulty === card.id;
      const onClick = (): void => {
        this.#draft = setDifficulty(this.#draft, card.id);
        this.#rebuild();
      };
      this.#buttons.push(new McButton(this, { kind: "quiet", label: "", type: typeRole.label, rect: cardRect, onClick }));
      this.#stops.set(`difficulty:${card.id}`, { rect: cardRect, activate: onClick });
      this.#cardFrame(cardRect, selected);
      const name = this.add.text(cardRect.x + 10, cardRect.y + 8, card.name, textStyle({ ...typeRole.sectionHeader, size: 18 }, surface.ink.hex, selected ? 1 : ink.disabled));
      fitText(name, cardRect.width - 20, 18);
      this.add
        .text(cardRect.x + 10, cardRect.y + 8 + 22, card.description, textStyle(typeRole.body, surface.ink.hex, selected ? ink.secondary : ink.disabled))
        .setWordWrapWidth(cardRect.width - 20)
        .setMaxLines(Math.max(1, Math.floor((cardRect.height - 34) / 14)));
    });
  }

  /** A card's white ground and border — 4px Hero Red when selected, a thin dim ink outline otherwise. Never a fill besides "Deal it out". */
  #cardFrame(rect: Rect, selected: boolean): void {
    const g = this.add.graphics();
    g.fillStyle(surface.card.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    if (selected) g.lineStyle(4, accent.heroRed.hex, 1).strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
    else g.lineStyle(1.5, surface.ink.hex, ink.disabled).strokeRect(rect.x + 0.75, rect.y + 0.75, rect.width - 1.5, rect.height - 1.5);
  }

  /** MODULAR SETS: the scenario's own required set(s) first (ink-filled, not toggleable), then every candidate — a grid at `layout.modularColumns` columns, whatever row height this form factor uses. */
  #drawModularGrid(layout: TableSetupLayout, requiredSets: readonly RequiredEncounterSet[], options: readonly ModularSetOption[], scenario: Scenario): void {
    const rect = layout.modularGrid;
    const columns = layout.modularColumns;
    const gap = layout.wide ? ROW_GAP : NARROW_MODULAR_GRID_GAP;
    const cellHeight = layout.modularRows > 0 ? (rect.height - (layout.modularRows - 1) * gap) / layout.modularRows : rect.height;
    const cellWidth = (rect.width - (columns - 1) * gap) / columns;
    const villainName = scenarioDetailOf(scenario, CARDS_BY_ID, POOL_ENCOUNTER_SETS).villainName;

    const cellAt = (index: number): Rect => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      return { x: rect.x + col * (cellWidth + gap), y: rect.y + row * (cellHeight + gap), width: cellWidth, height: cellHeight };
    };

    let index = 0;
    for (const required of requiredSets) {
      this.#drawRequiredModularCard(cellAt(index), required, villainName);
      index += 1;
    }
    for (const option of options) {
      this.#drawModularCard(cellAt(index), option);
      index += 1;
    }
  }

  /** The label line under a modular card's name, clamped to however many lines actually fit below `nameBottom` inside `rect` — flowing from the top (not anchored to the card's own bottom edge), so a two-line wrap never spills past a short card into whatever's drawn below it. */
  #drawModularCardLabel(rect: Rect, nameBottom: number, text: string, color: number, alpha: number): void {
    const available = rect.y + rect.height - 4 - nameBottom;
    const maxLines = Math.max(1, Math.floor(available / 12));
    if (maxLines < 1) return;
    this.add
      .text(rect.x + 10, nameBottom, text, textStyle(typeRole.label, color, alpha))
      .setLetterSpacing(typeRole.label.letterSpacing)
      .setWordWrapWidth(rect.width - 20)
      .setMaxLines(maxLines);
  }

  /** The scenario's own required set: ink-filled, paper text, never toggleable — no button, no focus stop. */
  #drawRequiredModularCard(rect: Rect, required: RequiredEncounterSet, villainName: string): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    const name = this.add.text(rect.x + 10, rect.y + 8, required.name, textStyle({ ...typeRole.sectionHeader, size: 15 }, surface.paper.hex));
    fitText(name, rect.width - 20, 15);
    this.#drawModularCardLabel(rect, rect.y + 8 + name.height + 4, requiredCardLabel(villainName, required.cardCount).toUpperCase(), surface.paper.hex, ink.label);
  }

  /** A candidate modular set: white, chosen = 4px red border, available = dim border + dim text. Toggling replaces the current pick at the scenario's own cap (`toggleModularSet` enforces it). */
  #drawModularCard(rect: Rect, option: ModularSetOption): void {
    const onClick = (): void => {
      const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === this.#draft.scenarioId)!;
      this.#draft = toggleModularSet(this.#draft, scenario, option.id);
      this.#rebuild();
    };
    this.#buttons.push(new McButton(this, { kind: "quiet", label: "", type: typeRole.label, rect, onClick }));
    this.#stops.set(`modular:${option.id}`, { rect, activate: onClick });
    this.#cardFrame(rect, option.selected);
    const dim = option.selected ? 1 : ink.disabled;
    const name = this.add.text(rect.x + 10, rect.y + 8, option.name, textStyle({ ...typeRole.sectionHeader, size: 15 }, surface.ink.hex, dim));
    fitText(name, rect.width - 20, 15);
    this.#drawModularCardLabel(rect, rect.y + 8 + name.height + 4, modularCardLabel(option).toUpperCase(), surface.ink.hex, option.selected ? ink.label : ink.disabled);
  }

  /** One seat cell per seated deck — a radio dot (filled amber for the first player), the hero's name, and a small "FIRST PLAYER"/"SEAT N" label. */
  #seatCells(deckOptions: readonly DeckOption[]): readonly SeatCell[] {
    return this.#draft.seats.map((deckId, index) => {
      const option = deckOptions.find((o) => (o.deck.id as string) === deckId);
      return {
        id: `${index}`,
        name: option?.identityName ?? "?",
        meta: this.#draft.firstPlayerIndex === index || (this.#draft.firstPlayerIndex === null && index === 0) ? "First player" : `Seat ${index + 1}`,
        selected: this.#draft.firstPlayerIndex === index || (this.#draft.firstPlayerIndex === null && index === 0),
        onClick: () => {
          this.#draft = setFirstPlayerIndex(this.#draft, index);
          this.#rebuild();
        },
      };
    });
  }

  /** SEATING & FIRST PLAYER: one horizontal row. `includeRandom` adds a dashed "Random" cell at the end (narrow, matching P12); wide keeps Random on the section-header line instead (`#rebuild`). */
  #drawSeatingRow(rect: Rect, cells: readonly SeatCell[], bodyColor: number, includeRandom: boolean): void {
    const gap = 10;
    const count = cells.length + (includeRandom ? 1 : 0);
    const cellWidth = (rect.width - gap * (count - 1)) / count;
    cells.forEach((cell, index) => {
      const cellRect: Rect = { x: rect.x + index * (cellWidth + gap), y: rect.y, width: cellWidth, height: rect.height };
      this.#buttons.push(new McButton(this, { kind: "quiet", label: "", type: typeRole.label, rect: cellRect, onClick: cell.onClick }));
      this.#stops.set(`first-player:${cell.id}`, { rect: cellRect, activate: cell.onClick });
      const g = this.add.graphics();
      g.fillStyle(surface.card.hex, 1).fillRect(cellRect.x, cellRect.y, cellRect.width, cellRect.height);
      g.lineStyle(1.5, surface.ink.hex, cell.selected ? 1 : ink.disabled).strokeRect(cellRect.x + 0.75, cellRect.y + 0.75, cellRect.width - 1.5, cellRect.height - 1.5);

      const dotSize = Math.min(16, cellRect.height * 0.28);
      const dotCx = cellRect.x + 10 + dotSize / 2;
      const dotCy = cellRect.y + cellRect.height / 2;
      const dot = this.add.graphics();
      dot.lineStyle(2, surface.ink.hex, cell.selected ? 1 : ink.disabled).strokeCircle(dotCx, dotCy, dotSize / 2);
      if (cell.selected) dot.fillStyle(signal.caution.hex, 1).fillCircle(dotCx, dotCy, dotSize / 2 - 3);

      const textX = dotCx + dotSize / 2 + 8;
      const textWidth = cellRect.x + cellRect.width - textX - 6;
      const name = this.add.text(textX, cellRect.y + cellRect.height * 0.34, cell.name, textStyle({ ...typeRole.sectionHeader, size: 14 }, surface.ink.hex));
      fitText(name, textWidth, 14);
      const meta = label(this, textX, cellRect.y + cellRect.height * 0.68, cell.meta, typeRole.label, surface.ink.hex, ink.label);
      fitText(meta, textWidth, typeRole.label.size);
    });
    if (includeRandom) {
      const randomRect: Rect = { x: rect.x + cells.length * (cellWidth + gap), y: rect.y, width: cellWidth, height: rect.height };
      const roll = (): void => {
        this.#draft = setFirstPlayerIndex(this.#draft, rollFirstPlayerIndex(this.#draft.seed, this.#draft.seats.length));
        this.#rebuild();
      };
      this.#buttons.push(new McButton(this, { kind: "quiet", label: "", type: typeRole.label, rect: randomRect, onClick: roll }));
      this.#stops.set("first-player:random", { rect: randomRect, activate: roll });
      // Covers the "quiet" button's own default paper fill (theme.ts's `skin("quiet","rest")`, correct on the
      // wide layout's paper body but wrong here) with the page's own ink ground, so the dashed outline reads as
      // "an empty slot" against this screen's ink page rather than a stray cream box with invisible paper-on-paper text.
      const ground = this.add.graphics();
      ground.fillStyle(surface.ink.hex, 1).fillRect(randomRect.x, randomRect.y, randomRect.width, randomRect.height);
      const dash = this.add.graphics();
      dashedRect(dash, randomRect, 1.5, bodyColor);
      const text = this.add.text(randomRect.x + randomRect.width / 2, randomRect.y + randomRect.height / 2, "Random", textStyle(typeRole.label, bodyColor, ink.label)).setOrigin(0.5);
      fitText(text, randomRect.width - 10, typeRole.label.size);
    }
  }

  /** "THE ENCOUNTER DECK YOU'RE BUILDING": Composition (obligations row in red) / What's in there / a parchment Nemesis panel. */
  #drawEncounterPanels(layout: TableSetupLayout, composition: readonly CompositionRow[], whatsInThere: readonly CompositionRow[], nemesis: NemesisStandby | null): void {
    const [compBudget, witBudget, nemBudget] = layout.encounterPanels.rowBudgets;
    this.#drawListPanel(layout.encounterPanels.composition, "Composition", composition, compBudget, surface.card.hex);
    this.#drawListPanel(layout.encounterPanels.whatsInThere, "What's in there", whatsInThere, witBudget, surface.card.hex);
    this.#drawNemesisPanel(layout.encounterPanels.nemesis, nemesis, nemBudget);
  }

  #drawListPanel(rect: Rect, title: string, rows: readonly CompositionRow[], rowBudget: number, ground: number): void {
    // Below its own header's height, a panel reads as a stray sliver, not a legible "trimmed" panel — the layout's
    // own defensive clamp (`table-setup-layout.ts`, very short viewports) can shrink a panel below that; this
    // scene simply omits it rather than draw a clipped label in a box a few pixels tall.
    if (rect.height < PANEL_HEADER_HEIGHT + 4) return;
    const g = this.add.graphics();
    g.fillStyle(ground, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(1.5, surface.ink.hex, ink.disabled).strokeRect(rect.x + 0.75, rect.y + 0.75, rect.width - 1.5, rect.height - 1.5);
    label(this, rect.x + 10, rect.y + 8, title, typeRole.label, surface.ink.hex, ink.label);
    let y = rect.y + PANEL_HEADER_HEIGHT + 4;
    const shown = rows.slice(0, rowBudget);
    for (const row of shown) {
      const color = row.red ? accent.heroRed.hex : surface.ink.hex;
      const rowLabel = this.add.text(rect.x + 10, y, row.label, textStyle(typeRole.body, color)).setWordWrapWidth(rect.width - 60).setMaxLines(1);
      fitText(rowLabel, rect.width - 60, typeRole.body.size);
      this.add.text(rect.x + rect.width - 10, y, String(row.count), textStyle({ ...typeRole.emphasis, weight: 700 }, color)).setOrigin(1, 0);
      y += PANEL_ROW_HEIGHT;
    }
    const hidden = rows.length - shown.length;
    if (hidden > 0 && y + PANEL_ROW_HEIGHT <= rect.y + rect.height) {
      label(this, rect.x + 10, y, `+${hidden} more`, typeRole.label, surface.ink.hex, ink.meta);
    }
  }

  #drawNemesisPanel(rect: Rect, nemesis: NemesisStandby | null, lineBudget: number): void {
    if (rect.height < PANEL_HEADER_HEIGHT + 4) return;
    const g = this.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(1.5, surface.ink.hex, ink.disabled).strokeRect(rect.x + 0.75, rect.y + 0.75, rect.width - 1.5, rect.height - 1.5);
    label(this, rect.x + 10, rect.y + 8, "Nemesis sets held back", typeRole.label, surface.ink.hex, ink.label);
    if (!nemesis) {
      if (lineBudget > 0) {
        this.add.text(rect.x + 10, rect.y + PANEL_HEADER_HEIGHT + 4, "Not used for this scenario.", textStyle(typeRole.body, surface.ink.hex, ink.meta)).setWordWrapWidth(rect.width - 20);
      }
      return;
    }
    if (lineBudget > 1) {
      this.add
        .text(rect.x + 10, rect.y + PANEL_HEADER_HEIGHT + 4, nemesis.sentence, textStyle(typeRole.body, surface.ink.hex))
        .setWordWrapWidth(rect.width - 20)
        .setMaxLines(Math.max(1, lineBudget - 1));
    }
    const footY = rect.y + rect.height - PANEL_PAD - 12;
    if (footY > rect.y + PANEL_HEADER_HEIGHT + 4) {
      label(this, rect.x + 10, footY, `${nemesis.totalCards} cards on standby`, typeRole.label, surface.ink.hex, ink.label);
    }
  }

  /** "THE GAME YOU'LL GET": label-over-value rows, always paper-on-ink. */
  #drawGameSummaryRows(rect: Rect, rows: readonly GameSummaryRow[]): void {
    const shown = rows.slice(0, GAME_SUMMARY_ROW_COUNT);
    shown.forEach((row, index) => {
      const y = rect.y + index * PANEL_ROW_HEIGHT;
      if (y + PANEL_ROW_HEIGHT > rect.y + rect.height + 0.01) return;
      label(this, rect.x, y + 2, row.label, typeRole.label, surface.paper.hex, ink.label);
      const value = this.add.text(rect.x + rect.width, y, row.value, textStyle({ ...typeRole.emphasis, weight: 700 }, surface.paper.hex)).setOrigin(1, 0);
      fitText(value, rect.width * 0.6, typeRole.emphasis.size);
    });
  }

  async #start(players: readonly ReturnType<typeof corePlayerForSeat>[]): Promise<void> {
    if (this.#starting) return;
    if (parseSeed(this.#seedText) === null) {
      this.#status?.setText("seed must be a whole number");
      return;
    }
    this.#starting = true;
    this.#rebuild();

    const { store } = appSession();
    await store.start(toSessionConfig(this.#draft, players));

    if (store.state.status === "failed") {
      this.#starting = false;
      this.#rebuild();
      const setupError = store.state.setupError;
      if (setupError?.code === "illegal_deck") {
        const seat = setupError.illegalDecks[0];
        const deckId = seat ? this.#draft.seats[seat.seatIndex] : undefined;
        this.scale.off("resize", this.#rebuild, this);
        this.scene.start(SCENES.decks, {
          focusDeckId: deckId ?? null,
          message: seat?.problems[0]?.message ?? store.state.error ?? "This deck is not legal.",
        } satisfies DecksSceneData);
        return;
      }
      this.#status?.setText(store.state.error ?? "setup failed");
      return;
    }
    this.scale.off("resize", this.#rebuild, this);
    // W3 (docs/phase4-screen-gaps.md §3): "Deal it out" routes through the dedicated setup deal & mulligan screen,
    // never straight to the Board — that scene hands off to the Board itself once `state.step.phase` leaves "setup".
    this.scene.start(SCENES.setupDeal);
  }
}

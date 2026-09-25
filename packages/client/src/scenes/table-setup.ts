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
import {
  buildScenario,
  CARDS_BY_ID,
  POOL_CARDS,
  POOL_DEPS,
  POOL_ENCOUNTER_SETS,
  POOL_SCENARIOS,
  POOL_VERSION,
} from "../content/pool.js";
import { accent, dotGrid, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTextInput, dashedRect, fitText, label, paintDotGrid, sectionHeader } from "../ui/widgets.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { estimateWrappedLines, formFactorFor, type Rect } from "../view/layout.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { deckOptionsOf, type DeckOption } from "../view/deck-list-model.js";
import { corePlayerForSeat } from "../view/deck-seat.js";
import {
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
  type TableSetupPreview,
} from "../view/table-setup-preview.js";
import {
  setDifficulty,
  setFirstPlayerIndex,
  setSeed,
  rerollSeed,
  toSessionConfig,
  type SetupDraft,
} from "../view/setup-draft.js";
import { tableSetupFocusOrder } from "../view/screen-focus.js";
import {
  COMPACT_DIFFICULTY_ROW_HEIGHT,
  COMPACT_FIRST_PLAYER_ROW_HEIGHT,
  COMPACT_MODULAR_ROW_HEIGHT,
  COMPACT_SEED_ROW_HEIGHT,
  GAME_SUMMARY_ROW_COUNT,
  NARROW_MODULAR_GRID_GAP,
  PANEL_HEADER_HEIGHT,
  PANEL_PAD,
  PANEL_ROW_HEIGHT,
  ROW_GAP,
  compactRowIndex,
  compactRowRects,
  tableSetupCompactLayout,
  tableSetupLayout,
  type TableSetupCompactLayout,
  type TableSetupLayout,
} from "../view/table-setup-layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { appSession, deckStorage } from "../session.js";
import type { DecksSceneData } from "./decks.js";
import type { SeatsData } from "./seats.js";
import type { ScenarioIntroData } from "./scenario-intro.js";
import { scenarioIntroFor } from "../campaign/scenario-intros.js";
import { ART_CATALOG, introArtFor } from "../art/scenario-art.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";

export interface TableSetupData {
  readonly draft: SetupDraft;
}

interface SeatCell {
  readonly id: string;
  readonly name: string;
  readonly meta: string;
  /** The compact chip's own top line ("You" for seat 0 — always the local seat, regardless of who's first player — "S2"/"S3"/"S4" for the rest), P12's own shape. */
  readonly chipLabel: string;
  readonly selected: boolean;
  readonly onClick: () => void;
}

/** Data every compact-row draw case needs, threaded through once rather than recomputed per row. */
interface CompactRowData {
  readonly difficultyCards: readonly DifficultyCard[];
  readonly villainName: string;
  readonly requiredById: ReadonlyMap<string, RequiredEncounterSet>;
  readonly candidateById: ReadonlyMap<string, ModularSetOption>;
  readonly modularRightLabel: string;
  readonly seatCells: readonly SeatCell[];
  readonly compositionRows: readonly CompositionRow[];
  readonly whatsInThereRows: readonly CompositionRow[];
  readonly nemesisStandby: NemesisStandby | null;
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
  /** Phone's own scroll position (`tableSetupCompactLayout`, the 2026-09-18 correction) — persists across rebuilds like every other scroll owner in the app (`ListScroll`/`VariableListScroll` convention), reset fresh only in `create()`. */
  #compactScroll = new VariableListScroll();
  #compactRegion: McScrollRegion | null = null;
  /** The seed field's own box, in the compact scroll region's content space — read by `#syncCompactSeedInput` every time the scroll offset changes, since the DOM-backed `McTextInput` sits above the canvas and isn't clipped by `McScrollRegion`'s own Phaser mask. */
  #compactSeedBoxRect: Rect | null = null;
  #compactViewport: Rect | null = null;
  /** The current compact layout, kept for `ensureVisible` callbacks built at draw time but resolved at focus time (`#compactScrollIntoView`), and for `#syncCompactSeedInput`. */
  #compactLayout: TableSetupCompactLayout | null = null;

  constructor() {
    super(SCENES.setup);
  }

  init(data: TableSetupData): void {
    this.#draft = data.draft;
    this.#seedText = String(data.draft.seed);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    appSession().music?.playTitle();
    this.#compactScroll = new VariableListScroll();
    this.scale.on("resize", this.#rebuild, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      this.#seedInput?.destroy();
      this.#seedInput = null;
      this.#compactRegion?.destroy();
      this.#compactRegion = null;
    });
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect) || (this.#seedInput?.focused ?? false),
      onCancel: () => this.#back(),
    });
    this.#starting = false;
    this.#savedDecks = [];
    this.#rebuild();
    fadeScreenIn(this);
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
    goToScreen(this, SCENES.seats, { draft: this.#draft } satisfies SeatsData);
  }

  #deckOptions(): readonly DeckOption[] {
    return deckOptionsOf(this.#savedDecks, POOL_CARDS, POOL_VERSION, POOL_DEPS);
  }

  /** The seed field's own `onChange`, shared by the standard (wide/tablet portrait) and compact (phone) paths — one `McTextInput` instance persists across both, so the handler has to be identical either way. */
  #onSeedChange = (value: string): void => {
    this.#seedText = value;
    const parsed = parseSeed(value);
    if (parsed !== null) this.#draft = setSeed(this.#draft, parsed);
    this.#status?.setText(value.length > 0 && parsed === null ? "seed must be a whole number" : "");
  };

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();
    const kept = this.#seedInput ? [this.#seedInput.gameObject] : [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === this.#draft.scenarioId)!;
    const difficultyCards = difficultyCardsFor(scenario);

    const deckOptions = this.#deckOptions();
    const seatedOptions = this.#draft.seats
      .map((deckId) => deckOptions.find((o) => (o.deck.id as string) === deckId))
      .filter((o): o is DeckOption => o !== undefined);
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
    let preview: TableSetupPreview | null = null;
    if (players.length > 0) {
      const config = buildScenario(this.#draft.scenarioId, toSessionConfig(this.#draft, players));
      preview = tableSetupPreviewOf(config, scenario, this.#draft.difficulty, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
      compositionRows = compositionRowsOf(preview.encounterDeck);
      whatsInThereRows = whatsInThereRowsOf(preview.encounterDeck);
      nemesisStandby = nemesisStandbyOf(preview.encounterDeck);
      gameSummaryRows = gameSummaryRowsOf(preview);
      encounterDeckSize = preview.encounterDeckSize;
    }

    // Phone: P12's own scrolling page (2026-09-18 correction) — a whole different composition from wide/tablet
    // portrait's, not a squeeze of the same layout, so it's a separate draw path entirely rather than a branch
    // inside the one below.
    if (formFactorFor(width, height) === "phone") {
      this.#drawCompact(
        width,
        height,
        scenario,
        difficultyCards,
        deckOptions,
        players,
        requiredSets,
        modularOptions,
        modularCap,
        compositionRows,
        whatsInThereRows,
        nemesisStandby,
        encounterDeckSize,
        preview,
      );
      return;
    }
    this.#compactRegion?.destroy();
    this.#compactRegion = null;

    // The nemesis panel's own line count: the wrapped sentence plus one foot line for "N CARDS ON STANDBY" — a
    // conservative estimate against roughly a third of the body width (`view/layout.ts`'s own "estimate before a
    // live text object exists" rule; three side-by-side panels at wide, one full-width panel at narrow, so a third
    // of the column is the tighter, safer bound either way).
    const nemesisPanelWidthEstimate = Math.max(160, width / 3.4 - 24);
    const nemesisLines = nemesisStandby
      ? estimateWrappedLines(nemesisStandby.sentence, nemesisPanelWidthEstimate, 5.4) + 1
      : 0;

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
      paintDotGrid(
        this,
        { x: 0, y: layout.headerBar.height, width, height: height - layout.headerBar.height },
        "paper",
        dotGrid.onPaper,
      );
      this.add
        .rectangle(layout.sidebar!.x, layout.sidebar!.y, layout.sidebar!.width, layout.sidebar!.height, surface.ink.hex)
        .setOrigin(0, 0);
    } else {
      this.add.rectangle(0, 0, width, height, surface.ink.hex).setOrigin(0, 0);
      paintDotGrid(
        this,
        { x: 0, y: layout.headerBar.height, width, height: height - layout.headerBar.height },
        "ink",
        dotGrid.onInk,
      );
    }
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
        label: "◂ Seats",
        type: typeRole.backLabel,
        rect: layout.back,
        onClick: back,
        enabled: !this.#starting,
      }),
    );
    this.#stops.set("back", { rect: layout.back, activate: back });
    const titleX = layout.back.x + layout.back.width + 16;
    const title = this.add
      .text(titleX, layout.headerBar.height / 2, "Set the table", textStyle(typeRole.pageTitle, surface.paper.hex))
      .setOrigin(0, 0.5);
    fitText(title, layout.step.x - titleX - 12, typeRole.pageTitle.size);
    this.add
      .text(
        layout.step.x + layout.step.width,
        layout.headerBar.height / 2,
        "STEP 4 OF 4",
        textStyle(typeRole.label, surface.paper.hex, ink.label),
      )
      .setOrigin(1, 0.5);

    // The body's own text colour: ink on the wide layout's paper body, paper on the narrow layout's ink page. The
    // sidebar/"game you'll get" block is always on ink (the sidebar on wide, the same ink page on narrow), so its
    // own text is always paper — set separately below rather than following `bodyColor`.
    const bodyColor = layout.wide ? surface.ink.hex : surface.paper.hex;

    sectionHeader(
      this,
      layout.difficultyHeader.x,
      layout.difficultyHeader.y,
      layout.difficultyHeader.width,
      "Difficulty",
      bodyColor,
    );
    this.#drawDifficultyRow(layout.difficultyRow, difficultyCards, layout.wide);

    const modularRight = `${requiredSets.length} required · ${modularCap} chosen`.toUpperCase();
    sectionHeader(
      this,
      layout.modularHeader.x,
      layout.modularHeader.y,
      layout.modularHeader.width,
      "Modular sets",
      bodyColor,
      modularRight,
    );
    this.#drawModularGrid(layout, requiredSets, modularOptions, scenario);

    sectionHeader(
      this,
      layout.seatingHeader.x,
      layout.seatingHeader.y,
      layout.seatingHeader.width,
      "Seating & first player",
      bodyColor,
    );
    const seatCells = this.#seatCells(deckOptions);
    if (layout.wide && layout.randomControl.width > 0) {
      const roll = (): void => {
        this.#draft = setFirstPlayerIndex(
          this.#draft,
          rollFirstPlayerIndex(this.#draft.seed, this.#draft.seats.length),
        );
        this.#rebuild();
      };
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "Random",
          type: typeRole.label,
          rect: layout.randomControl,
          onClick: roll,
        }),
      );
      this.#stops.set("first-player:random", { rect: layout.randomControl, activate: roll });
      this.#drawSeatingRow(layout.seatingRow, seatCells, bodyColor, false);
    } else {
      this.#drawSeatingRow(layout.seatingRow, seatCells, bodyColor, true);
    }

    const encounterRight = `${encounterDeckSize} cards · shuffled at deal`.toUpperCase();
    sectionHeader(
      this,
      layout.encounterHeader.x,
      layout.encounterHeader.y,
      layout.encounterHeader.width,
      "The encounter deck you're building",
      bodyColor,
      encounterRight,
    );
    this.#drawEncounterPanels(layout, compositionRows, whatsInThereRows, nemesisStandby);

    // The sidebar/summary block: always paper-on-ink, regardless of form factor.
    sectionHeader(
      this,
      layout.gameSummaryHeader.x,
      layout.gameSummaryHeader.y,
      layout.gameSummaryHeader.width,
      "The game you'll get",
      surface.paper.hex,
    );
    this.#drawGameSummaryRows(layout.gameSummaryRows, gameSummaryRows);
    if (layout.rule.height > 0) {
      const rule = this.add.graphics();
      rule
        .fillStyle(surface.paper.hex, ink.disabled)
        .fillRect(layout.rule.x, layout.rule.y, layout.rule.width, layout.rule.height);
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
        onChange: this.#onSeedChange,
      });
    }
    this.#stops.set("seed", { rect: layout.seed, activate: () => this.#seedInput?.focus() });
    const reroll = (): void => {
      this.#draft = rerollSeed(this.#draft);
      this.#seedText = String(this.#draft.seed);
      this.#seedInput?.setValue(this.#seedText);
      this.#status?.setText("");
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "Reroll",
        type: typeRole.label,
        rect: layout.reroll,
        onClick: reroll,
      }),
    );
    this.#stops.set("reroll", { rect: layout.reroll, activate: reroll });
    if (layout.seedHelper.height > 8) {
      this.add
        .text(
          layout.seedHelper.x,
          layout.seedHelper.y,
          "Recorded in the game log — the same seed plus the same commands replays this game exactly.",
          textStyle(typeRole.body, surface.paper.hex, ink.label),
        )
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

    this.#status = this.add.text(
      layout.dealItOut.x,
      layout.dealItOut.y - 20,
      "",
      textStyle(typeRole.body, surface.paper.hex),
    );

    this.#route?.set(
      tableSetupFocusOrder({
        difficulties: difficultyCards.map((c) => c.id),
        modularSetIds: modularOptions.map((o) => o.id),
        firstPlayerOptionIds: [...seatCells.map((c) => c.id), "random"],
      }),
      this.#stops,
    );
  }

  // -----------------------------------------------------------------------------------------------------------
  // Phone: P12's own scrolling paper page (2026-09-18 correction). See `view/table-setup-layout.ts`'s own doc
  // comment on `tableSetupCompactLayout` for why this is a whole separate composition, not a squeeze of the one
  // above. Every row is drawn at its own real, full height — nothing here trims to fit; `McScrollRegion` makes
  // the difference up by moving the page instead.
  // -----------------------------------------------------------------------------------------------------------

  #drawCompact(
    width: number,
    height: number,
    scenario: Scenario,
    difficultyCards: readonly DifficultyCard[],
    deckOptions: readonly DeckOption[],
    players: readonly ReturnType<typeof corePlayerForSeat>[],
    requiredSets: readonly RequiredEncounterSet[],
    modularOptions: readonly ModularSetOption[],
    modularCap: number,
    compositionRows: readonly CompositionRow[],
    whatsInThereRows: readonly CompositionRow[],
    nemesisStandby: NemesisStandby | null,
    encounterDeckSize: number,
    preview: TableSetupPreview | null,
  ): void {
    this.#compactRegion?.destroy();
    this.#compactRegion = null;
    this.#compactSeedBoxRect = null;

    const villainName = scenarioDetailOf(scenario, CARDS_BY_ID, POOL_ENCOUNTER_SETS).villainName;
    const modularRightLabel = `${requiredSets.length} required · ${modularCap} chosen`.toUpperCase();

    const layout = tableSetupCompactLayout({
      width,
      height,
      difficultyIds: difficultyCards.map((c) => c.id),
      requiredModularIds: requiredSets.map((r) => r.id as string),
      candidateModularIds: modularOptions.map((o) => o.id),
      modularHeaderRightLabel: modularRightLabel,
      seatCount: this.#draft.seats.length,
      compositionRows: compositionRows.length,
      whatsInThereRows: whatsInThereRows.length,
      hasNemesisStandby: nemesisStandby !== null,
    });
    this.#compactLayout = layout;
    this.#compactViewport = layout.viewport;

    // Ground: paper, matching P12 exactly — the wide/tablet-portrait ink page (`table-setup-layout.ts`'s own doc
    // comment on why that one's ink) doesn't apply here.
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    this.add
      .rectangle(
        layout.headerBar.x,
        layout.headerBar.y,
        layout.headerBar.width,
        layout.headerBar.height,
        surface.ink.hex,
      )
      .setOrigin(0, 0);
    this.#drawCompactHeader(layout);

    const seatCells = this.#seatCells(deckOptions);
    const requiredById = new Map(requiredSets.map((r) => [r.id as string, r]));
    const candidateById = new Map(modularOptions.map((o) => [o.id, o]));
    const rowData: CompactRowData = {
      difficultyCards,
      villainName,
      requiredById,
      candidateById,
      modularRightLabel,
      seatCells,
      compositionRows,
      whatsInThereRows,
      nemesisStandby,
    };

    const rects = compactRowRects(layout);
    const heights = layout.rows.map((row) => row.height);
    this.#compactRegion = new McScrollRegion(this, {
      rect: layout.viewport,
      heights,
      scroll: this.#compactScroll,
      onScroll: () => this.#syncCompactSeedInput(),
    });
    const container = this.#compactRegion.content;

    layout.rows.forEach((row, index) => {
      const contentRect = rects[index]!;
      const screenRect: Rect = {
        x: contentRect.x,
        y: layout.viewport.y + contentRect.y,
        width: contentRect.width,
        height: contentRect.height,
      };
      this.#captureInto(container, () => this.#drawCompactRow(row.id, screenRect, layout, rowData));
    });

    if (this.#compactSeedBoxRect) {
      if (this.#seedInput) this.#seedInput.layout(this.#compactSeedBoxRect);
      else {
        this.#seedInput = new McTextInput(this, {
          rect: this.#compactSeedBoxRect,
          value: this.#seedText,
          type: typeRole.mono,
          numeric: true,
          maxLength: 9,
          placeholder: "seed",
          onChange: this.#onSeedChange,
        });
      }
    }
    this.#syncCompactSeedInput();

    this.#drawCompactFooter(layout, preview, players, villainName, modularOptions.filter((o) => o.selected).length);

    this.#route?.set(
      tableSetupFocusOrder({
        difficulties: difficultyCards.map((c) => c.id),
        modularSetIds: modularOptions.map((o) => o.id),
        firstPlayerOptionIds: [...seatCells.map((c) => c.id), "random"],
      }),
      this.#stops,
    );
  }

  /** Runs `draw`, then reparents everything it just added to the scene's top-level display list into `container` — the "eagerly draw, then move into the scrolled/masked layer" trick `McScrollRegion` relies on (its own doc comment), since `this.add.graphics()`/`new McButton(this, …)` always land at the top level first. */
  #captureInto(container: Phaser.GameObjects.Container, draw: () => void): void {
    const before = this.children.list.length;
    draw();
    const added = this.children.list.slice(before);
    if (added.length > 0) container.add(added);
  }

  /** Looks up `id`'s current row index in `#compactLayout` at *activation* time (not draw time, when the id was captured into a closure) — `layout.rows` can't reorder between a rebuild and the next focus move, but resolving fresh avoids a second, potentially stale copy of the same index. */
  #compactScrollIntoView(id: string): void {
    if (!this.#compactLayout || !this.#compactRegion) return;
    const index = compactRowIndex(this.#compactLayout, id);
    if (index >= 0) this.#compactRegion.scrollIntoView(index);
  }

  /** A stop inside the scroll region: its rect tracks the current scroll offset (`FocusStop.rect`'s own function form, for exactly this), and taking focus scrolls it into view. */
  #compactStop(rect: Rect, activate: () => void, scrollId: string): FocusStop {
    return {
      rect: () => ({ ...rect, y: rect.y - this.#compactScroll.offsetPx }),
      activate,
      ensureVisible: () => this.#compactScrollIntoView(scrollId),
    };
  }

  #compactClip = (): Rect | null => this.#compactRegion?.rect ?? null;
  #compactSuppressClick = (): boolean => this.#compactRegion?.isDragSuppressingClick ?? false;

  #drawCompactHeader(layout: TableSetupCompactLayout): void {
    const back = (): void => this.#back();
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "◂",
        type: { ...typeRole.backLabel, size: 20 },
        rect: layout.back,
        onClick: back,
        enabled: !this.#starting,
      }),
    );
    this.#stops.set("back", { rect: layout.back, activate: back });
    const titleX = layout.back.x + layout.back.width + 12;
    const title = this.add
      .text(titleX, layout.headerBar.height / 2, "Set the table", textStyle(typeRole.pageTitle, surface.paper.hex))
      .setOrigin(0, 0.5);
    fitText(title, layout.step.x - titleX - 8, typeRole.pageTitle.size);
    this.add
      .text(
        layout.step.x + layout.step.width,
        layout.headerBar.height / 2,
        "4/4",
        textStyle(typeRole.label, surface.paper.hex, ink.label),
      )
      .setOrigin(1, 0.5);
  }

  #drawCompactRow(id: string, rect: Rect, layout: TableSetupCompactLayout, data: CompactRowData): void {
    if (id === "header:difficulty") {
      sectionHeader(this, rect.x, rect.y + 2, rect.width, "Difficulty", surface.ink.hex);
      return;
    }
    if (id === "difficulty") {
      this.#drawCompactDifficultySegment(rect, data.difficultyCards);
      return;
    }
    if (id === "header:modular") {
      if (!layout.modularHeaderStacked) {
        sectionHeader(this, rect.x, rect.y + 2, rect.width, "Modular sets", surface.ink.hex, data.modularRightLabel);
      } else {
        sectionHeader(this, rect.x, rect.y + 2, rect.width, "Modular sets", surface.ink.hex);
        // 26px: the Bangers heading's own line height at this size (`sectionHeader`'s own font size, 19px) — the
        // stacked right label sits directly under it, inside this row's own taller height (`modularHeaderStacked`).
        label(this, rect.x, rect.y + 2 + 26, data.modularRightLabel, typeRole.label, surface.ink.hex, ink.label);
      }
      return;
    }
    if (id.startsWith("modular:")) {
      const setId = id.slice("modular:".length);
      const required = data.requiredById.get(setId);
      if (required) {
        this.#drawCompactRequiredRow(rect, required, data.villainName);
        return;
      }
      const option = data.candidateById.get(setId);
      if (option) this.#drawCompactModularRow(rect, option);
      return;
    }
    if (id === "header:firstPlayer") {
      sectionHeader(this, rect.x, rect.y + 2, rect.width, "First player", surface.ink.hex);
      return;
    }
    if (id === "firstPlayer") {
      this.#drawCompactFirstPlayerRow(rect, data.seatCells);
      return;
    }
    if (id === "header:seed") {
      sectionHeader(this, rect.x, rect.y + 2, rect.width, "Shuffle seed", surface.ink.hex);
      return;
    }
    if (id === "seed") {
      this.#drawCompactSeedRow(rect);
      return;
    }
    if (id === "header:encounter") {
      sectionHeader(this, rect.x, rect.y + 2, rect.width, "The encounter deck", surface.ink.hex);
      return;
    }
    if (id === "encounterPanel") {
      this.#drawCompactEncounterPanel(rect, data.compositionRows, data.whatsInThereRows, data.nemesisStandby);
    }
  }

  /** DIFFICULTY: a compact segmented row — ink fill (paper text) = selected, paper (ink text) = available. No description text (P12 has none; the wide layout's own cards carry that). */
  #drawCompactDifficultySegment(rect: Rect, cards: readonly DifficultyCard[]): void {
    const h = COMPACT_DIFFICULTY_ROW_HEIGHT;
    const gap = 2;
    const cellWidth = (rect.width - gap * (cards.length - 1)) / cards.length;
    cards.forEach((card, index) => {
      const cellRect: Rect = { x: rect.x + index * (cellWidth + gap), y: rect.y, width: cellWidth, height: h };
      const selected = this.#draft.difficulty === card.id;
      const onClick = (): void => {
        this.#draft = setDifficulty(this.#draft, card.id);
        this.#rebuild();
      };
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "",
          type: typeRole.label,
          rect: cellRect,
          onClick,
          clip: this.#compactClip,
          suppressClick: this.#compactSuppressClick,
        }),
      );
      this.#stops.set(`difficulty:${card.id}`, this.#compactStop(cellRect, onClick, "difficulty"));
      const g = this.add.graphics();
      g.fillStyle(selected ? surface.ink.hex : surface.card.hex, 1).fillRect(
        cellRect.x,
        cellRect.y,
        cellRect.width,
        cellRect.height,
      );
      g.lineStyle(2, surface.ink.hex, 1).strokeRect(
        cellRect.x + 1,
        cellRect.y + 1,
        cellRect.width - 2,
        cellRect.height - 2,
      );
      const text = this.add
        .text(
          cellRect.x + cellRect.width / 2,
          cellRect.y + cellRect.height / 2,
          card.name,
          textStyle({ ...typeRole.sectionHeader, size: 17 }, selected ? surface.paper.hex : surface.ink.hex),
        )
        .setOrigin(0.5);
      fitText(text, cellRect.width - 12, 17);
    });
  }

  /** The scenario's own required set: ink-filled, a red checked box ("locked" — P12's own literal wording, no card count: it can't be un-chosen, so the count that matters is the candidates'), never toggleable. */
  #drawCompactRequiredRow(rect: Rect, required: RequiredEncounterSet, villainName: string): void {
    const h = COMPACT_MODULAR_ROW_HEIGHT;
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, h);
    g.lineStyle(3, surface.ink.hex, 1).strokeRect(rect.x + 1.5, rect.y + 1.5, rect.width - 3, h - 3);
    const boxRect = this.#drawCompactCheckbox(rect, h, true, accent.heroRed.hex);
    const textX = boxRect.x + boxRect.width + 11;
    const textWidth = rect.x + rect.width - textX - 10;
    const name = this.add.text(
      textX,
      rect.y + 11,
      required.name,
      textStyle({ ...typeRole.rowTitle, size: 13 }, surface.paper.hex),
    );
    fitText(name, textWidth, 13);
    const meta = label(
      this,
      textX,
      rect.y + 11 + 18,
      `Required by ${villainName} · locked`,
      typeRole.label,
      surface.paper.hex,
      ink.label,
    );
    fitText(meta, textWidth, typeRole.label.size);
  }

  /** A candidate modular set: paper row throughout (P12's own shape — the row itself never changes; only the checkbox does), ink-filled checked box when chosen, empty when available. Toggling replaces the current pick at the scenario's own cap (`toggleModularSet` enforces it). */
  #drawCompactModularRow(rect: Rect, option: ModularSetOption): void {
    const h = COMPACT_MODULAR_ROW_HEIGHT;
    const cellRect: Rect = { ...rect, height: h };
    const onClick = (): void => {
      const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === this.#draft.scenarioId)!;
      this.#draft = toggleModularSet(this.#draft, scenario, option.id);
      this.#rebuild();
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: "",
        type: typeRole.label,
        rect: cellRect,
        onClick,
        clip: this.#compactClip,
        suppressClick: this.#compactSuppressClick,
      }),
    );
    this.#stops.set(`modular:${option.id}`, this.#compactStop(cellRect, onClick, `modular:${option.id}`));
    const g = this.add.graphics();
    g.fillStyle(surface.card.hex, 1).fillRect(rect.x, rect.y, rect.width, h);
    g.lineStyle(2.5, surface.ink.hex, 1).strokeRect(rect.x + 1.25, rect.y + 1.25, rect.width - 2.5, h - 2.5);
    const boxRect = this.#drawCompactCheckbox(rect, h, option.selected, surface.ink.hex);
    const textX = boxRect.x + boxRect.width + 11;
    const textWidth = rect.x + rect.width - textX - 10;
    const name = this.add.text(
      textX,
      rect.y + 11,
      option.name,
      textStyle({ ...typeRole.rowTitle, size: 13 }, surface.ink.hex),
    );
    fitText(name, textWidth, 13);
    const meta = label(
      this,
      textX,
      rect.y + 11 + 18,
      modularCardLabel(option),
      typeRole.label,
      surface.ink.hex,
      ink.label,
    );
    fitText(meta, textWidth, typeRole.label.size);
  }

  /** A checkbox at a row's own left edge, vertically centred — `checkedColor` is the required row's red or a candidate's ink; unchecked is always just an outline. */
  #drawCompactCheckbox(rect: Rect, rowHeight: number, checked: boolean, checkedColor: number): Rect {
    const size = 24;
    const boxRect: Rect = { x: rect.x + 11, y: rect.y + (rowHeight - size) / 2, width: size, height: size };
    const box = this.add.graphics();
    const outline = checkedColor === accent.heroRed.hex ? surface.paper.hex : surface.ink.hex;
    box.lineStyle(2, outline, 1).strokeRect(boxRect.x, boxRect.y, boxRect.width, boxRect.height);
    if (checked) {
      box.fillStyle(checkedColor, 1).fillRect(boxRect.x + 2, boxRect.y + 2, boxRect.width - 4, boxRect.height - 4);
      this.add
        .text(
          boxRect.x + boxRect.width / 2,
          boxRect.y + boxRect.height / 2,
          "✓",
          textStyle({ ...typeRole.label, size: 13 }, surface.paper.hex),
        )
        .setOrigin(0.5);
    }
    return boxRect;
  }

  /** FIRST PLAYER: one row of compact chips (P12's own shape) — Bangers "YOU"/"S2"/… over the hero's short name, ink fill = first player, plus a dashed "Random" chip. Shares the row equally across however many seats there are, plus Random. */
  #drawCompactFirstPlayerRow(rect: Rect, cells: readonly SeatCell[]): void {
    const h = COMPACT_FIRST_PLAYER_ROW_HEIGHT;
    const gap = 6;
    const count = cells.length + 1;
    const cellWidth = (rect.width - gap * (count - 1)) / count;
    cells.forEach((cell, index) => {
      const cellRect: Rect = { x: rect.x + index * (cellWidth + gap), y: rect.y, width: cellWidth, height: h };
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "",
          type: typeRole.label,
          rect: cellRect,
          onClick: cell.onClick,
          clip: this.#compactClip,
          suppressClick: this.#compactSuppressClick,
        }),
      );
      this.#stops.set(`first-player:${cell.id}`, this.#compactStop(cellRect, cell.onClick, "firstPlayer"));
      const g = this.add.graphics();
      g.fillStyle(cell.selected ? surface.ink.hex : surface.card.hex, 1).fillRect(
        cellRect.x,
        cellRect.y,
        cellRect.width,
        cellRect.height,
      );
      g.lineStyle(2.5, surface.ink.hex, 1).strokeRect(
        cellRect.x + 1.25,
        cellRect.y + 1.25,
        cellRect.width - 2.5,
        cellRect.height - 2.5,
      );
      const tone = cell.selected ? surface.paper.hex : surface.ink.hex;
      const top = this.add
        .text(
          cellRect.x + cellRect.width / 2,
          cellRect.y + cellRect.height * 0.36,
          cell.chipLabel,
          textStyle({ ...typeRole.sectionHeader, size: 15 }, tone),
        )
        .setOrigin(0.5);
      fitText(top, cellRect.width - 8, 15);
      const bottom = this.add
        .text(
          cellRect.x + cellRect.width / 2,
          cellRect.y + cellRect.height * 0.72,
          cell.name,
          textStyle(typeRole.label, tone, ink.label),
        )
        .setOrigin(0.5);
      fitText(bottom, cellRect.width - 8, typeRole.label.size);
    });
    const randomRect: Rect = { x: rect.x + cells.length * (cellWidth + gap), y: rect.y, width: cellWidth, height: h };
    const roll = (): void => {
      this.#draft = setFirstPlayerIndex(this.#draft, rollFirstPlayerIndex(this.#draft.seed, this.#draft.seats.length));
      this.#rebuild();
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: "",
        type: typeRole.label,
        rect: randomRect,
        onClick: roll,
        clip: this.#compactClip,
        suppressClick: this.#compactSuppressClick,
      }),
    );
    this.#stops.set("first-player:random", this.#compactStop(randomRect, roll, "firstPlayer"));
    const g = this.add.graphics();
    g.fillStyle(surface.paper.hex, 1).fillRect(randomRect.x, randomRect.y, randomRect.width, randomRect.height);
    dashedRect(g, randomRect, 2, surface.ink.hex);
    const text = this.add
      .text(
        randomRect.x + randomRect.width / 2,
        randomRect.y + randomRect.height / 2,
        "Random",
        textStyle(typeRole.label, surface.ink.hex, ink.label),
      )
      .setOrigin(0.5);
    fitText(text, randomRect.width - 8, typeRole.label.size);
  }

  /** SHUFFLE SEED: a parchment bordered row (P12's own shape) — label/caption at left, the real DOM-backed seed field and Reroll at right. The seed box's own screen rect is recorded (`#compactSeedBoxRect`) for `#syncCompactSeedInput` to track every time the page scrolls. */
  #drawCompactSeedRow(rect: Rect): void {
    const h = COMPACT_SEED_ROW_HEIGHT;
    const g = this.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, h);
    g.lineStyle(2.5, surface.ink.hex, 1).strokeRect(rect.x + 1.25, rect.y + 1.25, rect.width - 2.5, h - 2.5);
    label(this, rect.x + 12, rect.y + 10, "Shuffle seed", typeRole.rowTitle, surface.ink.hex, 1);
    this.add.text(
      rect.x + 12,
      rect.y + 26,
      "Reproduce this exact deal",
      textStyle(typeRole.label, surface.ink.hex, ink.label),
    );

    const controlsY = rect.y + 48;
    const rerollWidth = 90;
    const seedWidth = rect.width - 24 - rerollWidth - 10;
    const seedBoxRect: Rect = { x: rect.x + 12, y: controlsY, width: seedWidth, height: hit.target };
    const rerollRect: Rect = {
      x: seedBoxRect.x + seedWidth + 10,
      y: controlsY,
      width: rerollWidth,
      height: hit.target,
    };
    this.#compactSeedBoxRect = seedBoxRect;

    const reroll = (): void => {
      this.#draft = rerollSeed(this.#draft);
      this.#seedText = String(this.#draft.seed);
      this.#seedInput?.setValue(this.#seedText);
      this.#status?.setText("");
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "Reroll",
        type: typeRole.label,
        rect: rerollRect,
        onClick: reroll,
        clip: this.#compactClip,
        suppressClick: this.#compactSuppressClick,
      }),
    );
    this.#stops.set("reroll", this.#compactStop(rerollRect, reroll, "seed"));
    this.#stops.set(
      "seed",
      this.#compactStop(seedBoxRect, () => this.#seedInput?.focus(), "seed"),
    );
  }

  /** THE ENCOUNTER DECK: one bordered paper panel — composition rows (obligations red), a thin rule, what's-in-there rows, then a single dim "N cards on standby" line. Every row real, none trimmed — the panel is exactly as tall as its own content (`tableSetupCompactLayout`'s own height math). */
  #drawCompactEncounterPanel(
    rect: Rect,
    composition: readonly CompositionRow[],
    whatsInThere: readonly CompositionRow[],
    nemesis: NemesisStandby | null,
  ): void {
    const g = this.add.graphics();
    g.fillStyle(surface.card.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(2.5, surface.ink.hex, 1).strokeRect(rect.x + 1.25, rect.y + 1.25, rect.width - 2.5, rect.height - 2.5);
    let y = rect.y + PANEL_PAD;
    const drawRow = (row: CompositionRow): void => {
      const color = row.red ? accent.heroRed.hex : surface.ink.hex;
      const rowLabel = this.add.text(rect.x + 12, y, row.label, textStyle(typeRole.body, color)).setMaxLines(1);
      fitText(rowLabel, rect.width - 80, typeRole.body.size);
      this.add
        .text(rect.x + rect.width - 12, y, String(row.count), textStyle({ ...typeRole.emphasis, weight: 700 }, color))
        .setOrigin(1, 0);
      y += PANEL_ROW_HEIGHT;
    };
    for (const row of composition) drawRow(row);
    if (composition.length > 0 && whatsInThere.length > 0) {
      const rule = this.add.graphics();
      rule.fillStyle(surface.ink.hex, ink.disabled).fillRect(rect.x + 12, y + 3, rect.width - 24, 1);
      y += 6;
    }
    for (const row of whatsInThere) drawRow(row);
    if (nemesis) {
      y += 4;
      label(this, rect.x + 12, y, `${nemesis.totalCards} cards on standby`, typeRole.label, surface.ink.hex, ink.meta);
    }
  }

  /** The sticky footer: one uppercase summary line, then the single red "Deal it out" fill with a paper outline (P12's own shape) — pinned outside the scroll region, always visible. */
  #drawCompactFooter(
    layout: TableSetupCompactLayout,
    preview: TableSetupPreview | null,
    players: readonly ReturnType<typeof corePlayerForSeat>[],
    villainName: string,
    chosenModularCount: number,
  ): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(
      layout.footer.x,
      layout.footer.y,
      layout.footer.width,
      layout.footer.height,
    );
    const difficultyLabel = `${this.#draft.difficulty}${preview ? ` ${preview.villainStageLabel}` : ""}`;
    const heroCount = players.length;
    const summary = preview
      ? `${villainName} · ${difficultyLabel} · ${heroCount} hero${heroCount === 1 ? "" : "es"} · ${chosenModularCount} modular${chosenModularCount === 1 ? "" : "s"}`
      : `${villainName} · ${difficultyLabel}`;
    const summaryText = label(
      this,
      layout.footerSummary.x,
      layout.footerSummary.y,
      summary,
      typeRole.label,
      surface.paper.hex,
      ink.label,
    );
    fitText(summaryText, layout.footerSummary.width, typeRole.label.size);

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
    const outline = this.add.graphics();
    outline
      .lineStyle(3, surface.paper.hex, 1)
      .strokeRect(
        layout.dealItOut.x + 1.5,
        layout.dealItOut.y + 1.5,
        layout.dealItOut.width - 3,
        layout.dealItOut.height - 3,
      );
    this.#stops.set("deal-it-out", { rect: layout.dealItOut, activate: () => void this.#start(players) });

    this.#status = this.add.text(
      layout.footerSummary.x,
      layout.footer.y - 20,
      "",
      textStyle(typeRole.body, surface.ink.hex),
    );
  }

  /** Repositions (and shows/hides) the DOM-backed seed field to track the compact scroll region's current offset — called on every scroll change and once right after the field is (re)built, since a canvas mask can't clip a DOM element the way it clips everything else in the scrolled content. */
  #syncCompactSeedInput(): void {
    if (!this.#seedInput || !this.#compactSeedBoxRect || !this.#compactViewport) return;
    const box = this.#compactSeedBoxRect;
    const screenY = box.y - this.#compactScroll.offsetPx;
    this.#seedInput.layout({ x: box.x, y: screenY, width: box.width, height: box.height });
    const viewport = this.#compactViewport;
    // A DOM element ignores this container's own Phaser mask and paints *above* the canvas regardless of x/y
    // (`McTextInput`'s own doc comment) — a partial overlap with the sticky ink footer or the header still shows
    // the field's own paper box floating over them. So visibility requires *full* containment within the
    // scrollable viewport, not merely "some pixel of it is inside" (found in browser verification, 2026-09-18: the
    // seed field visibly sat on top of the footer's own "DEAL IT OUT" while only partly scrolled into view).
    const visible = screenY >= viewport.y && screenY + box.height <= viewport.y + viewport.height;
    this.#seedInput.setVisible(visible);
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
      const cardRect: Rect = {
        x: rect.x + index * (slotWidth + gap),
        y: rect.y,
        width: slotWidth,
        height: rect.height,
      };
      const selected = this.#draft.difficulty === card.id;
      const onClick = (): void => {
        this.#draft = setDifficulty(this.#draft, card.id);
        this.#rebuild();
      };
      this.#buttons.push(
        new McButton(this, { kind: "quiet", label: "", type: typeRole.label, rect: cardRect, onClick }),
      );
      this.#stops.set(`difficulty:${card.id}`, { rect: cardRect, activate: onClick });
      this.#cardFrame(cardRect, selected);
      const name = this.add.text(
        cardRect.x + 10,
        cardRect.y + 8,
        card.name,
        textStyle({ ...typeRole.sectionHeader, size: 18 }, surface.ink.hex, selected ? 1 : ink.disabled),
      );
      fitText(name, cardRect.width - 20, 18);
      this.add
        .text(
          cardRect.x + 10,
          cardRect.y + 8 + 22,
          card.description,
          textStyle(typeRole.body, surface.ink.hex, selected ? ink.secondary : ink.disabled),
        )
        .setWordWrapWidth(cardRect.width - 20)
        .setMaxLines(Math.max(1, Math.floor((cardRect.height - 34) / 14)));
    });
  }

  /** A card's white ground and border — 4px Hero Red when selected, a thin dim ink outline otherwise. Never a fill besides "Deal it out". */
  #cardFrame(rect: Rect, selected: boolean): void {
    const g = this.add.graphics();
    g.fillStyle(surface.card.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    if (selected)
      g.lineStyle(4, accent.heroRed.hex, 1).strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
    else
      g.lineStyle(1.5, surface.ink.hex, ink.disabled).strokeRect(
        rect.x + 0.75,
        rect.y + 0.75,
        rect.width - 1.5,
        rect.height - 1.5,
      );
  }

  /** MODULAR SETS: the scenario's own required set(s) first (ink-filled, not toggleable), then every candidate — a grid at `layout.modularColumns` columns, whatever row height this form factor uses. */
  #drawModularGrid(
    layout: TableSetupLayout,
    requiredSets: readonly RequiredEncounterSet[],
    options: readonly ModularSetOption[],
    scenario: Scenario,
  ): void {
    const rect = layout.modularGrid;
    const columns = layout.modularColumns;
    const gap = layout.wide ? ROW_GAP : NARROW_MODULAR_GRID_GAP;
    const cellHeight =
      layout.modularRows > 0 ? (rect.height - (layout.modularRows - 1) * gap) / layout.modularRows : rect.height;
    const cellWidth = (rect.width - (columns - 1) * gap) / columns;
    const villainName = scenarioDetailOf(scenario, CARDS_BY_ID, POOL_ENCOUNTER_SETS).villainName;

    const cellAt = (index: number): Rect => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      return {
        x: rect.x + col * (cellWidth + gap),
        y: rect.y + row * (cellHeight + gap),
        width: cellWidth,
        height: cellHeight,
      };
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
      .setWordWrapWidth(rect.width - 20)
      .setMaxLines(maxLines);
  }

  /** The scenario's own required set: ink-filled, paper text, never toggleable — no button, no focus stop. */
  #drawRequiredModularCard(rect: Rect, required: RequiredEncounterSet, villainName: string): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    const name = this.add.text(
      rect.x + 10,
      rect.y + 8,
      required.name,
      textStyle({ ...typeRole.sectionHeader, size: 15 }, surface.paper.hex),
    );
    fitText(name, rect.width - 20, 15);
    this.#drawModularCardLabel(
      rect,
      rect.y + 8 + name.height + 4,
      requiredCardLabel(villainName, required.cardCount).toUpperCase(),
      surface.paper.hex,
      ink.label,
    );
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
    const name = this.add.text(
      rect.x + 10,
      rect.y + 8,
      option.name,
      textStyle({ ...typeRole.sectionHeader, size: 15 }, surface.ink.hex, dim),
    );
    fitText(name, rect.width - 20, 15);
    this.#drawModularCardLabel(
      rect,
      rect.y + 8 + name.height + 4,
      modularCardLabel(option).toUpperCase(),
      surface.ink.hex,
      option.selected ? ink.label : ink.disabled,
    );
  }

  /** One seat cell per seated deck — a radio dot (filled amber for the first player), the hero's name, and a small "FIRST PLAYER"/"SEAT N" label (wide/tablet portrait) or a compact "YOU"/"S2" chip (`chipLabel`, phone). */
  #seatCells(deckOptions: readonly DeckOption[]): readonly SeatCell[] {
    return this.#draft.seats.map((deckId, index) => {
      const option = deckOptions.find((o) => (o.deck.id as string) === deckId);
      return {
        id: `${index}`,
        name: option?.identityName ?? "?",
        meta:
          this.#draft.firstPlayerIndex === index || (this.#draft.firstPlayerIndex === null && index === 0)
            ? "First player"
            : `Seat ${index + 1}`,
        chipLabel: index === 0 ? "YOU" : `S${index + 1}`,
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
      const cellRect: Rect = {
        x: rect.x + index * (cellWidth + gap),
        y: rect.y,
        width: cellWidth,
        height: rect.height,
      };
      this.#buttons.push(
        new McButton(this, { kind: "quiet", label: "", type: typeRole.label, rect: cellRect, onClick: cell.onClick }),
      );
      this.#stops.set(`first-player:${cell.id}`, { rect: cellRect, activate: cell.onClick });
      const g = this.add.graphics();
      g.fillStyle(surface.card.hex, 1).fillRect(cellRect.x, cellRect.y, cellRect.width, cellRect.height);
      g.lineStyle(1.5, surface.ink.hex, cell.selected ? 1 : ink.disabled).strokeRect(
        cellRect.x + 0.75,
        cellRect.y + 0.75,
        cellRect.width - 1.5,
        cellRect.height - 1.5,
      );

      const dotSize = Math.min(16, cellRect.height * 0.28);
      const dotCx = cellRect.x + 10 + dotSize / 2;
      const dotCy = cellRect.y + cellRect.height / 2;
      const dot = this.add.graphics();
      dot.lineStyle(2, surface.ink.hex, cell.selected ? 1 : ink.disabled).strokeCircle(dotCx, dotCy, dotSize / 2);
      if (cell.selected) dot.fillStyle(signal.caution.hex, 1).fillCircle(dotCx, dotCy, dotSize / 2 - 3);

      const textX = dotCx + dotSize / 2 + 8;
      const textWidth = cellRect.x + cellRect.width - textX - 6;
      const name = this.add.text(
        textX,
        cellRect.y + cellRect.height * 0.34,
        cell.name,
        textStyle({ ...typeRole.sectionHeader, size: 14 }, surface.ink.hex),
      );
      fitText(name, textWidth, 14);
      const meta = label(
        this,
        textX,
        cellRect.y + cellRect.height * 0.68,
        cell.meta,
        typeRole.label,
        surface.ink.hex,
        ink.label,
      );
      fitText(meta, textWidth, typeRole.label.size);
    });
    if (includeRandom) {
      const randomRect: Rect = {
        x: rect.x + cells.length * (cellWidth + gap),
        y: rect.y,
        width: cellWidth,
        height: rect.height,
      };
      const roll = (): void => {
        this.#draft = setFirstPlayerIndex(
          this.#draft,
          rollFirstPlayerIndex(this.#draft.seed, this.#draft.seats.length),
        );
        this.#rebuild();
      };
      this.#buttons.push(
        new McButton(this, { kind: "quiet", label: "", type: typeRole.label, rect: randomRect, onClick: roll }),
      );
      this.#stops.set("first-player:random", { rect: randomRect, activate: roll });
      // Covers the "quiet" button's own default paper fill (theme.ts's `skin("quiet","rest")`, correct on the
      // wide layout's paper body but wrong here) with the page's own ink ground, so the dashed outline reads as
      // "an empty slot" against this screen's ink page rather than a stray cream box with invisible paper-on-paper text.
      const ground = this.add.graphics();
      ground.fillStyle(surface.ink.hex, 1).fillRect(randomRect.x, randomRect.y, randomRect.width, randomRect.height);
      const dash = this.add.graphics();
      dashedRect(dash, randomRect, 1.5, bodyColor);
      const text = this.add
        .text(
          randomRect.x + randomRect.width / 2,
          randomRect.y + randomRect.height / 2,
          "Random",
          textStyle(typeRole.label, bodyColor, ink.label),
        )
        .setOrigin(0.5);
      fitText(text, randomRect.width - 10, typeRole.label.size);
    }
  }

  /** "THE ENCOUNTER DECK YOU'RE BUILDING": Composition (obligations row in red) / What's in there / a parchment Nemesis panel. */
  #drawEncounterPanels(
    layout: TableSetupLayout,
    composition: readonly CompositionRow[],
    whatsInThere: readonly CompositionRow[],
    nemesis: NemesisStandby | null,
  ): void {
    const [compBudget, witBudget, nemBudget] = layout.encounterPanels.rowBudgets;
    this.#drawListPanel(layout.encounterPanels.composition, "Composition", composition, compBudget, surface.card.hex);
    this.#drawListPanel(
      layout.encounterPanels.whatsInThere,
      "What's in there",
      whatsInThere,
      witBudget,
      surface.card.hex,
    );
    this.#drawNemesisPanel(layout.encounterPanels.nemesis, nemesis, nemBudget);
  }

  #drawListPanel(rect: Rect, title: string, rows: readonly CompositionRow[], rowBudget: number, ground: number): void {
    // Below its own header's height, a panel reads as a stray sliver, not a legible "trimmed" panel — the layout's
    // own defensive clamp (`table-setup-layout.ts`, very short viewports) can shrink a panel below that; this
    // scene simply omits it rather than draw a clipped label in a box a few pixels tall.
    if (rect.height < PANEL_HEADER_HEIGHT + 4) return;
    const g = this.add.graphics();
    g.fillStyle(ground, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(1.5, surface.ink.hex, ink.disabled).strokeRect(
      rect.x + 0.75,
      rect.y + 0.75,
      rect.width - 1.5,
      rect.height - 1.5,
    );
    label(this, rect.x + 10, rect.y + 8, title, typeRole.label, surface.ink.hex, ink.label);
    let y = rect.y + PANEL_HEADER_HEIGHT + 4;
    const shown = rows.slice(0, rowBudget);
    for (const row of shown) {
      const color = row.red ? accent.heroRed.hex : surface.ink.hex;
      const rowLabel = this.add
        .text(rect.x + 10, y, row.label, textStyle(typeRole.body, color))
        .setWordWrapWidth(rect.width - 60)
        .setMaxLines(1);
      fitText(rowLabel, rect.width - 60, typeRole.body.size);
      this.add
        .text(rect.x + rect.width - 10, y, String(row.count), textStyle({ ...typeRole.emphasis, weight: 700 }, color))
        .setOrigin(1, 0);
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
    g.lineStyle(1.5, surface.ink.hex, ink.disabled).strokeRect(
      rect.x + 0.75,
      rect.y + 0.75,
      rect.width - 1.5,
      rect.height - 1.5,
    );
    label(this, rect.x + 10, rect.y + 8, "Nemesis sets held back", typeRole.label, surface.ink.hex, ink.label);
    if (!nemesis) {
      if (lineBudget > 0) {
        this.add
          .text(
            rect.x + 10,
            rect.y + PANEL_HEADER_HEIGHT + 4,
            "Not used for this scenario.",
            textStyle(typeRole.body, surface.ink.hex, ink.meta),
          )
          .setWordWrapWidth(rect.width - 20);
      }
      return;
    }
    if (lineBudget > 1) {
      this.add
        .text(
          rect.x + 10,
          rect.y + PANEL_HEADER_HEIGHT + 4,
          nemesis.sentence,
          textStyle(typeRole.body, surface.ink.hex),
        )
        .setWordWrapWidth(rect.width - 20)
        .setMaxLines(Math.max(1, lineBudget - 1));
    }
    const footY = rect.y + rect.height - PANEL_PAD - 12;
    if (footY > rect.y + PANEL_HEADER_HEIGHT + 4) {
      label(
        this,
        rect.x + 10,
        footY,
        `${nemesis.totalCards} cards on standby`,
        typeRole.label,
        surface.ink.hex,
        ink.label,
      );
    }
  }

  /** "THE GAME YOU'LL GET": label-over-value rows, always paper-on-ink. */
  #drawGameSummaryRows(rect: Rect, rows: readonly GameSummaryRow[]): void {
    const shown = rows.slice(0, GAME_SUMMARY_ROW_COUNT);
    shown.forEach((row, index) => {
      const y = rect.y + index * PANEL_ROW_HEIGHT;
      if (y + PANEL_ROW_HEIGHT > rect.y + rect.height + 0.01) return;
      label(this, rect.x, y + 2, row.label, typeRole.label, surface.paper.hex, ink.label);
      const value = this.add
        .text(rect.x + rect.width, y, row.value, textStyle({ ...typeRole.emphasis, weight: 700 }, surface.paper.hex))
        .setOrigin(1, 0);
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
        goToScreen(this, SCENES.decks, {
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
    // A scenario with a one-off intro (`campaign/scenario-intros.ts`) and its artboard reads that first; the intro
    // hands off to the deal itself.
    const scenarioId = this.#draft.scenarioId;
    if (scenarioIntroFor(scenarioId) && introArtFor(ART_CATALOG, scenarioId)) {
      goToScreen(this, SCENES.scenarioIntro, { scenarioId } satisfies ScenarioIntroData);
      return;
    }
    goToScreen(this, SCENES.setupDeal);
  }
}

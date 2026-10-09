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
import { progressionScope } from "../progression/progression-scope.js";
import { estimateWrappedLines, type Rect } from "../view/layout.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { deckOptionsOf, type DeckOption } from "../view/deck-list-model.js";
import { corePlayerForSeat } from "../view/deck-seat.js";
import {
  compactModularEntriesFor,
  effectiveModularSetIds,
  groupStartsOpen,
  modularCardLabel,
  modularGroupsOf,
  modularSectionsFor,
  type ModularGroupSummary,
  modularSetOptionsFor,
  pickedSetCount,
  requiredCardLabel,
  requiredEncounterSetsFor,
  toggleModularSet,
  type ModularSetOption,
  type RequiredEncounterSet,
} from "../view/modular-sets.js";
import { modularHeaderRightLabel } from "../view/modular-summary.js";
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
  hasTowerDefenseSetupDamageOption,
  setDifficulty,
  setFirstPlayerIndex,
  setSeed,
  rerollSeed,
  toggleTowerDefenseSetupDamage,
  towerDefenseSetupDamagePerHero,
  toSessionConfig,
  type SetupDraft,
} from "../view/setup-draft.js";
import {
  hasSetAsideModularChoice,
  hoodModularSetOptionsFor,
  toggleHoodIncludedSet,
  type HoodModularSetOption,
} from "../view/hood-modular-sets.js";
import { tableSetupFocusOrder } from "../view/screen-focus.js";
import {
  applySetupOption,
  isSetChoiceRow,
  optionActionsOf,
  setupOptionRowsOf,
  splitOptionRows,
  type OptionChip,
  type SetupOptionRow,
} from "../view/setup-options.js";
import {
  COMPACT_DIFFICULTY_ROW_HEIGHT,
  COMPACT_FIRST_PLAYER_ROW_HEIGHT,
  COMPACT_GROUP_ROW_HEIGHT,
  COMPACT_GROUP_ROW_PREFIX,
  COMPACT_GROUP_CELL_HEIGHT,
  COMPACT_ROW_GAP,
  COMPACT_MODULAR_ROW_HEIGHT,
  COMPACT_SEED_ROW_HEIGHT,
  COMPACT_SET_CHOICE_HEIGHT,
  GAME_SUMMARY_ROW_COUNT,
  compactOptionHeight,
  PANEL_HEADER_HEIGHT,
  PANEL_PAD,
  PANEL_ROW_HEIGHT,
  ROW_GAP,
  compactRowIndex,
  compactRowRects,
  difficultySlotRect,
  optionGroupsStacked,
  OPTION_GROUPS_NAME_ZONE,
  setChoiceRowRects,
  SETS_INLINE_NAME_WIDTH,
  tableSetupCompactLayout,
  tableSetupLayout,
  type TableSetupCompactLayout,
  type TableSetupLayout,
} from "../view/table-setup-layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { appSession, deckStorage } from "../session.js";
import { tableRulesOf } from "../settings.js";
import type { DecksSceneData } from "./decks.js";
import type { SeatsData } from "./seats.js";
import type { ScenarioIntroData } from "./scenario-intro.js";
import { scenarioIntroFor } from "../campaign/scenario-intros.js";
import { ART_CATALOG, introArtFor } from "../art/scenario-art.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";

/** Every encounter set's printed name, for the Standard and Expert chips. */
const POOL_SET_NAMES: ReadonlyMap<string, string> = new Map(
  POOL_ENCOUNTER_SETS.map((set) => [set.id as string, set.name]),
);

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
  /** The phone's labeled modular groups, by id, with whether each is showing. */
  readonly groupById: ReadonlyMap<string, { readonly group: ModularGroupSummary; readonly open: boolean }>;
  readonly modularRightLabel: string;
  readonly seatCells: readonly SeatCell[];
  readonly compositionRows: readonly CompositionRow[];
  readonly whatsInThereRows: readonly CompositionRow[];
  readonly nemesisStandby: NemesisStandby | null;
  /** The setup-option cards the scenario offers (`setupOptionRowsOf`), by row id. */
  readonly optionById: ReadonlyMap<string, SetupOptionRow>;
  /** The Hood's own nine modular set candidates, by id — empty for every other scenario. */
  readonly hoodOptionById: ReadonlyMap<string, HoodModularSetOption>;
}

/** A Horseman's name beside its A/B pair: wide enough for "Pestilence" at the label size. */
const HORSEMAN_LABEL_WIDTH = 72;

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
  /** Wide/tablet portrait: the modular grid's own scroll region when its groups are taller than its panel, and its scroll position (kept across rebuilds so a pick does not jump the grid back to the top). */
  #modularRegion: McScrollRegion | null = null;
  #modularScroll = new VariableListScroll();
  /** The modular grid's plan while it scrolls, for `ensureVisible` callbacks resolved at focus time. */
  #modularRowOfItem: readonly number[] = [];
  /** The scrolling grid's panel while it scrolls (dev hook `modularViewport`); null when the grid is drawn whole. */
  #modularViewportRect: Rect | null = null;
  /** Phone: which modular groups the player has shown or hidden (an absent group follows `groupStartsOpen`). */
  #openGroups = new Map<string, boolean>();
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
    this.#modularScroll = new VariableListScroll();
    this.#openGroups = new Map();
    this.scale.on("resize", this.#rebuild, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      this.#seedInput?.destroy();
      this.#seedInput = null;
      this.#compactRegion?.destroy();
      this.#compactRegion = null;
      this.#modularRegion?.destroy();
      this.#modularRegion = null;
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
    this.#modularRegion?.destroy();
    this.#modularRegion = null;
    this.#modularViewportRect = null;
    const kept = this.#seedInput ? [this.#seedInput.gameObject] : [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === this.#draft.scenarioId)!;

    const deckOptions = this.#deckOptions();
    const seatedOptions = this.#draft.seats
      .map((deckId) => deckOptions.find((o) => (o.deck.id as string) === deckId))
      .filter((o): o is DeckOption => o !== undefined);
    const players = seatedOptions.map((option) => corePlayerForSeat(option, this.#draft.deckSwaps));

    const requiredSets = requiredEncounterSetsFor(scenario, CARDS_BY_ID);
    const modularOptions = modularSetOptionsFor(this.#draft, scenario, CARDS_BY_ID, { scope: progressionScope() });
    const modularCardCount = requiredSets.length + modularOptions.length;
    const modularCap = scenario.modularSetCount ?? 1;

    // The setup options this scenario offers under the draft's difficulty and modular picks (`playableScenarioOffer`).
    const allOptionRows = setupOptionRowsOf(this.#draft, POOL_SET_NAMES);
    // The Standard / Expert set chips are folded into the difficulty row; the rest are cards under it.
    const { setChoices, cards: optionRows } = splitOptionRows(allOptionRows);
    // Tower Defense's own setup-damage toggle (docs/phase7-wave4.md §4 Q4): offered only for Tower Defense itself.
    const towerDefenseSetupDamageOffered = hasTowerDefenseSetupDamageOption(scenario);
    // The Hood's own "choose 7 modular encounter sets and set them aside" (§2.3, §3.18): empty for every other scenario.
    const hoodOptions = hasSetAsideModularChoice(scenario)
      ? hoodModularSetOptionsFor(this.#draft, scenario, CARDS_BY_ID)
      : [];

    let compositionRows: readonly CompositionRow[] = [];
    let whatsInThereRows: readonly CompositionRow[] = [];
    let nemesisStandby: NemesisStandby | null = null;
    let gameSummaryRows: readonly GameSummaryRow[] = [];
    let encounterDeckSize = 0;
    let preview: TableSetupPreview | null = null;
    let previewStartStageIndex: number | undefined;
    if (players.length > 0) {
      const config = buildScenario(
        this.#draft.scenarioId,
        toSessionConfig(
          this.#draft,
          players,
          POOL_SCENARIOS.find((s) => (s.id as string) === this.#draft.scenarioId),
          tableRulesOf(appSession().settings),
        ),
      );
      previewStartStageIndex = config.villainStartStageIndex;
      preview = tableSetupPreviewOf(config, scenario, this.#draft.difficulty, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
      compositionRows = compositionRowsOf(preview.encounterDeck);
      whatsInThereRows = whatsInThereRowsOf(preview.encounterDeck);
      nemesisStandby = nemesisStandbyOf(preview.encounterDeck);
      gameSummaryRows = gameSummaryRowsOf(preview, tableRulesOf(appSession().settings));
      encounterDeckSize = preview.encounterDeckSize;
    }
    // The cards say where the game begins: Apocalypse's easier start moves the standard card's stage to I.
    const difficultyCards = difficultyCardsFor(
      scenario,
      this.#draft.difficulty === "standard" && this.#draft.easierStart ? previewStartStageIndex : undefined,
    );

    // Dev e2e hook (never referenced by product code): what the setup screen shows right now — each modular chip with
    // whether it is chosen, the picks in the order they were made, the two header counts and the summary rows — and
    // every control's current rect (`#stops` is rebuilt each draw, so it is read live).
    if (import.meta.env.DEV) {
      (window as unknown as { __mcTableSetupDebug?: unknown }).__mcTableSetupDebug = {
        stops: () =>
          [...this.#stops].map(([key, stop]) => ({
            key,
            ...(typeof stop.rect === "function" ? stop.rect() : stop.rect),
          })),
        options: () => modularOptions.map((o) => ({ id: o.id, kind: o.kind, name: o.name, selected: o.selected })),
        picks: () => [...effectiveModularSetIds(this.#draft, scenario)],
        // The rect the modular tiles scroll inside (the grid's panel; on a phone, the page between header and footer):
        // a tile whose stop rect lies outside it is not on screen, whatever the rect's own coordinates say.
        modularViewport: () => this.#modularViewportRect ?? this.#compactViewport,
        modularHeader: () =>
          modularHeaderRightLabel(
            scenario,
            requiredSets.length,
            this.#draft.seats.length,
            pickedSetCount(modularOptions),
          ),
        encounterDeckSize: () => encounterDeckSize,
        summary: () => gameSummaryRows.map((r) => [r.label, r.value]),
      };
    }

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
      modularSections: modularSectionsFor(requiredSets.length, modularOptions),
      seatCount: this.#draft.seats.length,
      compositionRows: compositionRows.length,
      whatsInThereRows: whatsInThereRows.length,
      nemesisLines,
      optionSpans: optionRows.map((row) => row.span),
      optionGroupCounts: optionRows.map((row) => (row.control.kind === "groups" ? row.control.groups.length : 0)),
      setChoiceRows: setChoices.length,
      hasTowerDefenseSetupDamage: towerDefenseSetupDamageOffered,
      hoodSetCount: hoodOptions.length,
    });

    // The scrolling page (P12's own, 2026-09-18 correction) — a whole different composition from the wide one, not
    // a squeeze of it, so it's a separate draw path rather than a branch inside the one below. Every touch form
    // factor gets it, and a wide window too short to keep two tile rows and two panel rows (Piece 14, D1).
    if (layout.scrollsPage) {
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
        optionRows,
        setChoices,
        hoodOptions,
      );
      return;
    }
    this.#compactRegion?.destroy();
    this.#compactRegion = null;
    this.#compactViewport = null;

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

    // The body's own text color: ink on the wide layout's paper body, paper on the narrow layout's ink page. The
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
    this.#drawDifficultyRow(layout.difficultyRow, difficultyCards, layout.difficultySlots);
    if (setChoices.length > 0) this.#drawSetsCard(layout.setsCard, setChoices, layout.setsInline);
    // The setup-option cards (Gene Pool threat, Horsemen's sides, easier start), a two-column grid under Difficulty:
    // one card per choice the scenario offers, none for a scenario with none.
    optionRows.forEach((row, index) => {
      const rect = layout.optionCards[index];
      if (rect) this.#drawOptionCard(rect, row, false);
    });

    // Tower Defense's own setup-damage toggle (docs/phase7-wave4.md §4 Q4): a full-width toggle right under
    // Difficulty (and Standard II/Expert II, when both are offered) — zero-area on every other scenario's layout.
    if (layout.wide && layout.towerDefenseDamageRow.height > 0) {
      this.#drawTowerDefenseDamageRow(layout.towerDefenseDamageRow);
    }

    const modularRight = modularHeaderRightLabel(
      scenario,
      requiredSets.length,
      this.#draft.seats.length,
      pickedSetCount(modularOptions),
    ).toUpperCase();
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

    // The Hood's own "choose which modular sets are in" (docs/phase7-wave4.md §2.3, §3.18): its own section right
    // under Modular sets, only for a scenario with the choice at all (`hoodOptions` empty otherwise).
    if (layout.wide && layout.hoodHeader.height > 0 && hoodOptions.length > 0) {
      const includedCount = hoodOptions.filter((o) => o.included).length;
      sectionHeader(
        this,
        layout.hoodHeader.x,
        layout.hoodHeader.y,
        layout.hoodHeader.width,
        "The Hood's own modular sets",
        bodyColor,
        `${includedCount} of ${hoodOptions.length} in the game`.toUpperCase(),
      );
      this.#drawHoodModularGrid(layout, hoodOptions);
    }

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
        optionActions: optionActionsOf(allOptionRows),
        hasTowerDefenseSetupDamage: towerDefenseSetupDamageOffered,
        modularSetIds: modularOptions.map((o) => o.id),
        hoodSetIds: hoodOptions.map((o) => o.id),
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
    optionRows: readonly SetupOptionRow[],
    setChoices: readonly SetupOptionRow[],
    hoodOptions: readonly HoodModularSetOption[],
  ): void {
    this.#compactRegion?.destroy();
    this.#compactRegion = null;
    this.#compactSeedBoxRect = null;

    const villainName = scenarioDetailOf(scenario, CARDS_BY_ID, POOL_ENCOUNTER_SETS).displayName;
    const modularRightLabel = modularHeaderRightLabel(
      scenario,
      requiredSets.length,
      this.#draft.seats.length,
      pickedSetCount(modularOptions),
    ).toUpperCase();
    // Tower Defense's own setup-damage toggle (docs/phase7-wave4.md §4 Q4): offered only for Tower Defense itself.
    const towerDefenseSetupDamageOffered = hasTowerDefenseSetupDamageOption(scenario);

    // The phone folds the long list by group: a row per labeled group, and only the sets of the groups showing.
    const groups = modularGroupsOf(modularOptions);
    const groupOpen = (group: ModularGroupSummary): boolean => this.#openGroups.get(group.id) ?? groupStartsOpen(group);
    const modularEntries = compactModularEntriesFor(modularOptions, groupOpen);
    const groupById = new Map(groups.map((group) => [group.id, { group, open: groupOpen(group) }]));

    const layout = tableSetupCompactLayout({
      width,
      height,
      difficultyIds: difficultyCards.map((c) => c.id),
      requiredModularIds: requiredSets.map((r) => r.id as string),
      candidateModularIds: modularOptions.map((o) => o.id),
      candidateModularEntries: modularEntries,
      modularHeaderRightLabel: modularRightLabel,
      // The set choices keep their rows (a name and 44px chips each); the other options follow, as before.
      optionRows: [...setChoices, ...optionRows].map((row) => ({
        id: row.id,
        height: isSetChoiceRow(row)
          ? COMPACT_SET_CHOICE_HEIGHT
          : compactOptionHeight(row.control.kind, row.control.kind === "groups" ? row.control.groups.length : 1),
      })),
      hasTowerDefenseSetupDamage: towerDefenseSetupDamageOffered,
      hoodSetIds: hoodOptions.map((o) => o.id),
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
    const hoodOptionById = new Map(hoodOptions.map((o) => [o.id, o]));
    const rowData: CompactRowData = {
      difficultyCards,
      villainName,
      requiredById,
      candidateById,
      groupById,
      modularRightLabel,
      seatCells,
      compositionRows,
      whatsInThereRows,
      nemesisStandby,
      optionById: new Map([...setChoices, ...optionRows].map((row) => [row.id, row])),
      hoodOptionById,
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

    this.#drawCompactFooter(layout, preview, players, villainName, pickedSetCount(modularOptions));

    this.#route?.set(
      tableSetupFocusOrder({
        difficulties: difficultyCards.map((c) => c.id),
        optionActions: optionActionsOf([...setChoices, ...optionRows]),
        hasTowerDefenseSetupDamage: towerDefenseSetupDamageOffered,
        modularSetIds: modularOptions.map((o) => o.id),
        modularStopIds: modularEntries.map((e) => (e.kind === "group" ? `modulargroup:${e.id}` : `modular:${e.id}`)),
        hoodSetIds: hoodOptions.map((o) => o.id),
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
        // Wraps to a second line (the row is taller for it, `stackedHeaderLabelLines`) instead of running off the
        // screen: "...ONE JOINS AT RANDOM AT SETUP" is what tells the player which sets will be in the deck.
        label(
          this,
          rect.x,
          rect.y + 2 + 26,
          data.modularRightLabel,
          typeRole.label,
          surface.ink.hex,
          ink.label,
        ).setWordWrapWidth(rect.width, true);
      }
      return;
    }
    if (id.startsWith(COMPACT_GROUP_ROW_PREFIX)) {
      const entry = data.groupById.get(id.slice(COMPACT_GROUP_ROW_PREFIX.length));
      if (entry) this.#drawCompactGroupRow(rect, entry.group, entry.open);
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
    if (id.startsWith("option:")) {
      const row = data.optionById.get(id.slice("option:".length));
      // The row's height includes the gap to the next one; the card itself stops short of it.
      const card: Rect = { ...rect, height: rect.height - COMPACT_ROW_GAP };
      if (row && isSetChoiceRow(row)) this.#drawCompactSetRow(card, row, id);
      else if (row) this.#drawOptionCard(card, row, true, id);
      return;
    }
    if (id === "towerDefenseSetupDamage") {
      const perHero = towerDefenseSetupDamagePerHero(this.#draft.difficulty);
      this.#drawCompactToggleRow(rect, {
        selected: this.#draft.towerDefenseSetupDamage,
        name: "Black Order's initial attack",
        meta: this.#draft.towerDefenseSetupDamage
          ? `Chosen · place ${perHero} damage per hero on Avengers Tower`
          : `Off · Avengers Tower starts undamaged (${perHero} per hero suggested)`,
        onClick: () => {
          this.#draft = toggleTowerDefenseSetupDamage(this.#draft);
          this.#rebuild();
        },
        stopId: "towerDefenseSetupDamage",
      });
      return;
    }
    if (id.startsWith("hoodSet:")) {
      const setId = id.slice("hoodSet:".length);
      const option = data.hoodOptionById.get(setId);
      if (option) {
        this.#drawCompactToggleRow(rect, {
          selected: option.included,
          name: option.name,
          meta: option.included
            ? `In the game · ${modularCardLabel({ selected: true, cardCount: option.cardCount, descriptor: option.descriptor })}`
            : `Set aside · ${option.cardCount} card${option.cardCount === 1 ? "" : "s"}`,
          onClick: () => {
            const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === this.#draft.scenarioId)!;
            this.#draft = toggleHoodIncludedSet(this.#draft, scenario, option.id);
            this.#rebuild();
          },
          stopId: `hoodSet:${option.id}`,
        });
      }
      return;
    }
    if (id === "header:hoodSets") {
      sectionHeader(
        this,
        rect.x,
        rect.y + 2,
        rect.width,
        "The Hood's own modular sets",
        surface.ink.hex,
        "CHOOSE 2 TO INCLUDE",
      );
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

  /** A modular group's row on the phone: its name and count at the left, Show or Hide at the right; a tap folds or unfolds the group (the words, not a glyph, say which). */
  #drawCompactGroupRow(rect: Rect, group: ModularGroupSummary, open: boolean): void {
    const h = COMPACT_GROUP_ROW_HEIGHT;
    const cellRect: Rect = { ...rect, height: h };
    const onClick = (): void => {
      this.#openGroups.set(group.id, !open);
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
    this.#stops.set(`modulargroup:${group.id}`, this.#compactStop(cellRect, onClick, `modulargroup:${group.id}`));
    const g = this.add.graphics();
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, h - 2);
    const action = label(this, 0, rect.y + h / 2, open ? "Hide" : "Show", typeRole.label, surface.ink.hex, 1);
    action.setOrigin(1, 0.5).setX(rect.x + rect.width - 12);
    const chosen = group.selectedCount > 0 ? ` · ${group.selectedCount} chosen` : "";
    const text = label(
      this,
      rect.x + 12,
      rect.y + h / 2,
      `${group.label} · ${group.count} set${group.count === 1 ? "" : "s"}${chosen}`,
      typeRole.label,
      surface.ink.hex,
      1,
    );
    text.setOrigin(0, 0.5);
    fitText(text, rect.width - 24 - action.width - 8, typeRole.label.size);
  }

  /** A candidate modular set: paper row throughout (P12's own shape — the row itself never changes; only the checkbox does), ink-filled checked box when chosen, empty when available. Toggling replaces the current pick at the scenario's own cap (`toggleModularSet` enforces it). */
  #drawCompactModularRow(rect: Rect, option: ModularSetOption): void {
    const h = COMPACT_MODULAR_ROW_HEIGHT;
    const cellRect: Rect = { ...rect, height: h };
    const barred = option.disabledReason !== null;
    const onClick = (): void => {
      if (barred) return;
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
        ...(barred ? { enabled: false, reason: option.disabledReason } : {}),
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

  /**
   * A generic checkbox row: Standard II/Expert II's single toggle, and each of The Hood's own nine modular set
   * candidates — the same paper-card/checkbox/name/meta shape `#drawCompactModularRow` draws for the ordinary
   * modular picker, but with a caller-supplied click rather than `toggleModularSet` (neither of these two toggles
   * shares that function's own draft-field/cap shape).
   */
  #drawCompactToggleRow(
    rect: Rect,
    row: {
      readonly selected: boolean;
      readonly name: string;
      readonly meta: string;
      readonly onClick: () => void;
      readonly stopId: string;
    },
  ): void {
    const h = COMPACT_MODULAR_ROW_HEIGHT;
    const cellRect: Rect = { ...rect, height: h };
    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: "",
        type: typeRole.label,
        rect: cellRect,
        onClick: row.onClick,
        clip: this.#compactClip,
        suppressClick: this.#compactSuppressClick,
      }),
    );
    this.#stops.set(row.stopId, this.#compactStop(cellRect, row.onClick, row.stopId));
    const g = this.add.graphics();
    g.fillStyle(surface.card.hex, 1).fillRect(rect.x, rect.y, rect.width, h);
    g.lineStyle(2.5, surface.ink.hex, 1).strokeRect(rect.x + 1.25, rect.y + 1.25, rect.width - 2.5, h - 2.5);
    const boxRect = this.#drawCompactCheckbox(rect, h, row.selected, surface.ink.hex);
    const textX = boxRect.x + boxRect.width + 11;
    const textWidth = rect.x + rect.width - textX - 10;
    const name = this.add.text(
      textX,
      rect.y + 11,
      row.name,
      textStyle({ ...typeRole.rowTitle, size: 13 }, surface.ink.hex),
    );
    fitText(name, textWidth, 13);
    const meta = label(this, textX, rect.y + 11 + 18, row.meta, typeRole.label, surface.ink.hex, ink.label);
    fitText(meta, textWidth, typeRole.label.size);
  }

  /** A checkbox at a row's own left edge, vertically centered — `checkedColor` is the required row's red or a candidate's ink; unchecked is always just an outline. */
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
    // The villain's starting stage reads "Stage II", never a bare numeral beside the difficulty (it read as the Standard set chip).
    const villainLabel = preview ? `${villainName} · Stage ${preview.villainStageLabel}` : villainName;
    const heroCount = players.length;
    const summary = preview
      ? `${villainLabel} · ${this.#draft.difficulty} · ${heroCount} hero${heroCount === 1 ? "" : "es"} · ${chosenModularCount} modular${chosenModularCount === 1 ? "" : "s"}`
      : `${villainName} · ${this.#draft.difficulty}`;
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
   * DIFFICULTY: equal-width cards (Heroic stays out of scope, §4), each with a real description wrapped to as many
   * lines as it needs. `slots` is how many equal slots the row has (`TableSetupLayout.difficultySlots`): the cards and,
   * when the scenario offers Standard or Expert set choices, the card that holds their chips in the spare slot
   * (`#drawSetsCard`) — the owner's 2026-10-08 decision, so those choices cost no row of their own.
   */
  #drawDifficultyRow(rect: Rect, cards: readonly DifficultyCard[], slots: number): void {
    cards.forEach((card, index) => {
      const cardRect = difficultySlotRect(rect, slots, index);
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

  /**
   * One setup-option card (`view/setup-options.ts`): the same white ground and red-border-when-chosen frame every
   * difficulty card wears (`#cardFrame`), the name at the left and its controls at the right (wide and tablet
   * portrait), or the name over its controls (phone, `compact`, inside the scroll region). A toggle is the whole card;
   * set choices and the Horsemen's sides are segmented chips (`McButton`, selected = heavy border); Gene Pool is a
   * stepper. Every control is an action string the view model applies (`applySetupOption`), so this draws and never
   * decides.
   */
  #drawOptionCard(rect: Rect, row: SetupOptionRow, compact: boolean, scrollId?: string): void {
    const stopFor = (key: string, controlRect: Rect, activate: () => void): void => {
      this.#stops.set(
        key,
        compact && scrollId ? this.#compactStop(controlRect, activate, scrollId) : { rect: controlRect, activate },
      );
    };
    const buttonOptions = compact
      ? { clip: this.#compactClip, suppressClick: this.#compactSuppressClick }
      : ({} as Record<string, never>);
    const act = (action: string) => (): void => {
      this.#draft = applySetupOption(this.#draft, action);
      this.#rebuild();
    };
    const chipButton = (chip: OptionChip, chipRect: Rect): void =>
      this.#chipButton(chip, chipRect, buttonOptions, stopFor);

    const dim = row.active ? 1 : ink.secondary;
    const control = row.control;

    if (control.kind === "toggle") {
      // The whole card is the button, made before the frame so its hover ground never covers the border.
      const onClick = act(control.action);
      this.#buttons.push(
        new McButton(this, { kind: "quiet", label: "", type: typeRole.label, rect, onClick, ...buttonOptions }),
      );
      stopFor(`option:${control.action}`, rect, onClick);
      this.#cardFrame(rect, row.active);
      this.#cardName(rect.x + 10, rect.y + 8, rect.width - 20, row.name, dim);
      this.add.text(
        rect.x + 10,
        rect.y + 8 + 22,
        row.meta,
        textStyle(typeRole.body, surface.ink.hex, row.active ? ink.secondary : ink.disabled),
      );
      return;
    }

    this.#cardFrame(rect, row.active);
    // Name zone, then control zone: side by side when there is room (a stepper and the wide cards), stacked on a phone.
    const stacked = compact && control.kind === "groups";
    const nameWidth = stacked
      ? rect.width - 20
      : control.kind === "groups" && control.groups.length > 1
        ? OPTION_GROUPS_NAME_ZONE
        : Math.min(170, rect.width * 0.4);
    const name = this.#cardName(rect.x + 10, rect.y + (stacked ? 6 : 8), nameWidth - (stacked ? 0 : 6), row.name, dim);
    if (row.meta.length > 0 && !stacked)
      this.add
        .text(
          rect.x + 10,
          rect.y + 8 + name.height + 2,
          row.meta,
          textStyle(typeRole.body, surface.ink.hex, row.active ? ink.secondary : ink.disabled),
        )
        .setWordWrapWidth(nameWidth - 6);
    const zone: Rect = stacked
      ? { x: rect.x + 8, y: rect.y + 30, width: rect.width - 16, height: rect.height - 38 }
      : { x: rect.x + nameWidth + 10, y: rect.y + 8, width: rect.width - nameWidth - 18, height: rect.height - 16 };

    if (control.kind === "stepper") {
      const buttonWidth = Math.min(48, zone.width / 3);
      const down: Rect = {
        x: zone.x + zone.width - buttonWidth * 2 - 56,
        y: zone.y,
        width: buttonWidth,
        height: zone.height,
      };
      const up: Rect = { x: zone.x + zone.width - buttonWidth, y: zone.y, width: buttonWidth, height: zone.height };
      const valueRect: Rect = {
        x: down.x + down.width,
        y: zone.y,
        width: up.x - down.x - down.width,
        height: zone.height,
      };
      chipButton(control.down, down);
      chipButton(control.up, up);
      this.add
        .text(
          valueRect.x + valueRect.width / 2,
          valueRect.y + valueRect.height / 2,
          control.valueLabel,
          textStyle({ ...typeRole.sectionHeader, size: 20 }, surface.ink.hex, row.active ? 1 : ink.secondary),
        )
        .setOrigin(0.5);
      return;
    }

    const groups = control.groups;
    if (groups.length === 1) {
      const chips = groups[0]!.chips;
      const chipWidth = Math.min(stacked ? 120 : 84, (zone.width - 6 * (chips.length - 1)) / chips.length);
      const total = chipWidth * chips.length + 6 * (chips.length - 1);
      const startX = stacked ? zone.x : zone.x + zone.width - total;
      chips.forEach((chip, index) => {
        chipButton(chip, { x: startX + index * (chipWidth + 6), y: zone.y, width: chipWidth, height: zone.height });
      });
      return;
    }

    // Several groups (the Horsemen): each Horseman's A/B pair as two full 44px chips. The label sits beside the pair when
    // the card is wide enough (one row of four), else over it (the phone's two by two, or a narrower card).
    const overChips = stacked || optionGroupsStacked(rect.width, groups.length);
    const perRow = stacked ? 2 : groups.length;
    const cellGap = 12;
    const cellWidth = (zone.width - cellGap * (perRow - 1)) / perRow;
    const cellHeight = stacked ? COMPACT_GROUP_CELL_HEIGHT : zone.height;
    groups.forEach((group, index) => {
      const column = index % perRow;
      const line = Math.floor(index / perRow);
      const cellX = zone.x + column * (cellWidth + cellGap);
      const cellY = zone.y + line * cellHeight;
      const chipSize = hit.target;
      const chipGap = 4;
      const pairWidth = overChips ? cellWidth : chipSize * 2 + chipGap;
      const chipWidth = (pairWidth - chipGap * (group.chips.length - 1)) / group.chips.length;
      const labelRect: Rect = overChips
        ? { x: cellX, y: cellY, width: cellWidth, height: 14 }
        : { x: cellX, y: cellY, width: HORSEMAN_LABEL_WIDTH, height: chipSize };
      const labelText = this.add
        .text(
          overChips ? labelRect.x : labelRect.x + labelRect.width,
          overChips ? labelRect.y : labelRect.y + (labelRect.height - typeRole.label.size) / 2 - 2,
          group.label ?? "",
          textStyle(typeRole.label, surface.ink.hex, ink.label),
        )
        .setOrigin(overChips ? 0 : 1, 0);
      fitText(labelText, labelRect.width, typeRole.label.size);
      const chipTop = overChips ? cellY + 16 : cellY;
      const chipsLeft = overChips ? cellX : cellX + HORSEMAN_LABEL_WIDTH + 4;
      group.chips.forEach((chip, chipIndex) => {
        chipButton(chip, {
          x: chipsLeft + chipIndex * (chipWidth + chipGap),
          y: chipTop,
          width: chipWidth,
          height: chipSize,
        });
      });
    });
  }

  /**
   * The Standard and Expert set choices, folded into the difficulty row's spare slot (or a strip under the cards when
   * the row has none): one line per set, its name beside (a wide slot) or over its chips, every chip a full 44px target.
   * The chips are the same action strings `applySetupOption` takes, so the choices behave as the option cards did.
   */
  #drawSetsCard(card: Rect, rows: readonly SetupOptionRow[], inline: boolean): void {
    this.#cardFrame(
      card,
      rows.some((row) => row.active),
    );
    setChoiceRowRects(card, rows.length, inline).forEach((rects, index) => {
      const row = rows[index];
      if (!row || row.control.kind !== "groups") return;
      const size = inline ? 16 : 14;
      const name = this.add.text(
        rects.name.x + 2,
        rects.name.y + (inline ? (rects.name.height - size) / 2 - 2 : -2),
        row.name,
        textStyle({ ...typeRole.sectionHeader, size }, surface.ink.hex, row.active ? 1 : ink.secondary),
      );
      fitText(name, rects.name.width - 4, size);
      const chips = row.control.groups[0]!.chips;
      const gap = 6;
      const chipWidth = Math.min(80, (rects.chips.width - gap * (chips.length - 1)) / chips.length);
      const total = chipWidth * chips.length + gap * (chips.length - 1);
      const startX = rects.chips.x + rects.chips.width - total;
      chips.forEach((chip, chipIndex) => {
        this.#chipButton(
          chip,
          { x: startX + chipIndex * (chipWidth + gap), y: rects.chips.y, width: chipWidth, height: rects.chips.height },
          {},
          (key, chipRect, activate) => this.#stops.set(key, { rect: chipRect, activate }),
        );
      });
    });
  }

  /**
   * A chip is a quiet button (hover, focus, click) under a drawn segment: ink fill and paper text when chosen, paper and
   * ink otherwise, the way the phone's difficulty segments read; never color alone. A chip that cannot be pressed (a
   * stepper at its end) is drawn but is not a button or a focus stop.
   */
  #chipButton(
    chip: OptionChip,
    chipRect: Rect,
    buttonOptions: { clip?: () => Rect | null; suppressClick?: () => boolean },
    stopFor: (key: string, controlRect: Rect, activate: () => void) => void,
  ): void {
    const onClick = (): void => {
      this.#draft = applySetupOption(this.#draft, chip.action);
      this.#rebuild();
    };
    if (chip.enabled) {
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "",
          type: typeRole.label,
          rect: chipRect,
          onClick,
          ...buttonOptions,
        }),
      );
      stopFor(`option:${chip.action}`, chipRect, onClick);
    }
    const g = this.add.graphics();
    g.fillStyle(chip.selected ? surface.ink.hex : surface.card.hex, chip.enabled ? 1 : 0.5).fillRect(
      chipRect.x,
      chipRect.y,
      chipRect.width,
      chipRect.height,
    );
    g.lineStyle(2, surface.ink.hex, chip.enabled ? 1 : ink.disabled).strokeRect(
      chipRect.x + 1,
      chipRect.y + 1,
      chipRect.width - 2,
      chipRect.height - 2,
    );
    const size = Math.max(14, Math.min(22, chipRect.height - 8));
    const text = this.add
      .text(
        chipRect.x + chipRect.width / 2,
        chipRect.y + chipRect.height / 2,
        chip.label,
        textStyle(
          { ...typeRole.sectionHeader, size },
          chip.selected ? surface.paper.hex : surface.ink.hex,
          chip.enabled ? 1 : ink.disabled,
        ),
      )
      .setOrigin(0.5);
    fitText(text, chipRect.width - 8, size);
  }

  /** A Standard / Expert set row on the phone: a framed card with the name at the left and a full 44px chip row at the right. */
  #drawCompactSetRow(card: Rect, row: SetupOptionRow, scrollId: string): void {
    if (row.control.kind !== "groups") return;
    this.#cardFrame(card, row.active);
    const nameWidth = SETS_INLINE_NAME_WIDTH;
    const name = this.#cardName(
      card.x + 10,
      card.y + (card.height - 22) / 2,
      nameWidth - 10,
      row.name,
      row.active ? 1 : ink.secondary,
    );
    name.setFontSize(16);
    fitText(name, nameWidth - 10, 16);
    const chips = row.control.groups[0]!.chips;
    const zone: Rect = {
      x: card.x + nameWidth,
      y: card.y + (card.height - hit.target) / 2,
      width: card.width - nameWidth - 8,
      height: hit.target,
    };
    const gap = 6;
    const chipWidth = Math.min(80, (zone.width - gap * (chips.length - 1)) / chips.length);
    const total = chipWidth * chips.length + gap * (chips.length - 1);
    chips.forEach((chip, index) => {
      this.#chipButton(
        chip,
        {
          x: zone.x + zone.width - total + index * (chipWidth + gap),
          y: zone.y,
          width: chipWidth,
          height: zone.height,
        },
        { clip: this.#compactClip, suppressClick: this.#compactSuppressClick },
        (key, chipRect, activate) => this.#stops.set(key, this.#compactStop(chipRect, activate, scrollId)),
      );
    });
  }

  /** A card's name in the same Bangers size as the difficulty cards'. */
  #cardName(x: number, y: number, width: number, text: string, alpha: number): Phaser.GameObjects.Text {
    const name = this.add.text(x, y, text, textStyle({ ...typeRole.sectionHeader, size: 18 }, surface.ink.hex, alpha));
    fitText(name, width, 18);
    return name;
  }

  /**
   * Tower Defense's own "Modular Difficulty" (MC21 p. 11, docs/phase7-wave4.md §4 Q4), wide layout: the same
   * plain on/off card `#drawAlternateDifficultySetsRow` draws — a single full-width toggle, off by default,
   * labeled with the rulebook's own framing rather than a bare flag name.
   */
  #drawTowerDefenseDamageRow(rect: Rect): void {
    const selected = this.#draft.towerDefenseSetupDamage;
    const perHero = towerDefenseSetupDamagePerHero(this.#draft.difficulty);
    const onClick = (): void => {
      this.#draft = toggleTowerDefenseSetupDamage(this.#draft);
      this.#rebuild();
    };
    this.#buttons.push(new McButton(this, { kind: "quiet", label: "", type: typeRole.label, rect, onClick }));
    this.#stops.set("towerDefenseSetupDamage", { rect, activate: onClick });
    this.#cardFrame(rect, selected);
    const name = this.add.text(
      rect.x + 10,
      rect.y + 8,
      "Black Order's initial attack",
      textStyle({ ...typeRole.sectionHeader, size: 18 }, surface.ink.hex, selected ? 1 : ink.disabled),
    );
    fitText(name, rect.width - 20, 18);
    this.add.text(
      rect.x + 10,
      rect.y + 8 + 22,
      selected
        ? `Chosen · place ${perHero} damage per hero on Avengers Tower`
        : `Off · Avengers Tower starts undamaged (${perHero} per hero suggested)`,
      textStyle(typeRole.body, surface.ink.hex, selected ? ink.secondary : ink.disabled),
    );
  }

  /**
   * The Hood's own "choose which modular sets are in" (docs/phase7-wave4.md §2.3, §3.18), wide layout: the same
   * card grid `#drawModularGrid` draws for the ordinary modular picker, one card per candidate — `option.included`
   * stands in for `ModularSetOption.selected`, and toggling calls `toggleHoodIncludedSet` instead of
   * `toggleModularSet` (neither shares the ordinary picker's draft-field/cap shape).
   */
  #drawHoodModularGrid(layout: TableSetupLayout, options: readonly HoodModularSetOption[]): void {
    const rect = layout.hoodGrid;
    const columns = layout.hoodColumns;
    const gap = ROW_GAP;
    const cellHeight =
      layout.hoodRows > 0 ? (rect.height - (layout.hoodRows - 1) * gap) / layout.hoodRows : rect.height;
    const cellWidth = (rect.width - (columns - 1) * gap) / columns;
    options.forEach((option, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const cellRect: Rect = {
        x: rect.x + col * (cellWidth + gap),
        y: rect.y + row * (cellHeight + gap),
        width: cellWidth,
        height: cellHeight,
      };
      this.#drawHoodModularCard(cellRect, option);
    });
  }

  /** One of The Hood's own candidates: white, included = 4px red border, set aside = dim border + dim text — the same shape `#drawModularCard` uses for the ordinary picker. */
  #drawHoodModularCard(rect: Rect, option: HoodModularSetOption): void {
    const onClick = (): void => {
      const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === this.#draft.scenarioId)!;
      this.#draft = toggleHoodIncludedSet(this.#draft, scenario, option.id);
      this.#rebuild();
    };
    this.#buttons.push(new McButton(this, { kind: "quiet", label: "", type: typeRole.label, rect, onClick }));
    this.#stops.set(`hoodSet:${option.id}`, { rect, activate: onClick });
    this.#cardFrame(rect, option.included);
    const dim = option.included ? 1 : ink.disabled;
    const name = this.add.text(
      rect.x + 10,
      rect.y + 8,
      option.name,
      textStyle({ ...typeRole.sectionHeader, size: 15 }, surface.ink.hex, dim),
    );
    fitText(name, rect.width - 20, 15);
    const metaText = option.included
      ? modularCardLabel({ selected: true, cardCount: option.cardCount, descriptor: option.descriptor })
      : `Set aside · ${option.cardCount} card${option.cardCount === 1 ? "" : "s"}`;
    this.#drawModularCardLabel(
      rect,
      rect.y + 8 + name.height + 4,
      metaText.toUpperCase(),
      surface.ink.hex,
      option.included ? ink.label : ink.disabled,
    );
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

  /**
   * MODULAR SETS: the scenario's own required set(s) first (ink-filled, not toggleable), then every candidate group by
   * group, each group under a small label. The layout planned every tile (`layout.modularPlan`); when the groups are
   * taller than the panel the whole plan is drawn inside a scroll region the size of the panel.
   */
  #drawModularGrid(
    layout: TableSetupLayout,
    requiredSets: readonly RequiredEncounterSet[],
    options: readonly ModularSetOption[],
    scenario: Scenario,
  ): void {
    const rect = layout.modularGrid;
    const plan = layout.modularPlan;
    const villainName = scenarioDetailOf(scenario, CARDS_BY_ID, POOL_ENCOUNTER_SETS).displayName;
    this.#modularRowOfItem = plan.rowOfItem;

    const cellAt = (index: number): Rect => {
      const cell = plan.cells[index]!;
      return { x: rect.x + cell.x, y: rect.y + cell.y, width: cell.width, height: cell.height };
    };

    const draw = (): void => {
      let index = 0;
      for (const required of requiredSets) {
        this.#drawRequiredModularCard(cellAt(index), required, villainName);
        index += 1;
      }
      for (const header of plan.headers) {
        const text = label(
          this,
          rect.x + header.rect.x,
          rect.y + header.rect.y,
          header.label,
          typeRole.label,
          // Tablet portrait's whole ground is ink, so the label is paper there.
          layout.wide ? surface.ink.hex : surface.paper.hex,
          ink.label,
        );
        fitText(text, header.rect.width, typeRole.label.size);
      }
      for (const option of options) {
        this.#drawModularCard(cellAt(index), option, layout.modularScrolls ? index : null);
        index += 1;
      }
    };

    if (!layout.modularScrolls) {
      draw();
      return;
    }
    this.#modularViewportRect = rect;
    this.#modularRegion = new McScrollRegion(this, {
      rect,
      heights: plan.rowHeights,
      scroll: this.#modularScroll,
    });
    this.#captureInto(this.#modularRegion.content, draw);
  }

  #modularClip = (): Rect | null => this.#modularRegion?.rect ?? null;
  #modularSuppressClick = (): boolean => this.#modularRegion?.isDragSuppressingClick ?? false;

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

  /**
   * A candidate modular set: white, chosen = 4px red border, available = dim border + dim text, barred = dim with its
   * reason where the count goes. Toggling replaces the current pick at the scenario's own cap (`toggleModularSet`
   * enforces it). `scrollItem` is the tile's place in a scrolling grid (null when the grid does not scroll): its
   * focus stop then tracks the scroll offset and scrolls itself into view when focus lands on it.
   */
  #drawModularCard(rect: Rect, option: ModularSetOption, scrollItem: number | null): void {
    const barred = option.disabledReason !== null;
    const onClick = (): void => {
      if (barred) return;
      const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === this.#draft.scenarioId)!;
      this.#draft = toggleModularSet(this.#draft, scenario, option.id);
      this.#rebuild();
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: "",
        type: typeRole.label,
        rect,
        onClick,
        ...(barred ? { enabled: false, reason: option.disabledReason } : {}),
        ...(scrollItem !== null ? { clip: this.#modularClip, suppressClick: this.#modularSuppressClick } : {}),
      }),
    );
    this.#stops.set(
      `modular:${option.id}`,
      scrollItem === null
        ? { rect, activate: onClick }
        : {
            rect: () => ({ ...rect, y: rect.y - this.#modularScroll.offsetPx }),
            activate: onClick,
            ensureVisible: () => {
              const row = this.#modularRowOfItem[scrollItem];
              if (row !== undefined) this.#modularRegion?.scrollIntoView(row);
            },
          },
    );
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
      const rowLabel = label(this, rect.x, y + 2, row.label, typeRole.label, surface.paper.hex, ink.label);
      const value = this.add
        .text(rect.x + rect.width, y, row.value, textStyle({ ...typeRole.emphasis, weight: 700 }, surface.paper.hex))
        .setOrigin(1, 0);
      // Whatever the label leaves, never less than the old 60%: a long value keeps its size instead of shrinking.
      fitText(value, Math.max(rect.width * 0.6, rect.width - rowLabel.width - 10), typeRole.emphasis.size);
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
    await store.start(
      toSessionConfig(
        this.#draft,
        players,
        POOL_SCENARIOS.find((s) => (s.id as string) === this.#draft.scenarioId),
        tableRulesOf(appSession().settings),
      ),
    );

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

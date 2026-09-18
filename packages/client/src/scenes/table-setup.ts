/**
 * Table setup (docs/phase4-screen-gaps.md §3 W2, D05/P12): Standard/Expert
 * (/Extreme), the modular set picker, seating and first player (with a
 * deterministic "Random"), "the encounter deck you're building" (S3) and "the
 * game you'll get" (`view/table-setup-preview.ts`), the seed with Reroll, and
 * "Deal it out" — this is what actually starts the engine.
 */
import Phaser from "phaser";
import type { Deck } from "@mc/content";
import { buildScenario, CARDS_BY_ID, POOL_CARDS, POOL_DEPS, POOL_ENCOUNTER_SETS, POOL_SCENARIOS, POOL_VERSION } from "../content/pool.js";
import { dotGrid, ink, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTextInput, label, paintDotGrid } from "../ui/widgets.js";
import { deckOptionsOf, type DeckOption } from "../view/deck-list-model.js";
import { corePlayerForSeat } from "../view/deck-seat.js";
import { modularSetOptionsFor, toggleModularSet } from "../view/modular-sets.js";
import { parseSeed, rollFirstPlayerIndex } from "../view/seed.js";
import { encounterDeckPreviewLines, gamePreviewLines, tableSetupPreviewOf } from "../view/table-setup-preview.js";
import { difficultyOptionsFor, setDifficulty, setFirstPlayerIndex, setSeed, rerollSeed, toSessionConfig, type SetupDraft } from "../view/setup-draft.js";
import { LABEL_ROOM, setupColumnWidth } from "../view/setup-metrics.js";
import { tableSetupFocusOrder } from "../view/screen-focus.js";
import { tableSetupLayout } from "../view/table-setup-layout.js";
import { drawChipStrip, drawChoiceRow, type ChoiceCell } from "./roster-panel.js";
import { wrapChipsToRows } from "../view/chip-layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { appSession, deckStorage } from "../session.js";
import type { DecksSceneData } from "./decks.js";
import type { SeatsData } from "./seats.js";

export interface TableSetupData {
  readonly draft: SetupDraft;
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
    const difficultyChoices = difficultyOptionsFor(scenario);

    const deckOptions = this.#deckOptions();
    const seatedOptions = this.#draft.seats.map((deckId) => deckOptions.find((o) => (o.deck.id as string) === deckId)).filter((o): o is DeckOption => o !== undefined);
    const players = seatedOptions.map(corePlayerForSeat);

    const modularOptions = modularSetOptionsFor(this.#draft, scenario);
    const chipColumn = setupColumnWidth(width, height);
    const modularCells: readonly ChoiceCell[] = modularOptions.map((option) => ({
      id: option.id,
      text: option.recommended ? `${option.name} ★` : option.name,
      selected: option.selected,
      onClick: () => {
        this.#draft = toggleModularSet(this.#draft, scenario, option.id);
        this.#rebuild();
      },
    }));
    const modularRows = wrapChipsToRows(modularCells, chipColumn);

    let encounterLines: readonly string[] = [];
    let gameLines: readonly string[] = [];
    if (players.length > 0) {
      const config = buildScenario(this.#draft.scenarioId, toSessionConfig(this.#draft, players));
      const preview = tableSetupPreviewOf(config, scenario, this.#draft.difficulty, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
      encounterLines = encounterDeckPreviewLines(preview.encounterDeck);
      gameLines = gamePreviewLines(preview);
    }

    const layout = tableSetupLayout({
      width,
      height,
      difficultyCount: difficultyChoices.length,
      modularRows: modularRows.length,
      encounterLines: Math.max(1, encounterLines.length),
      gameLines: Math.max(1, gameLines.length),
    });
    // Ground: paper body panel beside a persistent ink sidebar on tablet/desktop; on phone there's no split
    // (`title-menu-layout.ts`'s own doc comment on why), so the whole content area is ink instead — the sidebar's
    // own rect already covers it (`table-setup-layout.ts`'s `sizingFor`), so the paper panel is simply skipped
    // rather than painted and then covered.
    if (layout.split) {
      this.add.rectangle(layout.bodyPanel.x, layout.bodyPanel.y, layout.bodyPanel.width, layout.bodyPanel.height, surface.paper.hex).setOrigin(0, 0);
      paintDotGrid(this, layout.bodyPanel, "paper", dotGrid.onPaper);
    }
    this.add.rectangle(layout.sidebar.x, layout.sidebar.y, layout.sidebar.width, layout.sidebar.height, surface.ink.hex).setOrigin(0, 0);
    this.add.rectangle(layout.headerBar.x, layout.headerBar.y, layout.headerBar.width, layout.headerBar.height, surface.ink.hex).setOrigin(0, 0);

    const back = (): void => this.#back();
    this.#buttons.push(new McButton(this, { kind: "onInk", label: "◂ Back", type: typeRole.rowTitle, rect: layout.back, onClick: back, enabled: !this.#starting }));
    this.#stops.set("back", { rect: layout.back, activate: back });
    this.add.text(layout.back.x + layout.back.width + 12, layout.headerBar.height / 2, "Set the table", textStyle(typeRole.rowTitle, surface.paper.hex)).setOrigin(0, 0.5);
    this.add.text(layout.step.x + layout.step.width, layout.headerBar.height / 2, "STEP 4 OF 4", textStyle(typeRole.label, surface.paper.hex, ink.label)).setOrigin(1, 0.5);

    // Phone has no paper/ink split (`title-menu-layout.ts`'s own doc comment on why: no room for two columns), so
    // the body panel itself is ink there — every label and toggle drawn "for the paper body" has to read on
    // whichever ground it's actually on, the same `surface.paper` "text color on dark grounds" rule the header bar
    // and Title's own phone layout already use.
    const bodyTextColor = layout.split ? surface.ink.hex : surface.paper.hex;
    const bodyKind = layout.split ? "secondary" : "onInk";

    label(this, layout.left, layout.difficulty.y - LABEL_ROOM, "Difficulty", typeRole.label, bodyTextColor, ink.label);
    drawChoiceRow(
      this,
      layout.difficulty,
      difficultyChoices.map((difficulty) => ({
        id: difficulty,
        text: difficulty,
        selected: this.#draft.difficulty === difficulty,
        onClick: () => {
          this.#draft = setDifficulty(this.#draft, difficulty);
          this.#rebuild();
        },
      })),
      "difficulty",
      this.#buttons,
      this.#stops,
      bodyKind,
    );

    label(this, layout.left, layout.modular.y - LABEL_ROOM, `Modular sets (choose ${scenario.modularSetCount ?? 1})`, typeRole.label, bodyTextColor, ink.label);
    drawChipStrip(this, layout.modular, modularRows, "modular", this.#buttons, this.#stops, "onInk");

    label(this, layout.left, layout.seating.y - LABEL_ROOM, "First player", typeRole.label, bodyTextColor, ink.label);
    const seatCells: ChoiceCell[] = this.#draft.seats.map((deckId, index) => {
      const option = deckOptions.find((o) => (o.deck.id as string) === deckId);
      return {
        id: `${index}`,
        text: `Seat ${index + 1}${option ? ` · ${option.identityName ?? ""}` : ""}`,
        selected: this.#draft.firstPlayerIndex === index,
        onClick: () => {
          this.#draft = setFirstPlayerIndex(this.#draft, index);
          this.#rebuild();
        },
      };
    });
    const randomCell: ChoiceCell = {
      id: "random",
      text: "Random",
      selected: false,
      onClick: () => {
        this.#draft = setFirstPlayerIndex(this.#draft, rollFirstPlayerIndex(this.#draft.seed, this.#draft.seats.length));
        this.#rebuild();
      },
    };
    drawChoiceRow(this, layout.seating, [...seatCells, randomCell], "first-player", this.#buttons, this.#stops, bodyKind);

    // The sidebar's own headings ("THE ENCOUNTER DECK YOU'RE BUILDING", "THE GAME YOU'LL GET") — paper text on its ink ground.
    label(this, layout.encounterPreview.x, layout.encounterPreview.y - LABEL_ROOM, "The encounter deck you're building", typeRole.label, surface.paper.hex, ink.label);
    encounterLines.forEach((line, index) => {
      this.add.text(layout.encounterPreview.x, layout.encounterPreview.y + index * 18, line, textStyle(typeRole.label, surface.paper.hex, ink.label));
    });
    label(this, layout.gamePreview.x, layout.gamePreview.y - LABEL_ROOM, "The game you'll get", typeRole.label, surface.paper.hex, ink.label);
    gameLines.forEach((line, index) => {
      this.add.text(layout.gamePreview.x, layout.gamePreview.y + index * 18, line, textStyle(typeRole.body, surface.paper.hex));
    });

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
    this.#buttons.push(new McButton(this, { kind: "quiet", label: "Reroll", type: typeRole.label, rect: layout.reroll, onClick: reroll }));
    this.#stops.set("reroll", { rect: layout.reroll, activate: reroll });

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

    this.#status = this.add.text(layout.left, layout.dealItOut.y - 22, "", textStyle(typeRole.body, surface.ink.hex));

    this.#route?.set(
      tableSetupFocusOrder({
        difficulties: difficultyChoices,
        modularSetIds: modularCells.map((c) => c.id),
        firstPlayerOptionIds: [...seatCells.map((c) => c.id), "random"],
      }),
      this.#stops,
    );
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
    this.scene.start(SCENES.board);
  }
}

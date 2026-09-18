/**
 * Take your seats (docs/phase4-screen-gaps.md §3 W2, D03/P03/T-P02): up to
 * four fixed seat slots above a searchable/scrollable roster (S8) of every
 * precon, saved and imported deck, a hero detail panel (obligation, nemesis
 * set), "Use preconstructed for all seats", a "Deck check ▸" hook (routed
 * straight to Table setup until W1's Deck check scene lands), and "Take these
 * seats ▸".
 */
import Phaser from "phaser";
import type { CardId, Deck } from "@mc/content";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS, POOL_ENCOUNTER_SETS, POOL_SCENARIOS, POOL_VERSION } from "../content/pool.js";
import { dotGrid, ink, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTextInput, label, paintDotGrid, paintPanel } from "../ui/widgets.js";
import { McVirtualList } from "../ui/virtual-list.js";
import { ListScroll } from "../view/list-scroll.js";
import { deckOptionsOf, type DeckOption } from "../view/deck-list-model.js";
import { heroAspectsOf, heroRosterMatches, withSelectionPinned, type DeckSourceKind } from "../view/roster-filter.js";
import { wrapChipsToRows } from "../view/chip-layout.js";
import { seatOptions, type SeatOption } from "../view/seats.js";
import { heroCandidateDetailOf, seatSlotsOf } from "../view/seat-slots.js";
import {
  addSeat,
  clearHeroFilter,
  pruneSeats,
  removeSeat,
  setHeroFilter,
  usePreconstructedForAllSeats,
  type SetupDraft,
} from "../view/setup-draft.js";
import { LABEL_ROOM, setupColumnWidth } from "../view/setup-metrics.js";
import { seatsFocusOrder } from "../view/screen-focus.js";
import { seatsLayout } from "../view/seats-layout.js";
import { drawChipStrip, drawRosterList, drawSearchField, type RosterRow } from "./roster-panel.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { DeckCheckSceneData } from "./deck-check.js";
import { deckStorage } from "../session.js";
import type { ScenarioSelectData } from "./scenario-select.js";
import type { TableSetupData } from "./table-setup.js";

export interface SeatsData {
  readonly draft: SetupDraft;
  /** Decks to list before `deckStorage().list()` resolves — "Play this deck ▸" (W9) seeds the one it seats. */
  readonly seedDecks?: readonly Deck[];
}

/**
 * "Deck check ▸" opens W1's Deck check over seat 1's deck (docs/phase4-screen-gaps.md §3 W1: "reached per seat
 * from the setup flow"), with Back returning here and its "Start game ▸" continuing to Table setup. With no
 * seated deck to check (or before the deck list has loaded), it goes straight to Table setup.
 */
function goToDeckCheckOrTableSetup(scene: Phaser.Scene, draft: SetupDraft, deckOptions: readonly DeckOption[]): void {
  const toTableSetup = (from: Phaser.Scene): void => {
    from.scene.start(SCENES.setup, { draft } satisfies TableSetupData);
  };
  const seated = deckOptions.find((option) => (option.deck.id as string) === draft.seats[0]);
  if (!seated) {
    toTableSetup(scene);
    return;
  }
  scene.scene.start(SCENES.deckCheck, {
    deck: seated.deck,
    returnTo: { scene: SCENES.seats, data: { draft } satisfies SeatsData },
    onStartGame: toTableSetup,
  } satisfies DeckCheckSceneData);
}

export class SeatsScene extends Phaser.Scene {
  #draft!: SetupDraft;
  #savedDecks: readonly Deck[] = [];
  /** Which roster row's stats/obligation/nemesis the detail panel shows — the last one clicked, defaulting to the first seated deck. */
  #detailDeckId: string | null = null;
  #buttons: McButton[] = [];
  #stops = new Map<string, FocusStop>();
  #searchInput: McTextInput | null = null;
  #list: McVirtualList | null = null;
  #scroll = new ListScroll();
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.seats);
  }

  #seedDecks: readonly Deck[] = [];

  init(data: SeatsData): void {
    this.#draft = data.draft;
    this.#seedDecks = data.seedDecks ?? [];
    this.#detailDeckId = data.draft.seats[0] ?? null;
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
    this.#savedDecks = this.#seedDecks;
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
    this.scale.off("resize", this.#rebuild, this);
    this.scene.start(SCENES.scenarioSelect, { draft: this.#draft } satisfies ScenarioSelectData);
  }

  #deckOptions(): readonly DeckOption[] {
    return deckOptionsOf(this.#savedDecks, POOL_CARDS, POOL_VERSION, POOL_DEPS);
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
    const deckOptions = this.#deckOptions();
    this.#draft = pruneSeats(this.#draft, new Set(deckOptions.map((o) => o.deck.id as string)), deckOptions[0]?.deck.id as string);
    if (this.#detailDeckId === null || !deckOptions.some((o) => (o.deck.id as string) === this.#detailDeckId)) {
      this.#detailDeckId = this.#draft.seats[0] ?? deckOptions[0]?.deck.id ?? null;
    }

    const chipColumn = setupColumnWidth(width, height);
    const chipDefs = this.#heroChipDefs(deckOptions);
    const chipRows = wrapChipsToRows(chipDefs, chipColumn);

    const detailOption = deckOptions.find((o) => (o.deck.id as string) === this.#detailDeckId);
    const detailLines = detailOption ? this.#detailLinesFor(detailOption) : ["Select a hero to see their details."];

    const layout = seatsLayout({ width, height, chipRows: chipRows.length, detailLines: detailLines.length });

    // Ground: paper body under the same full-width ink header bar Scenario select uses.
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    paintDotGrid(this, { x: 0, y: layout.headerBar.height, width, height: height - layout.headerBar.height }, "paper", dotGrid.onPaper);
    this.add.rectangle(layout.headerBar.x, layout.headerBar.y, layout.headerBar.width, layout.headerBar.height, surface.ink.hex).setOrigin(0, 0);

    const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === this.#draft.scenarioId);
    const back = (): void => this.#back();
    this.#buttons.push(new McButton(this, { kind: "onInk", label: `◂ ${scenario?.name ?? "Back"}`, type: typeRole.rowTitle, rect: layout.back, onClick: back }));
    this.#stops.set("back", { rect: layout.back, activate: back });
    this.add
      .text(layout.back.x + layout.back.width + 12, layout.headerBar.height / 2, "Take your seats", textStyle(typeRole.rowTitle, surface.paper.hex))
      .setOrigin(0, 0.5);
    this.add
      .text(layout.step.x + layout.step.width, layout.headerBar.height / 2, `STEP 2 OF 4 · ${this.#draft.seats.length} SEAT${this.#draft.seats.length === 1 ? "" : "S"} FILLED`, textStyle(typeRole.label, surface.paper.hex, ink.label))
      .setOrigin(1, 0.5);

    const seating = new Map(seatOptions(deckOptions, this.#draft.seats, CARDS_BY_ID).map((o) => [o.deckId, o]));
    const slots = seatSlotsOf(this.#draft.seats, deckOptions, CARDS_BY_ID);
    slots.forEach((slot, index) => {
      const rect = layout.seatSlots[index]!;
      const g = this.add.graphics();
      const occupiedState = slot.deckId ? (index === 0 ? "selected" : "rest") : "unavailable";
      paintPanel(g, rect, "card", occupiedState);
      const text = slot.deckId
        ? `SEAT ${index + 1}${index === 0 ? " · YOU" : ""}\n${slot.identityName ?? "?"}\n${slot.aspectLabel ?? ""} · HP ${slot.hp ?? "—"} · hand ${slot.handSize ?? "—"}`
        : `SEAT ${index + 1}\nEmpty — tap a hero below`;
      this.add.text(rect.x + 6, rect.y + 6, text, textStyle(typeRole.label, surface.ink.hex, slot.deckId ? 1 : ink.meta)).setWordWrapWidth(rect.width - 12);
    });

    const usePreconstructed = (): void => {
      this.#draft = usePreconstructedForAllSeats(this.#draft, deckOptions);
      this.#rebuild();
    };
    this.#buttons.push(new McButton(this, { kind: "quiet", label: "Use preconstructed for all seats", type: typeRole.label, rect: layout.usePreconstructed, onClick: usePreconstructed }));
    this.#stops.set("use-preconstructed", { rect: layout.usePreconstructed, activate: usePreconstructed });

    label(this, layout.left, layout.search.y - LABEL_ROOM, `Heroes — ${this.#draft.seats.length} seat${this.#draft.seats.length === 1 ? "" : "s"}, all played by you`, typeRole.label, surface.ink.hex, ink.label);
    const rows = this.#rows(deckOptions, seating);
    this.#searchInput = drawSearchField(
      this,
      layout.search,
      "hero-search",
      this.#draft.heroFilter.text,
      "search heroes, aspects, decks…",
      (value) => {
        this.#draft = setHeroFilter(this.#draft, { ...this.#draft.heroFilter, text: value });
        this.#scroll.reset();
        this.#rebuild();
      },
      this.#searchInput,
      this.#stops,
    );
    drawChipStrip(this, layout.chips, chipRows, "hero-chip", this.#buttons, this.#stops);
    this.#list = drawRosterList(
      this,
      layout.list,
      rows,
      this.#scroll,
      "hero",
      () => {
        this.#draft = clearHeroFilter(this.#draft);
        this.#searchInput?.setValue("");
        this.#rebuild();
      },
      this.#buttons,
      this.#stops,
      (row) => this.#inspectRow(row),
    );

    // The hero-detail panel — dark, matching D03's own sidebar, rather than plain text on the paper ground.
    this.add.rectangle(layout.detail.x, layout.detail.y, layout.detail.width, layout.detail.height, surface.ink.hex).setOrigin(0, 0);
    detailLines.forEach((line, index) => {
      this.add.text(layout.detail.x + 12, layout.detail.y + 8 + index * 20, line, textStyle(typeRole.body, surface.paper.hex));
    });

    // One red CTA (docs/design-renders/ScreensPhone_00.png's own "DECK CHECK ▸"): this build's hook routes it
    // straight to Table setup until W1's Deck check scene lands (`goToDeckCheckOrTableSetup`).
    const deckCheck = (): void => goToDeckCheckOrTableSetup(this, this.#draft, this.#deckOptions());
    this.#buttons.push(new McButton(this, { kind: "primary", label: "Deck check ▸", type: typeRole.barTitle, rect: layout.deckCheck, onClick: deckCheck }));
    this.#stops.set("deck-check", { rect: layout.deckCheck, activate: deckCheck });

    this.#route?.set(seatsFocusOrder({ deckIds: rows.map((r) => r.id), heroChipIds: chipDefs.map((c) => c.id) }), this.#stops);
  }

  #detailLinesFor(option: DeckOption): readonly string[] {
    const detail = heroCandidateDetailOf(option, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    return [
      `${detail.identityName} — ${detail.aspectLabel}`,
      `HP ${detail.hp ?? "—"} · Hand ${detail.handSize ?? "—"} · THW ${detail.thw ?? "—"} / ATK ${detail.atk ?? "—"} / DEF ${detail.def ?? "—"}`,
      `Obligation: ${detail.obligationName ?? "none"}`,
      `Nemesis set: ${detail.nemesisSetName ?? "none"}`,
    ];
  }

  #rows(deckOptions: readonly DeckOption[], seating: ReadonlyMap<string, SeatOption>): readonly RosterRow[] {
    return withSelectionPinned(
      deckOptions,
      (option) => heroRosterMatches(option.deck, CARDS_BY_ID.get(option.deck.identityCardId as string), this.#draft.heroFilter, seating.get(option.deck.id as string)?.blockedBy ?? null),
      (option) => this.#draft.seats.includes(option.deck.id as string),
    ).map((option) => {
      const deckId = option.deck.id as string;
      const seated = this.#draft.seats.includes(deckId);
      const blockedBy = seating.get(deckId)?.blockedBy ?? null;
      const warning = seating.get(deckId)?.warning ?? null;
      const sourceText = option.deck.source.kind === "precon" ? "Precon" : option.deck.source.kind === "imported" ? "Imported" : "Built";
      return {
        id: deckId,
        title: option.deck.name.split(" — ")[0]!,
        subtitle: `${sourceText} · ${option.identityName ?? "unknown identity"}`,
        selected: seated,
        blockedBy,
        warning,
        onClick: () => {
          this.#detailDeckId = deckId;
          this.#draft = seated ? removeSeat(this.#draft, deckId) : blockedBy ? this.#draft : addSeat(this.#draft, deckId);
          this.#rebuild();
        },
        inspectCardId: option.deck.identityCardId,
        chooseLabel: seated ? "Remove this seat" : "Take this seat",
      };
    });
  }

  #heroChipDefs(deckOptions: readonly DeckOption[]): readonly { id: string; text: string; selected: boolean; onClick: () => void }[] {
    const aspectChips = heroAspectsOf(deckOptions.map((option) => option.deck)).map((aspect) => ({
      id: `aspect:${aspect}`,
      text: aspect,
      selected: this.#draft.heroFilter.aspect === aspect,
      onClick: () => {
        this.#draft = setHeroFilter(this.#draft, { ...this.#draft.heroFilter, aspect: this.#draft.heroFilter.aspect === aspect ? null : aspect });
        this.#scroll.reset();
        this.#rebuild();
      },
    }));
    const sources: readonly { kind: DeckSourceKind; text: string }[] = [
      { kind: "precon", text: "Precon" },
      { kind: "imported", text: "Imported" },
      { kind: "userBuilt", text: "Built" },
    ];
    const sourceChips = sources.map(({ kind, text }) => ({
      id: `source:${kind}`,
      text,
      selected: this.#draft.heroFilter.source === kind,
      onClick: () => {
        this.#draft = setHeroFilter(this.#draft, { ...this.#draft.heroFilter, source: this.#draft.heroFilter.source === kind ? null : kind });
        this.#scroll.reset();
        this.#rebuild();
      },
    }));
    const playableChip = {
      id: "playable-now",
      text: "Playable now",
      selected: this.#draft.heroFilter.playableOnly === true,
      onClick: () => {
        this.#draft = setHeroFilter(this.#draft, { ...this.#draft.heroFilter, playableOnly: !this.#draft.heroFilter.playableOnly });
        this.#scroll.reset();
        this.#rebuild();
      },
    };
    return [...aspectChips, ...sourceChips, playableChip];
  }

  #onInspectChoose(rowId: string): void {
    const deckOptions = this.#deckOptions();
    const seating = new Map(seatOptions(deckOptions, this.#draft.seats, CARDS_BY_ID).map((o) => [o.deckId, o]));
    const row = this.#rows(deckOptions, seating).find((r) => r.id === rowId);
    if (row && !row.blockedBy) row.onClick();
  }

  #inspectRow(row: RosterRow): void {
    if (!row.inspectCardId) return;
    const card = CARDS_BY_ID.get(row.inspectCardId as string);
    const face = card?.type === "villain" ? ({ kind: "villainStage", sideIndex: 0, stageIndex: 0 } as const) : ({ kind: "hero" } as const);
    this.scene.launch(SCENES.inspect, {
      card: { cardId: row.inspectCardId as CardId, face },
      ...(row.blockedBy ? { note: row.blockedBy } : { choice: { optionId: row.id, label: row.chooseLabel } }),
    });
  }
}

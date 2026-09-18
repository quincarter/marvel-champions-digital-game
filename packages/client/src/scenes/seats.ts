/**
 * Take your seats (docs/phase4-screen-gaps.md §3 W2/W2b, D03/P03/T-P02): four
 * selectable seat cards over an **active-seat model** — clicking a seat makes
 * it active, and the pack-shelf hero roster (S8, the owner's pack-shelves
 * decision) picks a hero *for the active seat* (`view/setup-draft.ts`'s
 * `setActiveSeat`/`assignToActiveSeat`) — a hero detail panel (obligation,
 * nemesis), "Use preconstructed for all seats", "Play N heroes ▸" straight to
 * Table setup, and "Deck check ▸" into W1's Deck check for the *active*
 * seat's own deck (Back returns here, "Start game ▸" continues to Table
 * setup).
 *
 * **The bug this rebuild fixes:** the previous version hardcoded seat 1 both
 * in what the roster clicked into (`onClick` always called `addSeat`/`removeSeat`
 * by deck id, with no notion of "which seat") and in what "Deck check ▸"
 * opened (`draft.seats[0]`, unconditionally). Every seat is now a real,
 * independently selectable and deck-checkable target.
 */
import Phaser from "phaser";
import type { CardId, Deck } from "@mc/content";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS, POOL_ENCOUNTER_SETS, POOL_PACKS, POOL_SCENARIOS, POOL_VERSION, packNameOf } from "../content/pool.js";
import { artFor } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { dotGrid, ink, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTextInput, label, paintDotGrid } from "../ui/widgets.js";
import { McShelfRoster } from "../ui/shelf-roster.js";
import { deckOptionsOf, type DeckOption } from "../view/deck-list-model.js";
import { heroAspectsOf, withSelectionPinned, type DeckSourceKind } from "../view/roster-filter.js";
import { wrapChipsToRows } from "../view/chip-layout.js";
import { shelvesOf, flattenShelves, type ShelfCandidate } from "../view/roster-shelves.js";
import { seatOptions } from "../view/seats.js";
import { activeSeatRosterOf, heroCandidateDetailOf, seatSlotsOf } from "../view/seat-slots.js";
import {
  assignToActiveSeat,
  clearHeroFilter,
  pruneSeats,
  setActiveSeat,
  setHeroFilter,
  usePreconstructedForAllSeats,
  type SetupDraft,
} from "../view/setup-draft.js";
import { seatsFocusOrder } from "../view/screen-focus.js";
import { seatsLayout, detailPanelWidthFor, MAX_SEATS } from "../view/seats-layout.js";
import { estimateWrappedLines } from "../view/layout.js";
import { drawChipStrip, drawSearchField, drawShelfRosterPanel, renderShelfCard, renderShelfHeader } from "./roster-panel.js";
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

const CARD_METRICS = { cardWidth: 140, cardHeight: 200, cardGap: 10, headerHeight: 24, headerToCardsGap: 6, shelfGap: 16 };
/** Matches `scenes/scenario-select.ts`'s own constants — the identical wrapped-detail-line fix. */
const DETAIL_CHAR_WIDTH = 5.4;
const DETAIL_LINE_PX = 15;
const DETAIL_TEXT_PAD = 24;

/**
 * "Deck check ▸" opens W1's Deck check over the **active seat's own deck** (docs/phase4-screen-gaps.md §3 W1:
 * "reached per seat from the setup flow" — the bug this rebuild fixes was hardcoding seat 1 here), with Back
 * returning here and its "Start game ▸" continuing to Table setup. With no seated deck at the active seat (or
 * before the deck list has loaded), it goes straight to Table setup.
 */
function goToDeckCheckOrTableSetup(scene: Phaser.Scene, draft: SetupDraft, deckOptions: readonly DeckOption[]): void {
  const toTableSetup = (from: Phaser.Scene): void => {
    from.scene.start(SCENES.setup, { draft } satisfies TableSetupData);
  };
  const activeDeckId = draft.seats[draft.activeSeatIndex];
  const seated = activeDeckId ? deckOptions.find((option) => (option.deck.id as string) === activeDeckId) : undefined;
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
  #buttons: McButton[] = [];
  #stops = new Map<string, FocusStop>();
  #searchInput: McTextInput | null = null;
  #roster: McShelfRoster<DeckOption> | null = null;
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.seats);
  }

  #seedDecks: readonly Deck[] = [];

  init(data: SeatsData): void {
    this.#draft = data.draft;
    this.#seedDecks = data.seedDecks ?? [];
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
    this.#roster?.destroy();
    this.#roster = null;

    const kept = this.#searchInput ? [this.#searchInput.gameObject] : [];
    for (const node of kept) this.children.remove(node);
    this.children.removeAll(true);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const deckOptions = this.#deckOptions();
    this.#draft = pruneSeats(this.#draft, new Set(deckOptions.map((o) => o.deck.id as string)), deckOptions[0]?.deck.id as string);

    const chipDefs = this.#heroChipDefs(deckOptions);

    const activeDeckId = this.#draft.seats[this.#draft.activeSeatIndex];
    const detailOption = activeDeckId ? deckOptions.find((o) => (o.deck.id as string) === activeDeckId) : undefined;
    const detailLines = detailOption ? this.#detailLinesFor(detailOption) : ["Select a hero for this seat below."];
    const detailTextWidth = detailPanelWidthFor(width, height) - DETAIL_TEXT_PAD;
    const detailWrappedLines = detailLines.reduce((sum, line) => sum + estimateWrappedLines(line, detailTextWidth, DETAIL_CHAR_WIDTH), 0);

    const layout = seatsLayout({ width, height, chipRows: wrapChipsToRows(chipDefs, width).length, detailLines: detailWrappedLines });
    const chipRows = wrapChipsToRows(chipDefs, layout.chips.width);

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

    // The four selectable seat cards (the active-seat model, docs/phase4-screen-gaps.md §3 W2b's own bug fix):
    // clicking one makes it active, ringed with the `card` skin's own `selected` state.
    const slots = seatSlotsOf(this.#draft.seats, deckOptions, CARDS_BY_ID, MAX_SEATS, this.#draft.activeSeatIndex);
    slots.forEach((slot, index) => {
      const rect = layout.seatSlots[index]!;
      const heading = `SEAT ${index + 1}${index === 0 ? " · YOU" : ""}`;
      const body = slot.deckId
        ? `${slot.identityName ?? "?"}\n${slot.aspectLabel ?? ""} · HP ${slot.hp ?? "—"} · hand ${slot.handSize ?? "—"}`
        : "Empty — pick a hero below";
      const selectSeat = (): void => {
        this.#draft = setActiveSeat(this.#draft, index);
        this.#rebuild();
      };
      // `McButton` itself paints the `card` skin's panel (selected = the active seat's own red ring); the
      // heading/body text is drawn on top of it, since a seat card needs more than one line of label.
      this.#buttons.push(new McButton(this, { kind: "card", label: "", type: typeRole.label, rect, selected: slot.active, onClick: selectSeat }));
      label(this, rect.x + 6, rect.y + 6, heading, typeRole.label, surface.ink.hex, slot.deckId ? 1 : ink.meta);
      this.add.text(rect.x + 6, rect.y + 22, body, textStyle(typeRole.label, surface.ink.hex, slot.deckId ? 1 : ink.meta)).setWordWrapWidth(rect.width - 12);
      this.#stops.set(`seat:${index}`, { rect, activate: selectSeat });
    });

    const usePreconstructed = (): void => {
      this.#draft = usePreconstructedForAllSeats(this.#draft, deckOptions);
      this.#rebuild();
    };
    this.#buttons.push(new McButton(this, { kind: "quiet", label: "Use preconstructed for all seats", type: typeRole.label, rect: layout.usePreconstructed, onClick: usePreconstructed }));
    this.#stops.set("use-preconstructed", { rect: layout.usePreconstructed, activate: usePreconstructed });

    label(
      this,
      layout.search.x,
      layout.search.y - 16,
      `Heroes — seat ${this.#draft.activeSeatIndex + 1} of ${MAX_SEATS}, all played by you`,
      typeRole.label,
      surface.ink.hex,
      ink.label,
    );
    this.#searchInput = drawSearchField(
      this,
      layout.search,
      "hero-search",
      this.#draft.heroFilter.text,
      "search heroes, aspects, decks…",
      (value) => {
        this.#draft = setHeroFilter(this.#draft, { ...this.#draft.heroFilter, text: value });
        this.#rebuild();
      },
      this.#searchInput,
      this.#stops,
    );
    drawChipStrip(this, layout.chips, chipRows, "hero-chip", this.#buttons, this.#stops);

    const seating = new Map(seatOptions(deckOptions, this.#draft.seats, CARDS_BY_ID).map((o) => [o.deckId, o]));
    const active = new Map(activeSeatRosterOf(seatOptions(deckOptions, this.#draft.seats, CARDS_BY_ID), this.#draft.seats, this.#draft.activeSeatIndex).map((e) => [e.deckId, e]));
    const shelves = this.#shelves(deckOptions, seating, active);
    this.#roster = drawShelfRosterPanel({
      scene: this,
      rect: layout.shelves,
      shelves,
      metrics: CARD_METRICS,
      screen: "seats",
      focusPrefix: "hero",
      idOf: (o) => o.deck.id as string,
      renderHeader: (shelf, rect) => renderShelfHeader(this, shelf, rect, null, () => this.#roster?.refreshVisible()),
      renderCard: (option, _shelfIndex, _itemIndex, rect) => this.#renderHeroCard(option, active, rect),
      onCardActivate: (option) => {
        const entry = active.get(option.deck.id as string);
        if (entry?.blockedBy) return;
        this.#draft = assignToActiveSeat(this.#draft, option.deck.id as string);
        this.#rebuild();
      },
      inspect: (option) => this.#inspectOption(option, active),
      onClear: () => {
        this.#draft = clearHeroFilter(this.#draft);
        this.#searchInput?.setValue("");
        this.#rebuild();
      },
      buttons: this.#buttons,
      stops: this.#stops,
    });

    // The hero-detail panel — dark, matching D03's own sidebar, for the active seat's own pick. Each line wraps to
    // its own width and the cursor advances by its real wrapped height (a long obligation/nemesis-set name should
    // push the next line down, not run under it).
    this.add.rectangle(layout.detail.x, layout.detail.y, layout.detail.width, layout.detail.height, surface.ink.hex).setOrigin(0, 0);
    let detailCursorY = layout.detail.y + 8;
    for (const line of detailLines) {
      this.add.text(layout.detail.x + 12, detailCursorY, line, textStyle(typeRole.body, surface.paper.hex)).setWordWrapWidth(detailTextWidth);
      detailCursorY += estimateWrappedLines(line, detailTextWidth, DETAIL_CHAR_WIDTH) * DETAIL_LINE_PX;
    }

    // The two actions at the panel's own foot (D03/P03): a quiet "Play N heroes ▸" straight to Table setup, and
    // the primary "Deck check ▸" for the active seat's own deck.
    const play = (): void => {
      this.scale.off("resize", this.#rebuild, this);
      this.scene.start(SCENES.setup, { draft: this.#draft } satisfies TableSetupData);
    };
    this.#buttons.push(
      new McButton(this, { kind: "secondary", label: `Play ${this.#draft.seats.length} hero${this.#draft.seats.length === 1 ? "" : "es"} ▸`, type: typeRole.barTitle, rect: layout.play, onClick: play }),
    );
    this.#stops.set("play", { rect: layout.play, activate: play });

    const deckCheck = (): void => {
      this.scale.off("resize", this.#rebuild, this);
      goToDeckCheckOrTableSetup(this, this.#draft, this.#deckOptions());
    };
    this.#buttons.push(new McButton(this, { kind: "primary", label: "Deck check ▸", type: typeRole.barTitle, rect: layout.deckCheck, onClick: deckCheck }));
    this.#stops.set("deck-check", { rect: layout.deckCheck, activate: deckCheck });

    this.#route?.set(
      seatsFocusOrder({ seatCount: MAX_SEATS, deckIds: flattenShelves(shelves).map((o) => o.deck.id as string), heroChipIds: chipDefs.map((c) => c.id) }),
      this.#stops,
    );
  }

  #renderHeroCard(option: DeckOption, active: ReadonlyMap<string, import("../view/seat-slots.js").ActiveSeatRosterEntry>, rect: import("../view/layout.js").Rect): ReturnType<typeof renderShelfCard> {
    const identity = CARDS_BY_ID.get(option.deck.identityCardId as string);
    const source = identity ? artFor(identity, { kind: "hero" }) : null;
    const artKey = cardArt(this).request(this, source);
    const entry = active.get(option.deck.id as string);
    const sourceText = option.deck.source.kind === "precon" ? "Precon" : option.deck.source.kind === "imported" ? "Imported" : "Built";
    const tag = entry?.isActiveSeat ? `SEAT ${this.#draft.activeSeatIndex + 1}` : entry?.seatIndex !== null && entry?.seatIndex !== undefined ? `SEAT ${entry.seatIndex + 1}` : null;
    return renderShelfCard(this, rect, {
      artKey,
      title: option.deck.name.split(" — ")[0]!,
      subtitle: `${sourceText} · ${option.identityName ?? "unknown identity"}`,
      blockedBy: entry?.blockedBy ?? null,
      warning: entry?.warning ?? null,
      tag,
      selected: entry?.isActiveSeat ?? false,
    });
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

  #shelves(
    deckOptions: readonly DeckOption[],
    seating: ReadonlyMap<string, import("../view/seats.js").SeatOption>,
    active: ReadonlyMap<string, import("../view/seat-slots.js").ActiveSeatRosterEntry>,
  ): readonly import("../view/roster-shelves.js").Shelf<DeckOption>[] {
    const candidates: ShelfCandidate<DeckOption>[] = withSelectionPinned(
      deckOptions,
      () => true,
      (option) => active.get(option.deck.id as string)?.isActiveSeat ?? false,
    ).map((option) => {
      const identity = CARDS_BY_ID.get(option.deck.identityCardId as string);
      const hero = identity?.type === "hero_identity" ? identity : undefined;
      const packCode = option.deck.source.kind === "precon" ? (option.deck.source.packCode as string) : null;
      const chipsOk = this.#heroPassesChips(option, seating.get(option.deck.id as string)?.blockedBy ?? null);
      return {
        item: option,
        packCode,
        searchHaystacks: [option.deck.name, hero?.hero.faceName, hero?.alterEgo.faceName, ...option.deck.aspects, option.deck.source.kind],
        passesChips: chipsOk,
      };
    });
    return shelvesOf(
      candidates,
      POOL_PACKS.map((p) => p.code as string),
      packNameOf,
      this.#draft.heroFilter.text,
    );
  }

  #heroPassesChips(option: DeckOption, blockedBy: string | null): boolean {
    const filter = this.#draft.heroFilter;
    if (filter.aspect && !option.deck.aspects.includes(filter.aspect)) return false;
    if (filter.source && option.deck.source.kind !== filter.source) return false;
    if (filter.playableOnly && blockedBy !== null) return false;
    return true;
  }

  #heroChipDefs(deckOptions: readonly DeckOption[]): readonly { id: string; text: string; selected: boolean; onClick: () => void }[] {
    const aspectChips = heroAspectsOf(deckOptions.map((option) => option.deck)).map((aspect) => ({
      id: `aspect:${aspect}`,
      text: aspect,
      selected: this.#draft.heroFilter.aspect === aspect,
      onClick: () => {
        this.#draft = setHeroFilter(this.#draft, { ...this.#draft.heroFilter, aspect: this.#draft.heroFilter.aspect === aspect ? null : aspect });
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
        this.#rebuild();
      },
    }));
    const playableChip = {
      id: "playable-now",
      text: "Playable now",
      selected: this.#draft.heroFilter.playableOnly === true,
      onClick: () => {
        this.#draft = setHeroFilter(this.#draft, { ...this.#draft.heroFilter, playableOnly: !this.#draft.heroFilter.playableOnly });
        this.#rebuild();
      },
    };
    return [...aspectChips, ...sourceChips, playableChip];
  }

  #onInspectChoose(rowId: string): void {
    const deckOptions = this.#deckOptions();
    const option = deckOptions.find((o) => (o.deck.id as string) === rowId);
    const seating = new Map(seatOptions(deckOptions, this.#draft.seats, CARDS_BY_ID).map((o) => [o.deckId, o]));
    if (option && !seating.get(rowId)?.blockedBy) {
      this.#draft = assignToActiveSeat(this.#draft, rowId);
      this.#rebuild();
    }
  }

  #inspectOption(option: DeckOption, active: ReadonlyMap<string, import("../view/seat-slots.js").ActiveSeatRosterEntry>): void {
    const entry = active.get(option.deck.id as string);
    this.scene.launch(SCENES.inspect, {
      card: { cardId: option.deck.identityCardId as CardId, face: { kind: "hero" } },
      ...(entry?.blockedBy ? { note: entry.blockedBy } : { choice: { optionId: option.deck.id as string, label: entry?.isActiveSeat ? "Already this seat's pick" : "Take this seat" } }),
    });
  }
}

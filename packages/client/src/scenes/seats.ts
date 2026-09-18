/**
 * Take your seats (docs/phase4-screen-gaps.md §3 W2/W2b, D03/P03/T-P02): four
 * selectable seat cards over an **active-seat model** — clicking a seat makes
 * it active, and the pack-shelf hero roster (S8, the owner's pack-shelves
 * decision, drill-in per the owner's second-pass ask) picks a hero *for the
 * active seat* (`view/setup-draft.ts`'s `setActiveSeat`/`assignToActiveSeat`)
 * — a hero detail panel (obligation, nemesis), a small "Use preconstructed
 * for all seats" on the roster's own header line, "Play N heroes ▸" straight
 * to Table setup, and "Deck check ▸" into W1's Deck check for the *active*
 * seat's own deck (Back returns here, "Start game ▸" continues to Table
 * setup).
 *
 * **The bug this rebuild fixes:** the previous version hardcoded seat 1 both
 * in what the roster clicked into and in what "Deck check ▸" opened. Every
 * seat is now a real, independently selectable and deck-checkable target —
 * including *replacing* an already-seated hero once the table is full, which
 * needed `seatOptions` to be asked "if I removed the active seat, would this
 * be legal?" (`#seatOptionsExcludingActive`) rather than "is this legal to
 * add as a fifth seat?", which always said no once four seats were filled.
 */
import Phaser from "phaser";
import type { CardId, Deck } from "@mc/content";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS, POOL_ENCOUNTER_SETS, POOL_PACKS, POOL_SCENARIOS, POOL_VERSION, packNameOf } from "../content/pool.js";
import { artFor } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { accent, dotGrid, ink, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTextInput, dashedRect, fitText, label, paintDotGrid } from "../ui/widgets.js";
import { McShelfRoster } from "../ui/shelf-roster.js";
import { McVirtualList } from "../ui/virtual-list.js";
import { deckOptionsOf, type DeckOption } from "../view/deck-list-model.js";
import { heroAspectsOf, withSelectionPinned, type DeckSourceKind } from "../view/roster-filter.js";
import { packCompactChipsToRows } from "../view/chip-layout.js";
import { shelvesOf, flattenShelves, type Shelf, type ShelfCandidate } from "../view/roster-shelves.js";
import { ALL_PACKS, drillIntoPack, drillOut, type ShelfDrillState } from "../view/shelf-drill.js";
import { seatOptions, type SeatOption } from "../view/seats.js";
import { activeSeatRosterOf, aspectLabelOf, heroCandidateDetailOf, seatSlotsOf, type ActiveSeatRosterEntry } from "../view/seat-slots.js";
import {
  assignToActiveSeat,
  clearHeroFilter,
  clearSeat,
  deckCheckDeckId,
  pruneSeats,
  seatIsSelectable,
  setActiveSeat,
  setHeroFilter,
  usePreconstructedForAllSeats,
  type SetupDraft,
} from "../view/setup-draft.js";
import { seatsFocusOrder } from "../view/screen-focus.js";
import { seatsLayout, detailPanelWidthFor, MAX_SEATS } from "../view/seats-layout.js";
import { estimateWrappedLines, type Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { drawCompactChipStrip, drawPackGrid, drawSearchField, drawShelfRosterPanel, renderShelfCard, renderShelfHeader } from "./roster-panel.js";
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

/** Matches `scenes/scenario-select.ts`'s own constants — the identical wrapped-detail-line fix. */
const DETAIL_CHAR_WIDTH = 5.4;
const DETAIL_LINE_PX = 15;
const DETAIL_TEXT_PAD = 24;
/** Small enough that "SEAT 1 · YOU" still reads at ~240px-wide seat cards (a 4-across row at tablet-landscape widths) instead of ellipsizing to "SEAT…" (second-pass cosmetic fix). */
const CLOSE_SIZE = 16;

/**
 * "Deck check ▸" opens W1's Deck check over `deckCheckDeckId`'s own pick (docs/phase4-screen-gaps.md §3, second
 * W2b pass item 1 — the owner's bug report that this silently fell through to Table setup whenever the active
 * seat itself was empty, e.g. right after picking for seat 2 auto-advanced to the empty seat 3). It reaches Table
 * setup only when the table genuinely has no seated deck at all, which `pruneSeats`' own fallback never actually
 * allows — kept as a fallback rather than assumed unreachable.
 */
function goToDeckCheckOrTableSetup(scene: Phaser.Scene, draft: SetupDraft, deckOptions: readonly DeckOption[]): void {
  const toTableSetup = (from: Phaser.Scene): void => {
    from.scene.start(SCENES.setup, { draft } satisfies TableSetupData);
  };
  const checkedDeckId = deckCheckDeckId(draft);
  const seated = checkedDeckId ? deckOptions.find((option) => (option.deck.id as string) === checkedDeckId) : undefined;
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
  #grid: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  #drill: ShelfDrillState = ALL_PACKS;
  readonly #gridScroll = new ListScroll();

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
    // Seat-card thumbnails and roster cards both draw through `cardArt(this).request`, which only *asks* the
    // loader — nothing about that call redraws the scene once a scan actually arrives. Without this, whichever
    // card's own scan was still in flight when the last unrelated redraw ran stayed blank forever (found the same
    // way `scenes/scenario-select.ts`'s own identical fix was: fresh-navigating and waiting with no interaction).
    const artOff = cardArt(this).onArrived(() => this.#rebuild());
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

  #drillOut(): void {
    this.#drill = drillOut();
    this.#rebuild();
  }

  #deckOptions(): readonly DeckOption[] {
    return deckOptionsOf(this.#savedDecks, POOL_CARDS, POOL_VERSION, POOL_DEPS);
  }

  /**
   * Legality *as if the active seat were empty* — the fix for "once four seats are filled, no other hero can ever
   * be picked": `seatOptions`'s own "N seats is the maximum" and unique-identity checks are asked against the
   * table with the active seat's own current occupant removed, since picking a new hero for that seat always
   * *replaces* it rather than adding a fifth seat.
   */
  #seatOptionsExcludingActive(deckOptions: readonly DeckOption[]): readonly SeatOption[] {
    const seatsExcludingActive = this.#draft.seats.filter((_, i) => i !== this.#draft.activeSeatIndex);
    return seatOptions(deckOptions, seatsExcludingActive, CARDS_BY_ID, MAX_SEATS);
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
    const deckOptions = this.#deckOptions();
    this.#draft = pruneSeats(this.#draft, new Set(deckOptions.map((o) => o.deck.id as string)), deckOptions[0]?.deck.id as string);

    const chipDefs = this.#heroChipDefs(deckOptions);

    const activeDeckId = this.#draft.seats[this.#draft.activeSeatIndex];
    const detailOption = activeDeckId ? deckOptions.find((o) => (o.deck.id as string) === activeDeckId) : undefined;
    const detailTextWidth = detailPanelWidthFor(width, height) - DETAIL_TEXT_PAD;

    const layout = seatsLayout({ width, height, chipRows: packCompactChipsToRows(chipDefs, width).length, detailLines: 10 });
    const chipRows = packCompactChipsToRows(chipDefs, layout.chips.width);

    // Ground: paper body under the same full-width ink header bar Scenario select uses.
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    paintDotGrid(this, { x: 0, y: layout.headerBar.height, width, height: height - layout.headerBar.height }, "paper", dotGrid.onPaper);
    this.add.rectangle(layout.headerBar.x, layout.headerBar.y, layout.headerBar.width, layout.headerBar.height, surface.ink.hex).setOrigin(0, 0);

    const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === this.#draft.scenarioId);
    const back = (): void => this.#back();
    this.#buttons.push(new McButton(this, { kind: "onInk", label: `◂ ${scenario?.name ?? "Back"}`, type: typeRole.backLabel, rect: layout.back, onClick: back }));
    this.#stops.set("back", { rect: layout.back, activate: back });
    const titleX = layout.back.x + layout.back.width + 16;
    const title = this.add.text(titleX, layout.headerBar.height / 2, "Take your seats", textStyle(typeRole.pageTitle, surface.paper.hex)).setOrigin(0, 0.5);
    fitText(title, layout.step.x - titleX - 12, typeRole.pageTitle.size);
    const stepText = this.add
      .text(layout.step.x + layout.step.width, layout.headerBar.height / 2, `STEP 2 OF 4 · ${this.#draft.seats.length} SEAT${this.#draft.seats.length === 1 ? "" : "S"} FILLED`, textStyle(typeRole.label, surface.paper.hex, ink.label))
      .setOrigin(1, 0.5);
    fitText(stepText, layout.step.width, typeRole.label.size);

    // The four selectable seat cards (the active-seat model, docs/phase4-screen-gaps.md §3 W2b's own bug fix).
    const deckOptionsById = new Map(deckOptions.map((o) => [o.deck.id as string, o]));
    const slots = seatSlotsOf(this.#draft.seats, deckOptions, CARDS_BY_ID, MAX_SEATS, this.#draft.activeSeatIndex);
    slots.forEach((slot, index) => this.#drawSeatCard(layout.seatSlots[index]!, slot, index, slot.deckId ? deckOptionsById.get(slot.deckId) : undefined));

    const rosterLabel = label(this, layout.rosterHeader.x, layout.rosterHeader.y + layout.rosterHeader.height / 2, `Heroes — seat ${this.#draft.activeSeatIndex + 1} of ${MAX_SEATS}`, typeRole.label, surface.ink.hex, ink.label);
    rosterLabel.setOrigin(0, 0.5);
    fitText(rosterLabel, layout.usePreconstructed.x - layout.rosterHeader.x - 12, typeRole.label.size);
    const usePreconstructed = (): void => {
      this.#draft = usePreconstructedForAllSeats(this.#draft, deckOptions);
      this.#rebuild();
    };
    this.#buttons.push(new McButton(this, { kind: "quiet", label: "Use preconstructed", type: typeRole.label, rect: layout.usePreconstructed, onClick: usePreconstructed }));
    this.#stops.set("use-preconstructed", { rect: layout.usePreconstructed, activate: usePreconstructed });

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
    drawCompactChipStrip(this, layout.chips, chipRows, "hero-chip", this.#buttons, this.#stops);

    const seating = new Map(this.#seatOptionsExcludingActive(deckOptions).map((o) => [o.deckId, o]));
    const active = new Map(activeSeatRosterOf(this.#seatOptionsExcludingActive(deckOptions), this.#draft.seats, this.#draft.activeSeatIndex).map((e) => [e.deckId, e]));
    const shelves = this.#shelves(deckOptions, seating, active);
    const cardMetrics = this.#cardMetrics(layout.shelves);
    let cardIds: readonly string[];

    if (this.#drill.packId !== null) {
      const shelf = shelves.find((s) => s.id === this.#drill.packId);
      const drillBack = (): void => this.#drillOut();
      const backRect: Rect = { x: layout.shelves.x, y: layout.shelves.y, width: 130, height: 28 };
      this.#buttons.push(new McButton(this, { kind: "quiet", label: "◂ All packs", type: typeRole.rowTitle, rect: backRect, onClick: drillBack }));
      this.#stops.set("drill-back", { rect: backRect, activate: drillBack });
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
        focusPrefix: "hero",
        idOf: (o) => o.deck.id as string,
        renderCard: (option, _index, rect) => this.#renderHeroCard(option, active, rect),
        onCardActivate: (option) => this.#pickHero(option, active),
        inspect: (option) => this.#inspectOption(option, active),
        onClear: () => this.#drillOut(),
        buttons: this.#buttons,
        stops: this.#stops,
      });
      cardIds = ["drill-back", ...items.map((o) => o.deck.id as string)];
    } else {
      this.#roster = drawShelfRosterPanel({
        scene: this,
        rect: layout.shelves,
        shelves,
        metrics: cardMetrics,
        screen: "seats",
        focusPrefix: "hero",
        idOf: (o) => o.deck.id as string,
        renderHeader: (shelf, rect) => renderShelfHeader(this, shelf, rect, null, () => this.#roster?.refreshVisible(), `${shelf.items.length} ${shelf.items.length === 1 ? "IDENTITY" : "IDENTITIES"}`),
        renderCard: (option, _shelfIndex, _itemIndex, rect) => this.#renderHeroCard(option, active, rect),
        onCardActivate: (option) => this.#pickHero(option, active),
        onHeaderActivate: (shelf) => {
          this.#drill = drillIntoPack(shelf.id);
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
      cardIds = flattenShelves(shelves).map((o) => o.deck.id as string);
    }

    // The hero-detail panel — dark, matching D03's own sidebar, for the active seat's own pick.
    this.#drawSidePanel(layout, detailOption, detailTextWidth);

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
      seatsFocusOrder({ seatCount: MAX_SEATS, deckIds: cardIds, heroChipIds: chipDefs.map((c) => c.id) }),
      this.#stops,
    );
  }

  #pickHero(option: DeckOption, active: ReadonlyMap<string, ActiveSeatRosterEntry>): void {
    const entry = active.get(option.deck.id as string);
    if (entry?.blockedBy) return;
    this.#draft = assignToActiveSeat(this.#draft, option.deck.id as string);
    this.#rebuild();
  }

  /** ~220px wide portrait cards, tall enough to fill most of the shelf viewport's own height (mirrors `scenario-select.ts`'s own sizing, narrower since a hero identity scan is a portrait card, not a landscape villain scene). */
  #cardMetrics(shelvesRect: Rect): { cardWidth: number; cardHeight: number; cardGap: number; headerHeight: number; headerToCardsGap: number; shelfGap: number } {
    const headerHeight = 28;
    const headerToCardsGap = 8;
    const shelfGap = 18;
    const cardWidth = Math.min(220, shelvesRect.width - 40);
    const available = shelvesRect.height - headerHeight - headerToCardsGap - shelfGap;
    const cardHeight = Math.max(200, Math.min(360, available));
    return { cardWidth, cardHeight, cardGap: 12, headerHeight, headerToCardsGap, shelfGap };
  }

  /** One seat card (D03 second pass): a portrait thumbnail at left, a red "SEAT N" label, the Bangers hero name, a meta line, a 4px red border when active, a dashed border and "EMPTY — PICK A HERO" when not, and a small "✕" to clear an occupied seat. */
  /**
   * One seat card. Four states (docs/phase4-screen-gaps.md §3, second W2b pass items 2–3):
   *  - filled + active: solid 4px red border, "SEAT N · YOU"/"SEAT N".
   *  - filled + inactive: a thin ink border.
   *  - empty + active: 4px red **dashed** border, "SEAT N · PICKING" — the active seat must always read as active
   *    even with nothing seated yet (the owner's bug report: an empty active seat looked identical to an empty
   *    inactive one).
   *  - empty + inactive + selectable (the *one* reachable empty seat, `seatIsSelectable`): the ordinary dashed
   *    "Empty — pick a hero" this screen always drew.
   *  - empty + inactive + **not** selectable (an empty seat further out than that): dimmed, not clickable at all,
   *    "Fill seat N first" — the chosen fix for "I clicked seat 3 and the hero landed in seat 2" (item 3): rather
   *    than leave it clickable and rely on a player noticing which seat actually lit up, a seat that can't yet be
   *    reached is presented as not pickable.
   */
  #drawSeatCard(rect: Rect, slot: ReturnType<typeof seatSlotsOf>[number], index: number, option: DeckOption | undefined): void {
    const selectable = seatIsSelectable(this.#draft, index);
    const activeEmpty = slot.active && !slot.deckId;
    if (selectable) {
      const selectSeat = (): void => {
        this.#draft = setActiveSeat(this.#draft, index);
        this.#rebuild();
      };
      this.#buttons.push(new McButton(this, { kind: "quiet", label: "", type: typeRole.label, rect, onClick: selectSeat }));
      this.#stops.set(`seat:${index}`, { rect, activate: selectSeat });
    }
    // A seat further out than `seatIsSelectable` allows is deliberately not wired to any button or focus stop —
    // it cannot be reached at all, not merely discouraged, so the redirect this fix targets can't happen.

    const face = this.add.graphics();
    const dim = selectable ? 1 : ink.illegal;
    face.fillStyle(surface.card.hex, dim).fillRect(rect.x, rect.y, rect.width, rect.height);
    if (activeEmpty) {
      dashedRect(face, rect, 4, accent.heroRed.hex);
    } else if (!slot.deckId) {
      dashedRect(face, rect, 2);
    } else if (slot.active) {
      face.lineStyle(4, accent.heroRed.hex, 1).strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
    } else {
      face.lineStyle(1.5, surface.ink.hex, ink.label).strokeRect(rect.x + 0.75, rect.y + 0.75, rect.width - 1.5, rect.height - 1.5);
    }

    // Capped relative to the card's own width too, not just its height — at a 2×2 grid's ~180px card, a
    // height-driven thumbnail (99px) left less than half the card for any text at all.
    const thumbSize = Math.min(rect.height - 16, rect.width * 0.32);
    const thumbRect: Rect = { x: rect.x + 8, y: rect.y + 8, width: thumbSize, height: thumbSize };
    if (slot.deckId && option) {
      const identity = CARDS_BY_ID.get(option.deck.identityCardId as string);
      const source = identity ? artFor(identity, { kind: "hero" }) : null;
      const key = cardArt(this).request(this, source);
      const art = key ? drawArt(this, key, thumbRect, { fit: "cover" }) : null;
      if (!art) {
        const placeholder = this.add.graphics();
        placeholder.fillStyle(surface.parchment.hex, 1).fillRect(thumbRect.x, thumbRect.y, thumbRect.width, thumbRect.height);
      }
    }

    const textX = thumbRect.x + thumbRect.width + 10;
    const textWidth = rect.x + rect.width - textX - 8;
    // The close button sits top-right of the whole card — only the top two lines (the seat label, the name) need
    // to leave room for it; the meta line at the card's own foot is well clear (second-pass fidelity pass:
    // "SPIDER-MAN" read as "SPIDER-MA" with the "✕" sitting on top of the rest).
    const topLineWidth = slot.deckId ? textWidth - CLOSE_SIZE - 8 : textWidth;
    const seatText = activeEmpty ? `SEAT ${index + 1} · PICKING` : `SEAT ${index + 1}${index === 0 && slot.deckId ? " · YOU" : ""}`;
    const seatLabel = label(this, textX, rect.y + 8, seatText, typeRole.label, accent.heroRed.hex, dim);
    fitText(seatLabel, topLineWidth, typeRole.label.size);
    if (slot.deckId) {
      const name = this.add.text(textX, rect.y + 26, slot.identityName ?? "?", textStyle(typeRole.sectionHeader, surface.ink.hex));
      name.setFontSize(18);
      fitText(name, topLineWidth, 18);
      const meta = this.add.text(textX, rect.y + rect.height - 34, `${slot.aspectLabel ?? ""} · ${slot.hp ?? "—"} HP · hand ${slot.handSize ?? "—"}`, textStyle(typeRole.label, surface.ink.hex, ink.label));
      meta.setWordWrapWidth(textWidth);
      const closeRect: Rect = { x: rect.x + rect.width - CLOSE_SIZE - 4, y: rect.y + 4, width: CLOSE_SIZE, height: CLOSE_SIZE };
      const clear = (): void => {
        this.#draft = clearSeat(this.#draft, index);
        this.#rebuild();
      };
      this.#buttons.push(new McButton(this, { kind: "quiet", label: "✕", type: typeRole.label, rect: closeRect, onClick: clear }));
    } else {
      const message = selectable ? "Empty — pick a hero" : `Fill seat ${this.#draft.seats.length + 1} first`;
      const empty = this.add.text(textX, rect.y + rect.height / 2, message, textStyle(typeRole.label, surface.ink.hex, selectable ? ink.meta : ink.illegal));
      empty.setOrigin(0, 0.5);
      empty.setWordWrapWidth(textWidth);
    }
  }

  #renderHeroCard(option: DeckOption, active: ReadonlyMap<string, ActiveSeatRosterEntry>, rect: Rect): ReturnType<typeof renderShelfCard> {
    const identity = CARDS_BY_ID.get(option.deck.identityCardId as string);
    const source = identity ? artFor(identity, { kind: "hero" }) : null;
    const artKey = cardArt(this).request(this, source);
    const entry = active.get(option.deck.id as string);
    const sourceText = option.deck.source.kind === "precon" ? "Precon" : option.deck.source.kind === "imported" ? "Imported" : "Built";
    const seatedElsewhere = entry?.seatIndex !== null && entry?.seatIndex !== undefined && !entry.isActiveSeat;
    // Second-pass item 12/cosmetic: a deck seated elsewhere gets only its short "SEAT N" tag (no truncated
    // "ALREADY SEATED · SEA…" string); a genuinely illegal/duplicate deck gets "AT THE TABLE" instead of its own
    // full sentence ("Captain Marvel is already at the table"), which used to truncate in the subtitle line — the
    // full reason is still one Inspect away (`#inspectOption`'s own `note`).
    const blockedBy = seatedElsewhere ? null : (entry?.blockedBy ?? null);
    const tag = entry?.isActiveSeat ? `SEAT ${this.#draft.activeSeatIndex + 1}` : seatedElsewhere ? `SEAT ${entry!.seatIndex! + 1}` : blockedBy ? "AT THE TABLE" : null;
    return renderShelfCard(this, rect, {
      artKey,
      titleRole: typeRole.barTitle,
      title: option.deck.name.split(" — ")[0]!,
      subtitle: `${sourceText} · ${option.identityName ?? "unknown identity"}`,
      blockedBy,
      warning: seatedElsewhere ? null : (entry?.warning ?? null),
      tag,
      selected: entry?.isActiveSeat ?? false,
    });
  }

  #drawSidePanel(layout: ReturnType<typeof seatsLayout>, option: DeckOption | undefined, detailTextWidth: number): void {
    const rect = layout.detail;
    this.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.ink.hex).setOrigin(0, 0);
    if (!option) {
      this.add.text(rect.x + 16, rect.y + 16, "Select a hero for this seat below.", textStyle(typeRole.body, surface.paper.hex, ink.label)).setWordWrapWidth(rect.width - 32);
      return;
    }
    const detail = heroCandidateDetailOf(option, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    let y = rect.y + 16;
    const name = this.add.text(rect.x + 16, y, detail.identityName, textStyle(typeRole.sectionHeader, surface.paper.hex));
    name.setFontSize(22);
    name.setWordWrapWidth(rect.width - 32);
    y += name.height + 6;
    const stat = this.add.text(rect.x + 16, y, `${detail.aspectLabel} · HP ${detail.hp ?? "—"} · hand ${detail.handSize ?? "—"} · THW ${detail.thw ?? "—"} / ATK ${detail.atk ?? "—"} / DEF ${detail.def ?? "—"}`, textStyle(typeRole.label, surface.paper.hex, ink.label));
    stat.setWordWrapWidth(rect.width - 32);
    y += stat.height + 12;
    const rule = this.add.graphics();
    rule.lineStyle(1, surface.paper.hex, ink.disabled).lineBetween(rect.x + 16, y, rect.x + rect.width - 16, y);
    y += 14;
    label(this, rect.x + 16, y, "Obligation", typeRole.label, surface.paper.hex, ink.label);
    y += 16;
    const obligation = this.add.text(rect.x + 16, y, detail.obligationName ?? "None.", textStyle(typeRole.body, surface.paper.hex));
    obligation.setWordWrapWidth(detailTextWidth);
    y += estimateWrappedLines(detail.obligationName ?? "None.", detailTextWidth, DETAIL_CHAR_WIDTH) * DETAIL_LINE_PX + 12;
    label(this, rect.x + 16, y, "Nemesis set", typeRole.label, surface.paper.hex, ink.label);
    y += 16;
    const nemesis = this.add.text(rect.x + 16, y, detail.nemesisSetName ?? "None.", textStyle(typeRole.body, surface.paper.hex));
    nemesis.setWordWrapWidth(detailTextWidth);
  }

  #shelves(
    deckOptions: readonly DeckOption[],
    seating: ReadonlyMap<string, SeatOption>,
    active: ReadonlyMap<string, ActiveSeatRosterEntry>,
  ): readonly Shelf<DeckOption>[] {
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
      // A hero pack ships one hero; a shelf each was a column of one-card rows.
      { id: "hero-packs", title: "Hero packs" },
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
      text: aspectLabelOf([aspect]),
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
    const seating = new Map(this.#seatOptionsExcludingActive(deckOptions).map((o) => [o.deckId, o]));
    if (option && !seating.get(rowId)?.blockedBy) {
      this.#draft = assignToActiveSeat(this.#draft, rowId);
      this.#rebuild();
    }
  }

  #inspectOption(option: DeckOption, active: ReadonlyMap<string, ActiveSeatRosterEntry>): void {
    const entry = active.get(option.deck.id as string);
    this.scene.launch(SCENES.inspect, {
      card: { cardId: option.deck.identityCardId as CardId, face: { kind: "hero" } },
      ...(entry?.blockedBy ? { note: entry.blockedBy } : { choice: { optionId: option.deck.id as string, label: entry?.isActiveSeat ? "Already this seat's pick" : "Take this seat" } }),
    });
  }
}

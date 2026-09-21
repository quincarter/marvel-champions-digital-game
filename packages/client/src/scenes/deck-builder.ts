/**
 * The minimal deck builder (PLAN.md Phase 9): pick an identity and its
 * aspect(s), name the deck, search/filter the pool, add and remove cards, and
 * save — with live legality from the same `validateDeck` the Decks screen and
 * `createGame` use (`view/deck-builder-model.ts`'s `legalityOf`). This scene
 * decides nothing about what's legal; it only shows what the engine already
 * said.
 *
 * Two entries: `{ deck }` edits a saved deck (its identity is already fixed);
 * `{}` starts fresh, showing only the identity picker until one is chosen —
 * `Deck.identityCardId` is required, so there is no `Deck` to build against
 * until then (`view/deck-builder-model.ts`'s `newDeck` needs an identity).
 *
 * The pool browser is a long, filterable list — wave 1 more than doubles the
 * pool — so it is a `McVirtualList` (`ui/virtual-list.ts`), the same widget
 * the Decks screen's deck list uses: recreated fresh every `#rebuild()` (like
 * every other non-DOM control this scene draws), with only its scroll
 * position (`#listScroll`) surviving that.
 *
 * **Composition (fidelity pass, 2026-09-17), against D04.** D04 is a
 * three-column desktop layout — an aspect/filter rail (ending in the cost
 * curve) on the left, the card pool in the middle, "Your deck" on an ink
 * ground on the right — over one legality chip in the header. From
 * `WIDE_MIN_WIDTH` up this scene now draws exactly that split
 * (`#rebuildWide`); below it, every control still stacks in the one column
 * this scene always drew (`#rebuildNarrow`), unchanged. **What stayed a
 * deviation, deliberately:** D04 has no visible deck-name field or Save
 * button — its mockup deck is already named by identity+aspect and "saving"
 * reads as the next setup step ("Table setup ▸"), which doesn't exist yet
 * (W2). This build still needs to name and persist a deck with no setup flow
 * to hand it to, so the name field and a real Save button live at the top of
 * the right (ink) column instead of being dropped — the closest real
 * equivalent of "the deck's own identity" the mockup shows there. Every
 * number and legality string is still `view/deck-stats.ts`/`legalityOf`'s
 * own; this pass only rearranges where they're drawn.
 *
 * Unlike the other four W1/W4 screens in this fidelity pass, this scene has
 * no dedicated `view/*-layout.ts` pure layout module — every rect is computed
 * inline against a running `y` cursor per column, the same shape this file
 * already had. A future pass extracting that into a tested pure function
 * (the way `deck-check-layout.ts` already does for Deck check) is real,
 * unstarted work; this pass keeps the existing architecture rather than
 * introducing a new one under time pressure.
 */

import Phaser from "phaser";
import type { AnyCard, CardType, Deck, HeroIdentityCard } from "@mc/content";
import { POOL_CARDS, POOL_STARTER_DECKS, POOL_VERSION } from "../content/pool.js";
import {
  SELECTABLE_ASPECTS,
  addCard,
  aspectCountFor,
  browsablePool,
  identityOptions,
  legalityOf,
  newDeck,
  removeCard,
  resetToIdentitySet,
  resetToPrecon,
  setAspects,
  setName,
  type PoolFilter,
} from "../view/deck-builder-model.js";
import { costCurveBars, deckListGroupsOf, deckStatsOf } from "../view/deck-stats.js";
import { CHIP_GAP, chipStripHeight, wrapChipsToRows } from "../view/chip-layout.js";
import { deckBuilderFocusOrder } from "../view/screen-focus.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { accent, dotGrid, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTextInput, fitText, label, paintDotGrid, paintPanel } from "../ui/widgets.js";
import { drawCostCurveBars, drawGroupedCardList } from "../ui/deck-stats-widgets.js";
import { deckStorage } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";

export interface DeckBuilderSceneData {
  readonly deck?: Deck;
}

const IDENTITY_ROW_HEIGHT = hit.target;
const CARD_ROW_HEIGHT = 56;
const POOL: readonly AnyCard[] = POOL_CARDS;
const IDENTITIES: readonly HeroIdentityCard[] = identityOptions(POOL);

/** Below this, the three-column desktop split doesn't have room to breathe and the scene stacks into one column instead. */
const WIDE_MIN_WIDTH = 1000;
const LEFT_RAIL_WIDTH = 230;
const RIGHT_RAIL_WIDTH = 300;
const RAIL_GAP = 24;

/**
 * W1's type filter chips (docs/phase4-screen-gaps.md §3): "All" plus every `PoolFilter.type` the pool actually
 * holds player-deck cards of. `null` means "All" — no filter. `text` duplicates `label` to satisfy
 * `view/chip-layout.ts`'s `ChipLabel` (its wrap math reads a chip's display text under that name).
 */
const TYPE_FILTERS: readonly {
  readonly id: string;
  readonly label: string;
  readonly text: string;
  readonly type: CardType | null;
}[] = (
  [
    { id: "all", label: "All", type: null },
    { id: "ally", label: "Ally", type: "ally" },
    { id: "event", label: "Event", type: "event" },
    { id: "upgrade", label: "Upgrade", type: "upgrade" },
    { id: "support", label: "Support", type: "support" },
    { id: "resource", label: "Resource", type: "resource" },
  ] as const
).map((chip) => ({ ...chip, text: chip.label }));

/** How many of the grouped deck list's own entry lines (headers not counted) show before folding the rest into one "+ N more" line — matches D04's own panel. */
const STATS_LIST_ENTRY_CAP = 10;

export class DeckBuilderScene extends Phaser.Scene {
  #identity: HeroIdentityCard | null = null;
  #deck: Deck | null = null;
  #filter: PoolFilter = {};
  #filterText = "";
  #status: string | null = null;
  #busy = false;
  #nameInput: McTextInput | null = null;
  #filterInput: McTextInput | null = null;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();
  /** The list itself is recreated every rebuild (`ui/virtual-list.ts`); only its scroll position persists, in this field. */
  #list: McVirtualList | null = null;
  #listScroll = new ListScroll();

  constructor() {
    super(SCENES.deckBuilder);
  }

  create(data: DeckBuilderSceneData = {}): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#deck = data.deck ?? null;
    this.#identity = this.#deck ? (IDENTITIES.find((i) => i.id === this.#deck!.identityCardId) ?? null) : null;
    this.#filter = {};
    this.#filterText = "";
    this.#status = null;
    this.#busy = false;
    this.#listScroll = new ListScroll();

    const onResize = (): void => this.#rebuild();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#nameInput?.destroy();
      this.#nameInput = null;
      this.#filterInput?.destroy();
      this.#filterInput = null;
      this.#list?.destroy();
      this.#list = null;
    });
    this.#route = new FocusRoute(this, {
      blocked: () =>
        this.scene.isActive(SCENES.inspect) ||
        (this.#nameInput?.focused ?? false) ||
        (this.#filterInput?.focused ?? false),
      onPage: (direction) => this.#list?.scrollByPage(direction),
      onHomeEnd: (edge) => (edge === "home" ? this.#list?.scrollToStart() : this.#list?.scrollToEnd()),
    });
    this.#rebuild();
    fadeScreenIn(this);
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();
    // The list is recreated fresh every rebuild, in the normal draw order
    // (`ui/virtual-list.ts` — reattaching it across a sweep put it ahead of
    // whatever the scene drew afterward). Its scroll position lives in
    // `#listScroll`, which survives this regardless.
    this.#list?.destroy();
    this.#list = null;

    const kept = [
      ...(this.#nameInput ? [this.#nameInput.gameObject] : []),
      ...(this.#filterInput ? [this.#filterInput.gameObject] : []),
    ];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const phone = formFactorFor(width, height) === "phone";
    const wide = !phone && width >= WIDE_MIN_WIDTH;
    const pad = phone ? 16 : 40;
    const column = Math.min(width - pad * 2, wide ? 1200 : 720);
    const left = (width - column) / 2;
    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", dotGrid.onPaper);

    let y = pad;
    this.add
      .text(left, y, "DECK BUILDER", {
        ...textStyle(typeRole.screenTitle, surface.ink.hex),
        fontSize: phone ? "28px" : "38px",
      })
      .setLetterSpacing(2);
    const backRect: Rect = { x: left + column - 100, y: y + 2, width: 100, height: hit.target };
    const goBack = (): void => {
      goToScreen(this, SCENES.decks);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Back",
        type: typeRole.rowTitle,
        rect: backRect,
        onClick: goBack,
      }),
    );
    this.#stops.set("back", { rect: backRect, activate: goBack });
    y += (phone ? 28 : 38) + 16;

    if (!this.#identity) {
      this.#drawIdentityPicker(left, y, column);
      this.#route?.set(
        deckBuilderFocusOrder({
          identityChosen: false,
          identityIds: IDENTITIES.map((identity) => identity.id as string),
          aspectIds: [],
          typeFilterIds: [],
          poolCardIds: [],
        }),
        this.#stops,
      );
      return;
    }

    const deck = this.#deck!;
    label(this, left, y, `identity — ${this.#identity.name}`, typeRole.label, surface.ink.hex, ink.label);
    y += 20;

    const pool = wide ? this.#rebuildWide(left, y, column, deck) : this.#rebuildNarrow(left, y, column, deck);

    this.#route?.set(
      deckBuilderFocusOrder({
        identityChosen: true,
        identityIds: [],
        aspectIds: [...SELECTABLE_ASPECTS],
        typeFilterIds: TYPE_FILTERS.map((f) => f.id),
        poolCardIds: pool.map((card) => card.id as string),
      }),
      this.#stops,
    );
  }

  /**
   * The narrow (phone/tablet) layout: everything in the one column D04's own
   * canvas doesn't have room for below `WIDE_MIN_WIDTH` — aspect, filter
   * chips, name, legality, the stats panel, Preconstructed/Clear, Save, the
   * pool search, then the pool list filling whatever height is left. Returns
   * the browsable pool, for the caller's focus order.
   */
  #rebuildNarrow(left: number, top: number, column: number, deck: Deck): readonly AnyCard[] {
    let y = top;
    y = this.#drawAspectPicker(left, y, column, deck);
    y = this.#drawTypeFilters(left, y, column);
    y = this.#drawNameField(left, y, column, deck);
    y = this.#drawLegalityLine(left, y, column, deck);
    y = this.#drawCostCurve(left, y, column, deck, false);
    y = this.#drawYourDeckList(left, y, column, deck, false);
    y = this.#drawPreconClearSave(left, y, column, deck);

    const { height } = this.scale.gameSize;
    const pad = 16;
    label(this, left, y, "search the pool", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    y = this.#drawFilterInput(left, y, column);
    const pool = browsablePool(POOL, this.#identity!, deck.aspects, this.#filter);
    label(
      this,
      left,
      y,
      `pool — ${pool.length} card${pool.length === 1 ? "" : "s"}`,
      typeRole.label,
      surface.ink.hex,
      ink.label,
    );
    y += 16;
    const listRect: Rect = { x: left, y, width: column, height: Math.max(CARD_ROW_HEIGHT, height - y - pad) };
    this.#drawPoolList(listRect, deck, pool);
    return pool;
  }

  /**
   * The wide (desktop) layout (D04): a left aspect/filter/cost-curve rail, the
   * card pool in the middle, "Your deck" on its own ink ground on the right.
   * Returns the browsable pool, for the caller's focus order.
   */
  #rebuildWide(left: number, top: number, column: number, deck: Deck): readonly AnyCard[] {
    const { height } = this.scale.gameSize;
    const pad = 40;
    const bottom = height - pad;

    const leftX = left;
    const midX = leftX + LEFT_RAIL_WIDTH + RAIL_GAP;
    const midWidth = Math.max(240, column - LEFT_RAIL_WIDTH - RIGHT_RAIL_WIDTH - RAIL_GAP * 2);
    const rightX = midX + midWidth + RAIL_GAP;

    // Left rail: aspect, filter, cost curve.
    let leftY = top;
    leftY = this.#drawAspectPicker(leftX, leftY, LEFT_RAIL_WIDTH, deck);
    leftY = this.#drawTypeFilters(leftX, leftY, LEFT_RAIL_WIDTH);
    label(this, leftX, leftY, "cost curve", typeRole.label, surface.ink.hex, ink.label);
    leftY += 16;
    this.#drawCostCurve(leftX, leftY, LEFT_RAIL_WIDTH, deck, true);

    // Right rail: name, legality, Your deck, Preconstructed/Clear, Save — one ink ground panel behind all of it.
    const rightPanel = this.add.graphics();
    paintPanel(
      rightPanel,
      { x: rightX, y: top - 8, width: RIGHT_RAIL_WIDTH, height: bottom - top + 8 },
      "onInk",
      "rest",
    );
    let rightY = top + 8;
    rightY = this.#drawNameField(rightX + 12, rightY, RIGHT_RAIL_WIDTH - 24, deck, true);
    rightY = this.#drawLegalityLine(rightX + 12, rightY, RIGHT_RAIL_WIDTH - 24, deck, true);
    rightY += 4;
    rightY = this.#drawYourDeckList(rightX + 12, rightY, RIGHT_RAIL_WIDTH - 24, deck, true);
    this.#drawPreconClearSave(rightX + 12, bottom - hit.target * 2 - 24, RIGHT_RAIL_WIDTH - 24, deck, true);

    // Middle: the pool, search field above it.
    let midY = top;
    label(this, midX, midY, "card pool", typeRole.label, surface.ink.hex, ink.label);
    midY += 16;
    midY = this.#drawFilterInput(midX, midY, midWidth);
    const pool = browsablePool(POOL, this.#identity!, deck.aspects, this.#filter);
    label(
      this,
      midX,
      midY,
      `${pool.length} card${pool.length === 1 ? "" : "s"}`,
      typeRole.label,
      surface.ink.hex,
      ink.meta,
    );
    midY += 16;
    const listRect: Rect = { x: midX, y: midY, width: midWidth, height: Math.max(CARD_ROW_HEIGHT, bottom - midY) };
    this.#drawPoolList(listRect, deck, pool);
    return pool;
  }

  #drawAspectPicker(left: number, top: number, column: number, deck: Deck): number {
    let y = top;
    const maxAspects = aspectCountFor(this.#identity!);
    label(this, left, y, `aspect (choose ${maxAspects})`, typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const aspectCols = column >= 420 ? SELECTABLE_ASPECTS.length : 2;
    const aspectRows = Math.ceil(SELECTABLE_ASPECTS.length / aspectCols);
    const aspectCellWidth = (column - (aspectCols - 1) * 6) / aspectCols;
    SELECTABLE_ASPECTS.forEach((aspect, index) => {
      const row = Math.floor(index / aspectCols);
      const col = index % aspectCols;
      const rect: Rect = {
        x: left + col * (aspectCellWidth + 6),
        y: y + row * (hit.target + 6),
        width: aspectCellWidth,
        height: hit.target,
      };
      const selected = deck.aspects.includes(aspect);
      const toggle = (): void => {
        if (selected)
          this.#setDeck(
            setAspects(
              deck,
              deck.aspects.filter((a) => a !== aspect),
            ),
          );
        else if (deck.aspects.length < maxAspects) this.#setDeck(setAspects(deck, [...deck.aspects, aspect]));
        else this.#setDeck(setAspects(deck, [...deck.aspects.slice(1), aspect]));
      };
      this.#buttons.push(
        new McButton(this, { kind: "secondary", label: aspect, type: typeRole.label, rect, selected, onClick: toggle }),
      );
      this.#stops.set(`aspect:${aspect}`, { rect, activate: toggle });
    });
    return y + aspectRows * (hit.target + 6) + 10;
  }

  #drawTypeFilters(left: number, top: number, column: number): number {
    let y = top;
    label(this, left, y, "filter", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const typeChipRows = wrapChipsToRows(TYPE_FILTERS, column);
    const activeTypeFilterId = TYPE_FILTERS.find((f) => f.type === (this.#filter.type ?? null))?.id ?? "all";
    typeChipRows.forEach((row, rowIndex) => {
      const cellWidth = (column - (row.length - 1) * CHIP_GAP) / row.length;
      row.forEach((chip, index) => {
        const rect: Rect = {
          x: left + index * (cellWidth + CHIP_GAP),
          y: y + rowIndex * (hit.target + CHIP_GAP),
          width: cellWidth,
          height: hit.target,
        };
        const selected = chip.id === activeTypeFilterId;
        const applyFilter = (): void => {
          this.#filter = { ...this.#filter, type: chip.type };
          this.#listScroll.reset();
          this.#rebuild();
        };
        this.#buttons.push(
          new McButton(this, {
            kind: "secondary",
            label: chip.label,
            type: typeRole.label,
            rect,
            selected,
            onClick: applyFilter,
          }),
        );
        this.#stops.set(`type:${chip.id}`, { rect, activate: applyFilter });
      });
    });
    return y + chipStripHeight(typeChipRows.length) + 16;
  }

  #drawNameField(left: number, top: number, column: number, deck: Deck, onDark = false): number {
    let y = top;
    label(
      this,
      left,
      y,
      "deck name",
      typeRole.label,
      onDark ? surface.paper.hex : surface.ink.hex,
      onDark ? ink.secondary : ink.label,
    );
    y += 16;
    const nameRect: Rect = { x: left, y, width: column, height: hit.target };
    if (this.#nameInput) this.#nameInput.layout(nameRect);
    else {
      this.#nameInput = new McTextInput(this, {
        rect: nameRect,
        value: deck.name,
        type: typeRole.rowTitle,
        onChange: (value) => this.#setDeck(setName(this.#deck!, value), false),
      });
    }
    this.#stops.set("name", { rect: nameRect, activate: () => this.#nameInput?.focus() });
    return y + hit.target + 16;
  }

  #drawLegalityLine(left: number, top: number, column: number, deck: Deck, onDark = false): number {
    let y = top;
    const verdict = legalityOf(deck, POOL);
    const cardCount = deck.cards.reduce((n, c) => n + c.quantity, 0);
    const legalityText = verdict.ok
      ? `Legal — ${cardCount} cards.`
      : `${verdict.problems.length} problem${verdict.problems.length === 1 ? "" : "s"}: ${verdict.problems.map((p) => p.message).join(" ")}`;
    const color = verdict.ok ? signal.heal.hex : accent.redDeep.hex;
    const legalityLine = this.add
      .text(left, y, legalityText, textStyle(typeRole.body, onDark ? surface.paper.hex : color))
      .setWordWrapWidth(column);
    if (onDark && verdict.ok) legalityLine.setColor(cssOf(signal.heal.hex));
    y += legalityLine.height + 12;

    if (this.#status) {
      const statusLine = this.add
        .text(
          left,
          y,
          this.#status,
          textStyle(typeRole.body, onDark ? surface.paper.hex : surface.ink.hex, ink.secondary),
        )
        .setWordWrapWidth(column);
      y += statusLine.height + 8;
    }
    return y;
  }

  /**
   * The cost curve chart alone (D04's own left-rail placement, wide layout) —
   * split out of what used to be one combined "stats panel" so the wide
   * layout can put it in the left rail while "Your deck" (`#drawYourDeckList`)
   * goes in the right one; the narrow layout still calls both back to back,
   * in the same order as before.
   */
  #drawCostCurve(left: number, top: number, column: number, deck: Deck, onDark: boolean): number {
    const stats = deckStatsOf(deck, POOL);
    const chartHeight = 74;
    drawCostCurveBars(this, { x: left, y: top, width: column, height: chartHeight }, costCurveBars(stats), onDark);
    return top + chartHeight + 16;
  }

  /** "Your deck", grouped Hero / aspect / Basic with a "+ N more" overflow (D04's right rail; the narrow layout's own stats panel). */
  #drawYourDeckList(left: number, top: number, column: number, deck: Deck, onDark: boolean): number {
    label(
      this,
      left,
      top,
      "your deck",
      typeRole.label,
      onDark ? surface.paper.hex : surface.ink.hex,
      onDark ? ink.secondary : ink.label,
    );
    const groups = deckListGroupsOf(deck, POOL);
    return drawGroupedCardList(this, left, top + 16, column, groups, STATS_LIST_ENTRY_CAP, onDark);
  }

  #drawPreconClearSave(left: number, top: number, column: number, deck: Deck, onDark = false): number {
    let y = top;
    const resetRowGap = 8;
    const resetCellWidth = (column - resetRowGap) / 2;
    const preconRect: Rect = { x: left, y, width: resetCellWidth, height: hit.target };
    const clearRect: Rect = { x: left + resetCellWidth + resetRowGap, y, width: resetCellWidth, height: hit.target };
    const precon = resetToPrecon(deck, this.#identity!, POOL_STARTER_DECKS);
    const doPrecon = (): void => {
      if (precon) this.#setDeck(precon);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: onDark ? "onInk" : "secondary",
        label: "Preconstructed",
        type: typeRole.label,
        rect: preconRect,
        enabled: precon !== null,
        ...(precon === null ? { reason: "This hero has no published precon to reset to." } : {}),
        onClick: doPrecon,
      }),
    );
    this.#stops.set("preconstructed", { rect: preconRect, activate: doPrecon });
    const doClear = (): void => this.#setDeck(resetToIdentitySet(deck, this.#identity!, POOL));
    this.#buttons.push(
      new McButton(this, {
        kind: onDark ? "onInk" : "secondary",
        label: "Clear",
        type: typeRole.label,
        rect: clearRect,
        onClick: doClear,
      }),
    );
    this.#stops.set("clear", { rect: clearRect, activate: doClear });
    y += hit.target + 16;

    const saveRect: Rect = { x: left, y, width: column, height: hit.primary };
    const doSave = (): void => void this.#save();
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: this.#busy ? "Saving…" : "Save deck",
        type: typeRole.barTitle,
        rect: saveRect,
        enabled: !this.#busy,
        onClick: doSave,
      }),
    );
    this.#stops.set("save", { rect: saveRect, activate: doSave });
    return y + hit.primary + 16;
  }

  #drawFilterInput(left: number, top: number, column: number): number {
    const filterRect: Rect = { x: left, y: top, width: column, height: hit.target };
    if (this.#filterInput) this.#filterInput.layout(filterRect);
    else {
      this.#filterInput = new McTextInput(this, {
        rect: filterRect,
        value: this.#filterText,
        placeholder: "card name",
        onChange: (value) => {
          this.#filterText = value;
          this.#filter = { ...this.#filter, text: value };
          this.#listScroll.reset();
          this.#rebuild();
        },
      });
    }
    this.#stops.set("filter-text", { rect: filterRect, activate: () => this.#filterInput?.focus() });
    return top + hit.target + 16;
  }

  /** The pool, virtualized: `McVirtualList` owns which rows are live game objects; every card still gets a focus stop regardless of whether it's currently drawn. */
  #drawPoolList(listRect: Rect, deck: Deck, pool: readonly AnyCard[]): void {
    if (pool.length === 0) {
      this.add.text(
        listRect.x + 10,
        listRect.y + 10,
        "No cards match this filter.",
        textStyle(typeRole.body, surface.ink.hex, ink.meta),
      );
    }
    const renderRow = (index: number, rect: Rect): VirtualListRow => this.#renderCardRow(rect, deck, pool[index]!);
    this.#list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: CARD_ROW_HEIGHT,
      count: pool.length,
      renderRow,
      scroll: this.#listScroll,
    });
    const list = this.#list;
    pool.forEach((card, index) => {
      const cardId = card.id as string;
      this.#stops.set(`card:${cardId}`, {
        rect: () => list.rectFor(index),
        activate: () => this.#setDeck(addCard(deck, card.id)),
        inspect: () => this.#inspect(card),
        ensureVisible: () => list.scrollIntoView(index),
      });
    });
  }

  #drawIdentityPicker(left: number, y: number, column: number): void {
    label(this, left, y, "pick an identity", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const rail = this.add.graphics();
    paintPanel(
      rail,
      { x: left, y, width: column, height: IDENTITIES.length * (IDENTITY_ROW_HEIGHT + 6) + 6 },
      "rail",
      "rest",
    );
    IDENTITIES.forEach((identity, index) => {
      const rect: Rect = {
        x: left + 6,
        y: y + 6 + index * (IDENTITY_ROW_HEIGHT + 6),
        width: column - 12,
        height: IDENTITY_ROW_HEIGHT,
      };
      const choose = (): void => {
        this.#identity = identity;
        this.#deck = newDeck(
          identity,
          POOL_CARDS,
          `deck-${crypto.randomUUID()}`,
          POOL_VERSION,
          new Date().toISOString(),
        );
        this.#rebuild();
      };
      this.#buttons.push(
        new McButton(this, { kind: "secondary", label: identity.name, type: typeRole.rowTitle, rect, onClick: choose }),
      );
      this.#stops.set(`identity:${identity.id as string}`, { rect, activate: choose });
    });
  }

  #renderCardRow(rect: Rect, deck: Deck, card: AnyCard): VirtualListRow {
    const row: Rect = { x: rect.x + 4, y: rect.y, width: rect.width - 8, height: CARD_ROW_HEIGHT - 6 };
    const objects: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics();
    paintPanel(g, row, "card", "rest");
    objects.push(g);
    const quantity = deck.cards.find((c) => c.cardId === card.id)?.quantity ?? 0;

    const name = this.add.text(row.x + 10, row.y + 6, card.name, textStyle(typeRole.rowTitle, surface.ink.hex));
    fitText(name, row.width - 190);
    objects.push(name);
    const cost = "cost" in card ? String((card as unknown as { cost: number }).cost) : "—";
    objects.push(
      this.add.text(
        row.x + 10,
        row.y + 6 + name.height + 2,
        `${card.type.replace(/_/g, " ")} · cost ${cost}`,
        textStyle(typeRole.label, surface.ink.hex, ink.meta),
      ),
    );

    const qtyText = label(
      this,
      row.x + row.width - 128,
      row.y + row.height / 2,
      String(quantity),
      typeRole.rowTitle,
      surface.ink.hex,
    ).setOrigin(0.5);
    objects.push(qtyText);

    // `clip`/`suppressClick` read `this.#list` lazily (see decks.ts's
    // `#renderRow` for why it can't be a value captured up front): a row
    // reparented into the list's masked layer is still fully hit-testable
    // outside the mask, and a drag that just scrolled the list must not also
    // add or remove a card it happened to end over.
    const clip = (): Rect | null => this.#list?.rect ?? null;
    const suppressClick = (): boolean => this.#list?.isDragSuppressingClick ?? false;

    const minusRect: Rect = {
      x: row.x + row.width - 106,
      y: row.y + (row.height - hit.target) / 2,
      width: 40,
      height: hit.target,
    };
    const doRemove = (): void => this.#setDeck(removeCard(deck, card.id));
    const minusButton = new McButton(this, {
      kind: "secondary",
      label: "−",
      type: typeRole.rowTitle,
      rect: minusRect,
      enabled: quantity > 0,
      onClick: doRemove,
      clip,
      suppressClick,
    });
    objects.push(minusButton.container);

    const plusRect: Rect = { x: row.x + row.width - 46, y: minusRect.y, width: 40, height: hit.target };
    const doAdd = (): void => this.#setDeck(addCard(deck, card.id));
    const plusButton = new McButton(this, {
      kind: "secondary",
      label: "+",
      type: typeRole.rowTitle,
      rect: plusRect,
      onClick: doAdd,
      clip,
      suppressClick,
    });
    objects.push(plusButton.container);

    return { objects };
  }

  #inspect(card: AnyCard): void {
    this.scene.launch(SCENES.inspect, { card: { cardId: card.id, face: { kind: "front" } } });
  }

  #setDeck(deck: Deck, rebuild = true): void {
    this.#deck = deck;
    if (rebuild) this.#rebuild();
  }

  async #save(): Promise<void> {
    if (this.#busy || !this.#deck) return;
    this.#busy = true;
    this.#rebuild();
    await deckStorage().put(this.#deck);
    this.#busy = false;
    this.#status = "Saved.";
    this.#rebuild();
  }
}

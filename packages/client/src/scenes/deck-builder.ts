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
 */

import Phaser from "phaser";
import type { AnyCard, Deck, HeroIdentityCard } from "@mc/content";
import { POOL_CARDS, POOL_VERSION } from "../content/pool.js";
import {
  SELECTABLE_ASPECTS,
  addCard,
  aspectCountFor,
  browsablePool,
  identityOptions,
  legalityOf,
  newDeck,
  removeCard,
  setAspects,
  setName,
  type PoolFilter,
} from "../view/deck-builder-model.js";
import { deckBuilderFocusOrder } from "../view/screen-focus.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { accent, dotGrid, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTextInput, fitText, label, paintDotGrid, paintPanel } from "../ui/widgets.js";
import { deckStorage } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface DeckBuilderSceneData {
  readonly deck?: Deck;
}

const IDENTITY_ROW_HEIGHT = hit.target;
const CARD_ROW_HEIGHT = 56;
const POOL: readonly AnyCard[] = POOL_CARDS;
const IDENTITIES: readonly HeroIdentityCard[] = identityOptions(POOL);

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
      blocked: () => this.scene.isActive(SCENES.inspect) || (this.#nameInput?.focused ?? false) || (this.#filterInput?.focused ?? false),
      onPage: (direction) => this.#list?.scrollByPage(direction),
      onHomeEnd: (edge) => (edge === "home" ? this.#list?.scrollToStart() : this.#list?.scrollToEnd()),
    });
    this.#rebuild();
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

    const kept = [...(this.#nameInput ? [this.#nameInput.gameObject] : []), ...(this.#filterInput ? [this.#filterInput.gameObject] : [])];
    for (const node of kept) this.children.remove(node);
    this.children.removeAll(true);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const phone = formFactorFor(width, height) === "phone";
    const pad = phone ? 16 : 40;
    const column = Math.min(width - pad * 2, 720);
    const left = (width - column) / 2;
    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", dotGrid.onPaper);

    let y = pad;
    this.add.text(left, y, "DECK BUILDER", { ...textStyle(typeRole.screenTitle, surface.ink.hex), fontSize: phone ? "28px" : "38px" }).setLetterSpacing(2);
    const backRect: Rect = { x: left + column - 100, y: y + 2, width: 100, height: hit.target };
    const goBack = (): void => {
      this.scene.start(SCENES.decks);
    };
    this.#buttons.push(new McButton(this, { kind: "secondary", label: "Back", type: typeRole.rowTitle, rect: backRect, onClick: goBack }));
    this.#stops.set("back", { rect: backRect, activate: goBack });
    y += (phone ? 28 : 38) + 16;

    if (!this.#identity) {
      this.#drawIdentityPicker(left, y, column);
      this.#route?.set(
        deckBuilderFocusOrder({ identityChosen: false, identityIds: IDENTITIES.map((identity) => identity.id as string), aspectIds: [], poolCardIds: [] }),
        this.#stops,
      );
      return;
    }

    const deck = this.#deck!;
    label(this, left, y, `identity — ${this.#identity.name}`, typeRole.label, surface.ink.hex, ink.label);
    y += 20;

    // Aspects: as many as this identity's deckbuilding requires (RRG default 1).
    const maxAspects = aspectCountFor(this.#identity);
    label(this, left, y, `aspect (choose ${maxAspects})`, typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const aspectCols = SELECTABLE_ASPECTS.length;
    const aspectCellWidth = (column - (aspectCols - 1) * 6) / aspectCols;
    SELECTABLE_ASPECTS.forEach((aspect, index) => {
      const rect: Rect = { x: left + index * (aspectCellWidth + 6), y, width: aspectCellWidth, height: hit.target };
      const selected = deck.aspects.includes(aspect);
      const toggle = (): void => {
        if (selected) this.#setDeck(setAspects(deck, deck.aspects.filter((a) => a !== aspect)));
        else if (deck.aspects.length < maxAspects) this.#setDeck(setAspects(deck, [...deck.aspects, aspect]));
        else this.#setDeck(setAspects(deck, [...deck.aspects.slice(1), aspect]));
      };
      this.#buttons.push(new McButton(this, { kind: "secondary", label: aspect, type: typeRole.label, rect, selected, onClick: toggle }));
      this.#stops.set(`aspect:${aspect}`, { rect, activate: toggle });
    });
    y += hit.target + 16;

    // Name.
    label(this, left, y, "deck name", typeRole.label, surface.ink.hex, ink.label);
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
    y += hit.target + 16;

    // Legality, live from the engine — never recomputed here beyond calling it.
    const verdict = legalityOf(deck, POOL);
    const cardCount = deck.cards.reduce((n, c) => n + c.quantity, 0);
    const legalityText = verdict.ok
      ? `Legal — ${cardCount} cards.`
      : `${verdict.problems.length} problem${verdict.problems.length === 1 ? "" : "s"}: ${verdict.problems.map((p) => p.message).join(" ")}`;
    const legalityLine = this.add
      .text(left, y, legalityText, textStyle(typeRole.body, verdict.ok ? signal.heal.hex : accent.redDeep.hex))
      .setWordWrapWidth(column);
    y += legalityLine.height + 12;

    if (this.#status) {
      const statusLine = this.add.text(left, y, this.#status, textStyle(typeRole.body, surface.ink.hex, ink.secondary)).setWordWrapWidth(column);
      y += statusLine.height + 8;
    }

    // Save.
    const saveRect: Rect = { x: left, y, width: column, height: hit.primary };
    const doSave = (): void => void this.#save();
    this.#buttons.push(new McButton(this, { kind: "primary", label: this.#busy ? "Saving…" : "Save deck", type: typeRole.barTitle, rect: saveRect, enabled: !this.#busy, onClick: doSave }));
    y += hit.primary + 16;

    // Filter.
    label(this, left, y, "search the pool", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const filterRect: Rect = { x: left, y, width: column, height: hit.target };
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
    y += hit.target + 16;

    // The pool, virtualized: `McVirtualList` owns which rows are live game
    // objects; every card still gets a focus stop below regardless of
    // whether it's currently drawn.
    const pool = browsablePool(POOL, this.#identity, deck.aspects, this.#filter);
    label(this, left, y, `pool — ${pool.length} card${pool.length === 1 ? "" : "s"}`, typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const listRect: Rect = { x: left, y, width: column, height: Math.max(CARD_ROW_HEIGHT, height - y - pad) };

    if (pool.length === 0) {
      this.add.text(listRect.x + 10, listRect.y + 10, "No cards match this filter.", textStyle(typeRole.body, surface.ink.hex, ink.meta));
    }

    const renderRow = (index: number, rect: Rect): VirtualListRow => this.#renderCardRow(rect, deck, pool[index]!);
    this.#list = new McVirtualList(this, { rect: listRect, rowHeight: CARD_ROW_HEIGHT, count: pool.length, renderRow, scroll: this.#listScroll });
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

    this.#stops.set("save", { rect: saveRect, activate: doSave });

    this.#route?.set(
      deckBuilderFocusOrder({
        identityChosen: true,
        identityIds: [],
        aspectIds: [...SELECTABLE_ASPECTS],
        poolCardIds: pool.map((card) => card.id as string),
      }),
      this.#stops,
    );
  }

  #drawIdentityPicker(left: number, y: number, column: number): void {
    label(this, left, y, "pick an identity", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const rail = this.add.graphics();
    paintPanel(rail, { x: left, y, width: column, height: IDENTITIES.length * (IDENTITY_ROW_HEIGHT + 6) + 6 }, "rail", "rest");
    IDENTITIES.forEach((identity, index) => {
      const rect: Rect = { x: left + 6, y: y + 6 + index * (IDENTITY_ROW_HEIGHT + 6), width: column - 12, height: IDENTITY_ROW_HEIGHT };
      const choose = (): void => {
        this.#identity = identity;
        this.#deck = newDeck(identity, POOL_CARDS, `deck-${crypto.randomUUID()}`, POOL_VERSION, new Date().toISOString());
        this.#rebuild();
      };
      this.#buttons.push(new McButton(this, { kind: "secondary", label: identity.name, type: typeRole.rowTitle, rect, onClick: choose }));
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
    objects.push(this.add.text(row.x + 10, row.y + 6 + name.height + 2, `${card.type.replace(/_/g, " ")} · cost ${cost}`, textStyle(typeRole.label, surface.ink.hex, ink.meta)));

    const qtyText = label(this, row.x + row.width - 128, row.y + row.height / 2, String(quantity), typeRole.rowTitle, surface.ink.hex).setOrigin(0.5);
    objects.push(qtyText);

    // `clip`/`suppressClick` read `this.#list` lazily (see decks.ts's
    // `#renderRow` for why it can't be a value captured up front): a row
    // reparented into the list's masked layer is still fully hit-testable
    // outside the mask, and a drag that just scrolled the list must not also
    // add or remove a card it happened to end over.
    const clip = (): Rect | null => this.#list?.rect ?? null;
    const suppressClick = (): boolean => this.#list?.isDragSuppressingClick ?? false;

    const minusRect: Rect = { x: row.x + row.width - 106, y: row.y + (row.height - hit.target) / 2, width: 40, height: hit.target };
    const doRemove = (): void => this.#setDeck(removeCard(deck, card.id));
    const minusButton = new McButton(this, { kind: "secondary", label: "−", type: typeRole.rowTitle, rect: minusRect, enabled: quantity > 0, onClick: doRemove, clip, suppressClick });
    objects.push(minusButton.container);

    const plusRect: Rect = { x: row.x + row.width - 46, y: minusRect.y, width: 40, height: hit.target };
    const doAdd = (): void => this.#setDeck(addCard(deck, card.id));
    const plusButton = new McButton(this, { kind: "secondary", label: "+", type: typeRole.rowTitle, rect: plusRect, onClick: doAdd, clip, suppressClick });
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

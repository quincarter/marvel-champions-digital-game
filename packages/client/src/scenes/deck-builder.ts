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
 * The pool browser is a long, filterable list, so it follows the same
 * redraw-safe virtualized pattern as the Decks screen's deck list
 * (`view/list-scroll.ts`).
 */

import Phaser from "phaser";
import { CORE_CARDS, CORE_POOL_VERSION, type AnyCard, type Deck, type HeroIdentityCard } from "@mc/content";
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
import { ListScroll, thumbOf } from "../view/list-scroll.js";
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
const POOL: readonly AnyCard[] = CORE_CARDS;
const IDENTITIES: readonly HeroIdentityCard[] = identityOptions(POOL);

export class DeckBuilderScene extends Phaser.Scene {
  #identity: HeroIdentityCard | null = null;
  #deck: Deck | null = null;
  #filter: PoolFilter = {};
  #filterText = "";
  #scroll = new ListScroll();
  #status: string | null = null;
  #busy = false;
  #nameInput: McTextInput | null = null;
  #filterInput: McTextInput | null = null;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();
  #listRect: Rect | null = null;

  constructor() {
    super(SCENES.deckBuilder);
  }

  create(data: DeckBuilderSceneData = {}): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#deck = data.deck ?? null;
    this.#identity = this.#deck ? (IDENTITIES.find((i) => i.id === this.#deck!.identityCardId) ?? null) : null;
    this.#filter = {};
    this.#filterText = "";
    this.#scroll = new ListScroll();
    this.#status = null;
    this.#busy = false;

    const onResize = (): void => this.#rebuild();
    this.scale.on("resize", onResize, this);
    this.input.on("wheel", this.#onWheel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.input.off("wheel", this.#onWheel, this);
      this.#nameInput?.destroy();
      this.#nameInput = null;
      this.#filterInput?.destroy();
      this.#filterInput = null;
    });
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect) || (this.#nameInput?.focused ?? false) || (this.#filterInput?.focused ?? false),
    });
    this.#rebuild();
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();

    const nameNode = this.#nameInput?.gameObject ?? null;
    const filterNode = this.#filterInput?.gameObject ?? null;
    if (nameNode) this.children.remove(nameNode);
    if (filterNode) this.children.remove(filterNode);
    this.children.removeAll(true);
    if (nameNode) this.children.add(nameNode);
    if (filterNode) this.children.add(filterNode);

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
        deckBuilderFocusOrder({
          identityChosen: false,
          identityIds: IDENTITIES.map((identity) => identity.id as string),
          aspectIds: [],
          visiblePoolCardIds: [],
          canScrollUp: false,
          canScrollDown: false,
        }),
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
          this.#scroll.reset();
          this.#rebuild();
        },
      });
    }
    this.#stops.set("filter-text", { rect: filterRect, activate: () => this.#filterInput?.focus() });
    y += hit.target + 16;

    // The pool, virtualized: only the visible rows become game objects or focus stops.
    const pool = browsablePool(POOL, this.#identity, deck.aspects, this.#filter);
    label(this, left, y, `pool — ${pool.length} card${pool.length === 1 ? "" : "s"}`, typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const listRect: Rect = { x: left, y, width: column, height: Math.max(CARD_ROW_HEIGHT, height - y - pad) };
    this.#listRect = listRect;
    const rail = this.add.graphics();
    paintPanel(rail, listRect, "rail", "rest");

    const rowsVisible = Math.max(1, Math.floor((listRect.height - 8) / CARD_ROW_HEIGHT));
    const win = this.#scroll.windowFor(pool.length, rowsVisible);
    if (pool.length === 0) {
      this.add.text(listRect.x + 10, listRect.y + 10, "No cards match this filter.", textStyle(typeRole.body, surface.ink.hex, ink.meta));
    }
    let rowY = listRect.y + 4;
    for (let i = win.start; i < win.end; i++) {
      this.#drawCardRow(left, rowY, column, deck, pool[i]!);
      rowY += CARD_ROW_HEIGHT;
    }
    const thumb = thumbOf(win, pool.length);
    if (thumb) {
      const track: Rect = { x: listRect.x + listRect.width - 6, y: listRect.y, width: 3, height: listRect.height };
      const tg = this.add.graphics();
      tg.fillStyle(surface.ink.hex, 0.12).fillRect(track.x, track.y, track.width, track.height);
      tg.fillStyle(surface.ink.hex, 0.6).fillRect(track.x, track.y + thumb.top * track.height, track.width, Math.max(10, thumb.size * track.height));
    }
    const canScrollUp = win.start > 0;
    const canScrollDown = win.end < pool.length;
    if (canScrollUp) this.#stops.set("scroll-up", { rect: { x: listRect.x, y: listRect.y - 2, width: listRect.width, height: 4 }, activate: () => this.#scrollBy(-3, pool.length, rowsVisible) });
    if (canScrollDown) this.#stops.set("scroll-down", { rect: { x: listRect.x, y: listRect.y + listRect.height - 2, width: listRect.width, height: 4 }, activate: () => this.#scrollBy(3, pool.length, rowsVisible) });

    this.#stops.set("save", { rect: saveRect, activate: doSave });

    this.#route?.set(
      deckBuilderFocusOrder({
        identityChosen: true,
        identityIds: [],
        aspectIds: [...SELECTABLE_ASPECTS],
        visiblePoolCardIds: pool.slice(win.start, win.end).map((card) => card.id as string),
        canScrollUp,
        canScrollDown,
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
        this.#deck = newDeck(identity, CORE_CARDS, `deck-${crypto.randomUUID()}`, CORE_POOL_VERSION, new Date().toISOString());
        this.#rebuild();
      };
      this.#buttons.push(new McButton(this, { kind: "secondary", label: identity.name, type: typeRole.rowTitle, rect, onClick: choose }));
      this.#stops.set(`identity:${identity.id as string}`, { rect, activate: choose });
    });
  }

  #drawCardRow(x: number, y: number, width: number, deck: Deck, card: AnyCard): void {
    const rect: Rect = { x: x + 4, y, width: width - 8, height: CARD_ROW_HEIGHT - 6 };
    const g = this.add.graphics();
    paintPanel(g, rect, "card", "rest");
    const quantity = deck.cards.find((c) => c.cardId === card.id)?.quantity ?? 0;

    const name = this.add.text(rect.x + 10, rect.y + 6, card.name, textStyle(typeRole.rowTitle, surface.ink.hex));
    fitText(name, rect.width - 190);
    const cost = "cost" in card ? String((card as unknown as { cost: number }).cost) : "—";
    this.add.text(rect.x + 10, rect.y + 6 + name.height + 2, `${card.type.replace(/_/g, " ")} · cost ${cost}`, textStyle(typeRole.label, surface.ink.hex, ink.meta));

    const qtyText = label(this, rect.x + rect.width - 128, rect.y + rect.height / 2, String(quantity), typeRole.rowTitle, surface.ink.hex).setOrigin(0.5);

    const minusRect: Rect = { x: rect.x + rect.width - 106, y: rect.y + (rect.height - hit.target) / 2, width: 40, height: hit.target };
    const doRemove = (): void => this.#setDeck(removeCard(deck, card.id));
    this.#buttons.push(new McButton(this, { kind: "secondary", label: "−", type: typeRole.rowTitle, rect: minusRect, enabled: quantity > 0, onClick: doRemove }));

    const plusRect: Rect = { x: rect.x + rect.width - 46, y: minusRect.y, width: 40, height: hit.target };
    const doAdd = (): void => this.#setDeck(addCard(deck, card.id));
    this.#buttons.push(new McButton(this, { kind: "secondary", label: "+", type: typeRole.rowTitle, rect: plusRect, onClick: doAdd }));

    qtyText.setDepth(1);
    this.#stops.set(`card:${card.id as string}`, { rect, activate: doAdd, inspect: () => this.#inspect(card) });
  }

  #inspect(card: AnyCard): void {
    this.scene.launch(SCENES.inspect, { card: { cardId: card.id, face: { kind: "front" } } });
  }

  #setDeck(deck: Deck, rebuild = true): void {
    this.#deck = deck;
    if (rebuild) this.#rebuild();
  }

  #scrollBy(rows: number, count: number, rowsVisible: number): void {
    if (this.#scroll.scrollBy(rows, count, rowsVisible)) this.#rebuild();
  }

  #onWheel(pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number): void {
    const rect = this.#listRect;
    if (!this.#identity || !rect || pointer.x < rect.x || pointer.x > rect.x + rect.width || pointer.y < rect.y || pointer.y > rect.y + rect.height) return;
    const pool = browsablePool(POOL, this.#identity, this.#deck?.aspects ?? [], this.#filter);
    const rowsVisible = Math.max(1, Math.floor((rect.height - 8) / CARD_ROW_HEIGHT));
    const lines = Math.trunc(dy / 40);
    if (lines !== 0) this.#scrollBy(lines, pool.length, rowsVisible);
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

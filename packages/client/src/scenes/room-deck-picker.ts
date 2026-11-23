/**
 * The room's deck picker (issue #880; Quin, 2026-11-20: every player brings their own hero and deck): the decks on THIS
 * device, saved, imported and precon, as rows with the hero's picture, searched with the shared fuzzy match
 * (`view/room-deck-picker-model.ts`). A seated player picks one for their seat ("Choose your deck"); the host picks one
 * for any seat ("Set deck", sent as a preset the holder may replace). Back returns to the lobby, which is still joined.
 *
 * The picker only chooses: whether a deck may be seated is the engine's verdict on each `DeckOption`, and the host's
 * engine judges the deck again at Start. The list scrolls inside a masked region (`ui/scroll-region.ts`), so every
 * button in it takes the region's clip and drag: a swipe that ends over Pick fires nothing (issue #227).
 */
import Phaser from "phaser";
import { currentCardsById, currentDeps, currentPool, POOL_VERSION } from "../content/pool.js";
import { t, tPlural } from "../i18n/translate.js";
import { chooseDeck, onRoomState, presetDeck, roomState, warmDeckWorker, type RoomState } from "../platform/room.js";
import { appSession, deckStorage } from "../session.js";
import { hit, surface, typeRole } from "../tokens.js";
import { campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { drawDetailsPanel, type DetailsPanel } from "../ui/room-deck-details-panel.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { drawHeroAvatar, SEAT_AVATAR_READY } from "../ui/seat-avatar.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { onTap } from "../ui/tap.js";
import { importedDeckNote, importMarvelCdbDeck } from "../platform/marvelcdb-import.js";
import { McButton, McTextInput, fitText } from "../ui/widgets.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import type { DeckOption } from "../view/deck-list-model.js";
import type { Rect } from "../view/layout.js";
import { aspectStampsOf } from "../view/aspect-stamp.js";
import { type ImportEnv } from "../view/deck-import-model.js";
import { deckDetailsOf, type DeckDetails } from "../view/room-deck-details-model.js";
import {
  detailsPanelRect,
  detailsPresentationOf,
  gridContentHeight,
  panelOffsetAt,
  pickerControlsLayout,
  pickerGridLayout,
  readPickerView,
  tileTitleOf,
  tileRect,
  writePickerView,
  type DetailsPresentation,
  type PickerViewMode,
} from "../view/room-deck-picker-layout.js";
import { pickerRows, type PickerRow } from "../view/room-deck-picker-model.js";
import type { CoreAspect, Deck } from "@mc/content";
import { seatNameOf } from "../view/room-lobby-model.js";
import { seatableDecksOf, seatableOptionsNow } from "../view/seatable-decks.js";
import { DeckSearchClient } from "../view/deck-search-client.js";
import { cachedDeckOption, deckOptionOf, primeDeckOption, verdictOf } from "../view/deck-list-model.js";
import { deckUsesCustomCards } from "../view/custom-content.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import type { DeckBuilderSceneData } from "./deck-builder.js";
import { SCENES } from "./keys.js";
import { bindTextFieldEscape } from "./text-field-escape.js";

const PAPER = surface.paper.hex;
const INK = surface.ink.hex;
const PARCHMENT = surface.parchment.hex;
/** How long a note about what the room refused stays above the list. */
const NOTE_MS = 6000;

export interface RoomDeckPickerData {
  /** The seat the deck goes to. */
  readonly seat: string;
  /** The host presetting a deck for the seat (it may hold another's); false: my own seat. */
  readonly preset: boolean;
  /** Dev only: a made-up room (`view/room-lobby-fixture.ts`) instead of the live one; nothing is sent. */
  readonly preview?: RoomState;
  /** Open on this deck's details: back from the deck builder, on the deck just edited. */
  readonly focusDeckId?: string;
}

/** `data` for the scene as the deck builder hands back to it (the seat, and in a dev preview the made-up room). */
export type RoomDeckPickerReturn = Pick<RoomDeckPickerData, "seat" | "preset" | "preview" | "focusDeckId">;

export class RoomDeckPickerScene extends Phaser.Scene {
  #seat = "";
  #preset = false;
  #preview = false;
  #state: RoomState = roomState();
  #options: readonly DeckOption[] | null = null;
  #query = "";
  #input: McTextInput | null = null;
  /** Import from MarvelCDB: whether its link row is open, what is typed in it, and a fetch is under way. */
  #importOpen = false;
  #importText = "";
  #importBusy = false;
  #importInput: McTextInput | null = null;
  #buttons: McButton[] = [];
  #region: McScrollRegion | null = null;
  readonly #scroll = new VariableListScroll();
  #hover: HoverPreview | null = null;
  #hoverFaces: { readonly cardId: string; readonly rect: Rect; readonly view: Rect }[] = [];
  #route: FocusRoute | null = null;
  #hints!: GlyphHints;
  #stops = new Map<string, FocusStop>();
  #order: string[] = [];
  #alive = false;
  #leaving = false;
  #avatarRedrawQueued = false;
  #items: ListItem[] = [];
  #decks: readonly Deck[] = [];
  readonly #checker = new DeckSearchClient();
  /** Everything the list or grid drew (its frame and region), so a new search replaces it without touching the rest. */
  #listNodes: Phaser.GameObjects.GameObject[] = [];
  #listRect: Rect | null = null;
  #listInner: Rect | null = null;
  #current: { readonly hero: string; readonly name: string } | null = null;
  #searchTimer: Phaser.Time.TimerEvent | null = null;
  #picking = false;
  /** Bumped on every visit and every pick: an answer that arrives for an older one is ignored. */
  #pickGen = 0;
  #busyNodes: Phaser.GameObjects.GameObject[] = [];
  #off: (() => void) | null = null;
  #note: { readonly text: string; readonly until: number } | null = null;
  /** Grid (the default) or list, remembered between visits. */
  #view: PickerViewMode = "grid";
  /** The deck whose details are open, by deck id. */
  #selected: string | null = null;
  #focusDeckId: string | null = null;
  #panel: DetailsPanel | null = null;
  #panelNodes: Phaser.GameObjects.GameObject[] = [];
  #panelHolder: Phaser.GameObjects.Container | null = null;
  #panelButtons: McButton[] = [];
  readonly #panelScroll = new VariableListScroll();
  #panelDetails: { readonly id: string; readonly details: DeckDetails } | null = null;
  /** 0 just opened, 1 settled: how far the panel has come in (`panelOffsetAt`). */
  #progress = 1;
  #slide: Phaser.Tweens.Tween | Phaser.Tweens.TweenChain | null = null;
  #panelDraw: { readonly rect: Rect; readonly row: PickerRow; readonly presentation: DetailsPresentation } | null =
    null;

  constructor() {
    super(SCENES.roomDeckPicker);
  }

  init(data: RoomDeckPickerData): void {
    this.#seat = data.seat;
    this.#preset = data.preset;
    this.#preview = import.meta.env.DEV && data.preview !== undefined;
    this.#state = this.#preview ? data.preview! : roomState();
    this.#options = null;
    this.#query = "";
    this.#note = null;
    this.#importOpen = false;
    this.#importText = "";
    this.#importBusy = false;
    this.#leaving = false;
    this.#picking = false;
    this.#pickGen += 1;
    this.#scroll.reset?.();
    this.#view = readPickerView();
    this.#selected = null;
    this.#focusDeckId = data.focusDeckId ?? null;
    this.#panel = null;
    this.#panelNodes = [];
    this.#panelButtons = [];
    this.#panelDetails = null;
    this.#panelDraw = null;
    this.#progress = 1;
    this.#slide = null;
    this.#panelScroll.reset();
  }

  create(): void {
    this.#alive = true;
    // The deck worker boots and takes the packs while the player is still choosing, so Pick does not wait on it.
    if (!this.#preview) warmDeckWorker();
    this.cameras.main.setBackgroundColor(cssOf(PAPER));
    this.#hints = new GlyphHints(this);
    bindTextFieldEscape(this, () => this.#input);
    this.#route = new FocusRoute(this, {
      blocked: () => this.#input?.focused ?? false,
      onCancel: () => {
        if (!this.#picking) this.#backOrClose();
      },
      primary: () => null,
    });
    this.scale.on("resize", this.#draw, this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCardIds(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    this.events.on(SEAT_AVATAR_READY, this.#avatarReady, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#picking = false;
      this.#pickGen += 1;
      this.#off?.();
      this.#off = null;
      this.#hints.dispose();
      this.scale.off("resize", this.#draw, this);
      this.events.off(SEAT_AVATAR_READY, this.#avatarReady, this);
      this.#hover?.destroy();
      this.#hover = null;
      this.#slide?.stop();
      this.#slide = null;
      this.#checker.destroy();
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      for (const button of this.#panelButtons) button.destroy();
      this.#panelButtons = [];
      this.#region?.destroy();
      this.#region = null;
      this.#panel?.region.destroy();
      this.#panel = null;
      this.#input?.destroy();
      this.#input = null;
      this.#importInput?.destroy();
      this.#importInput = null;
    });
    if (!this.#preview) {
      this.#off = onRoomState((state) => {
        if (!this.#alive) return;
        this.#state = state;
        // The seat is no longer mine (taken back, released), or the room ended: nothing to choose for.
        if (this.#gone()) this.#back();
      });
    }
    this.#draw();
    fadeScreenIn(this);
    // Back from the deck builder: the deck just edited or built is open again, already in place.
    const wanted = this.#focusDeckId;
    this.#focusDeckId = null;
    void this.#reloadDecks(wanted);
  }

  /** Reads the device's decks again and, when `focus` is among them, opens its details. */
  async #reloadDecks(focus: string | null): Promise<void> {
    const decks = await deckStorage().list();
    if (!this.#alive) return;
    // Drawn at once from what is known: each deck's status (judged against the rules) comes from a worker, after.
    this.#decks = seatableDecksOf(decks, POOL_VERSION);
    this.#options = seatableOptionsNow(this.#decks, currentPool(), POOL_VERSION, currentDeps());
    if (focus !== null && this.#options.some((o) => (o.deck.id as string) === focus)) {
      this.#selected = focus;
      this.#panelDetails = null;
      this.#panelScroll.reset();
    }
    this.#draw();
    this.#askStatuses();
  }

  /**
   * Judges the decks whose status is not known yet, in the deck worker (a deck with a custom pack's cards here, as the
   * Decks screen does: the worker knows the base pool only), and redraws once when the answers arrive.
   */
  #askStatuses(): void {
    const pool = currentPool();
    const deps = currentDeps();
    const unchecked = this.#decks.filter((deck) => cachedDeckOption(deck, pool, POOL_VERSION, deps) === null);
    if (unchecked.length === 0) return;
    const custom = unchecked.filter(deckUsesCustomCards);
    for (const deck of custom) deckOptionOf(deck, pool, POOL_VERSION, deps);
    const base = unchecked.filter((deck) => !deckUsesCustomCards(deck));
    const done = (): void => {
      if (!this.#alive) return;
      this.#options = seatableOptionsNow(this.#decks, pool, POOL_VERSION, deps);
      this.#panelDetails = null;
      this.#draw();
    };
    if (base.length === 0) {
      done();
      return;
    }
    this.#checker.checkDecks(
      base,
      (asked) => asked.map((deck) => verdictOf(deck, pool, POOL_VERSION, deps)),
      (verdicts) => {
        base.forEach((deck, at) => primeDeckOption(deck, pool, POOL_VERSION, deps, verdicts[at]!));
        done();
      },
    );
  }

  /** The seat cannot take a deck from this device now. */
  #gone(): boolean {
    const state = this.#state;
    if (state.role === "none" || state.connection === "ended") return true;
    const seat = state.seats.find((s) => s.id === this.#seat);
    if (!seat) return true;
    return this.#preset ? state.role !== "host" : !seat.mine;
  }

  #back(): void {
    if (this.#leaving) return;
    this.#leaving = true;
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.roomLobby);
  }

  /** Back closes the open details first; with none open it leaves for the lobby. */
  #backOrClose(): void {
    if (this.#selected !== null) this.#closeDetails();
    else this.#back();
  }

  #closeDetails(): void {
    this.#slide?.stop();
    this.#slide = null;
    this.#selected = null;
    this.#progress = 1;
    this.#draw();
  }

  /** Opens the details of a deck: a slide-out or a sheet comes in; switching decks with one already open just swaps it. */
  #select(row: PickerRow): void {
    const wasOpen = this.#selected !== null;
    this.#selected = row.id;
    this.#panelScroll.reset();
    this.#slide?.stop();
    this.#slide = null;
    const animate = !wasOpen && !appSession().settings.reducedMotion;
    this.#progress = animate ? 0 : 1;
    this.#draw();
    if (this.#route?.focused != null) this.#route.focusKey("panel:use");
    if (!animate) return;
    this.#slide = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 220,
      onUpdate: (tween) => {
        this.#progress = tween.getValue() ?? 1;
        this.#placePanel();
      },
      onComplete: () => {
        this.#slide = null;
        this.#progress = 1;
        this.#placePanel();
      },
    });
  }

  #setView(mode: PickerViewMode): void {
    if (mode === this.#view) return;
    this.#view = mode;
    writePickerView(mode);
    this.#scroll.reset?.();
    this.#draw();
  }

  /** The details panel again, at the progress it has reached: the list or grid beside it stays as it is. */
  #redrawPanel(): void {
    if (!this.#alive || !this.#panelDraw) return;
    this.#clearPanel();
    const { rect, row, presentation } = this.#panelDraw;
    this.#drawPanel(rect, row, presentation);
    this.#route?.set(this.#order, this.#stops);
  }

  /** Where the panel is along its way in (`panelOffsetAt`); the content is never redrawn for it. */
  #placePanel(): void {
    const draw = this.#panelDraw;
    if (!this.#panelHolder || !draw) return;
    const offset = panelOffsetAt(this.#progress, draw.presentation, draw.rect, appSession().settings.reducedMotion);
    this.#panelHolder.setPosition(offset.x, offset.y);
    // The body's clip is fixed at the resting place, so it stays hidden until the slide has settled.
    this.#panel?.region.root.setVisible(this.#progress >= 1);
  }

  #clearPanel(): void {
    for (const button of this.#panelButtons) button.destroy();
    this.#panelButtons = [];
    this.#panel?.region.destroy();
    this.#panel = null;
    for (const node of this.#panelNodes) node.destroy();
    this.#panelNodes = [];
    this.#order = this.#order.filter((key) => !key.startsWith("panel:"));
    for (const key of [...this.#stops.keys()]) if (key.startsWith("panel:")) this.#stops.delete(key);
  }

  #say(text: string): void {
    this.#note = { text, until: this.time.now + NOTE_MS };
    this.time.delayedCall(NOTE_MS + 50, () => {
      if (this.#alive && this.#note && this.time.now >= this.#note.until) {
        this.#note = null;
        this.#draw();
      }
    });
  }

  #hoverCardIds(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    this.#hoverFaces.forEach(({ cardId, rect, view }, index) => {
      const shown = clipHoverRect({ ...rect, y: rect.y - this.#scroll.offsetPx }, view);
      if (shown) found.set(hoverSlotOf(cardId, `deck${index}`), { ...shown, cardId, through: true });
    });
    const panel = this.#panel;
    if (panel && this.#progress >= 1) {
      panel.faces.forEach(({ cardId, rect }, index) => {
        const shown = clipHoverRect({ ...rect, y: rect.y - this.#panelScroll.offsetPx }, panel.body);
        if (shown) found.set(hoverSlotOf(cardId, `panel${index}`), { ...shown, cardId, through: true });
      });
    }
    return found;
  }

  /** Why Pick does nothing for a deck: still being checked (try again), or the deck's own reason. */
  #notUsable(row: PickerRow): string {
    return row.checking
      ? t("room.picker.stillChecking")
      : t("room.picker.notReady", { reason: row.blockedReason ?? "" });
  }

  async #pick(row: PickerRow): Promise<void> {
    if (!row.seatable) {
      this.#say(this.#notUsable(row));
      this.#draw();
      return;
    }
    if (this.#preview) {
      const calls = ((globalThis as { __mcRoomCalls?: string[] }).__mcRoomCalls ??= []);
      calls.push(`${this.#preset ? "presetDeck" : "chooseDeck"}(${this.#seat},${row.id})`);
      this.#back();
      return;
    }
    if (this.#picking) return;
    // At once, before anything is built: the press is seen even where the deck takes a while to send.
    this.#picking = true;
    const gen = ++this.#pickGen;
    this.#showBusy();
    const result = await (this.#preset ? presetDeck : chooseDeck)(this.#seat, row.option);
    if (!this.#alive || gen !== this.#pickGen) return;
    this.#picking = false;
    this.#hideBusy();
    if (result.ok) {
      this.#back();
      return;
    }
    const seat = this.#state.seats.find((s) => s.id === this.#seat);
    const heldDeck = this.#preset && seat?.holder != null && seat.deck != null && seat.deck.preset !== true;
    this.#say(
      t(
        result.reason === "too-large"
          ? "room.picker.tooLarge"
          : result.reason === "not-seatable"
            ? "room.picker.refused"
            : result.reason === "no-worker"
              ? "room.picker.noWorker"
              : result.reason === "not-allowed" && heldDeck
                ? "room.deck.takeBackFirst"
                : "room.picker.gone",
      ),
    );
    this.#draw();
  }

  /** A dim layer with a line of words over the whole screen: a deck is on its way, and a second press does nothing. */
  #showBusy(): void {
    this.#hideBusy();
    const { width, height } = this.scale.gameSize;
    const veil = this.add.rectangle(0, 0, width, height, 0x000000, 0.45).setOrigin(0, 0).setDepth(1000);
    veil.setInteractive();
    const text = this.add
      .text(width / 2, height / 2, t("room.picker.sending"), textStyle(typeRole.rowTitle, surface.paper.hex))
      .setFontSize(18)
      .setOrigin(0.5)
      .setDepth(1001);
    this.#busyNodes = [veil, text];
  }

  #hideBusy(): void {
    for (const node of this.#busyNodes) node.destroy();
    this.#busyNodes = [];
  }

  #addStop(key: string, rect: Rect | (() => Rect), activate: () => void, extra: Partial<FocusStop> = {}): void {
    this.#stops.set(key, { rect, activate, ...extra });
    this.#order.push(key);
  }

  /**
   * A hero picture finished loading. A list of every deck loads dozens of them at once, and a full redraw per picture
   * froze the page for minutes on a phone, so the pictures that land together share one pass, and that pass rebuilds
   * only the tiles and rows on screen (and the open panel), never the screen.
   */
  #avatarReady = (): void => {
    if (this.#avatarRedrawQueued || !this.#alive) return;
    this.#avatarRedrawQueued = true;
    this.time.delayedCall(80, () => {
      this.#avatarRedrawQueued = false;
      if (!this.#alive) return;
      this.#rebuildVisible();
      if (this.#panel && this.#progress >= 1) this.#redrawPanel();
    });
  };

  #draw(): void {
    if (!this.#alive) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    for (const button of this.#panelButtons) button.destroy();
    this.#panelButtons = [];
    this.#panel?.region.destroy();
    this.#panel = null;
    this.#panelNodes = [];
    this.#panelDraw = null;
    this.#items = [];
    this.#listNodes = [];
    this.#listRect = null;
    this.#listInner = null;
    this.#region?.destroy();
    this.#region = null;
    const kept = [
      ...(this.#input ? this.#input.gameObjects : []),
      ...(this.#importInput ? this.#importInput.gameObjects : []),
    ];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);
    this.#hints.reset();
    this.#hoverFaces = [];
    this.#stops = new Map();
    this.#order = [];
    if (this.#picking) this.#showBusy();

    const frame = campaignFrame(this);
    const { width, height, phone, gutter, formFactor } = frame;
    this.add.rectangle(0, 0, width, height, PAPER).setOrigin(0, 0);
    const seats = this.#state.seats;
    const index = seats.findIndex((s) => s.id === this.#seat);
    const seatName = index >= 0 && seats[index] ? seatNameOf(seats[index]!, index) : this.#seat;
    const bar = drawTopBar(this, {
      backLabel: phone ? "◂" : `◂ ${t("room.leave").toUpperCase().replace(/.*/, t("room.picker.back").toUpperCase())}`,
      onBack: () => this.#backOrClose(),
      hints: phone ? null : this.#hints,
      title: this.#preset ? t("room.picker.titleFor", { seat: seatName }) : t("room.picker.title"),
      right: this.#preset ? t("room.deck.preset") : seatName,
      reserveRight: phone ? 80 : 0,
    });
    if (bar.back) this.#buttons.push(bar.back);
    if (bar.backRect) this.#addStop("back", bar.backRect, () => this.#backOrClose());

    // The deck whose details are open, if it is still among the decks.
    const seat = seats.find((s) => s.id === this.#seat);
    const current = seat?.deck ? { hero: seat.deck.hero, name: seat.deck.name } : null;
    const open = this.#selected !== null && this.#options !== null ? this.#rowOf(this.#selected, current) : null;
    const presentation = detailsPresentationOf(formFactor);
    const area: Rect = { x: 0, y: bar.height, width, height: height - bar.height };
    const panelRect = open ? detailsPanelRect(area, presentation, formFactor) : null;
    // A sheet covers the whole screen: nothing under it is drawn, so nothing under it can be pressed.
    const sheet = panelRect !== null && presentation === "sheet";
    const right = panelRect !== null && presentation === "slide" ? panelRect.x - 12 : width - gutter;

    // The search field and the view toggle, then the grid or list.
    const toggleWidth = phone ? 58 : 70;
    const controls = pickerControlsLayout({
      left: gutter,
      right,
      top: bar.height + 12,
      toggleWidth,
      searchHeight: hit.primary,
      buttonHeight: hit.target,
      importOpen: this.#importOpen,
    });
    const fieldRect = controls.search;
    if (!this.#input) {
      this.#input = new McTextInput(this, {
        rect: fieldRect,
        value: this.#query,
        type: typeRole.body,
        placeholder: t("room.picker.search"),
        maxLength: 80,
        // Debounced, and only the list is rebuilt: a key per redraw of the screen made typing lag on a phone.
        onChange: (value) => {
          this.#query = value;
          this.#searchTimer?.remove();
          this.#searchTimer = this.time.delayedCall(140, () => {
            this.#searchTimer = null;
            this.#scroll.reset?.();
            this.#relist();
          });
        },
      });
      this.children.bringToTop(this.#input.gameObject);
    } else {
      this.#input.layout(fieldRect);
      this.#input.setPlaceholder(t("room.picker.search"));
    }
    this.#input.setVisible(!sheet);
    this.#importInput?.setVisible(!sheet);
    if (!sheet) {
      this.#addStop("search", fieldRect, () => this.#input?.focus());
      (["grid", "list"] as const).forEach((mode, i) => {
        const rect = controls.toggles[i]!;
        const go = (): void => this.#setView(mode);
        this.#buttons.push(
          new McButton(this, {
            kind: "secondary",
            label: t(mode === "grid" ? "room.picker.viewGrid" : "room.picker.viewList"),
            type: { ...typeRole.label, size: 12 },
            rect,
            selected: this.#view === mode,
            onClick: go,
          }),
        );
        this.#addStop(`view:${mode}`, rect, go);
      });
      this.#drawMakers(controls);

      let top = controls.bottom + 8;
      const note = this.#note && this.time.now < this.#note.until ? this.#note.text : null;
      if (note) {
        const line = this.add
          .text(gutter, top, note, textStyle(typeRole.rowTitle, surface.inkOnHue.hex))
          .setFontSize(13)
          .setBackgroundColor("#f2b01e")
          .setPadding(6, 3, 6, 3);
        fitText(line, right - gutter, 13);
        top += line.height + 8;
      }
      const listRect: Rect = { x: gutter, y: top, width: right - gutter, height: Math.max(0, height - top - gutter) };
      this.#listRect = listRect;
      this.#current = current;
      this.#drawListLayer();
    }
    if (panelRect && open) {
      this.#panelDraw = { rect: panelRect, row: open, presentation };
      this.#drawPanel(panelRect, open, presentation);
    }
    this.#route?.set(this.#order, this.#stops);
  }

  /** Build a deck and Import from MarvelCDB, always offered, and the import's link row while it is open. */
  #drawMakers(controls: ReturnType<typeof pickerControlsLayout>): void {
    const type = { ...typeRole.label, size: 12 };
    const build = (): void => this.#build();
    const toggle = (): void => {
      this.#importOpen = !this.#importOpen;
      this.#draw();
      if (this.#importOpen) this.#importInput?.focus();
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: t("room.picker.build"),
        type,
        rect: controls.build,
        onClick: build,
      }),
      new McButton(this, {
        kind: "secondary",
        label: t("room.picker.importToggle"),
        type,
        rect: controls.importToggle,
        selected: this.#importOpen,
        onClick: toggle,
      }),
    );
    this.#addStop("build", controls.build, build);
    this.#addStop("import", controls.importToggle, toggle);
    const field = controls.importField;
    const go = controls.importGo;
    if (!field || !go) {
      this.#importInput?.destroy();
      this.#importInput = null;
      return;
    }
    if (this.#importInput) {
      this.#importInput.layout(field);
      for (const node of this.#importInput.gameObjects) this.children.bringToTop(node);
    } else {
      this.#importInput = new McTextInput(this, {
        rect: field,
        value: this.#importText,
        type: typeRole.body,
        placeholder: t("room.picker.importPlaceholder"),
        maxLength: 200,
        onChange: (value) => {
          this.#importText = value;
        },
      });
      (this.#importInput.gameObject as unknown as { node: HTMLElement }).node.addEventListener("keydown", (event) => {
        // After this key press finishes: a redraw inside the field's own keydown left its DOM box on screen.
        if (event.key === "Enter") setTimeout(() => void this.#import(), 0);
      });
    }
    this.#addStop("import-field", field, () => this.#importInput?.focus());
    const doImport = (): void => void this.#import();
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: this.#importBusy ? t("room.picker.importing") : t("room.picker.importGo"),
        type,
        rect: go,
        enabled: !this.#importBusy,
        onClick: doImport,
      }),
    );
    this.#addStop("import-go", go, doImport);
  }

  /** The deck builder on a new deck; Back (or a Save then Back) returns here on the deck just built, ready to Pick. */
  #build(): void {
    if (this.#leaving) return;
    this.#leaving = true;
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.deckBuilder, {
      returnTo: { key: SCENES.roomDeckPicker, data: this.#returnData(null) },
    } satisfies DeckBuilderSceneData);
  }

  #returnData(focusDeckId: string | null): RoomDeckPickerReturn {
    return {
      seat: this.#seat,
      preset: this.#preset,
      // A dev preview carries its made-up room through the builder and back; a live room needs nothing: it lives in a worker.
      ...(this.#preview ? { preview: this.#state } : {}),
      ...(focusDeckId !== null ? { focusDeckId } : {}),
    };
  }

  /** Fetches the MarvelCDB deck typed in the link row, saves it on this device and opens its details. */
  async #import(): Promise<void> {
    if (this.#importBusy || this.#leaving) return;
    this.#importBusy = true;
    this.#draw();
    const stored = await deckStorage().list();
    const env: ImportEnv = {
      pool: currentPool(),
      poolVersion: POOL_VERSION,
      now: () => new Date().toISOString(),
      newId: () => crypto.randomUUID(),
      existingNames: stored.map((deck) => deck.name),
    };
    const result = await importMarvelCdbDeck(this.#importText, env);
    if (!this.#alive) return;
    this.#importBusy = false;
    if (!result.ok) {
      this.#say(result.message);
      this.#draw();
      return;
    }
    await deckStorage().put(result.deck);
    if (!this.#alive) return;
    this.#importOpen = false;
    this.#importText = "";
    this.#importInput?.setValue("");
    this.#say(importedDeckNote(result.deck.name, result.warnings));
    await this.#reloadDecks(result.deck.id as string);
  }

  #rowOf(id: string, current: { readonly hero: string; readonly name: string } | null): PickerRow | null {
    return pickerRows(this.#options ?? [], "", current).find((r) => r.id === id) ?? null;
  }

  #drawPanel(rect: Rect, row: PickerRow, _presentation: DetailsPresentation): void {
    const start = this.children.list.length;
    if (this.#panelDetails?.id !== row.id)
      this.#panelDetails = { id: row.id, details: deckDetailsOf(row, currentPool()) };
    const panel = drawDetailsPanel(this, {
      rect,
      offset: { x: 0, y: 0 },
      details: this.#panelDetails.details,
      scroll: this.#panelScroll,
      onUse: () => void this.#pick(row),
      onUnavailable: () => {
        this.#say(this.#notUsable(row));
        this.#draw();
      },
      onEdit: () => this.#edit(row),
      onClose: () => this.#closeDetails(),
    });
    this.#panel = panel;
    this.#panelButtons = panel.buttons;
    // Drawn once at its resting place and moved as one: a slide that redrew the panel each frame was the cost, not the picture.
    const holder = this.add.container(0, 0, this.children.list.slice(start));
    this.#panelHolder = holder;
    this.#panelNodes = [holder];
    this.#placePanel();
    for (const stop of panel.stops) this.#addStop(stop.key, stop.rect, stop.activate);
  }

  /** The deck builder on this deck; Back (or a Save then Back) returns here with its details open. */
  #edit(row: PickerRow): void {
    if (this.#preview || this.#leaving) return;
    this.#leaving = true;
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.deckBuilder, {
      deck: row.option.deck,
      returnTo: { key: SCENES.roomDeckPicker, data: this.#returnData(row.id) },
    } satisfies DeckBuilderSceneData);
  }

  /**
   * The list or grid layer: its frame and a masked region, and a record of every deck's place in it. Only the tiles or
   * rows in or near the view have game objects (`#syncVisible`); the rest are numbers, so a long list costs what the
   * screen shows and a scroll builds only the row that comes into view.
   */
  #drawListLayer(): void {
    const rect = this.#listRect;
    if (!rect) return;
    const start = this.children.list.length;
    const g = this.add.graphics();
    g.fillStyle(PARCHMENT, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(2, INK, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    const inner: Rect = { x: rect.x + 10, y: rect.y + 8, width: rect.width - 20, height: rect.height - 16 };
    this.#listInner = inner;
    const heights = [inner.height];
    const region = new McScrollRegion(this, {
      rect: inner,
      heights,
      scroll: this.#scroll,
      clipInteractive: true,
      onScroll: () => this.#syncVisible(),
    });
    this.#region = region;
    this.#items = [];
    this.#hoverFaces = [];
    const used = this.#layoutItems(inner, region);
    heights[0] = Math.max(inner.height, used);
    region.refresh();
    this.#syncVisible();
    this.#listNodes = this.children.list.slice(start);
  }

  /** Replaces the list or grid alone (a new search): the top bar, field, toggle and open details stay. */
  #relist(): void {
    if (!this.#alive || !this.#listRect) return;
    for (const item of this.#items) this.#unrealize(item);
    this.#items = [];
    this.#region?.destroy();
    this.#region = null;
    for (const node of this.#listNodes) node.destroy();
    this.#listNodes = [];
    this.#order = this.#order.filter((key) => !key.startsWith("deck:") && !key.startsWith("pick:"));
    for (const key of [...this.#stops.keys()])
      if (key.startsWith("deck:") || key.startsWith("pick:")) this.#stops.delete(key);
    this.#drawListLayer();
    // The panel's stops keep their place after the list's.
    const panelKeys = this.#order.filter((key) => key.startsWith("panel:"));
    this.#order = [...this.#order.filter((key) => !key.startsWith("panel:")), ...panelKeys];
    this.#route?.set(this.#order, this.#stops);
  }

  /** Builds the items near the view and drops the ones that have left it. */
  #syncVisible(): void {
    const inner = this.#listInner;
    const region = this.#region;
    if (!inner || !region) return;
    const top = inner.y + this.#scroll.offsetPx;
    const reach = inner.height * 0.6;
    let built = false;
    for (const item of this.#items) {
      const near = item.y + item.height > top - reach && item.y < top + inner.height + reach;
      if (near && item.nodes.length === 0) {
        this.#realize(item, region);
        built = true;
      } else if (!near && item.nodes.length > 0) this.#unrealize(item);
    }
    if (built) region.syncInteractivity();
  }

  /** The pictures that landed: the items on screen still waiting for theirs draw it now; nothing else is touched. */
  #rebuildVisible(): void {
    const region = this.#region;
    if (!region) return;
    for (const item of this.#items) {
      if (item.nodes.length === 0 || item.artDone) continue;
      // The late picture goes where the old one was (under the tile's border), not on top at the end.
      const first = item.art[0];
      const at = first ? region.content.getIndex(first) : -1;
      const nodeAt = first ? item.nodes.indexOf(first) : -1;
      for (const node of item.art) node.destroy();
      item.nodes = item.nodes.filter((node) => !item.art.includes(node));
      this.#drawArt(item);
      if (at >= 0) region.content.addAt(item.art, at);
      else region.content.add(item.art);
      item.nodes.splice(nodeAt >= 0 ? nodeAt : item.nodes.length, 0, ...item.art);
    }
  }

  #realize(item: ListItem, region: McScrollRegion): void {
    const before = this.children.list.length;
    const buttons = item.make(item);
    const added = this.children.list.slice(before);
    item.nodes = added;
    item.buttons = buttons;
    this.#buttons.push(...buttons);
    if (added.length > 0) region.content.add(added);
  }

  /** Draws the item's picture into the objects it has so far, remembering them and whether the picture was there. */
  #drawArt(item: ListItem): void {
    const before = this.children.list.length;
    item.artDone = item.makeArt();
    item.art = this.children.list.slice(before);
  }

  #unrealize(item: ListItem): void {
    if (item.nodes.length === 0) return;
    item.art = [];
    item.artDone = false;
    for (const button of item.buttons) button.destroy();
    if (item.buttons.length > 0) this.#buttons = this.#buttons.filter((b) => !item.buttons.includes(b));
    for (const node of item.nodes) node.destroy();
    item.nodes = [];
    item.buttons = [];
  }

  /** A stop for a deck in the list or grid: the ring frames `rect`, and arrowing onto it scrolls it into view. */
  #rowStop(key: string, rectIn: Rect, item: ListItem, inner: Rect, region: McScrollRegion, go: () => void): void {
    this.#addStop(key, () => ({ ...rectIn, y: rectIn.y - this.#scroll.offsetPx }), go, {
      ensureVisible: () => {
        const rel = item.y - inner.y - this.#scroll.offsetPx;
        const over = rel + item.height - inner.height;
        if (rel < 0) region.scrollByPx(rel);
        else if (over > 0) region.scrollByPx(over);
      },
      view: inner,
    });
  }

  /** A tap zone over `rect` that opens the deck's details; a swipe that began or ended over it does not. */
  #detailsZone(rect: Rect, region: McScrollRegion, row: PickerRow): void {
    const zone = this.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    onTap(zone, () => {
      if (region.isDragSuppressingClick) return;
      this.#select(row);
    });
  }

  /** Lays out every deck (numbers only), registers its stop and hover place, and returns the content height. */
  #layoutItems(inner: Rect, region: McScrollRegion): number {
    const x = inner.x;
    const w = inner.width - 12;
    const options = this.#options;
    if (options === null) {
      const wait = this.add
        .text(x, inner.y + 2, t("room.state.connecting"), textStyle(typeRole.body, INK, 0.7))
        .setFontSize(14);
      return wait.height + 8;
    }
    const rows = pickerRows(options, this.#query, this.#current);
    if (rows.length === 0) {
      const text = options.length === 0 ? t("room.picker.noDecks") : t("room.picker.empty");
      const none = this.add
        .text(x, inner.y + 2, text, textStyle(typeRole.body, INK, 0.85))
        .setFontSize(14)
        .setWordWrapWidth(w, true);
      return none.height + 8;
    }
    const view = inner;
    if (this.#view === "grid") {
      const layout = pickerGridLayout(inner.width - 12, campaignFrame(this).formFactor);
      const top = inner.y + 2;
      rows.forEach((row, i) => {
        const rect = tileRect(layout, inner.x, top, i);
        const artRect: Rect = { x: rect.x, y: rect.y, width: rect.width, height: layout.artHeight };
        const item: ListItem = {
          y: rect.y,
          height: rect.height,
          nodes: [],
          buttons: [],
          art: [],
          artDone: false,
          make: (self) => this.#makeTile(self, rect, layout.artHeight, row, region),
          makeArt: () => this.#tileArt(artRect, row),
        };
        this.#items.push(item);
        this.#hoverFaces.push({ cardId: row.cardId, rect: { ...rect, height: layout.artHeight }, view });
        this.#rowStop(`deck:${row.id}`, rect, item, inner, region, () => this.#select(row));
      });
      return gridContentHeight(layout, rows.length) + 8;
    }
    let y = inner.y + 2;
    for (const row of rows) {
      const height = LIST_ROW_HEIGHT;
      const rect: Rect = { x, y, width: w, height };
      const item: ListItem = {
        y,
        height,
        nodes: [],
        buttons: [],
        art: [],
        artDone: false,
        make: (self) => this.#makeRow(self, rect, row, region),
        makeArt: () => drawHeroAvatar(this, rowArtRect(rect), currentCardsById().get(row.cardId), INK, 1, true),
      };
      this.#items.push(item);
      const buttonRect = rowButtonRect(rect);
      this.#hoverFaces.push({ cardId: row.cardId, rect: rowArtRect(rect), view });
      this.#rowStop(`deck:${row.id}`, rect, item, inner, region, () => this.#select(row));
      this.#rowStop(`pick:${row.id}`, buttonRect, item, inner, region, () => void this.#pick(row));
      y += height + 8;
    }
    return y - inner.y + 4;
  }

  /** The words under a deck's name: why it cannot be picked, that it is in the seat, or how many cards it has. Words, never a colour. */
  #statusOf(row: PickerRow, plain: string | null): { readonly text: string | null; readonly bold: boolean } {
    if (row.checking) return { text: t("room.picker.checking"), bold: false };
    if (!row.seatable) return { text: t("room.picker.notReady", { reason: row.blockedReason ?? "" }), bold: true };
    if (row.current) return { text: t("room.picker.current"), bold: true };
    return { text: plain, bold: false };
  }

  /** A tile's picture: the hero's art with a stripe of its aspect colors under it, and the tile's frame on top. */
  #tileArt(artRect: Rect, row: PickerRow): boolean {
    const drawn = drawHeroAvatar(this, artRect, currentCardsById().get(row.cardId), INK, 1, true);
    // The aspect colors as a stripe under the picture; the aspect's name is in the words below, never the color alone.
    const aspects = row.option.deck.aspects.filter((a): a is CoreAspect =>
      ["aggression", "justice", "leadership", "protection", "basic", "pool"].includes(a as string),
    );
    const stamps = aspectStampsOf(aspects);
    const stripe = this.add.graphics();
    stamps.forEach((stamp, s) => {
      const sw = artRect.width / stamps.length;
      stripe.fillStyle(stamp.fill, 1).fillRect(artRect.x + s * sw, artRect.y + artRect.height - 7, sw, 7);
    });
    return drawn;
  }

  /** One grid tile: the hero's picture, then the deck's words and its frame. */
  #makeTile(item: ListItem, rect: Rect, artHeight: number, row: PickerRow, region: McScrollRegion): McButton[] {
    const selected = row.id === this.#selected;
    this.add.rectangle(rect.x, rect.y, rect.width, rect.height, PAPER).setOrigin(0, 0);
    this.#drawArt(item);
    const tx = rect.x + 8;
    const tw = rect.width - 16;
    let ty = rect.y + artHeight + 6;
    const name = this.add.text(tx, ty, tileTitleOf(row.name), textStyle(typeRole.rowTitle, INK)).setFontSize(14);
    fitText(name, tw, 14);
    ty += 19;
    const who = [row.heroName, row.aspects].filter((p) => p !== "").join(" · ");
    const line = this.add.text(tx, ty, who, textStyle(typeRole.body, INK, 0.85)).setFontSize(12);
    fitText(line, tw, 12);
    ty += 16;
    const status = this.#statusOf(row, tPlural("room.deck.cards", row.cards));
    const s = this.add
      .text(tx, ty, status.text ?? "", textStyle(typeRole.body, INK, status.bold ? 1 : 0.85))
      .setFontSize(12);
    if (status.bold) s.setFontStyle("bold");
    fitText(s, tw, 12);
    const border = this.add.graphics();
    border
      .lineStyle(selected || row.current ? 5 : 2, INK, 1)
      .strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    this.#detailsZone(rect, region, row);
    return [];
  }

  /** One list row: picture, words, a Pick button; the row (not the button) opens the details. */
  #makeRow(item: ListItem, rect: Rect, row: PickerRow, region: McScrollRegion): McButton[] {
    const inner = this.#listInner!;
    const guard = { clip: (): Rect => inner, suppress: (): boolean => region.isDragSuppressingClick };
    const bg = this.add.graphics();
    bg.fillStyle(PAPER, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    bg.lineStyle(row.current || row.id === this.#selected ? 5 : 2, INK, 1).strokeRect(
      rect.x + 1,
      rect.y + 1,
      rect.width - 2,
      rect.height - 2,
    );
    const artRect = rowArtRect(rect);
    this.#drawArt(item);
    const buttonRect = rowButtonRect(rect);
    const tx = artRect.x + artRect.width + 10;
    const textWidth = buttonRect.x - 8 - tx;
    let ty = rect.y + 8;
    const name = this.add.text(tx, ty, tileTitleOf(row.name), textStyle(typeRole.rowTitle, INK)).setFontSize(15);
    fitText(name, textWidth, 15);
    ty += 21;
    const detail = [row.heroName, row.aspects, tPlural("room.deck.cards", row.cards)]
      .filter((p) => p !== "")
      .join(" · ");
    const line = this.add.text(tx, ty, detail, textStyle(typeRole.body, INK, 0.85)).setFontSize(12);
    fitText(line, textWidth, 12);
    ty += 17;
    const status = this.#statusOf(row, null);
    if (status.text) {
      const s = this.add
        .text(tx, ty, status.text, textStyle(typeRole.body, INK, status.bold ? 1 : 0.85))
        .setFontSize(12);
      if (status.bold) s.setFontStyle("bold");
      fitText(s, textWidth, 12);
    }
    this.#detailsZone({ x: rect.x, y: rect.y, width: buttonRect.x - 6 - rect.x, height: rect.height }, region, row);
    const go = (): void => void this.#pick(row);
    return [
      new McButton(this, {
        kind: row.seatable ? "primary" : "secondary",
        label: t("room.picker.choose"),
        type: { ...typeRole.label, size: 13 },
        rect: buttonRect,
        enabled: row.seatable,
        ...(row.blockedReason ? { reason: row.blockedReason } : {}),
        onUnavailablePress: go,
        onClick: go,
        clip: guard.clip,
        suppressClick: guard.suppress,
      }),
    ];
  }
}

/** A tile or row in the list or grid: where it sits, and the game objects it has while it is near the view. */
interface ListItem {
  readonly y: number;
  readonly height: number;
  nodes: Phaser.GameObjects.GameObject[];
  buttons: McButton[];
  /** Draws the item and returns the buttons it made. */
  readonly make: (item: ListItem) => McButton[];
  /** Draws the hero's picture (and what frames it) and says whether the picture was there to draw. */
  readonly makeArt: () => boolean;
  /** The picture's objects, a part of `nodes`, so a picture that lands later is drawn again without the words. */
  art: Phaser.GameObjects.GameObject[];
  artDone: boolean;
}

const LIST_ROW_HEIGHT = 76;
const ROW_PAD = 10;
const ROW_ART = 56;
const ROW_BUTTON_WIDTH = 92;

const rowArtRect = (rect: Rect): Rect => ({ x: rect.x + ROW_PAD, y: rect.y + 10, width: ROW_ART, height: ROW_ART });
const rowButtonRect = (rect: Rect): Rect => ({
  x: rect.x + rect.width - ROW_PAD - ROW_BUTTON_WIDTH,
  y: rect.y + (rect.height - hit.target) / 2,
  width: ROW_BUTTON_WIDTH,
  height: hit.target,
});

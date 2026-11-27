/**
 * The room's deck picker (issue #880; Quin, 2026-11-20: every player brings their own hero and deck): the decks on THIS
 * device, saved, imported and precon, as rows with the hero's picture, searched with the shared fuzzy match
 * (`view/room-deck-picker-model.ts`). A seated player picks one for their seat ("Choose your deck"); the host picks one
 * for any seat ("Set deck", sent as a preset the holder may replace). Back returns to the lobby, which is still joined.
 *
 * The picker only chooses: whether a deck may be seated is the engine's verdict on each `DeckOption`, and the host's
 * engine judges the deck again at Start.
 *
 * Everything under the top bar is Lit panels over the canvas (`dom/dom-region.ts`), each its own region: the controls
 * (a sheet with the search and link fields, real inputs, the view toggle and the makers), the decks (`mc-deck-grid`),
 * the open deck's details (`mc-deck-details`, a slide-out on a wide screen and a full sheet on a phone, sliding in over
 * the others) and the "Sending your deck" veil above all. The scene keeps the top bar, the focus route (ring drawn in the
 * panel layer) and the card hover popover. The decks scroll in their panel and every control in them is a tap: a swipe
 * that ends over Pick fires nothing (issue #227).
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McDeckDetails, McDeckGrid, McSearchField, McSheet } from "@mc/ui";
import type { Deck } from "@mc/content";
import { PackLeases, refreshPackArt } from "../art/pack-art.js";
import { currentDeps, currentPool, POOL_VERSION } from "../content/pool.js";
import { gatePanels } from "../dom/busy-gate.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { deckDetailsModelOf, deckGridModelOf } from "../dom/room-deck-panels.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { t } from "../i18n/translate.js";
import { onArtChange, onLanguageChange } from "../language-change.js";
import { importedDeckNote, importMarvelCdbDeck } from "../platform/marvelcdb-import.js";
import { chooseDeck, onRoomState, presetDeck, roomState, warmDeckWorker, type RoomState } from "../platform/room.js";
import { appSession, deckStorage } from "../session.js";
import { hit, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import { campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { cssOf } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import type { McButton } from "../ui/widgets.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { deckUsesCustomCards } from "../view/custom-content.js";
import { type ImportEnv } from "../view/deck-import-model.js";
import {
  cachedDeckOption,
  deckOptionOf,
  primeDeckOption,
  verdictOf,
  type DeckOption,
} from "../view/deck-list-model.js";
import { DeckSearchClient } from "../view/deck-search-client.js";
import { ImportFlight } from "../view/import-flight.js";
import type { Rect } from "../view/layout.js";
import { deckDetailsOf, type DeckDetails } from "../view/room-deck-details-model.js";
import {
  detailsPanelRect,
  detailsPresentationOf,
  panelOffsetAt,
  pickerControlsLayout,
  readPickerView,
  writePickerView,
  type DetailsPresentation,
  type PickerControlsLayout,
  type PickerViewMode,
} from "../view/room-deck-picker-layout.js";
import { pickerRows, type PickerRow } from "../view/room-deck-picker-model.js";
import { seatNameOf } from "../view/room-lobby-model.js";
import { seatableDecksOf, seatableOptionsNow } from "../view/seatable-decks.js";
import type { DeckBuilderSceneData } from "./deck-builder.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { bindTextFieldEscape } from "./text-field-escape.js";

const PAPER = surface.paper.hex;
/** How long a note about what the room refused stays above the list. */
const NOTE_MS = 6000;
/** A page of the list, as a share of its height (PageUp / PageDown, the shoulder buttons). */
const PAGE = 0.85;
/** The search field's and the link field's keys in the controls sheet. */
const SEARCH = "search";
const IMPORT_FIELD = "import-field";

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

/** What the top bar and frame left for the panels: measured once a draw, read by every compose. */
interface PickerLayout {
  readonly width: number;
  readonly height: number;
  readonly phone: boolean;
  readonly gutter: number;
  readonly formFactor: ReturnType<typeof campaignFrame>["formFactor"];
  readonly barHeight: number;
  readonly backRect: Rect | null;
}

type AnyRegion = DomRegion<McSheet> | DomRegion<McDeckGrid> | DomRegion<McDeckDetails>;

export class RoomDeckPickerScene extends Phaser.Scene {
  #seat = "";
  #preset = false;
  #preview = false;
  #state: RoomState = roomState();
  #options: readonly DeckOption[] | null = null;
  #query = "";
  /** Import from MarvelCDB: whether its link row is open, what is typed in it, and a fetch is under way. */
  #importOpen = false;
  #importText = "";
  readonly #importFlight = new ImportFlight();
  /** Bumped on every import and every visit: an answer for an older one is dropped. */
  #importGen = 0;
  /** The top bar's Back button. */
  #buttons: McButton[] = [];
  #layout: PickerLayout | null = null;
  /** The controls: one Lit sheet over the canvas, made once a visit. */
  #region: DomRegion<McSheet> | null = null;
  /** The decks, a panel of their own over the controls' ground. */
  #gridRegion: DomRegion<McDeckGrid> | null = null;
  /** The details panel, above the others; made on opening and dropped on closing. */
  #panelRegion: DomRegion<McDeckDetails> | null = null;
  /** The "Sending your deck" veil, above all, while a deck is on its way. */
  #veil: DomRegion<McSheet> | null = null;
  /** The pack pictures' blob URLs the panels show, held while their lazy images may still load them. */
  readonly #leases = new PackLeases();
  /** What each key in the panels does when tapped, this compose. */
  #actions = new Map<string, () => void>();
  /** The decks panel's scrolling box and the details body, on screen (what a hover popover is clipped to). */
  #listView: Rect = { x: 0, y: 0, width: 0, height: 0 };
  #panelBody: Rect = { x: 0, y: 0, width: 0, height: 0 };
  /** The list reads from its top on the next compose (a new search or view). */
  #listFromTop = false;
  /** Whether the details are a full sheet, so the controls and decks under them are not shown. */
  #sheetOpen = false;
  #hover: HoverPreview | null = null;
  #route: FocusRoute | null = null;
  #hints!: GlyphHints;
  #stops = new Map<string, FocusStop>();
  #order: string[] = [];
  #alive = false;
  #leaving = false;
  #decks: readonly Deck[] = [];
  readonly #checker = new DeckSearchClient();
  #picking = false;
  /** Bumped on every visit and every pick: an answer that arrives for an older one is ignored. */
  #pickGen = 0;
  #off: (() => void) | null = null;
  #note: { readonly text: string; readonly until: number } | null = null;
  /** Grid (the default) or list, remembered between visits. */
  #view: PickerViewMode = "grid";
  /** The deck whose details are open, by deck id. */
  #selected: string | null = null;
  #focusDeckId: string | null = null;
  #panelDetails: { readonly id: string; readonly details: DeckDetails } | null = null;
  /** Which deck the details panel last showed, so a new one reads from its top. */
  #panelShown: string | null = null;
  /** 0 just opened, 1 settled: how far the panel has come in (`panelOffsetAt`). */
  #progress = 1;
  #slide: Phaser.Tweens.Tween | Phaser.Tweens.TweenChain | null = null;
  /** What the details region follows while it slides in. */
  readonly #anchor: { x: number; y: number; alpha: number; active: boolean } = { x: 0, y: 0, alpha: 1, active: true };
  #panelDraw: { readonly rect: Rect; readonly presentation: DetailsPresentation } | null = null;
  /** The sheets whose text fields this scene already listens to. */
  readonly #bound = new WeakSet<HTMLElement>();

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
    this.#importGen += 1;
    this.#leaving = false;
    this.#picking = false;
    this.#pickGen += 1;
    this.#view = readPickerView();
    this.#selected = null;
    this.#focusDeckId = data.focusDeckId ?? null;
    this.#panelDetails = null;
    this.#panelShown = null;
    this.#panelDraw = null;
    this.#progress = 1;
    this.#slide = null;
    this.#region = null;
    this.#gridRegion = null;
    this.#panelRegion = null;
    this.#veil = null;
    this.#listFromTop = false;
    this.#sheetOpen = false;
    this.#layout = null;
  }

  create(): void {
    this.#alive = true;
    // The deck worker boots and takes the packs while the player is still choosing, so Pick does not wait on it.
    if (!this.#preview) warmDeckWorker();
    this.cameras.main.setBackgroundColor(cssOf(PAPER));
    this.#hints = new GlyphHints(this);
    // A pad leaves a field it put the caret in (before the route, as the other screens do).
    bindTextFieldEscape(this, () => this.#field(SEARCH));
    bindTextFieldEscape(this, () => this.#field(IMPORT_FIELD));
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () =>
        (this.#field(SEARCH)?.focused ?? false) || (this.#field(IMPORT_FIELD)?.focused ?? false) || this.#picking,
      onCancel: () => {
        if (!this.#picking) this.#backOrClose();
      },
      primary: () => null,
      // The right stick, PageUp / PageDown and Home / End scroll what the focus is on: the details body from its own
      // buttons (or whenever the details are the whole screen), the decks otherwise.
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
      onPage: (direction) => {
        const scroller = this.#scroller();
        scroller?.scrollBy({ top: direction * scroller.clientHeight * PAGE });
      },
      onHomeEnd: (edge) => this.#scroller()?.scrollTo({ top: edge === "home" ? 0 : Number.MAX_SAFE_INTEGER }),
    });
    this.scale.on("resize", this.#draw, this);
    resetHoverCards(this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCardIds(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    // A pack picture that resolves later (its pack has loaded) draws in place of the plain ground; a language change
    // rewrites every word.
    const offArt = onArtChange(() => {
      if (this.sys.isActive()) this.#compose();
    });
    const offLanguage = onLanguageChange(() => {
      this.#panelDetails = null;
      if (this.sys.isActive()) this.#draw();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#importGen += 1;
      this.#picking = false;
      this.#pickGen += 1;
      this.#off?.();
      this.#off = null;
      offArt();
      offLanguage();
      this.#leases.dispose();
      this.#hints.dispose();
      this.scale.off("resize", this.#draw, this);
      this.#hover?.destroy();
      this.#hover = null;
      this.#slide?.stop();
      this.#slide = null;
      this.#checker.destroy();
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      // The panels go with the scene (`DomRegion`); the next visit makes new ones.
      this.#region = null;
      this.#gridRegion = null;
      this.#panelRegion = null;
      this.#veil = null;
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

  /** A text field of the controls sheet (the search or the link), for its caret. */
  #field(key: string): McSearchField | null {
    return (this.#region?.element.elementOf(key) as McSearchField | null) ?? null;
  }

  /** Puts the caret in a field once it has rendered its input. */
  #focusField(key: string): void {
    const field = this.#field(key);
    if (field) void field.updateComplete.then(() => field.focusInput());
  }

  /** The element that scrolls under the focus: the details body or the decks. */
  #scroller(): HTMLElement | null {
    const focused = this.#route?.focused ?? null;
    if (this.#panelRegion && (this.#sheetOpen || focused?.startsWith("panel:"))) {
      return this.#panelRegion.element.scroller;
    }
    return this.#gridRegion?.element.scroller ?? null;
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
    }
    this.#compose();
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
      this.#compose();
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
    // Under the veil a deck is on its way: Back, like everything else there, waits for the answer.
    if (this.#picking) return;
    if (this.#selected !== null) this.#closeDetails();
    else this.#back();
  }

  #closeDetails(): void {
    this.#slide?.stop();
    this.#slide = null;
    this.#selected = null;
    this.#progress = 1;
    this.#compose();
  }

  /** Opens the details of a deck: a slide-out or a sheet comes in; switching decks with one already open just swaps it. */
  #select(row: PickerRow): void {
    const wasOpen = this.#selected !== null;
    this.#selected = row.id;
    this.#slide?.stop();
    this.#slide = null;
    const animate = !wasOpen && !appSession().settings.reducedMotion;
    this.#progress = animate ? 0 : 1;
    this.#compose();
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
    this.#listFromTop = true;
    this.#compose();
  }

  /** Where the panel is along its way in (`panelOffsetAt`); the content is never rebuilt for it. */
  #placePanel(): void {
    const draw = this.#panelDraw;
    if (!draw) return;
    const offset = panelOffsetAt(this.#progress, draw.presentation, draw.rect, appSession().settings.reducedMotion);
    this.#anchor.x = offset.x;
    this.#anchor.y = offset.y;
  }

  #say(text: string): void {
    this.#note = { text, until: this.time.now + NOTE_MS };
    this.time.delayedCall(NOTE_MS + 50, () => {
      if (this.#alive && this.#note && this.time.now >= this.#note.until) {
        this.#note = null;
        this.#compose();
      }
    });
  }

  /**
   * Every hero picture in view and every card line of the open details, with its place, for the hover popover (read on
   * each pointer move): the panels name what they show and the scene reads where each is, clipped to the box that scrolls.
   */
  #hoverCardIds(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const add = (
      region: AnyRegion | null,
      faces: readonly { readonly cardId: string; readonly element: HTMLElement }[],
      view: Rect,
      where: string,
    ): void => {
      if (!region) return;
      faces.forEach(({ cardId, element }, index) => {
        const shown = clipHoverRect(region.rectOf(element), view);
        if (shown) found.set(hoverSlotOf(cardId, `${where}${index}`), { ...shown, cardId, through: true });
      });
    };
    if (!this.#sheetOpen) add(this.#gridRegion, this.#gridRegion?.element.hoverFaces() ?? [], this.#listView, "deck");
    if (this.#progress >= 1) {
      add(this.#panelRegion, this.#panelRegion?.element.hoverFaces() ?? [], this.#panelBody, "panel");
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
      this.#compose();
      return;
    }
    if (this.#preview) {
      // Dev e2e hook: hold the answer, as a slow send would, so the veil's input gate can be checked.
      const hold = (globalThis as { __mcPickHold?: Promise<void> }).__mcPickHold;
      if (hold) {
        this.#picking = true;
        const held = ++this.#pickGen;
        this.#showBusy();
        await hold;
        if (!this.#alive || held !== this.#pickGen) return;
        this.#picking = false;
        this.#hideBusy();
      }
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
    this.#compose();
  }

  /** A dim layer with a line of words over the whole screen: a deck is on its way, and a second press does nothing. */
  #showBusy(): void {
    const { width, height } = this.scale.gameSize;
    const full: Rect = { x: 0, y: 0, width, height };
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    b.box(full, { fill: 0x000000, fillAlpha: 0.45 });
    b.text(width / 2, height / 2, t("room.picker.sending"), typeRole.rowTitle, {
      size: 18,
      color: surface.paper.hex,
      origin: [0.5, 0.5],
    });
    // Swallows every press under it, the top bar's included.
    b.tap("busy", full);
    if (!this.#veil) {
      const element = document.createElement("mc-sheet") as McSheet;
      this.#veil = new DomRegion(this, element, full);
    }
    this.#veil.setRect(full);
    this.#veil.element.nodes = b.nodes;
    renderNow(this.#veil.element);
    // The panels under the veil take no input until the answer: armed presses are dropped, fields lose the caret.
    gatePanels(this.#underVeil(), true);
  }

  #underVeil(): HTMLElement[] {
    return [this.#region?.element, this.#gridRegion?.element, this.#panelRegion?.element].filter(
      (element): element is NonNullable<typeof element> => element !== undefined,
    );
  }

  #hideBusy(): void {
    gatePanels(this.#underVeil(), false);
    this.#veil?.destroy();
    this.#veil = null;
  }

  #addStop(key: string, rect: Rect | (() => Rect), activate: () => void, extra: Partial<FocusStop> = {}): void {
    this.#stops.set(key, { rect, activate, ...extra });
    this.#order.push(key);
  }

  /** A panel part's box on screen now, scroll and slide included; null when it is not drawn. */
  #liveRect(region: AnyRegion | null, key: string): Rect | null {
    const found = (region?.element as { elementOf(key: string): HTMLElement | null } | undefined)?.elementOf(key);
    return found && region ? region.rectOf(found) : null;
  }

  /** Wires a panel's region: presses reach `#actions`, a stale pack picture asks again, the mouse reaches the hover popover. */
  #wire<E extends McSheet | McDeckGrid | McDeckDetails>(element: E, rect: Rect): DomRegion<E> {
    element.addEventListener("mc-activate", (event) => {
      // Leaving already, or a deck is on its way: a second tap must not act.
      if (this.#leaving || this.#picking) return;
      this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
    });
    // A pack picture's blob URL went stale before its lazy image loaded: read it again, once.
    element.addEventListener("mc-image-error", (event) => {
      const { key, src } = (event as CustomEvent<{ key?: string; src: string | null }>).detail;
      if (key) refreshPackArt(key, src ?? undefined);
    });
    const region = new DomRegion<E>(this, element, rect);
    // The card hover popover follows Phaser's pointer, which only hears the mouse over the canvas; the popover itself is
    // drawn in the canvas, so its box is left out of the panel.
    region.forwardMouseMoves(() => this.#hover?.suppress());
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
    return region;
  }

  /** Draws the screen: the top bar and ground in the canvas, then the panels over them. */
  #draw(): void {
    if (!this.#alive) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    this.#hints.reset();

    const frame = campaignFrame(this);
    const { width, height, phone, gutter, formFactor } = frame;
    this.add.rectangle(0, 0, width, height, PAPER).setOrigin(0, 0);
    const seats = this.#state.seats;
    const index = seats.findIndex((s) => s.id === this.#seat);
    const seatName = index >= 0 && seats[index] ? seatNameOf(seats[index]!, index) : this.#seat;
    const bar = drawTopBar(this, {
      backLabel: phone ? "◂" : `◂ ${t("room.picker.back").toUpperCase()}`,
      onBack: () => this.#backOrClose(),
      hints: phone ? null : this.#hints,
      title: this.#preset ? t("room.picker.titleFor", { seat: seatName }) : t("room.picker.title"),
      right: this.#preset ? t("room.deck.preset") : seatName,
      reserveRight: phone ? 80 : 0,
    });
    if (bar.back) this.#buttons.push(bar.back);
    this.#layout = { width, height, phone, gutter, formFactor, barHeight: bar.height, backRect: bar.backRect };
    this.#compose();
  }

  /**
   * Builds the panels from the current state and hands them over, and the focus stops that walk them. Nothing in the
   * canvas is touched, so a search, a verdict from the deck worker or a note going away rebuilds only what the player
   * sees change.
   */
  #compose(): void {
    const layout = this.#layout;
    if (!this.#alive || !layout) return;
    const { width, height, phone, gutter, formFactor, barHeight } = layout;
    this.#actions = new Map();
    this.#leases.begin();
    resetHoverCards(this);
    this.#stops = new Map();
    this.#order = [];
    if (layout.backRect) this.#addStop("back", layout.backRect, () => this.#backOrClose());

    // The deck whose details are open, if it is still among the decks.
    const seat = this.#state.seats.find((s) => s.id === this.#seat);
    const current = seat?.deck ? { hero: seat.deck.hero, name: seat.deck.name } : null;
    const open =
      this.#selected !== null && this.#options !== null
        ? (pickerRows(this.#options, "", current).find((r) => r.id === this.#selected) ?? null)
        : null;
    const presentation = detailsPresentationOf(formFactor);
    const area: Rect = { x: 0, y: barHeight, width, height: height - barHeight };
    const panelRect = open ? detailsPanelRect(area, presentation, formFactor) : null;
    // A sheet covers the whole screen: nothing under it is shown, so nothing under it can be pressed.
    const sheet = panelRect !== null && presentation === "sheet";
    this.#sheetOpen = sheet;
    const right = panelRect !== null && presentation === "slide" ? panelRect.x - 12 : width - gutter;

    const toggleWidth = phone ? 58 : 70;
    const controls = pickerControlsLayout({
      left: gutter,
      right,
      top: barHeight + 12,
      toggleWidth,
      searchHeight: hit.primary,
      buttonHeight: hit.target,
      importOpen: this.#importOpen,
    });

    if (sheet) {
      this.#region?.setHidden(true);
      this.#gridRegion?.setHidden(true);
    } else this.#mountMain(area, controls, current, right, layout);

    if (panelRect && open) this.#mountDetails(panelRect, presentation, open);
    else this.#dropDetails();

    if (this.#picking) this.#showBusy();
    else if (this.#veil) this.#hideBusy();
    this.#route?.set(this.#order, this.#stops);
    this.#leases.end();
    this.#hover?.onDraw();
    if (import.meta.env.DEV) {
      // Dev e2e hook: the card the hover popover shows, and how many cards it could show right now.
      (window as unknown as { __mcDeckPickerDebug?: unknown }).__mcDeckPickerDebug = {
        hoverKey: () => this.#hover?.shownKey ?? null,
        hoverCards: () => this.#hoverCardIds().size,
        actions: () => [...this.#actions.keys()],
      };
    }
  }

  /** The controls sheet (ground, search, view toggle, makers, link row, note) and, over it, the decks panel. */
  #mountMain(
    area: Rect,
    controls: PickerControlsLayout,
    current: { readonly hero: string; readonly name: string } | null,
    right: number,
    layout: PickerLayout,
  ): void {
    const { height, gutter, formFactor } = layout;
    const b = new SheetBuilder(this.game, { x: area.x, y: area.y }, isDesktopType);
    b.box(area, { fill: PAPER });

    // The fields keep what is typed in them across a rebuild (the search's debounce lags behind the keys).
    b.search(controls.search, {
      key: SEARCH,
      value: this.#field(SEARCH)?.text ?? this.#query,
      placeholder: t("room.picker.search"),
      clearLabel: t("deckPicker.searchClear"),
      maxLength: 80,
      debounce: 140,
      escapeClears: true,
    });
    this.#addStop(SEARCH, controls.search, () => this.#focusField(SEARCH));
    const labelType = { ...typeRole.label, size: 12 };
    (["grid", "list"] as const).forEach((mode, i) => {
      const rect = controls.toggles[i]!;
      const go = (): void => this.#setView(mode);
      b.button({
        key: `view:${mode}`,
        rect,
        label: t(mode === "grid" ? "room.picker.viewGrid" : "room.picker.viewList"),
        look: "secondary",
        type: labelType,
        selected: this.#view === mode,
      });
      this.#actions.set(`view:${mode}`, go);
      this.#addStop(`view:${mode}`, rect, go);
    });
    this.#drawMakers(b, controls, labelType);

    let top = controls.bottom + 8;
    const note = this.#note && this.time.now < this.#note.until ? this.#note.text : null;
    if (note) {
      // Two or three lines on a phone, not one cut line: the words are what the player needs.
      const wrapWidth = right - gutter - 12;
      const size = b.measure(note, typeRole.rowTitle, { size: 13, wrapWidth, maxLines: 3 });
      b.box({ x: gutter, y: top, width: right - gutter, height: size.height + 6 }, { fill: signal.caution.hex });
      b.text(gutter + 6, top + 3, note, typeRole.rowTitle, {
        size: 13,
        color: surface.inkOnHue.hex,
        wrapWidth,
        maxLines: 3,
      });
      top += size.height + 6 + 8;
    }
    const region = (this.#region ??= this.#wire(document.createElement("mc-sheet") as McSheet, area));
    this.#bindFields(region.element);
    region.setRect(area);
    region.setHidden(false);
    region.element.nodes = b.nodes;
    renderNow(region.element);

    // The decks, on their own panel over the ground.
    const listRect: Rect = { x: gutter, y: top, width: right - gutter, height: Math.max(0, height - top - gutter) };
    this.#listView = {
      x: listRect.x + 10,
      y: listRect.y + 8,
      width: listRect.width - 20,
      height: listRect.height - 16,
    };
    const rows = this.#options === null ? [] : pickerRows(this.#options, this.#query, current);
    const model = deckGridModelOf({
      rows,
      loading: this.#options === null,
      none: this.#options?.length === 0,
      mode: this.#view,
      selected: this.#selected,
      contentWidth: listRect.width - 32,
      formFactor,
      leases: this.#leases,
    });
    const grid = (this.#gridRegion ??= this.#wire(document.createElement("mc-deck-grid") as McDeckGrid, listRect));
    grid.setRect(listRect);
    grid.setHidden(false);
    grid.element.model = model;
    renderNow(grid.element);
    for (const row of rows) {
      const open = (): void => this.#select(row);
      const pick = (): void => void this.#pick(row);
      this.#actions.set(`open:${row.id}`, open);
      this.#actions.set(`pick:${row.id}`, pick);
      const stop = (key: string, activate: () => void): void =>
        this.#addStop(key, () => this.#liveRect(grid, key) ?? listRect, activate, {
          ensureVisible: () => grid.element.elementOf(key)?.scrollIntoView({ block: "nearest" }),
          view: () => this.#listView,
        });
      stop(`deck:${row.id}`, open);
      if (this.#view === "list") stop(`pick:${row.id}`, pick);
    }
    if (this.#listFromTop) {
      const scroller = grid.element.scroller;
      if (scroller) scroller.scrollTop = 0;
      this.#listFromTop = false;
    }
  }

  /** Listens to the controls sheet's two text fields (once: the sheet outlives a rebuild). */
  #bindFields(element: McSheet): void {
    if (this.#bound.has(element)) return;
    this.#bound.add(element);
    element.addEventListener("mc-search", (event) => {
      const { key, value: text } = (event as CustomEvent<{ key: string; value: string }>).detail;
      if (this.#picking) return;
      if (key === SEARCH) {
        this.#query = text;
        this.#listFromTop = true;
        this.#compose();
      } else if (key === IMPORT_FIELD) this.#importText = text;
    });
    element.addEventListener("mc-submit", (event) => {
      const { key, value: text } = (event as CustomEvent<{ key: string; value: string }>).detail;
      if (this.#picking) return;
      if (key === IMPORT_FIELD) {
        this.#importText = text;
        void this.#import();
      }
    });
  }

  /** Build a deck and Import from MarvelCDB, always offered, and the import's link row while it is open. */
  #drawMakers(b: SheetBuilder, controls: PickerControlsLayout, type: TypeSpec): void {
    const build = (): void => this.#build();
    const toggle = (): void => {
      this.#importOpen = !this.#importOpen;
      this.#compose();
      if (this.#importOpen) this.#focusField(IMPORT_FIELD);
    };
    b.button({ key: "build", rect: controls.build, label: t("room.picker.build"), look: "secondary", type });
    b.button({
      key: "import",
      rect: controls.importToggle,
      label: t("room.picker.importToggle"),
      look: "secondary",
      type,
      selected: this.#importOpen,
    });
    this.#actions.set("build", build);
    this.#actions.set("import", toggle);
    this.#addStop("build", controls.build, build);
    this.#addStop("import", controls.importToggle, toggle);
    const field = controls.importField;
    const go = controls.importGo;
    if (!field || !go) return;
    b.search(field, {
      key: IMPORT_FIELD,
      value: this.#field(IMPORT_FIELD)?.text ?? this.#importText,
      placeholder: t("room.picker.importPlaceholder"),
      clearLabel: t("deckPicker.searchClear"),
      maxLength: 200,
      debounce: 0,
      keepFocus: true,
      escapeClears: true,
    });
    this.#addStop(IMPORT_FIELD, field, () => this.#focusField(IMPORT_FIELD));
    const doImport = (): void => void this.#import();
    const busy = this.#importFlight.busy;
    b.button({
      key: "import-go",
      rect: go,
      label: busy ? t("room.picker.importing") : t("room.picker.importGo"),
      look: "primary",
      type,
      ...(busy ? { disabled: true as const } : {}),
    });
    this.#actions.set("import-go", doImport);
    this.#addStop("import-go", go, doImport);
  }

  /** The deck builder on a new deck; Back (or a Save then Back) returns here on the deck just built, ready to Pick. */
  #build(): void {
    if (this.#leaving || this.#picking || this.#importFlight.busy) return;
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
    if (this.#importFlight.busy || this.#leaving || this.#picking) return;
    const gen = ++this.#importGen;
    // Busy until the deck is saved and the list reloaded, not just until MarvelCDB answers: a second Enter during a
    // slow write would otherwise store the deck twice (`view/import-flight.ts`).
    await this.#importFlight.run(async () => {
      this.#compose();
      try {
        await this.#runImport(gen);
      } catch (cause) {
        if (!this.#alive || gen !== this.#importGen) return;
        this.#say(cause instanceof Error ? cause.message : String(cause));
      }
    });
    if (this.#alive && gen === this.#importGen) this.#compose();
  }

  async #runImport(gen: number): Promise<void> {
    const stored = await deckStorage().list();
    const env: ImportEnv = {
      pool: currentPool(),
      poolVersion: POOL_VERSION,
      now: () => new Date().toISOString(),
      newId: () => crypto.randomUUID(),
      existingNames: stored.map((deck) => deck.name),
    };
    const result = await importMarvelCdbDeck(this.#importText, env, undefined, false);
    if (!this.#alive || gen !== this.#importGen) return;
    if (!result.ok) {
      this.#say(result.message);
      return;
    }
    await deckStorage().put(result.deck);
    if (!this.#alive || gen !== this.#importGen) return;
    this.#importOpen = false;
    this.#importText = "";
    this.#say(importedDeckNote(result.deck.name, result.warnings));
    await this.#reloadDecks(result.deck.id as string);
  }

  /** The details panel's own region, above the others: built from the deck's details and slid in while it opens. */
  #mountDetails(rect: Rect, presentation: DetailsPresentation, row: PickerRow): void {
    if (this.#panelDetails?.id !== row.id) {
      this.#panelDetails = { id: row.id, details: deckDetailsOf(row, currentPool()) };
    }
    this.#panelDraw = { rect, presentation };
    this.#actions.set("panel:use", () => void this.#pick(row));
    this.#actions.set("panel:edit", () => this.#edit(row));
    this.#actions.set("panel:close", () => this.#closeDetails());
    const fresh = !this.#panelRegion;
    const region = (this.#panelRegion ??= this.#wire(document.createElement("mc-deck-details") as McDeckDetails, rect));
    // Drawn once at its resting place and moved as one (the region follows the anchor): a slide that rebuilt the panel
    // each frame was the cost, not the picture.
    if (fresh) region.follow(this.#anchor);
    this.#placePanel();
    region.setRect(rect);
    region.setHidden(false);
    // The body's column: the panel less its padding and the scrollbar's room.
    region.element.model = deckDetailsModelOf(this.#panelDetails.details, rect.width - 28 - 12, this.#leases);
    renderNow(region.element);
    this.#panelBody = {
      x: rect.x + 14,
      y: rect.y + 14,
      width: rect.width - 28,
      // The body's own height, as the panel laid it out.
      height: region.element.scroller?.clientHeight ?? Math.max(0, rect.height - 153),
    };
    if (this.#panelShown !== row.id) {
      const scroller = region.element.scroller;
      if (scroller) scroller.scrollTop = 0;
      this.#panelShown = row.id;
    }
    for (const key of ["panel:use", "panel:edit", "panel:close"]) {
      if (key === "panel:edit" && !this.#panelDetails.details.edit) continue;
      this.#addStop(key, () => this.#liveRect(region, key) ?? rect, this.#actions.get(key)!);
    }
  }

  #dropDetails(): void {
    this.#panelRegion?.destroy();
    this.#panelRegion = null;
    this.#panelDraw = null;
    this.#panelShown = null;
  }

  /** The deck builder on this deck; Back (or a Save then Back) returns here with its details open. */
  #edit(row: PickerRow): void {
    if (this.#preview || this.#leaving || this.#picking) return;
    this.#leaving = true;
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.deckBuilder, {
      deck: row.option.deck,
      returnTo: { key: SCENES.roomDeckPicker, data: this.#returnData(row.id) },
    } satisfies DeckBuilderSceneData);
  }
}

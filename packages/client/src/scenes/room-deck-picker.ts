/**
 * The room's deck picker (issue #880; Quin, 2026-11-20: every player brings their own hero and deck): the decks on THIS
 * device, saved, imported and precon, as rows with the hero's picture, searched with the shared fuzzy match
 * (`view/room-deck-picker-model.ts`). A seated player picks one for their seat ("Choose your deck"); the host picks one
 * for any seat ("Set deck", sent as a preset the holder may replace). Back returns to the lobby, which is still joined.
 *
 * The picker only chooses: whether a deck may be seated is the engine's verdict on each `DeckOption`, and the host's
 * engine judges the deck again at Start.
 *
 * Everything under the top bar is Lit panels over the canvas (`dom/dom-region.ts`): the controls and the grid or list of
 * decks are one `mc-sheet`, the details panel (a slide-out on a wide screen, a full sheet on a phone) another that
 * slides in over it, and the "Sending your deck" veil a third above both. The scene keeps the top bar, the search and
 * link fields (Phaser DOM text inputs, left uncovered by a hole), the focus route (ring drawn in the panel layer) and
 * the card hover popover. The lists scroll in the panel and every control in them is a tap: a swipe that ends over Pick
 * fires nothing (issue #227).
 */
import Phaser from "phaser";
import type { McSheet } from "@mc/ui";
import type { CoreAspect, Deck } from "@mc/content";
import { PackLeases, refreshPackArt } from "../art/pack-art.js";
import { currentCardsById, currentDeps, currentPool, POOL_VERSION } from "../content/pool.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { heroPictureOf } from "../dom/hero-picture.js";
import { buildDetailsSheet, DETAILS_BODY, type DetailsSheet } from "../dom/room-deck-details-sheet.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { t, tPlural } from "../i18n/translate.js";
import { onArtChange, onLanguageChange } from "../language-change.js";
import { importedDeckNote, importMarvelCdbDeck } from "../platform/marvelcdb-import.js";
import { chooseDeck, onRoomState, presetDeck, roomState, warmDeckWorker, type RoomState } from "../platform/room.js";
import { appSession, deckStorage } from "../session.js";
import { border, hit, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import { campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { cssOf } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { McTextInput, type McButton } from "../ui/widgets.js";
import { aspectStampsOf } from "../view/aspect-stamp.js";
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
  gridContentHeight,
  panelOffsetAt,
  pickerControlsLayout,
  pickerGridLayout,
  readPickerView,
  tileRect,
  tileTitleOf,
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
const INK = surface.ink.hex;
const PARCHMENT = surface.parchment.hex;
/** How long a note about what the room refused stays above the list. */
const NOTE_MS = 6000;
/** A page of the list, as a share of its height (PageUp / PageDown, the shoulder buttons). */
const PAGE = 0.85;
/** The key of the list's scrolling region in the sheet. */
const LIST = "list";

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
  readonly seatName: string;
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
  readonly #importFlight = new ImportFlight();
  /** Bumped on every import and every visit: an answer for an older one is dropped. */
  #importGen = 0;
  #importInput: McTextInput | null = null;
  /** The two text fields' boxes now (null while a field is not on screen), for the holes they are seen through. */
  #fieldRect: Rect | null = null;
  #importRect: Rect | null = null;
  /** The top bar's Back button. */
  #buttons: McButton[] = [];
  #layout: PickerLayout | null = null;
  /** The controls and the list or grid: one Lit panel over the canvas, made once a visit so the list's scroll stays. */
  #region: DomRegion<McSheet> | null = null;
  /** The details panel, its own panel above the first; made on opening and dropped on closing. */
  #panelRegion: DomRegion<McSheet> | null = null;
  /** The "Sending your deck" veil, above both, while a deck is on its way. */
  #veil: DomRegion<McSheet> | null = null;
  /** The pack pictures' blob URLs the panels show, held while their lazy images may still load them. */
  readonly #leases = new PackLeases();
  /** What each key in the panels does when tapped, this compose. */
  #actions = new Map<string, () => void>();
  /** The list's own box on screen, and the hero pictures in it by hover slot (`y` from the list's top). */
  #listView: Rect = { x: 0, y: 0, width: 0, height: 0 };
  #listFaces = new Map<string, { readonly cardId: string; readonly rect: Rect }>();
  /** The list reads from its top on the next compose (a new search or view). */
  #listFromTop = false;
  /** Whether the details are a full sheet, so the list under them is not shown. */
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
  #searchTimer: Phaser.Time.TimerEvent | null = null;
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
  /** The details sheet as last built: its card faces and body, for the hover popover. */
  #panelSheet: DetailsSheet | null = null;
  /** Which deck the details panel last showed, so a new one reads from its top. */
  #panelShown: string | null = null;
  /** 0 just opened, 1 settled: how far the panel has come in (`panelOffsetAt`). */
  #progress = 1;
  #slide: Phaser.Tweens.Tween | Phaser.Tweens.TweenChain | null = null;
  /** What the details region follows while it slides in. */
  readonly #anchor: { x: number; y: number; alpha: number; active: boolean } = { x: 0, y: 0, alpha: 1, active: true };
  #panelDraw: { readonly rect: Rect; readonly presentation: DetailsPresentation } | null = null;

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
    this.#panelSheet = null;
    this.#panelShown = null;
    this.#panelDraw = null;
    this.#progress = 1;
    this.#slide = null;
    this.#region = null;
    this.#panelRegion = null;
    this.#veil = null;
    this.#listFromTop = false;
    this.#sheetOpen = false;
    this.#fieldRect = null;
    this.#importRect = null;
    this.#layout = null;
  }

  create(): void {
    this.#alive = true;
    // The deck worker boots and takes the packs while the player is still choosing, so Pick does not wait on it.
    if (!this.#preview) warmDeckWorker();
    this.cameras.main.setBackgroundColor(cssOf(PAPER));
    this.#hints = new GlyphHints(this);
    bindTextFieldEscape(this, () => this.#input);
    bindTextFieldEscape(this, () => this.#importInput);
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => (this.#input?.focused ?? false) || (this.#importInput?.focused ?? false) || this.#picking,
      onCancel: () => {
        if (!this.#picking) this.#backOrClose();
      },
      primary: () => null,
      // The right stick, PageUp / PageDown and Home / End scroll what the focus is on: the details body from its own
      // buttons (or whenever the details are the whole screen), the list otherwise.
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
      this.#panelRegion = null;
      this.#veil = null;
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

  /** The element that scrolls under the focus: the details body or the list. */
  #scroller(): HTMLElement | null {
    const focused = this.#route?.focused ?? null;
    if (this.#panelRegion && (this.#sheetOpen || focused?.startsWith("panel:"))) {
      return this.#panelRegion.element.elementOf(DETAILS_BODY);
    }
    return this.#region?.element.elementOf(LIST) ?? null;
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
   * each pointer move). Worked out from the layout rects noted at compose time plus each panel's scroll: no element is
   * measured, so a long list costs a few subtractions.
   */
  #hoverCardIds(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const view = this.#listView;
    if (!this.#sheetOpen) {
      const scrolled = this.#region?.element.elementOf(LIST)?.scrollTop ?? 0;
      for (const [slot, face] of this.#listFaces) {
        const shown = clipHoverRect({ ...face.rect, y: view.y + face.rect.y - scrolled }, view);
        if (shown) found.set(slot, { ...shown, cardId: face.cardId, through: true });
      }
    }
    const panel = this.#panelSheet;
    if (panel && this.#panelRegion && this.#progress >= 1) {
      const scrolled = this.#panelRegion.element.elementOf(DETAILS_BODY)?.scrollTop ?? 0;
      panel.faces.forEach(({ cardId, rect }, index) => {
        const shown = clipHoverRect({ ...rect, y: panel.body.y + rect.y - scrolled }, panel.body);
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
      this.#compose();
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
  }

  #hideBusy(): void {
    this.#veil?.destroy();
    this.#veil = null;
  }

  #addStop(key: string, rect: Rect | (() => Rect), activate: () => void, extra: Partial<FocusStop> = {}): void {
    this.#stops.set(key, { rect, activate, ...extra });
    this.#order.push(key);
  }

  /** A panel part's box on screen now, scroll and slide included; null when it is not drawn. */
  #liveRect(region: DomRegion<McSheet> | null, key: string): Rect | null {
    const found = region?.element.elementOf(key);
    return found && region ? region.rectOf(found) : null;
  }

  /** A panel (one `mc-sheet` in a region) for this scene: presses reach `#actions`, a stale pack picture asks again. */
  #makeRegion(rect: Rect, holes: () => readonly Rect[]): DomRegion<McSheet> {
    const element = document.createElement("mc-sheet") as McSheet;
    element.addEventListener("mc-activate", (event) => {
      // Leaving already: a second tap must not act.
      if (this.#leaving) return;
      this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
    });
    // A pack picture's blob URL went stale before its lazy image loaded: read it again, once.
    element.addEventListener("mc-image-error", (event) => {
      const { key, src } = (event as CustomEvent<{ key: string; src: string | null }>).detail;
      refreshPackArt(key, src ?? undefined);
    });
    const region = new DomRegion(this, element, rect);
    // The card hover popover follows Phaser's pointer, which only hears the mouse over the canvas.
    region.forwardMouseMoves();
    region.setHoles(holes);
    return region;
  }

  /** Draws the screen: the top bar and ground in the canvas, then the panels over them. */
  #draw(): void {
    if (!this.#alive) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    const kept = [
      ...(this.#input ? this.#input.gameObjects : []),
      ...(this.#importInput ? this.#importInput.gameObjects : []),
    ];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);
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
    this.#layout = {
      width,
      height,
      phone,
      gutter,
      formFactor,
      barHeight: bar.height,
      backRect: bar.backRect,
      seatName,
    };
    this.#compose();
  }

  /**
   * Builds the panels from the current state and hands them over: the controls and the list or grid, the open details
   * and the veil, and the focus stops that walk them. Nothing in the canvas is touched, so a search, a verdict from the
   * deck worker or a note going away rebuilds only what the player sees change.
   */
  #compose(): void {
    const layout = this.#layout;
    if (!this.#alive || !layout) return;
    const { width, height, phone, gutter, formFactor, barHeight } = layout;
    this.#actions = new Map();
    this.#leases.begin();
    this.#listFaces = new Map();
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

    // The search field and the view toggle, then the grid or list.
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
    this.#placeSearchField(controls.search, sheet);
    this.#placeImportField(controls, sheet);

    if (sheet) this.#region?.setHidden(true);
    else this.#mountMain(area, controls, current, right, layout);

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
      };
    }
  }

  /** The search field (a Phaser DOM input, seen through a hole in the panel): made once, laid out each compose. */
  #placeSearchField(rect: Rect, sheet: boolean): void {
    this.#fieldRect = rect;
    if (!this.#input) {
      this.#input = new McTextInput(this, {
        rect,
        value: this.#query,
        type: typeRole.body,
        placeholder: t("room.picker.search"),
        maxLength: 80,
        // Debounced, and only the list is rebuilt: a key per redraw made typing lag on a phone.
        onChange: (value) => {
          this.#query = value;
          this.#searchTimer?.remove();
          this.#searchTimer = this.time.delayedCall(140, () => {
            this.#searchTimer = null;
            this.#listFromTop = true;
            this.#compose();
          });
        },
      });
      this.children.bringToTop(this.#input.gameObject);
    } else {
      this.#input.layout(rect);
      this.#input.setPlaceholder(t("room.picker.search"));
    }
    this.#input.setVisible(!sheet);
  }

  /** The import's link field while its row is open (made and dropped with the row). */
  #placeImportField(controls: PickerControlsLayout, sheet: boolean): void {
    const field = controls.importField;
    if (!field) {
      this.#importInput?.destroy();
      this.#importInput = null;
      this.#importRect = null;
      return;
    }
    this.#importRect = field;
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
    this.#importInput.setVisible(!sheet);
  }

  /** The controls panel: ground, search room, view toggle, makers, the note and the list frame with its decks. */
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

    this.#addStop("search", controls.search, () => this.#input?.focus());
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
      const noteType = typeRole.rowTitle;
      const size = b.measure(note, noteType, { size: 13, wrapWidth, maxLines: 3 });
      b.box({ x: gutter, y: top, width: right - gutter, height: size.height + 6 }, { fill: signal.caution.hex });
      b.text(gutter + 6, top + 3, note, noteType, {
        size: 13,
        color: surface.inkOnHue.hex,
        wrapWidth,
        maxLines: 3,
      });
      top += size.height + 6 + 8;
    }
    const listRect: Rect = { x: gutter, y: top, width: right - gutter, height: Math.max(0, height - top - gutter) };
    b.box(listRect, { fill: PARCHMENT });
    b.box(
      { x: listRect.x + 1, y: listRect.y + 1, width: listRect.width - 2, height: listRect.height - 2 },
      { stroke: INK, strokeWidth: 2 },
    );
    const inner: Rect = {
      x: listRect.x + 10,
      y: listRect.y + 8,
      width: listRect.width - 20,
      height: listRect.height - 16,
    };
    // The decks scroll here; the scrollbar's room comes out of the right edge.
    const view: Rect = { x: inner.x, y: inner.y, width: inner.width - 12, height: inner.height };
    this.#listView = inner;
    const plan = this.#planList(b, view, current, formFactor);
    b.scroll(LIST, view, Math.max(inner.height, plan.height), plan.draw);

    const region = (this.#region ??= this.#makeRegion(area, () => this.#mainHoles()));
    region.setRect(area);
    region.setHidden(false);
    region.element.nodes = b.nodes;
    renderNow(region.element);
    if (this.#listFromTop) {
      const scroller = region.element.elementOf(LIST);
      if (scroller) scroller.scrollTop = 0;
      this.#listFromTop = false;
    }
  }

  /** What the controls panel leaves uncovered: the two Phaser text fields while they show, and the hover popover. */
  #mainHoles(): readonly Rect[] {
    const holes: Rect[] = [];
    if (this.#input?.shown && this.#fieldRect) holes.push(this.#fieldRect);
    if (this.#importInput?.shown && this.#importRect) holes.push(this.#importRect);
    const popover = this.#hover?.shownRect;
    if (popover) holes.push(popover);
    return holes;
  }

  /** Build a deck and Import from MarvelCDB, always offered, and the import's link row while it is open. */
  #drawMakers(b: SheetBuilder, controls: PickerControlsLayout, type: TypeSpec): void {
    const build = (): void => this.#build();
    const toggle = (): void => {
      this.#importOpen = !this.#importOpen;
      this.#compose();
      if (this.#importOpen) this.#importInput?.focus();
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
    this.#addStop("import-field", field, () => this.#importInput?.focus());
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
    if (this.#leaving || this.#importFlight.busy) return;
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
    if (this.#importFlight.busy || this.#leaving) return;
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
    this.#importInput?.setValue("");
    this.#say(importedDeckNote(result.deck.name, result.warnings));
    await this.#reloadDecks(result.deck.id as string);
  }

  /** The details panel's own region, above the controls: built from the deck's details and slid in while it opens. */
  #mountDetails(rect: Rect, presentation: DetailsPresentation, row: PickerRow): void {
    if (this.#panelDetails?.id !== row.id) {
      this.#panelDetails = { id: row.id, details: deckDetailsOf(row, currentPool()) };
    }
    const details = this.#panelDetails.details;
    const built = buildDetailsSheet({
      game: this.game,
      desktop: isDesktopType,
      rect,
      details,
      leases: this.#leases,
    });
    this.#panelSheet = built;
    this.#panelDraw = { rect, presentation };
    this.#actions.set("panel:use", () => void this.#pick(row));
    this.#actions.set("panel:edit", () => this.#edit(row));
    this.#actions.set("panel:close", () => this.#closeDetails());
    const fresh = !this.#panelRegion;
    const region = (this.#panelRegion ??= this.#makeRegion(rect, () => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    }));
    // Drawn once at its resting place and moved as one (the region follows the anchor): a slide that rebuilt the panel
    // each frame was the cost, not the picture.
    if (fresh) region.follow(this.#anchor);
    this.#placePanel();
    region.setRect(rect);
    region.element.nodes = built.nodes;
    renderNow(region.element);
    if (this.#panelShown !== row.id) {
      const scroller = region.element.elementOf(DETAILS_BODY);
      if (scroller) scroller.scrollTop = 0;
      this.#panelShown = row.id;
    }
    for (const stop of built.stops) {
      this.#addStop(stop.key, () => this.#liveRect(region, stop.key) ?? stop.rect, this.#actions.get(stop.key)!);
    }
  }

  #dropDetails(): void {
    this.#panelRegion?.destroy();
    this.#panelRegion = null;
    this.#panelSheet = null;
    this.#panelDraw = null;
    this.#panelShown = null;
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
   * What the list or grid scrolls: its parts (built in the region's own content space, `y` from 0 and `x` the
   * screen's) and their height, read before the region is made. The stops of every deck are registered here too: each
   * frames its element in the panel, so it follows the scroll.
   */
  #planList(
    b: SheetBuilder,
    view: Rect,
    current: { readonly hero: string; readonly name: string } | null,
    formFactor: PickerLayout["formFactor"],
  ): { readonly height: number; readonly draw: (b: SheetBuilder) => void } {
    const x = view.x;
    const options = this.#options;
    if (options === null) {
      const text = t("room.state.connecting");
      const wait = b.measure(text, typeRole.body, { size: 14 });
      return {
        height: wait.height + 8,
        draw: (inner) => void inner.text(x, 2, text, typeRole.body, { size: 14, color: INK, alpha: 0.7 }),
      };
    }
    const rows = pickerRows(options, this.#query, current);
    if (rows.length === 0) {
      const text = options.length === 0 ? t("room.picker.noDecks") : t("room.picker.empty");
      const none = b.measure(text, typeRole.body, { size: 14, wrapWidth: view.width });
      return {
        height: none.height + 8,
        draw: (inner) =>
          void inner.text(x, 2, text, typeRole.body, { size: 14, color: INK, alpha: 0.85, wrapWidth: view.width }),
      };
    }
    const inView = (key: string): Pick<FocusStop, "ensureVisible" | "view"> => ({
      ensureVisible: () => this.#region?.element.elementOf(key)?.scrollIntoView({ block: "nearest" }),
      view: () => this.#liveRect(this.#region, LIST) ?? view,
    });
    const frame =
      (id: string): (() => Rect) =>
      () =>
        this.#liveRect(this.#region, `frame:${id}`) ?? view;
    if (this.#view === "grid") {
      const layout = pickerGridLayout(view.width, formFactor);
      for (const row of rows) {
        this.#addStop(`deck:${row.id}`, frame(row.id), () => this.#select(row), inView(`frame:${row.id}`));
        this.#actions.set(`open:${row.id}`, () => this.#select(row));
      }
      return {
        height: gridContentHeight(layout, rows.length) + 8,
        draw: (inner) => {
          rows.forEach((row, i) => {
            const rect = tileRect(layout, x, 2, i);
            this.#drawTile(inner, rect, layout.artHeight, row, i);
          });
        },
      };
    }
    for (const row of rows) {
      this.#addStop(`deck:${row.id}`, frame(row.id), () => this.#select(row), inView(`frame:${row.id}`));
      this.#addStop(
        `pick:${row.id}`,
        () => this.#liveRect(this.#region, `pick:${row.id}`) ?? view,
        () => void this.#pick(row),
        inView(`pick:${row.id}`),
      );
      this.#actions.set(`open:${row.id}`, () => this.#select(row));
      this.#actions.set(`pick:${row.id}`, () => void this.#pick(row));
    }
    return {
      height: 2 + rows.length * (LIST_ROW_HEIGHT + 8) - 8 + 4 + 8,
      draw: (inner) => {
        rows.forEach((row, i) => {
          const rect: Rect = { x, y: 2 + i * (LIST_ROW_HEIGHT + 8), width: view.width, height: LIST_ROW_HEIGHT };
          this.#drawRow(inner, rect, row, i);
        });
      },
    };
  }

  /** The words under a deck's name: why it cannot be picked, that it is in the seat, or how many cards it has. Words, never a colour. */
  #statusOf(row: PickerRow, plain: string | null): { readonly text: string | null; readonly bold: boolean } {
    if (row.checking) return { text: t("room.picker.checking"), bold: false };
    if (!row.seatable) return { text: t("room.picker.notReady", { reason: row.blockedReason ?? "" }), bold: true };
    if (row.current) return { text: t("room.picker.current"), bold: true };
    return { text: plain, bold: false };
  }

  /** A hero's picture in `rect`, framed in ink, noted for the hover popover. Where no picture is known the box is plain. */
  #heroArt(b: SheetBuilder, rect: Rect, row: PickerRow, index: number): void {
    const picture = heroPictureOf(currentCardsById().get(row.cardId), this.#leases);
    b.image(rect, {
      src: picture.src,
      fill: signal.spent.hex,
      cover: picture.cover,
      ...(picture.retry !== undefined ? { retry: picture.retry } : {}),
    });
    b.box(rect, { stroke: INK, strokeWidth: border.detail });
    this.#listFaces.set(hoverSlotOf(row.cardId, `deck${index}`), { cardId: row.cardId, rect });
  }

  /** One grid tile: the hero's picture with a stripe of its aspect colors under it, the deck's words and its frame. */
  #drawTile(b: SheetBuilder, rect: Rect, artHeight: number, row: PickerRow, index: number): void {
    const selected = row.id === this.#selected;
    b.box(rect, { fill: PAPER, key: `frame:${row.id}` });
    const artRect: Rect = { x: rect.x, y: rect.y, width: rect.width, height: artHeight };
    this.#heroArt(b, artRect, row, index);
    // The aspect colors as a stripe under the picture; the aspect's name is in the words below, never the color alone.
    const aspects = row.option.deck.aspects.filter((a): a is CoreAspect =>
      ["aggression", "justice", "leadership", "protection", "basic", "pool"].includes(a as string),
    );
    const stamps = aspectStampsOf(aspects);
    stamps.forEach((stamp, s) => {
      const sw = artRect.width / stamps.length;
      b.box({ x: artRect.x + s * sw, y: artRect.y + artRect.height - 7, width: sw, height: 7 }, { fill: stamp.fill });
    });
    const tx = rect.x + 8;
    const tw = rect.width - 16;
    let ty = rect.y + artHeight + 6;
    b.text(tx, ty, tileTitleOf(row.name), typeRole.rowTitle, { size: 14, color: INK, fitWidth: tw });
    ty += 19;
    const who = [row.heroName, row.aspects].filter((p) => p !== "").join(" · ");
    b.text(tx, ty, who, typeRole.body, { size: 12, color: INK, alpha: 0.85, fitWidth: tw });
    ty += 16;
    const status = this.#statusOf(row, tPlural("room.deck.cards", row.cards));
    b.text(tx, ty, status.text ?? "", status.bold ? { ...typeRole.body, weight: 700 } : typeRole.body, {
      size: 12,
      color: INK,
      alpha: status.bold ? 1 : 0.85,
      fitWidth: tw,
    });
    b.box(
      { x: rect.x + 1, y: rect.y + 1, width: rect.width - 2, height: rect.height - 2 },
      { stroke: INK, strokeWidth: selected || row.current ? 5 : 2 },
    );
    b.tap(`open:${row.id}`, rect);
  }

  /** One list row: picture, words, a Pick button; the row (not the button) opens the details. */
  #drawRow(b: SheetBuilder, rect: Rect, row: PickerRow, index: number): void {
    b.box(rect, { fill: PAPER, key: `frame:${row.id}` });
    b.box(
      { x: rect.x + 1, y: rect.y + 1, width: rect.width - 2, height: rect.height - 2 },
      { stroke: INK, strokeWidth: row.current || row.id === this.#selected ? 5 : 2 },
    );
    const artRect = rowArtRect(rect);
    this.#heroArt(b, artRect, row, index);
    const buttonRect = rowButtonRect(rect);
    const tx = artRect.x + artRect.width + 10;
    const textWidth = buttonRect.x - 8 - tx;
    let ty = rect.y + 8;
    b.text(tx, ty, tileTitleOf(row.name), typeRole.rowTitle, { size: 15, color: INK, fitWidth: textWidth });
    ty += 21;
    const detail = [row.heroName, row.aspects, tPlural("room.deck.cards", row.cards)]
      .filter((p) => p !== "")
      .join(" · ");
    b.text(tx, ty, detail, typeRole.body, { size: 12, color: INK, alpha: 0.85, fitWidth: textWidth });
    ty += 17;
    const status = this.#statusOf(row, null);
    if (status.text) {
      b.text(tx, ty, status.text, status.bold ? { ...typeRole.body, weight: 700 } : typeRole.body, {
        size: 12,
        color: INK,
        alpha: status.bold ? 1 : 0.85,
        fitWidth: textWidth,
      });
    }
    b.tap(`open:${row.id}`, { x: rect.x, y: rect.y, width: buttonRect.x - 6 - rect.x, height: rect.height });
    // Not usable: dimmed, but a press still says why (a touch has no hover to show it).
    b.button({
      key: `pick:${row.id}`,
      rect: buttonRect,
      label: t("room.picker.choose"),
      look: row.seatable ? "primary" : "secondary",
      type: { ...typeRole.label, size: 13 },
      ...(row.seatable ? {} : { disabled: row.blockedReason ?? (true as const), pressable: true }),
    });
  }
}

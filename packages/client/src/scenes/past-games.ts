/**
 * Past games (issue #706): every finished game saved on this device, newest first, to look over and then watch again
 * as a replay, share as a link, or export as a replay file or a game log. Reached from the Title's "Past games" button;
 * Back returns there.
 *
 * **The screen is one custom element**, `mc-past-games-page` (`views/past-games/`), composing the sections in
 * `components/past-games/`: the ink bar (Back, the title, "Open a replay file"), the filter tabs, the export button and
 * the search box, the list of games and the details (a side panel beside the list on desktop and tablet, the newest game
 * shown there at first; a popup over the list on a phone). Which games are listed, what a row says and where everything
 * sits is `view/past-games-model.ts`'s and the page's CSS. Each row pictures the villain and the heroes (every picture
 * opens the card hover popover under a resting mouse) and says how the game went. The details carry the larger
 * pictures, each hero's damage and thwart, and the four actions: Watch (opens the game on the board as a replay; the
 * transport's Exit comes back here), Share link, Export (the `.mcreplay` file) and Log (the game log as text). Share,
 * Export and Log open the game in a replay worker of their own just long enough to write the file
 * (`past-games/past-games-actions.ts`). A shared link is kept per game while the app runs.
 *
 * This scene mounts the page, sets its `model` from the saves and its own state (`past-games/past-games-page-model.ts`),
 * handles the `mc-past-games` events and keeps what is a decision: the filter, the search text, the game picked, what is
 * running, the focus route (its ring drawn in the panel layer), the card hover popover and navigation. A pad or keyboard
 * walks Back, the tabs, the file button, the export button, the search, the rows and the details' actions; LB / RB step
 * the tabs; B (Escape) closes the phone's popup before it leaves the screen. Every press is `onTap` (a button, a row),
 * so the end of a swipe that lifts over a row or a button presses nothing (issue #227).
 */
import Phaser from "phaser";
import "@mc/ui";
import type { AnyCard } from "@mc/content";
import type { McSearchDetail } from "@mc/ui";
import "../views/past-games/mc-past-games-page/mc-past-games-page.js";
import type { PastGamesEventDetail } from "../components/past-games/shared/past-games-events.types.js";
import { CardEvents } from "../dom/card-events.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { renderDeep } from "../dom/element-render.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { PictureLeases } from "../dom/picture-leases.js";
import { onArtChange, onLanguageChange } from "../language-change.js";
import { defaultFaceFor } from "../art/art-source.js";
import { inputDevice } from "../platform/input-device.js";
import { appSession } from "../session.js";
import type { SaveMeta } from "../engine/game-storage.js";
import { surface } from "../tokens.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { cssOf } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { cardInPacks } from "../view/game-label-names.js";
import { PAST_GAME_FILTERS, type PastGameFilter, type PastGameRow } from "../view/past-games-model.js";
import { pastGamesFocusOrder } from "../view/screen-focus.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { PastGamesActions } from "./past-games/past-games-actions.js";
import { buildPastGamesPage, type Busy, type PastGamesPageBuild } from "./past-games/past-games-page-model.js";
import { bindTextFieldEscape } from "./text-field-escape.js";

/** How far a page (Page Up / Down, a shoulder button) scrolls, as a share of the scroller's height. */
const PAGE = 0.85;

/** How Past games was opened. All absent: from the Title, to the list as it was last left. */
export interface PastGamesSceneData {
  /** A game to show selected, with its details (a stats record's "View game"); scrolled into view once the saves load. */
  readonly gameId?: string;
  /** The screen that opened this one, which Back returns to (with `backData`) instead of the Title. */
  readonly from?: string;
  readonly backData?: object;
}

export class PastGamesScene extends Phaser.Scene {
  /** Every save on the device, or null while they are read. */
  #saves: readonly SaveMeta[] | null = null;
  #rows: readonly PastGameRow[] = [];
  /** What the search box says. Kept across visits like the filter (Phaser reuses the instance). */
  #query = "";
  /** The caret is in the search field: the screen's keyboard route stands aside. */
  #searchFocused = false;
  #filter: PastGameFilter = "all";
  /** Where the list was left: kept across visits and put back when the page is made again. */
  #listTop = 0;
  /** The list reads from its top on the next paint (a new filter or search). */
  #listFromTop = false;
  readonly #listened = new WeakSet<HTMLElement>();
  #mounted: MountedElement<HTMLElementTagNameMap["mc-past-games-page"]> | null = null;
  /** The game whose details show (the side panel), or whose popup is open (a phone); null for none. */
  #selectedId: string | null = null;
  #revealId: string | null = null;
  /** Where Back goes: a screen that sent the player here. Cleared by Back, so a visit from the Title is not sent there. */
  #backTo: { readonly from: string; readonly backData: object } | null = null;
  #busy: Busy | null = null;
  #route: FocusRoute | null = null;
  #glyphs!: ControlGlyphs;
  #hover: HoverPreview | null = null;
  #cards: CardEvents | null = null;
  #status: { readonly text: string; readonly until: number } | null = null;
  #popupOpen = false;
  #alive = false;
  readonly #leases = new PictureLeases();
  readonly #records = new Map<string, AnyCard>();
  #unbindStops: (() => void) | null = null;
  /** This visit's number: an open still running from an earlier visit stands down rather than act on this one. */
  #visit = 0;
  /** Back has started the fade out: no action starts until the next visit. */
  #leaving = false;
  #focusKey: string | null = null;
  #stamp = 0;
  readonly #actions: PastGamesActions;

  constructor() {
    super(SCENES.pastGames);
    this.#actions = new PastGamesActions({
      scene: this,
      current: (visit) => this.#current(visit),
      visit: () => this.#visit,
      leaving: () => this.#leaving,
      busy: () => this.#busy,
      setBusy: (busy, visit = this.#visit) => this.#setBusy(busy, visit),
      say: (text, ms) => this.#say(text, ms),
      sayIn: (visit, text, ms) => {
        if (this.#current(visit)) this.#say(text, ms);
      },
      rows: () => this.#rows,
      stopResizing: () => this.scale.off("resize", this.#draw, this),
    });
  }

  init(data: PastGamesSceneData): void {
    const gameId = data?.gameId;
    if (gameId) {
      this.#selectedId = gameId;
      this.#revealId = gameId;
      // The record's game may be under the current filter or search: show everything.
      this.#filter = "all";
      this.#query = "";
      this.#listTop = 0;
      this.#listFromTop = true;
    }
    // Only a visit that says where it came from returns there. Phaser keeps the scene, so a later visit without `from`
    // (from the Title, or back from a replay watched from here) must not keep a Stats return (code review, #917).
    this.#backTo = data?.from ? { from: data.from, backData: data.backData ?? {} } : null;
  }

  create(): void {
    // Back from a replay, which played its scenario's music: the menus' music again (#858). A no-op when it already is.
    appSession().music?.playTitle();
    this.#alive = true;
    this.#leaving = false;
    this.#visit += 1;
    this.#busy = null;
    this.#status = null;
    this.#saves = null;
    this.#popupOpen = false;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-past-games-page", { x: 0, y: 0, width, height });
    this.#mounted = mounted;
    const { region, element } = mounted;
    element.addEventListener("mc-past-games", (event) => !this.#leaving && this.#heard(event.detail));
    element.addEventListener("mc-search", (event) => {
      const { value } = (event as CustomEvent<McSearchDetail>).detail;
      if (value === this.#query) return;
      this.#query = value;
      this.#resetScroll();
      this.#draw();
    });
    element.addEventListener("mc-search-focus", (event) => {
      this.#searchFocused = (event as CustomEvent<{ focused: boolean }>).detail.focused;
    });
    // A pack scan that fails to load reads its file again (`mc-image-error` from a picture with a retry key).
    this.#leases.watch(element);
    this.#unbindStops = bindStopFocus(element, (key) => this.#route?.focusKey(key), { visibleOnly: true });
    this.#glyphs = new ControlGlyphs(this, () => this.#draw());
    this.#cards = new CardEvents(region);
    this.#cards.recordOf = (cardId) => this.#records.get(cardId);
    this.#cards.onInspect = (cardId, face) => {
      const card = this.#records.get(cardId) ?? cardInPacks(undefined, cardId);
      if (card) this.scene.launch(SCENES.inspect, { card: { cardId, face: face ?? defaultFaceFor(card) } });
    };
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#cards?.hovered() ?? new Map(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    region.forwardMouseMoves(() => this.#hover?.suppress());
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
    // A pad that put the caret in the search box can take it out again. Bound before the route (`text-field-escape.ts`).
    bindTextFieldEscape(
      this,
      () => this.#page()?.searchField ?? null,
      () => this.#popupOpen,
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#searchFocused,
      onCancel: () => this.#cancel(),
      onTab: (direction) => {
        if (!this.#popupOpen) this.#stepFilter(direction);
      },
      // The details scroll while the popup is up or the ring is on their actions; else the list does (the phone
      // popup holds the list under it still).
      onPage: (direction) => {
        const scroller = this.#activeScroller();
        scroller?.scrollBy({ top: direction * scroller.clientHeight * PAGE });
      },
      onHomeEnd: (edge) => {
        this.#activeScroller()?.scrollTo({ top: edge === "home" ? 0 : Number.MAX_SAFE_INTEGER });
      },
      onScroll: (_dx, dy) => {
        this.#activeScroller()?.scrollBy({ top: dy });
      },
      onFocusChange: (key) => {
        this.#focusKey = key;
      },
    });
    this.scale.on("resize", this.#draw, this);
    const offLanguage = onLanguageChange(() => this.#draw());
    // A pack's pictures are read from the store after the packs load: draw again when they land.
    const offArt = onArtChange(() => this.#draw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#visit += 1;
      offLanguage();
      offArt();
      this.scale.off("resize", this.#draw, this);
      this.#unbindStops?.();
      this.#unbindStops = null;
      this.#cards?.destroy();
      this.#cards = null;
      this.#hover?.destroy();
      this.#hover = null;
      this.#glyphs.dispose();
      this.#leases.dispose();
      // The page goes with the scene (`DomRegion`); the next visit makes a new one.
      this.#mounted = null;
    });
    this.#draw();
    // The words measured before the fonts were in: lay the bar out again once they are.
    void (typeof document === "undefined" ? undefined : document.fonts?.ready)?.then(() => {
      if (this.#alive) this.#draw();
    });
    fadeScreenIn(this);
    void this.#load();
  }

  #page(): HTMLElementTagNameMap["mc-past-games-page"] | null {
    return this.#mounted?.element ?? null;
  }

  /** The scroller the stick and the Page keys move: the details', or the list (never under the phone's popup). */
  #activeScroller(): HTMLElement | null {
    const page = this.#page();
    if (this.#popupOpen || (this.#focusKey?.startsWith("action:") ?? false)) return page?.detailsScroller ?? null;
    return page?.listScroller ?? null;
  }

  /** True while `visit` is still this scene's visit: a wait that began in an earlier one acts on nothing. */
  #current(visit: number): boolean {
    return this.#alive && !this.#leaving && this.#visit === visit;
  }

  async #load(): Promise<void> {
    const visit = this.#visit;
    const saves = await appSession().store.listSaves();
    if (!this.#current(visit)) return;
    this.#saves = saves;
    await this.#render();
    this.#revealSelected();
  }

  /** Scrolls a linked game (`#revealId`) to the middle of the list, once its row exists. */
  #revealSelected(): void {
    const id = this.#revealId;
    if (!id) return;
    this.#revealId = null;
    if (this.#rows.some((row) => row.id === id)) this.#page()?.centerRow(id);
  }

  #heard(detail: PastGamesEventDetail): void {
    switch (detail.type) {
      case "back":
        return this.#back();
      case "open-file":
        return void this.#actions.openFile();
      case "export-tracker":
        return void this.#actions.exportTracker();
      case "filter":
        return this.#setFilter(detail.filter);
      case "select": {
        const row = this.#rows.find((r) => r.id === detail.id);
        if (row && !this.#popupOpen) this.#select(row);
        return;
      }
      case "close":
        return this.#closePopup();
      case "action": {
        const row = this.#rows.find((r) => r.id === detail.id);
        if (row) this.#actions.act(row, detail.action);
        return;
      }
    }
  }

  #back(): void {
    // A replay being put on the board (Watch, or a picked file) is not walked away from: once it is installed on the session
    // only the board's own shutdown takes it down, and a Title fade already running would swallow the board's start.
    if (this.#busy?.action === "watch") return;
    // Anything else still waiting (a Share, an Export) stands down from here, not from the fade's end, and nothing new
    // starts during the fade.
    this.#leaving = true;
    this.#visit += 1;
    this.scale.off("resize", this.#draw, this);
    const back = this.#backTo;
    this.#backTo = null;
    if (back) goToScreen(this, back.from, back.backData);
    else goToScreen(this, SCENES.title);
  }

  /** B / Escape: closes the phone's popup first, then leaves. */
  #cancel(): void {
    if (this.#popupOpen) return this.#closePopup();
    this.#back();
  }

  #closePopup(): void {
    const id = this.#selectedId;
    this.#selectedId = null;
    void this.#render().then(() => {
      if (id) this.#route?.focusKey(`game:${id}`);
    });
  }

  #select(row: PastGameRow): void {
    this.#selectedId = row.id;
    void this.#render().then(() => this.#route?.focusKey("action:watch"));
  }

  #setFilter(filter: PastGameFilter): void {
    if (filter === this.#filter) return;
    this.#filter = filter;
    this.#resetScroll();
    void this.#render().then(() => this.#route?.focusKey(`filter:${filter}`));
  }

  #stepFilter(direction: 1 | -1): void {
    const at = PAST_GAME_FILTERS.indexOf(this.#filter);
    this.#setFilter(PAST_GAME_FILTERS[(at + direction + PAST_GAME_FILTERS.length) % PAST_GAME_FILTERS.length]!);
  }

  /** Says something at the foot of the screen for a while: a link copied, or why an action failed. */
  #say(text: string, ms = 4000): void {
    if (!this.#alive) return;
    const status = { text, until: Date.now() + ms };
    this.#status = status;
    this.#draw();
    this.time.delayedCall(ms, () => {
      if (this.#status !== status) return;
      this.#status = null;
      this.#draw();
    });
  }

  /** Sets what is running, for `visit` only. */
  #setBusy(busy: Busy | null, visit: number): void {
    if (!this.#current(visit)) return;
    this.#busy = busy;
    this.#draw();
  }

  /** The list reads from its top on the next draw (a new filter or search). */
  #resetScroll(): void {
    this.#listTop = 0;
    this.#listFromTop = true;
    const scroller = this.#page()?.listScroller;
    if (scroller) scroller.scrollTop = 0;
  }

  #draw(): void {
    void this.#render();
  }

  /** Sets the page from the saves and the state, and reads its stops once it has drawn. */
  async #render(): Promise<void> {
    const mounted = this.#mounted;
    if (!this.#alive || !mounted) return;
    const { region, element } = mounted;
    const stamp = ++this.#stamp;
    const { width, height } = this.scale.gameSize;
    resetHoverCards(this);
    this.#glyphs.reset();
    const device = inputDevice();
    const build = buildPastGamesPage({
      scene: this,
      saves: this.#saves,
      filter: this.#filter,
      query: this.#query,
      selectedId: this.#selectedId,
      busy: this.#busy,
      status: this.#status && this.#status.until > Date.now() ? this.#status.text : "",
      fromStats: this.#backTo?.from === SCENES.playerStats,
      steam: device.mode === "pad" && device.pad?.steam === true,
      pad: device.mode === "pad",
      leases: this.#leases,
      glyphs: this.#glyphs,
    });
    this.#glyphs.settled();
    if (build.dropSelection) this.#selectedId = null;
    this.#rows = build.rows;
    this.#popupOpen = build.popup;
    this.#records.clear();
    for (const [id, card] of build.records) this.#records.set(id, card);
    region.setRect({ x: 0, y: 0, width, height });
    element.model = build.model;
    await renderDeep(element);
    if (stamp !== this.#stamp || !this.#alive) return;
    // The new pictures are mounted: the ones the last pass held are given back now.
    this.#leases.end();
    this.#placeList(element.listScroller);
    this.#syncStops(build);
    this.#hover?.onDraw();
  }

  /** The list comes back to where it was left (a replay's Exit, a redraw), unless the filter or search reset it. */
  #placeList(scroller: HTMLElement | null): void {
    if (!scroller) return;
    if (this.#listFromTop) {
      scroller.scrollTop = 0;
      this.#listFromTop = false;
    }
    if (this.#listened.has(scroller)) return;
    this.#listened.add(scroller);
    scroller.scrollTop = this.#listTop;
    scroller.addEventListener(
      "scroll",
      () => {
        this.#listTop = scroller.scrollTop;
      },
      { passive: true },
    );
  }

  /** The route's stops, read from the rendered page: Back, the tabs, the file button, the export button, the search, the rows, the details. */
  #syncStops(build: PastGamesPageBuild): void {
    const mounted = this.#mounted;
    const route = this.#route;
    if (!mounted || !route) return;
    const { region, element } = mounted;
    const stops = new Map<string, FocusStop>(focusStopsOf(element, (target) => region.rectOf(target)));
    const actions = ["watch", "share", "export", "log"].map((a) => `action:${a}`);
    // The popup takes every press: only its own stops are on the route.
    const order = build.popup
      ? ["close", ...actions]
      : pastGamesFocusOrder(build.rows.map((row) => row.id)).filter((key) => stops.has(key));
    route.set(order, stops);
  }
}

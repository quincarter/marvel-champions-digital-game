/**
 * Pause (docs/phase4-screen-gaps.md §3 "W4"; owner decision 2026-09-18 — see `view/pause-model.ts`'s own header).
 *
 * The whole screen is one page element, `mc-pause-page` (`views/pause/`), made of section elements
 * (`components/pause/`): wide (desktop and tablet, both orientations) an ink menu beside a pane (the search field over the
 * Rules reference and "Jump to a moment", the Full game log, or the search results), phone one ink sheet (header with ✕,
 * search, the Reference and Table/Guide groups or the log, footer). This scene only mounts it, hands it a model
 * (`scenes/pause/pause-compose.ts`, from the live game, the settings and the room) and lets `PauseActions`
 * (`scenes/pause/pause-actions.ts`) answer its `mc-pause` events. It keeps the scrim and press shield, the entrance and
 * exit, the focus route (the page's `data-stop` parts, read by `dom/element-stops.ts`), the card hover popover for the
 * keyword cards' card names, and Settings' search worker.
 *
 * Launched over the Board by its own MENU/≡ chrome button, or by Escape when nothing else owns it (`scenes/board.ts`). The
 * board keeps running underneath, like every other overlay.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/pause/mc-pause-page/mc-pause-page.js";
import type { McSearchDetail, McSearchFocusDetail } from "@mc/ui";
import { addPressShield } from "../ui/press-shield.js";
import { renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { settleElements } from "../dom/element-settle.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { CardEvents } from "../dom/card-events.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { gameDeps } from "../content/game-deps.js";
import { surface } from "../tokens.js";
import { PAUSE_EVENT } from "../components/pause/shared/pause-events.types.js";
import { rulesGlossaryOf } from "../view/rules-reference.js";
import { guideRowInfoOf, cardSizeRowInfoOf, settingsRowInfoOf } from "../view/settings-rows.js";
import { guidePrefs, onGuidePrefsChange } from "../guide/guide-store.js";
import { appSession } from "../session.js";
import { onRoomState } from "../platform/room.js";
import { FocusRoute } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { OverlayMotion } from "../ui/transitions.js";
import { t } from "../i18n/translate.js";
import { liveStatus, onLiveStatus } from "../platform/live-watch.js";
import { pauseWatchLinkOf, watchLinkLabelOf } from "../view/live-watch-ui.js";
import { SettingsSearchClient } from "../view/settings-search-client.js";
import { PauseSearchSession } from "../view/pause-search.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { composePause, pauseModeOf, type ComposedPause } from "./pause/pause-compose.js";
import type { PauseContext } from "./pause/pause-context.types.js";
import { PauseActions } from "./pause/pause-actions.js";
import { quickEntriesOf, quickRowsOf } from "./pause/pause-quick-rows.js";
import { searchIndexInputOf, settingRowsOf } from "./pause/pause-search-host.js";
import {
  concedeSentenceOf,
  manualAdjustOn,
  roomChatShown,
  seatGame,
  showHandKey,
  showHandLabelOf,
} from "./pause/pause-room.js";
import { blindSheetOf, statusLineOf, wideStatusLineOf } from "./pause/pause-status.js";

type Page = MountedElement<HTMLElementTagNameMap["mc-pause-page"]>;

/** The pages that open over Pause and own the input while they are up (and the Board's own warnings). */
const COVERING_SCENES = [
  SCENES.rules,
  SCENES.settings,
  SCENES.playerStats,
  SCENES.manualAdjust,
  // The "This game won't count" warning before a Jump to a moment past a reveal opens over the Board (#791).
  SCENES.endTurnConfirm,
  SCENES.controls,
  SCENES.unlocks,
  SCENES.saveData,
  SCENES.inspect,
];

export class PauseOverlay extends Phaser.Scene {
  #page: Page | null = null;
  #scrim: Phaser.GameObjects.Graphics | null = null;
  #shield: Phaser.GameObjects.Zone | null = null;
  #route: FocusRoute | null = null;
  #cards: CardEvents | null = null;
  #hover: HoverPreview | null = null;
  #glyphs!: ControlGlyphs;
  #motion = new OverlayMotion();
  #actions!: PauseActions;
  /** The caret is in the search field: the focus route stands aside. */
  #typing = false;
  #searchClient: SettingsSearchClient | null = null;
  #search: PauseSearchSession | null = null;
  /** What the last draw showed: the route's order and the Reference toggle's state. */
  #composed: ComposedPause | null = null;

  constructor() {
    super(SCENES.pause);
  }

  create(): void {
    this.#motion = new OverlayMotion();
    this.#typing = false;
    this.#page = null;
    this.#composed = null;
    this.#actions = new PauseActions({
      scene: this,
      motion: this.#motion,
      draw: () => this.#draw(),
      page: () => this.#page?.element ?? null,
      search: () => this.#search,
      quickOpen: () => this.#composed?.model.quick.toggle.open ?? false,
    });
    this.#glyphs = new ControlGlyphs(this, () => this.#draw());
    // The watch link appearing (or going) while Pause is up adds or drops its item (#876); so does a Show my hand change.
    let linkShown = pauseWatchLinkOf(liveStatus()) !== null;
    const liveOff = onLiveStatus((status) => {
      const shown = pauseWatchLinkOf(status) !== null;
      if (shown === linkShown) return;
      linkShown = shown;
      if (this.sys.isActive()) this.#draw();
    });
    let handKey = showHandKey();
    const roomOff = onRoomState(() => {
      const key = showHandKey();
      if (key === handKey) return;
      handKey = key;
      if (this.sys.isActive()) this.#draw();
    });
    this.#searchClient = new SettingsSearchClient();
    this.#search = new PauseSearchSession(
      this.#searchClient,
      () => searchIndexInputOf(this.game, this.#actions.quick),
      (newQuery) => {
        // A new query's list reads from its top; the same query answered again (a setting changed in place) stays put.
        if (newQuery) this.#actions.fromTop = true;
        if (this.sys.isActive()) this.#draw();
      },
    );
    const storeOff = appSession().store.subscribe(() => this.#draw());
    // The standalone Settings overlay (or another Pause) can change the same live guide prefs while this one is open.
    const guideOff = onGuidePrefsChange(() => {
      this.#search?.reindex();
      this.#draw();
    });
    const onResize = (): void => {
      // A resize can change Settings' tabs (and so where a result lives, and which rows there are).
      this.#search?.reindex();
      this.#backdrop();
      this.#draw();
    };
    this.scale.on("resize", onResize, this);
    // Before the route: A, B or Start takes the caret out of the search field (as on Settings).
    bindTextFieldEscape(
      this,
      () => {
        const field = this.#page?.element.searchField;
        return field ? { focused: field.isFocused, blur: () => field.blurInput() } : null;
      },
      () => this.#covered(),
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#covered() || this.#typing,
      onCancel: () =>
        this.#actions.confirmingConcede ? this.#actions.setConfirmingConcede(false) : this.#actions.resume(),
    });
    const unbind = this.#mount();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      liveOff();
      roomOff();
      storeOff();
      guideOff();
      unbind();
      this.scale.off("resize", onResize, this);
      this.#hover?.destroy();
      this.#hover = null;
      this.#cards?.destroy();
      this.#cards = null;
      this.#glyphs.dispose();
      // The panel goes with the scene (`DomRegion`); the next open makes a new one.
      this.#page = null;
      this.#searchClient?.destroy();
      this.#searchClient = null;
      this.#search = null;
    });
    this.#draw();
    // The worker loads the pages it searches on its first message: start it now, so the first letter typed is answered
    // at once. Off the main thread, like the searching itself.
    this.#search.reindex();
  }

  /** Mounts the page, the scrim and the shield (kept for the life of the scene), and wires what the page says. */
  #mount(): () => void {
    const { width, height } = this.scale.gameSize;
    this.#scrim = this.add.graphics();
    this.#backdrop();
    // Nothing drawn: the entrance and exit tween this, and the panel rises and fades with it (`DomRegion.follow`).
    const anchor = this.add.graphics();
    const mounted = mountElement(this, "mc-pause-page", { x: 0, y: 0, width, height });
    this.#page = mounted;
    const { element, region } = mounted;
    region.follow(anchor);
    element.addEventListener(PAUSE_EVENT, (event) => this.#actions.heard(event.detail));
    element.addEventListener("mc-search", (event) => {
      this.#search?.setQuery((event as CustomEvent<McSearchDetail>).detail.value);
      this.#draw();
    });
    element.addEventListener("mc-search-focus", (event) => {
      this.#typing = (event as CustomEvent<McSearchFocusDetail>).detail.focused;
    });
    // The hover popover is drawn in the canvas, so its box is left out of the panel; the card's name raises the events.
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#cards?.hovered() ?? new Map(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    region.forwardMouseMoves(() => this.#hover?.suppress());
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
    this.#cards = new CardEvents(region);
    this.#cards.onInspect = (cardId, face) =>
      this.scene.launch(SCENES.inspect, { card: { cardId, face: face ?? { kind: "front" } } });
    this.#motion.enter(this, { scrim: [this.#scrim], panels: [anchor] });
    return bindStopFocus(element, (key) => this.#route?.focusKey(key));
  }

  /** The dim scrim over the board, and the shield that keeps a press outside the sheet off the board. */
  #backdrop(): void {
    const { width, height } = this.scale.gameSize;
    this.#scrim?.clear().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    this.#shield?.destroy();
    // The scrim is Graphics, which takes no pointer: without this a press outside the sheet reached the board.
    this.#shield = addPressShield(this, { x: 0, y: 0, width, height });
  }

  /** True while a page opened from here (or the Board's own warning) is over this sheet and owns the input. */
  #covered(): boolean {
    return COVERING_SCENES.some((key) => this.scene.isActive(key));
  }

  /** Everything the page shows that comes from the live game, the settings and the room. */
  #context(): PauseContext {
    const { store, settings } = appSession();
    const { game, perspectiveId, config } = store.state;
    const mode = pauseModeOf(this.scale.gameSize.width);
    const withGame = game !== null && perspectiveId !== null;
    const actions = this.#actions;
    actions.quick = quickEntriesOf(actions.quickHost, game);
    actions.entries = game ? rulesGlossaryOf(game, gameDeps()) : [];
    actions.guideRows = guideRowInfoOf(guidePrefs());
    this.#glyphs.reset();
    return {
      mode,
      hasGame: withGame,
      status: withGame ? (mode === "phone" ? statusLineOf : wideStatusLineOf)(game, perspectiveId, config) : "",
      blindLines: withGame ? blindSheetOf(game, perspectiveId, config) : [],
      adjusted: store.state.adjusted,
      seatGame: seatGame(),
      roomChat: roomChatShown(),
      manualAdjustOn: manualAdjustOn(),
      adjustLabel: actions.quickHost.adjustLabel(),
      quitLabel: seatGame() ? t("ask.leave") : t("pause.saveQuit"),
      concedeSentence: concedeSentenceOf(),
      confirmingConcede: actions.confirmingConcede,
      logExpanded: actions.logExpanded,
      quickExpanded: actions.quickExpanded,
      guidedRunActive: actions.guidedRunActive(),
      watchLinkLabel: pauseWatchLinkOf(liveStatus()) !== null ? watchLinkLabelOf(actions.linkCopied, false) : null,
      showHandLabel: showHandLabelOf(true),
      quickRows: quickRowsOf(actions.quick),
      query: this.#search?.query ?? "",
      searching: this.#search?.searching ?? false,
      results: this.#search?.results ?? null,
      settingRows: settingRowsOf(),
      tableRows: settingsRowInfoOf(settings),
      cardSize: cardSizeRowInfoOf(settings),
      guideRows: actions.guideRows,
      entries: actions.entries,
      logLines: appSession().gameLog.lines,
      undoable: actions.undoable(),
      cancelGlyph: this.#glyphs.glyph("cancel", ["cancel"], "ink", mode === "phone" ? 44 : 48),
    };
  }

  #draw(): void {
    // Answered its own exit already (Resume, Save & quit): a store update or resize mid-fade must not redraw.
    if (this.#motion.leaving || !this.#page) return;
    const { width, height } = this.scale.gameSize;
    resetHoverCards(this);
    const composed = composePause(this.#context());
    this.#glyphs.settled();
    this.#composed = composed;
    const { element, region } = this.#page;
    region.setRect({ x: 0, y: 0, width, height });
    element.model = composed.model;
    renderNow(element);
    if (this.#actions.fromTop) {
      element.resetScroll();
      this.#actions.fromTop = false;
    }
    this.#hover?.onDraw();
    // The route reads the stops once the page's sections have drawn too.
    void settleElements(element).then(() => this.#syncStops());
  }

  #syncStops(): void {
    const page = this.#page;
    if (!page || !this.#route || !this.#composed) return;
    this.#route.set(
      this.#composed.order,
      focusStopsOf(page.element, (target) => page.region.rectOf(target)),
    );
  }
}

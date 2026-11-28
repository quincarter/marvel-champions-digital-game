/**
 * Deck check (W1, docs/phase4-screen-gaps.md §3, P04/D04): a deck's resource curve, composition, legality and full card
 * list at a glance, with "Edit deck" back into the builder and "Start game ▸" into the setup flow — reached from the
 * Decks screen's "Check" button on every row and from Seats' "Deck check ▸" for the active seat.
 *
 * The whole screen is one page element, `mc-deck-check-page` (`views/deck-check/`), made of section elements
 * (`components/deck-check/`): the wide layout's rail, cards and ink panel, or a narrow layout's tab strip, one tab's body
 * and footer. This scene only mounts it, sets its properties from the view model (`view/deck-check-page-model.ts`: every
 * number is `view/deck-stats.ts`'s and the engine's own legality verdict, `view/deck-list-model.ts`'s), and handles its
 * events: back, edit, start, sort, tab, filter, an aspect tip, a tap on a card. It keeps the focus route (the page's
 * `data-stop` parts, read by `dom/element-stops.ts`) and the card hover popover (`dom/card-events.ts`).
 *
 * The rail's type filter chips are a display filter only, like the builder's.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/deck-check/mc-deck-check-page/mc-deck-check-page.js";
import type { PictureSource } from "@mc/ui";
import type { CoreAspect, Deck } from "@mc/content";
import { POOL_VERSION } from "../content/pool.js";
import { type ArtSource } from "../art/art-source.js";
import { PackLeases, refreshPackArt } from "../art/pack-art.js";
import { nextDeckListSort, type DeckListSort, type PlayerCardType } from "../view/deck-stats.js";
import { addCommunityDeck, testedEntryOf } from "../view/community-decks-model.js";
import { onArtChange, onLanguageChange } from "../language-change.js";
import { testedCatalog } from "../view/seatable-decks.js";
import type { CampaignDeckVerdict } from "../view/campaign-deck-edit-model.js";
import { deckCheckFocusOrder } from "../view/screen-focus.js";
import { deckCheckLayout, type DeckCheckTab } from "../view/deck-check-layout.js";
import { TYPE_FILTERS, deckCheckPageModel, type DeckCheckModelResult } from "../view/deck-check-page-model.js";
import { appSession } from "../session.js";
import { cardSizeFactor } from "../settings.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { deckBuilderView, rememberDeckListSort } from "../platform/deck-builder-view.js";
import { surface } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import type { DeckBuilderSceneData } from "./deck-builder.js";
import type { AspectLessonSceneData } from "./aspect-lesson.js";
import { SCENES, type SceneKey } from "./keys.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { t } from "../i18n/translate.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { CardEvents } from "../dom/card-events.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { renderNow } from "../dom/dom-region.js";
import { isDesktopType } from "../ui/desktop-type.js";
import type { DeckCheckEventDetail } from "../components/deck-check/shared/deck-check-events.types.js";
import { DECK_CHECK_RENDERED } from "../components/deck-check/shared/deck-check-events.types.js";

export interface DeckCheckSceneData {
  readonly deck: Deck;
  /** Where Back returns — defaults to the Decks screen, so a caller that only has a deck can still open this. */
  readonly returnTo?: { readonly scene: SceneKey; readonly data?: object };
  /**
   * "Start game ▸"'s handler; W2's Seats supplies one that continues to Table setup. It receives *this* scene so
   * the handler can `from.scene.start(...)` and thereby stop Deck check — a closure over the caller's own (already
   * stopped) scene would start the next screen underneath this one. Absent: Start game draws unavailable with its
   * reason rather than being omitted.
   */
  readonly onStartGame?: (from: Phaser.Scene) => void;
  /** The count and status to show instead of the loose-deck rules': a campaign deck is judged by its campaign. */
  readonly verdict?: CampaignDeckVerdict;
  /** The narrow layout's tab to open on (dev jumps and tests); defaults to Curve. */
  readonly tab?: DeckCheckTab;
}

type Page = MountedElement<HTMLElementTagNameMap["mc-deck-check-page"]>;

const PAGE = 0.85;
/** The heights the glyphs hung on Back and over the tab strip are drawn for. */
const BACK_HEIGHT = 44;
const TAB_HINT_HEIGHT = 14;
/** Below this width a narrow layout is a phone's: its title sits under the dark mode tab. */
const PHONE_WIDTH = 600;

/**
 * What "Edit deck" opens. A tested community deck is an offer, never stored, so the builder gets the player's own
 * editable copy of it (a new id, credited to its MarvelCDB decklist) rather than a deck it would save under the
 * offer's id. Any other deck is edited as it is.
 */
function editableCopyOf(deck: Deck): Deck {
  const entry = testedEntryOf(deck, testedCatalog());
  return entry
    ? addCommunityDeck(entry, {
        poolVersion: POOL_VERSION,
        now: () => new Date().toISOString(),
        newId: () => crypto.randomUUID(),
      })
    : deck;
}

export class DeckCheckScene extends Phaser.Scene {
  #deck!: Deck;
  #returnTo!: { readonly scene: SceneKey; readonly data?: object };
  #deckSort: DeckListSort = "aspect";
  #onStartGame: ((from: Phaser.Scene) => void) | undefined;
  #verdict: DeckCheckSceneData["verdict"];
  #activeTab: DeckCheckTab = "curve";
  /** Wide only: the rail's own type filter, applied to the cards (a display filter, never a deckbuilding rule). */
  #typeFilter: PlayerCardType | null = null;
  /** Which aspect's tip is open, if any — wide only. */
  #openTip: string | null = null;
  #alive = false;
  #leaving = false;
  #page: Page | null = null;
  readonly #leases = new PackLeases();
  #route: FocusRoute | null = null;
  #cards: CardEvents | null = null;
  #hover: HoverPreview | null = null;
  #unbind: (() => void) | null = null;
  /** The last view model: the faces for Inspect, and the cards and faces the route's order names. */
  #result: DeckCheckModelResult | null = null;
  /** The cards list reads from its top on the next draw (a new filter, sort or tab). */
  #fromTop = false;
  #syncQueued = false;
  #glyphs!: ControlGlyphs;
  /** The page's focus stops as last read: Escape's Back is the stop named `back`. */
  #stops = new Map<string, FocusStop>();

  constructor() {
    super(SCENES.deckCheck);
  }

  create(data: DeckCheckSceneData): void {
    this.#alive = true;
    this.#leaving = false;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#deck = data.deck;
    this.#returnTo = data.returnTo ?? { scene: SCENES.decks };
    this.#deckSort = deckBuilderView().deckSort;
    this.#onStartGame = data.onStartGame;
    this.#verdict = data.verdict;
    this.#activeTab = data.tab ?? "curve";
    this.#typeFilter = null;
    this.#openTip = null;
    this.#page = null;
    this.#result = null;
    this.#glyphs = new ControlGlyphs(this, () => this.#compose());
    this.scale.on("resize", this.#compose, this);
    // A pack picture that resolves later, or a card language switch (#390), reads the screen again.
    const artOff = onArtChange(() => {
      if (this.sys.isActive()) this.#compose();
    });
    const languageOff = onLanguageChange(() => {
      if (this.sys.isActive()) this.#compose();
    });
    resetHoverCards(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#compose, this);
      artOff();
      languageOff();
      this.#hover?.destroy();
      this.#hover = null;
      this.#cards?.destroy();
      this.#cards = null;
      this.#unbind?.();
      this.#unbind = null;
      this.#leases.dispose();
      this.#glyphs.dispose();
      this.#page = null;
    });
    this.#mount();
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.scene.isActive(SCENES.inspect),
      onCancel: () => {
        // An open aspect tip closes first; the next B leaves.
        if (this.#openTip !== null) this.#closeTip();
        else this.#stops.get("back")?.activate();
      },
      // LB / RB step Curve, Cards and Aspect on a narrow screen; the wide layout has no strip, so they page the cards.
      onTab: (direction) => {
        if (this.#wide()) {
          this.#pageBy(direction);
          return;
        }
        const order: readonly DeckCheckTab[] = ["curve", "cards", "aspect"];
        const next = order[order.indexOf(this.#activeTab) + direction];
        if (next) this.#setTab(next);
      },
      onScroll: (_dx, dy) => this.#page?.element.cardScroller?.scrollBy({ top: dy }),
      onPage: (direction) => this.#pageBy(direction),
      onHomeEnd: (edge) =>
        this.#page?.element.cardScroller?.scrollTo({ top: edge === "home" ? 0 : Number.MAX_SAFE_INTEGER }),
    });
    this.#compose();
    fadeScreenIn(this);
  }

  /** Mounts the page and wires what it says and what hovers over it. */
  #mount(): void {
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-deck-check-page", { x: 0, y: 0, width, height });
    this.#page = mounted;
    const { element, region } = mounted;
    element.addEventListener("mc-deck-check", (event) => this.#heard(event.detail));
    element.addEventListener(DECK_CHECK_RENDERED, () => this.#queueStops());
    element.addEventListener("mc-image-error", (event) => {
      const { key, src } = (event as CustomEvent<{ key?: string; src: string | null }>).detail;
      if (key) refreshPackArt(key, src ?? undefined);
    });
    this.#unbind = bindStopFocus(element, (key) => this.#route?.focusKey(key));
    // The hover popover is drawn in the canvas, so its box is left out of the panel; the picture raises the events.
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
  }

  #wide(): boolean {
    const { width, height } = this.scale.gameSize;
    return deckCheckLayout({ width, height }).wide;
  }

  #pageBy(direction: 1 | -1): void {
    const scroller = this.#page?.element.cardScroller;
    scroller?.scrollBy({ top: direction * scroller.clientHeight * PAGE });
  }

  #setTab(tab: DeckCheckTab): void {
    if (tab === this.#activeTab) return;
    this.#activeTab = tab;
    this.#fromTop = true;
    this.#compose();
  }

  #closeTip(): void {
    this.#openTip = null;
    if (this.#page) this.#page.element.openTip = null;
  }

  /** The page said something (a tap, or the focus route's click on a stop). */
  #heard(detail: DeckCheckEventDetail): void {
    if (this.#leaving) return;
    switch (detail.type) {
      case "back":
        return this.#goBack();
      case "edit":
        return this.#edit();
      case "start":
        return this.#start();
      case "sort":
        this.#deckSort = nextDeckListSort(this.#deckSort);
        rememberDeckListSort(this.#deckSort);
        this.#fromTop = true;
        return this.#compose();
      case "tab":
        return this.#setTab(detail.tab);
      case "filter":
        this.#typeFilter = TYPE_FILTERS.find((f) => f.id === detail.filter)?.type ?? null;
        this.#fromTop = true;
        return this.#compose();
      case "tip":
        this.#openTip = this.#openTip === detail.aspect ? null : detail.aspect;
        if (this.#page) this.#page.element.openTip = this.#openTip;
        this.#queueStops();
        return;
      case "tip-link":
        this.scene.launch(SCENES.aspectLesson, {
          aspect: detail.aspect as CoreAspect,
          backTo: "previous",
        } satisfies AspectLessonSceneData);
        return;
      case "tip-close":
        return this.#closeTip();
      case "card":
        return this.#inspect(detail.key);
    }
  }

  #goBack(): void {
    this.#leaving = true;
    goToScreen(this, this.#returnTo.scene, this.#returnTo.data);
  }

  /** Back in the builder when it opened this screen, on the deck it handed over; else a builder opened on this deck. */
  #edit(): void {
    this.#leaving = true;
    if (this.#returnTo.scene === SCENES.deckBuilder) goToScreen(this, SCENES.deckBuilder, this.#returnTo.data);
    else goToScreen(this, SCENES.deckBuilder, { deck: editableCopyOf(this.#deck) } satisfies DeckBuilderSceneData);
  }

  #start(): void {
    if (!this.#onStartGame) return;
    this.#leaving = true;
    this.#onStartGame(this);
  }

  /** A tap on a card cell (`card:<id>`) or a face tile (`face:<id>`) opens Inspect on it. */
  #inspect(key: string): void {
    const face = this.#result?.faces.get(key);
    if (face) this.scene.launch(SCENES.inspect, { card: { cardId: face.cardId, face: face.face } });
    else if (key.startsWith("card:"))
      this.scene.launch(SCENES.inspect, { card: { cardId: key.slice("card:".length), face: { kind: "front" } } });
  }

  /** A scan's picture: its URL (held while shown) cropped toward the top, where a card's art and title sit. */
  #pictureOf(source: ArtSource | null): PictureSource {
    const held = this.#leases.image(source);
    return {
      src: held.src,
      cover: { x: 0.5, y: 0.2 },
      missing: t("deckCheck.noScan"),
      ...(held.retry !== undefined ? { retry: held.retry } : {}),
    };
  }

  /** Sets the page from the deck and the filters. */
  #compose(): void {
    if (!this.#alive || !this.#page) return;
    this.#leases.begin();
    this.#glyphs.reset();
    resetHoverCards(this);
    const { width, height } = this.scale.gameSize;
    const layout = deckCheckLayout({ width, height });
    const size = layout.wide ? "wide" : width < PHONE_WIDTH ? "phone" : "narrow";
    this.#result = deckCheckPageModel({
      deck: this.#deck,
      verdict: this.#verdict,
      wide: layout.wide,
      inFlow: this.#returnTo.scene === SCENES.seats,
      canStart: this.#onStartGame !== undefined,
      typeFilter: this.#typeFilter,
      deckSort: this.#deckSort,
      pictureOf: (source) => this.#pictureOf(source),
      backLabel: this.#returnTo.scene === SCENES.seats ? t("deckCheck.backToSeats") : t("scenario.back"),
      cardScale: cardSizeFactor(appSession().settings.cardSize),
      desktop: isDesktopType(),
      // Back's B glyph, and LB / RB over the narrow tab strip, while a keyboard or pad is in use.
      backGlyph: this.#glyphs.glyph("back", ["cancel"], "ink", BACK_HEIGHT),
      tabsGlyph: layout.wide
        ? undefined
        : this.#glyphs.glyph("tabs", ["zonePrevious", "zoneNext"], "paper", TAB_HINT_HEIGHT),
    });
    this.#glyphs.settled();
    const { region, element } = this.#page;
    region.setRect({ x: 0, y: 0, width, height });
    element.size = size;
    element.tab = this.#activeTab;
    element.typeFilter = TYPE_FILTERS.find((f) => f.type === this.#typeFilter)?.id ?? "all";
    element.openTip = layout.wide ? this.#openTip : null;
    element.model = this.#result.model;
    renderNow(element);
    this.#leases.end();
    this.#hover?.onDraw();
    this.#queueStops();
  }

  /** Reads the page's stops a frame after it drew, once its parts (the card list waits for its width) have too. */
  #queueStops(): void {
    if (this.#syncQueued) return;
    this.#syncQueued = true;
    requestAnimationFrame(() => {
      this.#syncQueued = false;
      if (this.#alive) this.#syncStops();
    });
  }

  #syncStops(): void {
    if (!this.#page || !this.#route || !this.#result) return;
    const { element, region } = this.#page;
    if (this.#fromTop) {
      const scroller = element.cardScroller;
      if (scroller) {
        scroller.scrollTop = 0;
        this.#fromTop = false;
      }
    }
    const stops = new Map<string, FocusStop>(focusStopsOf(element, (target) => region.rectOf(target)));
    // A card's or a face's one action is Inspect, so `I` does what Enter does.
    for (const [key, stop] of stops) {
      if (key.startsWith("card:") || key.startsWith("face:")) stops.set(key, { ...stop, inspect: stop.activate });
    }
    this.#stops = stops;
    const wide = this.#wide();
    // An open tip's "Aspects ▸" link is the first stop, as Seats has it.
    const tipLink = wide && this.#openTip !== null && stops.has("aspect-tip-link") ? ["aspect-tip-link"] : [];
    this.#route.set(
      [
        ...tipLink,
        ...deckCheckFocusOrder({
          wide,
          activeTab: this.#activeTab,
          cardIds: this.#result.cardIds,
          faceIds: this.#result.faceIds,
          filterChipIds: wide ? TYPE_FILTERS.map((f) => f.id) : [],
          showSort: wide || this.#activeTab === "cards",
        }),
      ],
      stops,
    );
  }
}

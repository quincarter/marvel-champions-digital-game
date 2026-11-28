/**
 * The deck builder (PLAN.md Phase 9): pick an identity and its aspect(s), name the deck, search/filter the pool, add and
 * remove cards, and save, with live legality from the same `validateDeck` the Decks screen and `createGame` use. This scene
 * decides nothing about what's legal; it only shows what the engine already said.
 *
 * Two entries: `{ deck }` edits a saved deck (its identity is already fixed); `{}` starts fresh, showing only the identity
 * picker until one is chosen: `Deck.identityCardId` is required, so there is no `Deck` to build against until then.
 *
 * **Custom elements, over the canvas.** The whole screen is one page element, `mc-deck-builder-page`
 * (`views/deck-builder/`), made of section elements (`components/deck-builder/`): the wide layout's rail, pool and ink deck
 * panel, or a narrow layout's tabs, one tab's body and the pinned Save bar. This scene only mounts it, sets its model from
 * the builder's state (`deck-builder/builder-model.ts`, every number the engine's or the campaign's own), and answers its one
 * typed event (`mc-deck-builder`, `deck-builder/builder-actions.ts`). It keeps the focus route over the page's `data-stop`
 * parts (`dom/element-stops.ts`: `deck-builder/builder-stops.ts` adds the pool cards the windowed list has not built) and
 * the card hover popover and Inspect (`dom/card-events.ts`). Layout is the page's CSS and every list scrolls natively.
 *
 * **Issue #217 (2026-10-17).** A precon handed to this scene is never edited in place (`editableDeckOf`): the player edits
 * their own copy, which Save adds to their decks. The pool shows as card pictures by default (Card view, each cell with its
 * own -/+), with List view keeping the text rows. The search matches every word against name, traits, type and rules text.
 * Back warns once about unsaved changes, a saved deck can be deleted here, and New deck picks a hero from searchable tiles,
 * then starts from an empty deck or a copy of one of that hero's precons.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/deck-builder/mc-deck-builder-page/mc-deck-builder-page.js";
import type { PictureSource } from "@mc/ui";
import type { AnyCard, Deck, HeroIdentityCard } from "@mc/content";
import type { CampaignDeckContext, CampaignGrant } from "@mc/engine";
import type { McSearchFocusDetail } from "@mc/ui";
import { rebuildOnPackChange } from "../ui/pack-redraw.js";
import { artLanguageNow, type ArtSource } from "../art/art-source.js";
import { HERO_ART, heroArtForIdentity } from "../art/hero-art.js";
import type { Picture } from "../art/pictures.js";
import { currentPool } from "../content/pool.js";
import { campaignPool } from "../content/campaign-pool.js";
import { isCustomCard } from "../view/custom-content.js";
import { qualifiedHeroName } from "../view/hero-names.js";
import { editableDeckOf, identityOptions } from "../view/deck-builder-model.js";
import { startTab, type DeckBuilderTab } from "../view/deck-builder-tabs.js";
import { deckBuilderRowSizes } from "../view/deck-builder-rows.js";
import { formFactorFor } from "../view/layout.js";
import { loadDeckInsights } from "../view/player-stats-client.js";
import { CardPoolSearch } from "../view/card-pool-search.js";
import { DeckSearchClient } from "../view/deck-search-client.js";
import { deckBuilderView, rememberDeckBuilderView } from "../platform/deck-builder-view.js";
import { appSession, deckStorage } from "../session.js";
import { cardSizeFactor } from "../settings.js";
import { onArtChange } from "../language-change.js";
import { surface } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { fadeScreenIn } from "../ui/transitions.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { t } from "../i18n/translate.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { bindStopFocus } from "../dom/element-stops.js";
import { settleElements } from "../dom/element-settle.js";
import { CardEvents } from "../dom/card-events.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { renderNow } from "../dom/dom-region.js";
import { heroPictureOf } from "../dom/hero-picture.js";
import { PictureLeases } from "../dom/picture-leases.js";
import { sheetThemeFor } from "../ui/campaign-chrome.js";
import { BUILDER_EVENT, BUILDER_RENDERED } from "../components/deck-builder/shared/deck-builder-events.types.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { SCENES } from "./keys.js";
import type { CampaignReturn } from "./campaign/routes.js";
import { BuilderActions } from "./deck-builder/builder-actions.js";
import type { BuilderHost } from "./deck-builder/builder-host.js";
import { pageModel } from "./deck-builder/builder-model.js";
import { BuilderState } from "./deck-builder/builder-state.js";
import { buildStops } from "./deck-builder/builder-stops.js";
import type { ModelEnv } from "./deck-builder/model-env.js";
import { identities, poolDocuments, setCampaignMode } from "./deck-builder/pool-data.js";

/**
 * Between-issue deck editing (`scenes/campaign/deck-edit.ts`), a campaign mode over this same screen rather than a second
 * deck grid: the identity is locked for the whole campaign (RRG 1.8 Appendix I; MC10 p. 3), so no picker, no name field (a
 * campaign seat's deck has none of its own) and no Preconstructed/Clear (both would silently drop the campaign's own granted
 * lines, which a player can never remove by hand). Save writes through `campaignService().setSeatDeck` and returns to
 * `returnTo`, instead of `deckStorage()` and the Decks screen.
 */
export interface DeckBuilderCampaignData {
  readonly runId: string;
  readonly seatNumber: number;
  readonly returnTo: CampaignReturn;
  readonly context: CampaignDeckContext;
  /** The header text: the campaign's own name plus the seat and its identity (`scenes/campaign/deck-edit.ts` builds it). */
  readonly title: string;
  /** This seat's own `CampaignGrant`s, threaded to `campaignDeckEditModel` for `CampaignDeckEditRow.face` (MC27 p. 22's Enhanced side). */
  readonly grants: readonly CampaignGrant[];
  /** Present only when MC27 p. 6's optional freeze is still available to opt into (`deck-edit.ts`'s own eligibility check). */
  readonly optionalFreeze?: { readonly eligible: true };
}

export interface DeckBuilderSceneData {
  readonly deck?: Deck;
  readonly campaign?: DeckBuilderCampaignData;
  /** Campaign mode: the deck as the run stores it, when `deck` already holds unsaved edits (back from Deck check). */
  readonly savedDeck?: Deck;
  /** Open on the deck rail's From your games tab (Decks & Collection's "Build my own from this" / "Edit with these"). */
  readonly railTab?: "deck" | "games";
  /** Open on this narrow tab: coming back from Deck check, on the Deck tab that opened it. */
  readonly tab?: DeckBuilderTab;
  /** Where Back (and Delete) go instead of Decks, for a builder opened from another screen (the room deck picker's "Edit deck"). */
  readonly returnTo?: CampaignReturn;
}

type Page = MountedElement<HTMLElementTagNameMap["mc-deck-builder-page"]>;

/** Below this, the three-column desktop split doesn't have room to breathe and the scene stacks into one column instead. */
const WIDE_MIN_WIDTH = 1000;
/** Under this height the narrow layout folds the pool's filters behind the Filters chip, as a phone does. */
const FOLD_FILTERS_BELOW_HEIGHT = 700;
const PAGE = 0.9;

export class DeckBuilderScene extends Phaser.Scene {
  #state = new BuilderState();
  #actions: BuilderActions | null = null;
  #page: Page | null = null;
  #route: FocusRoute | null = null;
  #cards: CardEvents | null = null;
  #hover: HoverPreview | null = null;
  #unbind: (() => void) | null = null;
  #glyphs!: ControlGlyphs;
  readonly #leases = new PictureLeases();
  /** The bundled picture chosen per hero this visit, so a redraw never reshuffles a hero with several pictures. */
  readonly #identityArt = new Map<string, Picture | null>();
  #rows = deckBuilderRowSizes(1);
  #alive = false;
  /** The cards the pool lists now, and the focus stops as last read. */
  #pool: readonly AnyCard[] = [];
  #stops = new Map<string, FocusStop>();
  #gen = 0;
  #settling = false;
  #windowKey = "";
  #syncQueued = false;
  #artRedraw = false;
  /** The pool and hero list go back to their top after the next draw (a new search, filter or sort). */
  #toTop = false;
  /** The scrolled offset of each list, kept across redraws and tabs (a tab's body is a new element each time). */
  readonly #scrollMem = new Map<string, number>();
  /** The field the caret is in, or null: the route and the pad stand aside while one has it. */
  #field: (HTMLElement & { blurInput(): void }) | null = null;
  #host!: BuilderHost;

  constructor() {
    super(SCENES.deckBuilder);
  }

  create(data: DeckBuilderSceneData = {}): void {
    this.#alive = true;
    this.#page = null;
    this.#field = null;
    this.#windowKey = "";
    this.#toTop = false;
    this.#scrollMem.clear();
    this.#state = new BuilderState();
    this.#host = this.#makeHost(this.#state);
    this.#actions = new BuilderActions(this.#host);
    const state = this.#state;
    rebuildOnPackChange(this, () => this.#compose());
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#rows = deckBuilderRowSizes(cardSizeFactor(appSession().settings.cardSize));
    state.campaign = data.campaign ?? null;
    state.returnTo = data.returnTo ?? null;
    setCampaignMode(state.campaign !== null);
    const given = data.deck ?? null;
    // A precon is never edited in place (issue #217): the builder edits the player's own copy of it.
    state.deck =
      given && !state.campaign ? editableDeckOf(given, `deck-${crypto.randomUUID()}`, new Date().toISOString()) : given;
    state.savedDeck = state.campaign ? (data.savedDeck ?? given) : null;
    state.poolSearch = new CardPoolSearch({
      alive: () => this.sys.isActive(),
      language: () => artLanguageNow(),
      documents: poolDocuments,
      onChange: () => {
        this.#resetPool();
        this.#compose();
      },
    });
    state.heroSearch = new DeckSearchClient();
    // A campaign seat's hero may come from a pack the run carries but that is no longer installed (#978).
    const heroes = state.campaign ? identityOptions(campaignPool()) : identities();
    const deck = state.deck;
    state.identity = deck ? (heroes.find((i) => i.id === deck.identityCardId) ?? null) : null;
    // The sort, kept filters and card/list view the player last left (issue #531).
    const view = deckBuilderView();
    state.filter = { ...view.filter };
    state.sort = view.sort;
    state.poolView = view.poolView;
    state.deckSort = view.deckSort;
    state.status = given && deck !== given ? t("deckBuilder.editingCopy") : null;
    // Whether this deck is already stored decides "unsaved changes" and Delete; a deck handed over unsaved (a copy) is not.
    if (given && deck === given && !state.campaign) {
      const id = given.id;
      void deckStorage()
        .get(id)
        .then((stored) => {
          if (!this.scene.isActive() || state.deck?.id !== id) return;
          state.savedDeck = stored;
          this.#compose();
        });
    }
    state.railTab = data.railTab === "games" ? "games" : "deck";
    state.tab = data.tab ?? startTab(data.railTab);
    this.#glyphs = new ControlGlyphs(this, () => this.#compose());
    void appSession()
      .store.listSaves()
      .then((saves) => loadDeckInsights(saves))
      .then((insights) => {
        if (!this.scene.isActive()) return;
        state.insights = insights;
        if (this.#host.showsGames()) this.#compose();
      })
      .catch(() => undefined);

    const onResize = (): void => this.#compose();
    this.scale.on("resize", onResize, this);
    // A picture whose source changed (the card language, a pack's art arriving) is a new URL on the same part: one redraw,
    // batched; a picture that merely loads never calls this (an `<img>` loads on its own).
    const offArt = onArtChange(() => {
      if (this.#artRedraw) return;
      this.#artRedraw = true;
      queueMicrotask(() => {
        this.#artRedraw = false;
        if (this.#alive && this.scene.isActive()) this.#compose();
      });
    });
    resetHoverCards(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", onResize, this);
      offArt();
      this.#actions?.dispose();
      this.#hover?.destroy();
      this.#hover = null;
      this.#cards?.destroy();
      this.#cards = null;
      this.#unbind?.();
      this.#unbind = null;
      this.#glyphs.dispose();
      this.#leases.dispose();
      state.poolSearch?.destroy();
      state.poolSearch = null;
      state.heroSearch?.destroy();
      state.heroSearch = null;
      this.#page = null;
    });
    this.#mount();
    // A pad that put the caret in a field can take it out again (B, A or Start). Bound before the route, so the A that
    // focuses the field is not also read as the press that leaves it (`text-field-escape.ts`).
    bindTextFieldEscape(
      this,
      () => ({ focused: this.#field !== null, blur: () => this.#field?.blurInput() }),
      () => this.#host.overlayUp(),
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      // B is the Back button (which asks to confirm when there are unsaved changes).
      onCancel: () => this.#stops.get("back")?.activate(),
      blocked: () => this.#host.overlayUp() || this.#field !== null,
      onPage: (direction) => this.#scrollMain(direction * this.#mainHeight() * PAGE),
      // LB / RB: the narrow layout's tabs (Pool, Deck, From your games); the wide layout's deck rail has two.
      onTab: (direction) => this.#actions?.stepTabs(direction),
      onScroll: (_dx, dy) => this.#scrollMain(dy),
      onHomeEnd: (edge) => this.#scrollMain(edge === "home" ? -1e9 : 1e9),
    });
    this.#compose();
    fadeScreenIn(this);
  }

  // ---- The page ---------------------------------------------------------------------------------------------------------

  /** Mounts the page and wires what it says and what hovers over it. */
  #mount(): void {
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-deck-builder-page", { x: 0, y: 0, width, height });
    this.#page = mounted;
    const { element, region } = mounted;
    element.addEventListener(BUILDER_EVENT, (event) => this.#actions?.handle(event.detail));
    element.addEventListener(BUILDER_RENDERED, () => this.#queueStops());
    element.addEventListener("mc-window", (event) => {
      const key = `${event.detail.start}-${event.detail.end}`;
      if (key === this.#windowKey) return;
      this.#windowKey = key;
      // A window the draw in flight made is already what it drew; a scroll that moves it builds the new rows (and their pictures).
      if (!this.#settling) this.#compose();
    });
    // The caret in a field: the route and the pad stand aside while one has it.
    element.addEventListener("mc-search-focus", (event) => {
      const { focused } = (event as CustomEvent<McSearchFocusDetail>).detail;
      const field = event
        .composedPath()
        .find(
          (node): node is HTMLElement & { blurInput(): void } =>
            typeof (node as { blurInput?: unknown }).blurInput === "function",
        );
      if (focused) this.#field = field ?? null;
      else if (!field || this.#field === field) this.#field = null;
    });
    // A pack scan that fails to load reads its file again (`mc-image-error` from a picture with a retry key).
    this.#leases.watch(element);
    this.#unbind = bindStopFocus(element, (key) => this.#route?.focusKey(key));
    // The hover popover is drawn in the canvas, so its box is left out of the panel; the picture raises the events.
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#cards?.hovered() ?? new Map(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    region.forwardMouseMoves(() => this.#hover?.suppress());
    // Only while the pointer rests on a card: a press that follows a quick move onto a control must not land in the hole of
    // a popover that is still closing.
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover && (this.#cards?.hovered().size ?? 0) > 0 ? [popover] : [];
    });
    this.#cards = new CardEvents(region);
    this.#cards.onInspect = (cardId, face) =>
      this.#host.inspect(cardId, (face as { kind: string } | undefined) ?? null);
  }

  #makeHost(state: BuilderState): BuilderHost {
    return {
      state,
      scene: this,
      compose: () => this.#compose(),
      resetPool: () => this.#resetPool(),
      focusKey: (key) => {
        // A key or pad press keeps the ring where it was; a mouse press leaves it off.
        this.#route?.focusKey(key);
      },
      isWide: () => this.#layout() === "wide",
      overlayUp: () =>
        this.scene.isActive(SCENES.inspect) ||
        this.scene.isActive(SCENES.searchHelp) ||
        this.scene.isActive(SCENES.poolPick) ||
        this.scene.isActive(SCENES.aspectLesson),
      // A hold that also taps would open it twice.
      inspect: (cardId, face) => {
        if (this.scene.isActive(SCENES.inspect)) return;
        this.scene.launch(SCENES.inspect, { card: { cardId, face: face ?? { kind: "front" } } });
      },
      setDeck: (deck) => {
        const state = this.#state;
        state.deck = deck;
        if (state.leaveArmed || state.deleteArmed) {
          state.leaveArmed = false;
          state.deleteArmed = false;
          state.status = null;
        }
        this.#compose();
      },
      showsGames: () => (this.#layout() === "wide" ? this.#state.railTab === "games" : this.#state.tab === "games"),
      rememberView: () =>
        rememberDeckBuilderView({
          sort: this.#state.sort,
          filter: this.#state.filter,
          poolView: this.#state.poolView,
          deckSort: this.#state.deckSort,
        }),
    };
  }

  #layout(): ModelEnv["layout"] {
    const { width, height } = this.scale.gameSize;
    const form = formFactorFor(width, height);
    return form === "phone" ? "phone" : width >= WIDE_MIN_WIDTH ? "wide" : "narrow";
  }

  /** A card scan as the panel draws it: its URL (held while shown) and the key to ask again by when a pack scan fails. */
  #scan = (source: ArtSource | null, missing: string): PictureSource => {
    const held = this.#leases.image(source);
    return { src: held.src, missing, ...(held.retry !== undefined ? { retry: held.retry } : {}) };
  };

  /**
   * The identity picture as the panel draws it: the hero's own art (`art/heroes/`, the one chosen this visit), else the
   * identity card's scan, an installed pack hero's picture leased by its key (`dom/hero-picture.ts`).
   */
  #heroPicture = (identity: HeroIdentityCard): PictureSource => {
    const id = identity.id as string;
    let chosen: Picture | null | undefined;
    // An installed pack hero's picture arrives after the first draw, so it is not remembered here.
    if (!isCustomCard(id)) {
      chosen = this.#identityArt.get(id);
      if (chosen === undefined) {
        chosen = heroArtForIdentity(HERO_ART, id, currentPool());
        this.#identityArt.set(id, chosen);
      }
    }
    const picture = heroPictureOf(identity, this.#leases, "tile", chosen);
    return {
      src: picture.src,
      cover: picture.cover,
      missing: qualifiedHeroName(identity),
      ...(picture.retry !== undefined ? { retry: picture.retry } : {}),
    };
  };

  #env(): ModelEnv {
    const { width, height } = this.scale.gameSize;
    return {
      layout: this.#layout(),
      width,
      height,
      folded: formFactorFor(width, height) !== "desktop" || height < FOLD_FILTERS_BELOW_HEIGHT,
      desktop: isDesktopType(),
      cardScale: cardSizeFactor(appSession().settings.cardSize),
      rows: this.#rows,
      scan: this.#scan,
      heroPicture: this.#heroPicture,
      glyph: (key, ids, ground, height) => this.#glyphs.glyph(key, ids, ground, height),
    };
  }

  /** Sets the page from the builder's state. */
  #compose(): void {
    const page = this.#page;
    if (!this.#alive || !page) return;
    this.#rememberScrolls();
    this.#leases.begin();
    this.#glyphs.reset();
    resetHoverCards(this);
    const env = this.#env();
    const { model, pool } = pageModel(this.#state, env);
    this.#pool = pool;
    this.#glyphs.settled();
    const { region, element } = page;
    const { width, height } = this.scale.gameSize;
    region.setRect({ x: 0, y: 0, width, height });
    element.layout = env.layout;
    element.model = model;
    renderNow(element);
    const gen = ++this.#gen;
    this.#settling = true;
    void settleElements(element).then(() => {
      // Only the newest draw gives back the pictures the last pass held (its list's cards lease theirs as they render).
      if (!this.#alive || gen !== this.#gen) return;
      this.#settling = false;
      this.#leases.end();
      this.#afterDraw();
    });
  }

  /** The draw is down: lists go where they were left, the toggle's room is made, hover and stops are read. */
  #afterDraw(): void {
    const page = this.#page;
    if (!page) return;
    this.#restoreScrolls(page.element.scrollers());
    this.#clearToggle();
    this.#hover?.onDraw();
    this.#queueStops();
  }

  /**
   * The dark mode toggle's press area is cut out of the panel, so words under it are cut off: the title drops below it or
   * ends before it (`sheetThemeFor`). Measured on the title set on one line (it does not depend on what is applied).
   */
  #clearToggle(): void {
    const page = this.#page;
    const header = page?.element.headerElement;
    const ghost = header?.ghost;
    if (!page || !header || !ghost) return;
    const { region, element } = page;
    const row = region.rectOf(header);
    const words = region.rectOf(ghost);
    const phone = this.#layout() === "phone";
    const back = 116;
    const plan = sheetThemeFor(this, {
      width: this.scale.gameSize.width,
      textLeft: row.x,
      textRight: row.x + Math.min(words.width, Math.max(0, row.width - back)),
      textTop: row.y,
      textHeight: words.height || (phone ? 28 : 38),
    });
    const max = plan.maxRight === null ? 0 : Math.max(80, plan.maxRight - row.x);
    if (element.titleDrop !== plan.drop || element.titleMax !== max) {
      element.titleDrop = plan.drop;
      element.titleMax = max;
    }
  }

  // ---- Scrolling ----------------------------------------------------------------------------------------------------------

  /** The pool and hero lists go back to their top (a new search, filter or sort). */
  #resetPool(): void {
    this.#toTop = true;
    this.#scrollMem.delete("pool");
    this.#scrollMem.delete("identity");
  }

  #rememberScrolls(): void {
    const scrollers = this.#page?.element.scrollers();
    if (!scrollers) return;
    for (const [key, element] of scrollers)
      if (!this.#toTop || (key !== "pool" && key !== "identity")) this.#scrollMem.set(key, element.scrollTop);
  }

  #restoreScrolls(scrollers: ReadonlyMap<string, HTMLElement>): void {
    for (const [key, element] of scrollers) {
      if ((key === "pool" || key === "identity") && this.#toTop) element.scrollTop = 0;
      else if (element.scrollTop === 0) element.scrollTop = this.#scrollMem.get(key) ?? 0;
    }
    this.#toTop = false;
  }

  #mainScroller(): HTMLElement | null {
    return this.#page?.element.mainScroller ?? null;
  }

  #mainHeight(): number {
    return this.#mainScroller()?.clientHeight ?? 400;
  }

  #scrollMain(pixels: number): void {
    this.#mainScroller()?.scrollBy({ top: pixels });
  }

  // ---- Focus stops --------------------------------------------------------------------------------------------------------

  /** Reads the page's stops a frame after it drew, once its parts (the pool list waits for its width) have too. */
  #queueStops(): void {
    if (this.#syncQueued) return;
    this.#syncQueued = true;
    requestAnimationFrame(() => {
      this.#syncQueued = false;
      if (this.#alive) this.#syncStops();
    });
  }

  #syncStops(): void {
    const page = this.#page;
    if (!page || !this.#route) return;
    const { element, region } = page;
    const { stops, order } = buildStops(element, this.#state, this.#pool, this.#layout() === "wide", {
      rectOf: (target) => region.rectOf(target),
      add: (cardId) => this.#actions?.handle({ type: "add", cardId }),
      open: (cardId) => this.#actions?.handle({ type: "open", cardId }),
    });
    this.#stops = stops;
    this.#route.set(order, stops);
  }
}

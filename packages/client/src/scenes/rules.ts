/**
 * Rules Reference (docs/phase4-screen-gaps.md §3 "W4"; view models in `view/rules-reference.ts` and
 * `view/rules-card-list.ts`; launched from `scenes/pause.ts#openRules` with `RulesSceneData`).
 *
 * **A full-screen reference with card art (owner feedback, 2026-09-18).** An ink chrome band (Back, "RULES REFERENCE", the
 * scope caption and toggle) edge to edge over a paper body with the tab rail and the glossary's search field:
 *
 * - **Glossary**: a grid of bordered entry cards: term, definition, citation and a strip of small thumbnails for every
 *   card that carries the keyword right now, each opening Inspect. "On your table" (default, with a game) filters to the
 *   table and points a thumbnail at the live instance; "All rules" (the only mode with no game) shows every entry and
 *   points a thumbnail at any pool card printing it.
 * - **Villain phase**: the six RRG 1.8 p. 47 steps, in sequence, the current one highlighted (ink fill, no red: this screen
 *   has no forward action to spend it on) with the main scheme's own scan, the villain's own scan, or the bundled
 *   encounter card back illustrating a step where one applies.
 * - **Card list**: every encounter set the pool knows, the running scenario's own first ("IN THIS GAME") under "On your
 *   table" scope, the rest ("NOT IN THIS GAME") under "All rules", each a heading over a wrapped grid of real card
 *   thumbnails with name captions, tap or hold or right-click opening Inspect.
 *
 * No rules text was invented for this pass: every glossary definition and citation is unchanged from `@mc/content`'s
 * `schema/glossary.ts` and `view/rules-reference.ts`'s own three table-state entries.
 *
 * **The screen is one page element**, `mc-rules-page` (`views/rules/`), in the shared `mc-reader` frame, made of the
 * section elements of `components/rules/`. This scene keeps the press shield, the scrim, the overlay's entrance and exit
 * (the page rises and fades with it, `DomRegion.follow`), the focus route, the card hover popover (`dom/card-events.ts`)
 * and what a press does; it sets the page's model (`scenes/rules/page-model.ts`) and handles its `mc-rules` events.
 *
 * Back returns to Pause (`this.scene.stop()`: Pause is still running underneath, since it launched this the same way
 * every other overlay in this app is launched).
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/rules/mc-rules-page/mc-rules-page.js";
import type { CardId } from "@mc/content";
import type { InstanceId } from "@mc/engine";
import { PackLeases, refreshPackArt } from "../art/pack-art.js";
import { defaultFaceFor } from "../art/art-source.js";
import { CARDS_BY_ID } from "../content/pool.js";
import { surface } from "../tokens.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { cardSizeFactor } from "../settings.js";
import { type RulesTab } from "../view/rules-layout.js";
import type { RulesCardRef } from "../view/rules-reference.js";
import { appSession } from "../session.js";
import { hintGlyphOf } from "../dom/hint-glyph.js";
import { rulesPageModelOf, RULES_TABS, type RulesModelResult } from "./rules/page-model.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { settleElements } from "../dom/element-settle.js";
import { CardEvents } from "../dom/card-events.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { isDesktopType } from "../ui/desktop-type.js";
import type { RulesEventDetail, RulesScope } from "../components/rules/shared/rules-events.types.js";
import { onArtChange, onLanguageChange } from "../language-change.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import type { InspectData } from "./inspect.js";
import { SCENES } from "./keys.js";
import { addPressShield } from "../ui/press-shield.js";
import { goToScreen, OverlayMotion } from "../ui/transitions.js";

export type { RulesScope };

/** How far a page (Page Up / Down, a shoulder button) scrolls, as a share of the list's height. */
const PAGE = 0.85;
const BACK_HEIGHT = 36;

/**
 * Optional starting point, so Pause's own "Quick reference" rows can jump straight to the right tab (and, for the
 * glossary, a pre-filled search). Absent, this opens exactly as it always has: the glossary tab, no query.
 */
export interface RulesSceneData {
  readonly initialTab?: RulesTab;
  readonly initialQuery?: string;
  /** Settings' search opens on "All rules": the entry it found may not be on the table. */
  readonly initialScope?: RulesScope;
}

type Page = MountedElement<HTMLElementTagNameMap["mc-rules-page"]>;

export class RulesOverlay extends Phaser.Scene {
  #activeTab: RulesTab = "glossary";
  #query = "";
  #scope: RulesScope = "table";
  #route: FocusRoute | null = null;
  #glyphs!: ControlGlyphs;
  /** The blob URLs of the pack pictures the page shows, held while its lazy images may still load them. */
  readonly #leases = new PackLeases();
  #page: Page | null = null;
  #cards: CardEvents | null = null;
  #hover: HoverPreview | null = null;
  #unbind: (() => void) | null = null;
  /** What a card tile's key does, and what a hold on a card does, as of the last model. */
  #result: RulesModelResult | null = null;
  /** True while the caret is in the search field (the route stands aside). */
  #searchFocused = false;
  /** The list reads from its top on the next draw (a new tab, scope or query). */
  #fromTop = false;
  #motion = new OverlayMotion();
  #alive = false;
  #drawn = 0;

  constructor() {
    super(SCENES.rules);
  }

  create(data: RulesSceneData = {}): void {
    this.#motion = new OverlayMotion();
    this.#alive = true;
    this.#activeTab = data.initialTab ?? "glossary";
    this.#query = data.initialQuery ?? "";
    this.#page = null;
    this.#searchFocused = false;
    this.#fromTop = false;
    this.#scope = data.initialScope ?? (appSession().store.state.game ? "table" : "all");
    const onResize = (): void => {
      this.#frame();
      this.#compose();
    };
    this.scale.on("resize", onResize, this);
    const offLanguage = onLanguageChange(() => this.#compose());
    // A card picture that resolves later (a pack's scan, once its pack has loaded) draws in place of "no scan".
    const offArt = onArtChange(() => {
      if (this.#alive) this.#compose();
    });
    this.#glyphs = new ControlGlyphs(this, () => this.#compose());
    // Before the route: A, B or Start takes the caret out of the search field.
    bindTextFieldEscape(
      this,
      () => ({ focused: this.#searchFocused, blur: () => this.#page?.element.searchField?.blurInput() }),
      () => this.scene.isActive(SCENES.inspect),
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.scene.isActive(SCENES.inspect) || this.#searchFocused,
      onCancel: () => this.#close(),
      // LB / RB step through the tabs (PageUp / PageDown still page the list); the right stick scrolls it.
      onTab: (direction) => {
        const at = RULES_TABS.indexOf(this.#activeTab);
        const next = RULES_TABS[Math.min(RULES_TABS.length - 1, Math.max(0, at + direction))]!;
        if (next === this.#activeTab) return;
        this.#setTab(next);
        this.#route?.focusKey(`tab:${next}`);
      },
      onScroll: (_dx, dy) => this.#page?.element.scroller?.scrollBy({ top: dy }),
      onPage: (direction) => {
        const scroller = this.#page?.element.scroller;
        scroller?.scrollBy({ top: direction * scroller.clientHeight * PAGE });
      },
      onHomeEnd: (edge) =>
        this.#page?.element.scroller?.scrollTo({ top: edge === "home" ? 0 : Number.MAX_SAFE_INTEGER }),
    });
    resetHoverCards(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      offLanguage();
      offArt();
      this.#leases.dispose();
      this.#glyphs.dispose();
      this.scale.off("resize", onResize, this);
      this.#hover?.destroy();
      this.#hover = null;
      this.#cards?.destroy();
      this.#cards = null;
      this.#unbind?.();
      this.#unbind = null;
      this.#page = null;
    });
    this.#mount();
    this.#frame();
    this.#compose();
  }

  /** Mounts the page once and wires what it says and what hovers over it. */
  #mount(): void {
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-rules-page", { x: 0, y: 0, width, height });
    this.#page = mounted;
    const { element, region } = mounted;
    element.addEventListener("mc-rules", (event) => this.#heard(event.detail));
    // A pack picture's blob URL went stale before its lazy image loaded: read it again, once.
    element.addEventListener("mc-image-error", (event) => {
      const { key, src } = (event as CustomEvent<{ key?: string; src: string | null }>).detail;
      if (key) refreshPackArt(key, src ?? undefined);
    });
    this.#unbind = bindStopFocus(element, (key) => this.#route?.focusKey(key));
    // The card hover popover over every card picture; Pause sits under Rules when it was opened from there.
    this.#cards = new CardEvents(region);
    this.#cards.onInspect = (cardId) => this.#result?.byCard.get(cardId)?.();
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#cards?.hovered() ?? new Map(),
      area: (pointer) =>
        screenHoverArea(this, pointer, { beneath: [SCENES.pause, SCENES.villainPhase, SCENES.roundDebrief] }),
    });
    region.forwardMouseMoves(() => this.#hover?.suppress());
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
  }

  /** The press shield, the scrim and the anchor the page rises with: drawn on open and again on a resize. */
  #frame(): void {
    if (this.#motion.leaving || !this.#alive) return;
    for (const child of [...this.children.list]) child.destroy();
    const { width, height } = this.scale.gameSize;
    // Swallows every press that lands on no control of this overlay's own. Without it, lifting a finger after a touch
    // scroll over the panel's blank space reached Title underneath and opened its releases link (owner, 2026-10-16).
    addPressShield(this, { x: 0, y: 0, width, height });
    // Full-screen ground: an opaque void backdrop, so nothing from Pause or the board shows through.
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 1).fillRect(0, 0, width, height);
    const panelsFrom = this.children.list.length;
    const anchor = this.add.graphics();
    this.#page?.region.setRect({ x: 0, y: 0, width, height });
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
    this.#page?.region.follow(anchor);
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  /** The page said something (a tap, or the focus route's click on a stop). */
  #heard(detail: RulesEventDetail): void {
    // Closing already (its exit is playing): a second tap must not act.
    if (this.#motion.leaving) return;
    switch (detail.type) {
      case "back":
        return this.#close();
      case "scope":
        return this.#setScope(detail.scope);
      case "tab":
        return this.#setTab(detail.tab as RulesTab);
      case "search":
        this.#query = detail.value;
        this.#fromTop = true;
        return this.#compose();
      case "search-focus":
        this.#searchFocused = detail.focused;
        return;
      case "card":
        return this.#result?.byKey.get(detail.key)?.();
      case "origin":
        return this.#openOriginBox(detail.boxId);
    }
  }

  #setTab(tab: RulesTab): void {
    if (tab === this.#activeTab) return;
    this.#activeTab = tab;
    this.#fromTop = true;
    this.#compose();
  }

  #setScope(scope: RulesScope): void {
    if (scope === this.#scope) return;
    this.#scope = scope;
    this.#fromTop = true;
    this.#compose();
  }

  /** Leaves the Rules reference (and the How to play screens under it) for the box page an entry was added with. */
  #openOriginBox(boxId: string): void {
    for (const key of [SCENES.howToPlay, SCENES.newInBox]) {
      if (this.scene.isActive(key)) this.scene.stop(key);
    }
    goToScreen(this, SCENES.newInBox, { boxId });
  }

  #inspectRef(ref: RulesCardRef): void {
    const game = appSession().store.state.game;
    if (game && ref.instanceId)
      this.scene.launch(SCENES.inspect, { instanceId: ref.instanceId as InstanceId } satisfies InspectData);
    else this.#inspectPool(ref.cardId);
  }

  #inspectPool(cardId: string): void {
    this.scene.launch(SCENES.inspect, {
      card: { cardId: cardId as CardId, face: defaultFaceFor(CARDS_BY_ID.get(cardId)) },
    } satisfies InspectData);
  }

  /** Sets the page from the game, the scope, the search and the tab, then, once it has rendered, hands the route its stops. */
  #compose(): void {
    const mounted = this.#page;
    if (!this.#alive || this.#motion.leaving || !mounted) return;
    this.#leases.begin();
    this.#glyphs.reset();
    resetHoverCards(this);
    const backGlyph = hintGlyphOf(this.#glyphs.glyph("back", ["cancel"], "ink", BACK_HEIGHT));
    this.#glyphs.settled();
    this.#result = rulesPageModelOf({
      game: appSession().store.state.game,
      scope: this.#scope,
      tab: this.#activeTab,
      query: this.#query,
      backGlyph,
      cardScale: cardSizeFactor(appSession().settings.cardSize),
      caption: isDesktopType() ? 58 : 46,
      image: (source) => this.#leases.image(source),
      inspectRef: (ref) => this.#inspectRef(ref),
      inspectPool: (cardId) => this.#inspectPool(cardId),
    });
    mounted.element.model = this.#result.model;
    this.#leases.end();
    const draw = ++this.#drawn;
    void settleElements(mounted.element).then(() => draw === this.#drawn && this.#alive && this.#wire(mounted));
  }

  /** After a render: the list's scroll, the route's stops and the dev hook. */
  #wire({ element, region }: Page): void {
    if (this.#fromTop) {
      const scroller = element.scroller;
      if (scroller) scroller.scrollTop = 0;
      this.#fromTop = false;
    }
    const stops = focusStopsOf(element, (target) => region.rectOf(target));
    const keys = [...stops.keys()];
    const order = [
      "back",
      "scope:table",
      "scope:all",
      ...RULES_TABS.map((tab) => `tab:${tab}`),
      "search",
      ...keys.filter((key) => key.startsWith("row:")),
    ];
    this.#route?.set(
      order.filter((key) => stops.has(key)),
      stops as Map<string, FocusStop>,
    );
    this.#hover?.onDraw();
    if (import.meta.env.DEV) {
      // Dev e2e hook: the card the hover popover shows, and the cards it could show right now.
      (window as unknown as { __mcRulesDebug?: unknown }).__mcRulesDebug = {
        hoverKey: () => this.#hover?.shownKey ?? null,
        hoverCards: () => this.#cards?.hovered().size ?? 0,
      };
    }
  }
}

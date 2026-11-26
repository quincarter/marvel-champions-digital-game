/**
 * Rules Reference (docs/phase4-screen-gaps.md §3 "W4"; view model in `view/rules-reference.ts`,
 * `view/rules-card-list.ts`, `view/rules-glossary-grid.ts`; launched from `scenes/pause.ts#openRules`
 * with `RulesSceneData`).
 *
 * **Redesigned full screen, with art (owner feedback, 2026-09-18): "Rules reference popup from
 * settings has some layering issues. I can see the search box from underneath, i also think this
 * should be the full screen as a popover with some card art if applicable, instead of just
 * straight up text."** The layering bug was `McTextInput`'s own — a DOM field showing through
 * whatever launched on top of it — and is already fixed there (it hides itself while any scene
 * runs above its own). This file is the other half: the previous build reused `overlay-layout.ts`'s
 * centered sheet (Pause and Settings' own shape) and drew the glossary/villain-phase/card-list
 * content as one scrolling `McScrollPanel` text block. Neither matched D13's own read (a grid of
 * individually bordered entry cards) nor the owner's ask, so this is a ground-up rebuild:
 *
 * - **Full screen** (`view/rules-layout.ts`): an ink chrome band (Back, "RULES REFERENCE", the
 *   scope caption/toggle) edge to edge, a paper body with the tab strip and the glossary's search
 *   field, `MARGIN`-px inset — no centered column with Pause peeking out on either side.
 * - **Glossary**: a grid of bordered entry cards (`view/rules-glossary-grid.ts`) —
 *   term, definition, citation, and (the owner's "card art") a strip of small thumbnails for every
 *   card that carries the keyword right now, each opening Inspect. "On your table" (default, with
 *   a game) filters to the table and points a thumbnail at the live instance; "All rules" (the
 *   only mode with no game) shows every entry and points a thumbnail at any pool card printing it.
 * - **Villain phase**: the six RRG 1.8 p. 47 steps, in sequence, the current one highlighted (ink
 *   fill, no red — this screen has no forward action to spend it on) with the main scheme's own
 *   scan, the villain's own scan, or the bundled encounter card back illustrating a step where one
 *   applies (`VillainPhaseStep.art`).
 * - **Card list**: every encounter set the pool knows, the running scenario's own first ("IN THIS
 *   GAME") under "On your table" scope, the rest ("NOT IN THIS GAME") following under "All rules" —
 *   each a Bangers header (name, rule, count) over a wrapped grid of real card thumbnails with name
 *   captions, tap or long-press/right-click opening Inspect.
 *
 * No rules text was invented for this pass: every glossary definition and citation is
 * unchanged from `@mc/content`'s `schema/glossary.ts` (S6) and this module's own three
 * table-state entries — only the presentation and the new card associations are new.
 *
 * **The screen is one Lit panel over the canvas** (`mc-sheet`, `dom/sheet-builder.ts`, the way `scenes/pause.ts` is):
 * the ground, chrome, Back (with its Cancel glyph, `dom/sheet-glyphs.ts`), scope toggle, tab rail and the three
 * scrolling lists are the panel's parts at the rects `view/rules-layout.ts` and the grid views give, scrolled
 * natively, with card scans as `<img>` (loaded as they come near). Phaser keeps the search field (a DOM element under
 * the panel, shown through a hole), the card hover popover (also shown through a hole while it is up), the focus
 * route (its ring drawn in the DOM, `dom/dom-ring.ts`), the press shield and the overlay's entrance and exit.
 *
 * Back returns to Pause (`this.scene.stop()` — Pause is still running underneath, since it
 * launched this the same way every other overlay in this app is launched).
 */
import { isDesktopType } from "../ui/desktop-type.js";
import Phaser from "phaser";
import "@mc/ui";
import type { McSheet } from "@mc/ui";
import type { AnyCard, CardId } from "@mc/content";
import { getInstance, type GameState, type InstanceId } from "@mc/engine";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS, POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { artFor, defaultFaceFor, CARD_BACKS, type ArtSource, type CardFace } from "../art/art-source.js";
import { faceOf } from "../view/board-model.js";
import { border, ink, minType, status, surface, typeRole } from "../tokens.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { poolCellRect, poolGridGeometry } from "../view/deck-pool-grid.js";
import { cardSizeFactor } from "../settings.js";
import {
  glossaryCellRect,
  glossaryGridColumns,
  glossaryRowHeights,
  GLOSSARY_CITE_SIZE,
  GLOSSARY_DEFINITION_SIZE,
  GLOSSARY_TERM_SIZE,
  GLOSSARY_THUMB_CAPTION,
  GLOSSARY_THUMB_SIZE,
} from "../view/rules-glossary-grid.js";
import { rulesLayout, type RulesTab } from "../view/rules-layout.js";
import {
  rulesGlossaryOf,
  rulesGlossaryPoolOf,
  villainPhaseOrder,
  type RulesCardRef,
  type RulesEntry,
  type VillainPhaseStep,
} from "../view/rules-reference.js";
import { rulesCardListOf, type RulesCardListCard, type RulesCardListGroup } from "../view/rules-card-list.js";
import { rulesFocusOrder } from "../view/screen-focus.js";
import { estimateWrappedLines, type Rect } from "../view/layout.js";
import { appSession } from "../session.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { t, tPlural, type MessageKey } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import { McTextInput } from "../ui/widgets.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import type { InspectData } from "./inspect.js";
import { SCENES } from "./keys.js";
import { addPressShield } from "../ui/press-shield.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { goToScreen, OverlayMotion } from "../ui/transitions.js";

const TAB_IDS: readonly RulesTab[] = ["glossary", "villainPhase", "cardList"];
const TAB_KEYS: Readonly<Record<RulesTab, MessageKey>> = {
  glossary: "rules.tab.glossary",
  villainPhase: "rules.tab.villainPhase",
  cardList: "rules.tab.cardList",
};

/** Hard ceiling on a glossary entry's thumbnail strip, regardless of how wide its own card is. */
const MAX_GLOSSARY_THUMBS = 6;
/** How tall an encounter-set header slot is in the Card list grid (Bangers name + rule + count). */
const SET_HEADER_HEIGHT = 34;
/** How tall the "IN THIS GAME" / "NOT IN THIS GAME" section label slot is. */
const SECTION_LABEL_HEIGHT = 26;
/** Reserved at the bottom of the Villain phase tab for its own citation, outside the scrolling list. */
const VILLAIN_PHASE_CITATION_HEIGHT = 24;
/** The Card list grid's own left inset — matches `poolCellRect`'s cell-to-`cardRect` gutter (`cell.x + 4`) so a section label or set header lines up under the card art below it instead of starting flush under the list's outer border. */
const CARD_LIST_INSET = 4;
/** How far a page (Page Up / Down, a shoulder button) scrolls, as a share of the list's height. */
const PAGE = 0.85;
/** The scrolling list's key in the panel: one list is up at a time. */
const LIST = "list";

export type RulesScope = "table" | "all";

/**
 * Optional starting point, so Pause's own "Quick reference" rows can jump
 * straight to the right tab (and, for the glossary, a pre-filled search) —
 * `scenes/pause.ts`'s own doc comment says which row sets which field.
 * Absent, this opens exactly as it always has: the glossary tab, no query.
 */
export interface RulesSceneData {
  readonly initialTab?: RulesTab;
  readonly initialQuery?: string;
  /** Settings' search opens on "All rules": the entry it found may not be on the table. */
  readonly initialScope?: RulesScope;
}

/** One flattened slot of the Card list tab. */
type CardListSlot =
  | { readonly kind: "sectionLabel"; readonly text: string }
  | { readonly kind: "header"; readonly group: RulesCardListGroup }
  | {
      readonly kind: "gridRow";
      readonly group: RulesCardListGroup;
      readonly startIndex: number;
      readonly count: number;
    };

/** What a card picture's hover slot stands for. */
interface HoverTarget {
  readonly cardId: string;
  readonly face?: CardFace;
}

export class RulesOverlay extends Phaser.Scene {
  #activeTab: RulesTab = "glossary";
  #query = "";
  #scope: RulesScope = "table";
  #searchInput: McTextInput | null = null;
  #searchRect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  #route: FocusRoute | null = null;
  #glyphs!: SheetGlyphs;
  /** The screen, one Lit panel over the canvas; made on the first draw and kept, so the list's scroll stays. */
  #region: DomRegion<McSheet> | null = null;
  /** The parts the draw in progress is building (a scrolling region's own while it builds that). */
  #b!: SheetBuilder;
  /** What each key in the panel does when tapped, and when held or right-clicked, this draw. */
  #actions = new Map<string, () => void>();
  #inspects = new Map<string, () => void>();
  /** The list reads from its top on the next draw (a new tab, scope or query). */
  #listFromTop = false;
  #motion = new OverlayMotion();
  /** The desktop hover popover over every card picture on the screen. */
  #hover: HoverPreview | null = null;
  /** The cards the pictures drawn this pass stand for, by hover slot (what `data-hover` says in the panel). */
  #hoverTargets = new Map<string, HoverTarget>();
  /** The list's own box, which a hover rect is clipped to. */
  #bodyRect: Rect = { x: 0, y: 0, width: 0, height: 0 };

  constructor() {
    super(SCENES.rules);
  }

  create(data: RulesSceneData = {}): void {
    this.#motion = new OverlayMotion();
    this.#activeTab = data.initialTab ?? "glossary";
    this.#query = data.initialQuery ?? "";
    this.#region = null;
    this.#listFromTop = false;
    const { game } = appSession().store.state;
    this.#scope = data.initialScope ?? (game ? "table" : "all");
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    const offLanguage = onLanguageChange(() => this.#draw());
    this.#glyphs = new SheetGlyphs(this, () => this.#draw());
    // Before the route: A, B or Start takes the caret out of the search field.
    bindTextFieldEscape(
      this,
      () => this.#searchInput,
      () => this.scene.isActive(SCENES.inspect),
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.scene.isActive(SCENES.inspect) || (this.#searchInput?.focused ?? false),
      onCancel: () => this.#close(),
      // LB / RB step through the tabs (PageUp / PageDown still page the list); the right stick scrolls it.
      onTab: (direction) => {
        const at = TAB_IDS.indexOf(this.#activeTab);
        const next = TAB_IDS[Math.min(TAB_IDS.length - 1, Math.max(0, at + direction))]!;
        if (next === this.#activeTab) return;
        this.#setTab(next);
        this.#route?.focusKey(`tab:${next}`);
      },
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
      onPage: (direction) => this.#scroller()?.scrollBy({ top: direction * this.#bodyRect.height * PAGE }),
      onHomeEnd: (edge) => this.#scroller()?.scrollTo({ top: edge === "home" ? 0 : Number.MAX_SAFE_INTEGER }),
    });
    resetHoverCards(this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCards(),
      // Pause sits under Rules when it was opened from there; it is not over it.
      area: (pointer) =>
        screenHoverArea(this, pointer, { beneath: [SCENES.pause, SCENES.villainPhase, SCENES.roundDebrief] }),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offLanguage();
      this.#glyphs.dispose();
      this.scale.off("resize", onResize, this);
      this.#hover?.destroy();
      this.#hover = null;
      this.#searchInput?.destroy();
      this.#searchInput = null;
      // The panel goes with the scene (`DomRegion`); the next open makes a new one.
      this.#region = null;
    });
    this.#draw();
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  #scroller(): HTMLElement | null {
    return this.#region?.element.elementOf(LIST) ?? null;
  }

  #setTab(tab: RulesTab): void {
    if (tab === this.#activeTab) return;
    this.#activeTab = tab;
    this.#listFromTop = true;
    this.#draw();
  }

  #setScope(scope: RulesScope): void {
    if (scope === this.#scope) return;
    this.#scope = scope;
    this.#listFromTop = true;
    this.#draw();
  }

  #onQueryChange(value: string): void {
    this.#query = value;
    this.#listFromTop = true;
    // The grid's row heights depend on the filtered entries, so a query change rebuilds it like a tab or scope change
    // does (a few dozen entry cards at most).
    this.#draw();
  }

  /** Every card picture on screen with its place, for the hover popover: read off the panel on each pointer move. */
  #hoverCards(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const region = this.#region;
    if (!region) return found;
    for (const element of region.element.renderRoot.querySelectorAll<HTMLElement>("[data-hover]")) {
      const slot = element.dataset.hover!;
      const target = this.#hoverTargets.get(slot);
      if (!target) continue;
      const rect = clipHoverRect(region.rectOf(element), this.#bodyRect);
      if (rect)
        found.set(slot, {
          ...rect,
          cardId: target.cardId,
          through: true,
          ...(target.face ? { face: target.face } : {}),
        });
    }
    return found;
  }

  /** A card picture's hover slot, noted so the popover knows which card (and face) it stands for. */
  #hoverSlot(cardId: string, where: string, face?: CardFace): string {
    const slot = hoverSlotOf(cardId, where);
    this.#hoverTargets.set(slot, { cardId, ...(face ? { face } : {}) });
    return slot;
  }

  /** What a key does when the panel reports a tap on it. */
  #press(key: string, action: () => void): void {
    this.#actions.set(key, action);
  }

  /** A key that a press-and-hold or right-click also answers: the same as its tap (a card opens Inspect). */
  #pressOrInspect(key: string, action: () => void): void {
    this.#actions.set(key, action);
    this.#inspects.set(key, action);
  }

  /** A stop inside the scrolling list: its box is read off the panel, so it follows the scroll. */
  #listStop(itemKey: string, activate: () => void, extra: Pick<FocusStop, "inspect"> = {}): FocusStop {
    const region = (): DomRegion<McSheet> | null => this.#region;
    const body = this.#bodyRect;
    return {
      rect: () => {
        const found = region()?.element.elementOf(itemKey);
        return found ? region()!.rectOf(found) : body;
      },
      view: () => {
        const found = region()?.element.elementOf(LIST);
        return found ? region()!.rectOf(found) : body;
      },
      activate,
      ...extra,
      ensureVisible: () => region()?.element.elementOf(itemKey)?.scrollIntoView({ block: "nearest" }),
    };
  }

  /** Builds the parts of the scrolling list in its own content space (`y` from 0, `x` the screen's). */
  #inScroll(rect: Rect, height: number, draw: (b: SheetBuilder) => void): void {
    const outer = this.#b;
    outer.scroll(LIST, rect, height, (inner) => {
      this.#b = inner;
      try {
        draw(inner);
      } finally {
        this.#b = outer;
      }
    });
  }

  /** Hands the built parts to the panel (made once, so the list's scroll survives a redraw) and renders them now. */
  #mount(width: number, height: number): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        // Closing already (its exit is playing): a second tap must not act.
        if (this.#motion.leaving) return;
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      element.addEventListener("mc-inspect", (event) => {
        if (this.#motion.leaving) return;
        this.#inspects.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      this.#region = new DomRegion(this, element, { x: 0, y: 0, width, height });
      // The card hover popover follows Phaser's pointer, which only hears the mouse over the canvas.
      this.#region.forwardMouseMoves();
    }
    const region = this.#region;
    region.setRect({ x: 0, y: 0, width, height });
    // The search field is a Phaser DOM element under the panel, and the hover popover is drawn in the canvas: both are
    // left out of the panel to be seen through it. The field only while it shows (under a pop-up it hides itself).
    region.setHoles(() => {
      const holes: Rect[] = [];
      if (this.#searchInput?.shown) holes.push(this.#searchRect);
      const popover = this.#hover?.shownRect;
      if (popover) holes.push(popover);
      return holes;
    });
    region.element.nodes = this.#b.nodes;
    renderNow(region.element);
    if (this.#listFromTop) {
      const scroller = this.#scroller();
      if (scroller) scroller.scrollTop = 0;
      this.#listFromTop = false;
    }
  }

  #draw(): void {
    // Already answering Back (or an inline query/tab change beat it there) —
    // don't redraw over the outgoing sheet mid-fade.
    if (this.#motion.leaving) return;
    this.#actions = new Map();
    this.#inspects = new Map();
    this.#hoverTargets = new Map();
    this.#glyphs.reset();
    resetHoverCards(this);
    const kept = this.#searchInput?.gameObjects ?? [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const layout = rulesLayout({ x: 0, y: 0, width, height }, this.#activeTab);
    const { game } = appSession().store.state;
    this.#bodyRect = layout.body;

    // Swallows every press that lands on no control of this overlay's own. Without it, lifting a finger after a
    // touch scroll over the panel's blank space reached Title underneath and opened its releases link (owner,
    // 2026-10-16), and the same went for Pause or the Board.
    addPressShield(this, { x: 0, y: 0, width, height });
    // Full-screen ground: an opaque void backdrop (nothing from Pause/the board can show through a full-bleed screen,
    // by construction — the owner's "layering" complaint's other half). The panel above it is the paper and the chrome.
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 1).fillRect(0, 0, width, height);
    const panelsFrom = this.children.list.length;
    // Nothing drawn: the entrance and exit tween this, and the panel rises and fades with it (`DomRegion.follow`).
    const anchor = this.add.graphics();

    this.#b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    const b = this.#b;
    const bodyTop = layout.chrome.height;
    const ground: Rect = { x: 0, y: bodyTop, width, height: Math.max(0, height - bodyTop) };
    b.box(ground, { fill: surface.paper.hex });
    b.dots(ground, "paper", 6, 1, 0.1);
    b.box(layout.chrome, { fill: surface.ink.hex });

    const stops = new Map<string, FocusStop>();

    const backRect: Rect = {
      x: layout.header.x + 16,
      y: layout.header.y + (layout.header.height - 36) / 2,
      width: 90,
      height: 36,
    };
    this.#glyphs.button(b, {
      key: "back",
      rect: backRect,
      label: t("rules.back"),
      look: "onInk",
      type: typeRole.rowTitle,
      ids: ["cancel"],
      ground: "ink",
    });
    this.#press("back", () => this.#close());
    stops.set("back", { rect: backRect, activate: () => this.#close() });
    b.text(
      backRect.x + backRect.width + 14,
      layout.header.y + layout.header.height / 2,
      t("rules.title"),
      typeRole.barTitle,
      {
        size: 24,
        color: surface.paper.hex,
        origin: [0, 0.5],
      },
    );

    const showScopeToggle = game !== null;
    if (showScopeToggle) {
      // Toggle width scales down on a narrow screen instead of a fixed 150px overflowing past the
      // scope row's own left edge into the caption (found on a 390px phone in a real headless-Chrome
      // pass) — never so narrow either label has to clip.
      const gap = 4;
      const toggleWidth = Math.max(70, Math.min(150, (layout.scope.width - 32 - gap) / 2));
      const allRect: Rect = {
        x: layout.scope.x + layout.scope.width - toggleWidth * 2 - gap,
        y: layout.scope.y + (layout.scope.height - 26) / 2,
        width: toggleWidth,
        height: 26,
      };
      const tableRect: Rect = { x: allRect.x + toggleWidth + gap, y: allRect.y, width: toggleWidth, height: 26 };
      // The caption only draws if there's real room left of the buttons — on a phone the two
      // buttons alone (their own fill already says which is active) carry the meaning; a caption
      // squeezed into a sliver would only ever run under them, which is the bug this guards against.
      const captionWidth = allRect.x - (layout.scope.x + 16) - 12;
      if (captionWidth > 90) {
        b.text(
          layout.scope.x + 16,
          layout.scope.y + layout.scope.height / 2,
          this.#scope === "table" ? t("rules.scope.captionTable") : t("rules.scope.captionAll"),
          typeRole.label,
          { size: 10, color: surface.paper.hex, alpha: ink.secondary, origin: [0, 0.5], fitWidth: captionWidth },
        );
      }
      // Custom-painted rather than `mc-button`'s `onInk`/`primary` skins, whose own "selected" state
      // is Hero Red — this screen has no forward action to spend that on ("one red per screen", and
      // this one needs none), so the active option is a solid paper pill instead and the inactive one
      // a plain paper outline.
      this.#scopeOption(
        allRect,
        t("rules.scope.all"),
        this.#scope === "all",
        () => this.#setScope("all"),
        stops,
        "scope:all",
      );
      this.#scopeOption(
        tableRect,
        t("rules.scope.table"),
        this.#scope === "table",
        () => this.#setScope("table"),
        stops,
        "scope:table",
      );
    } else {
      b.text(
        layout.scope.x + 16,
        layout.scope.y + layout.scope.height / 2,
        t("rules.scope.captionPool"),
        typeRole.label,
        {
          size: 10,
          color: surface.paper.hex,
          alpha: ink.secondary,
          origin: [0, 0.5],
          fitWidth: layout.scope.width - 32,
        },
      );
    }

    // The tab rail: a recessed strip of equal cells, the active one an ink fill.
    b.box(layout.tabs, { fill: surface.parchment.hex, stroke: surface.ink.hex, strokeWidth: border.detail });
    const cellWidth = layout.tabs.width / TAB_IDS.length;
    const tabType = { ...typeRole.label, size: Math.max(minType.phoneLabel, typeRole.label.size) };
    TAB_IDS.forEach((tab, index) => {
      const cell: Rect = {
        x: layout.tabs.x + index * cellWidth,
        y: layout.tabs.y,
        width: cellWidth,
        height: layout.tabs.height,
      };
      b.button({
        key: `tab:${tab}`,
        rect: cell,
        label: t(TAB_KEYS[tab]),
        look: "rail",
        type: tabType,
        selected: tab === this.#activeTab,
      });
      this.#press(`tab:${tab}`, () => this.#setTab(tab));
      stops.set(`tab:${tab}`, { rect: cell, activate: () => this.#setTab(tab) });
    });

    let rowIds: readonly string[] = [];
    if (this.#activeTab === "glossary") {
      this.#searchRect = layout.search;
      if (this.#searchInput) this.#searchInput.layout(layout.search);
      else
        this.#searchInput = new McTextInput(this, {
          rect: layout.search,
          value: this.#query,
          placeholder: t("rules.search.placeholder"),
          onChange: (v) => this.#onQueryChange(v),
        });
      stops.set("search", { rect: layout.search, activate: () => this.#searchInput?.focus() });
      rowIds = this.#drawGlossaryTab(layout.body, game, stops);
    } else if (this.#activeTab === "villainPhase") {
      this.#searchInput?.destroy();
      this.#searchInput = null;
      rowIds = this.#drawVillainPhaseTab(layout.body, game, stops);
    } else {
      this.#searchInput?.destroy();
      this.#searchInput = null;
      rowIds = this.#drawCardListTab(layout.body, game, stops);
    }

    // Rendered before the route reads its stops, so a stop inside the list can find its element.
    this.#mount(width, height);
    this.#route?.set(
      rulesFocusOrder({
        tabIds: TAB_IDS,
        showScopeToggle,
        showSearch: this.#activeTab === "glossary",
        rowIds,
      }),
      stops,
    );

    // A kept field's ring was first on the list, under the anchor drawn since (as in `scenes/pause.ts`).
    for (const node of kept) this.children.bringToTop(node);
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
    this.#region?.follow(anchor);
    this.#hover?.onDraw();
  }

  /** One "All rules" / "On your table" segment — see `#draw`'s own comment on why this isn't an `onInk` button. */
  #scopeOption(
    rect: Rect,
    text: string,
    selected: boolean,
    onClick: () => void,
    stops: Map<string, FocusStop>,
    stopId: string,
  ): void {
    const b = this.#b;
    if (selected) b.box(rect, { fill: surface.paper.hex });
    else b.box(rect, { stroke: surface.paper.hex, strokeWidth: 2, alpha: ink.secondary });
    b.text(rect.x + rect.width / 2, rect.y + rect.height / 2, text, typeRole.label, {
      color: selected ? surface.ink.hex : surface.paper.hex,
      alpha: selected ? 1 : ink.secondary,
      origin: [0.5, 0.5],
    });
    b.tap(stopId, rect);
    this.#press(stopId, onClick);
    stops.set(stopId, { rect, activate: onClick });
  }

  /** The list's recessed "rail" panel behind its rows. */
  #listPanel(rect: Rect): void {
    this.#b.box(rect, { fill: surface.parchment.hex, stroke: surface.ink.hex, strokeWidth: border.detail });
  }

  /** A card picture's tile: the scan above, its name below, one border around both (`McCardTile`'s own look). */
  #tile(
    b: SheetBuilder,
    rect: Rect,
    name: string,
    source: ArtSource | null,
    keys: { readonly tap: string; readonly hover: string | undefined },
    activate: () => void,
  ): void {
    const artHeight = Math.max(0, rect.height - GLOSSARY_THUMB_CAPTION);
    b.box(rect, { fill: surface.card.hex, stroke: surface.ink.hex, strokeWidth: border.object });
    const slot: Rect = {
      x: rect.x + border.object,
      y: rect.y + border.object,
      width: rect.width - border.object * 2,
      height: Math.max(0, artHeight - border.object),
    };
    if (slot.height > 0) {
      b.image(slot, {
        src: source?.url ?? null,
        fill: surface.parchment.hex,
        missing: t("rules.noScan"),
        color: surface.ink.hex,
      });
      // A rule between the card and its name, the same 2px detail weight the stat tiles use.
      b.box(
        { x: slot.x, y: slot.y + slot.height, width: slot.width, height: border.detail },
        { fill: surface.ink.hex },
      );
    }
    const captionTop = rect.y + artHeight;
    const captionHeight = rect.y + rect.height - captionTop - border.object;
    // A caption tall enough for two lines wraps a long name ("Basic Attack") rather than cutting it to "Basic At…".
    if (captionHeight >= 20) {
      b.text(rect.x + rect.width / 2, captionTop + captionHeight / 2, name, typeRole.rowTitle, {
        size: Math.min(typeRole.rowTitle.size, Math.max(minType.phoneLabel, Math.floor(captionHeight / 2.4))),
        color: surface.ink.hex,
        origin: [0.5, 0.5],
        align: "center",
        wrapWidth: rect.width - 6,
        maxLines: 2,
      });
    } else {
      b.text(rect.x + rect.width / 2, captionTop + captionHeight / 2, name, typeRole.rowTitle, {
        color: surface.ink.hex,
        origin: [0.5, 0.5],
        fitWidth: rect.width - 12,
      });
    }
    b.tap(keys.tap, rect, { inspect: true, ...(keys.hover !== undefined ? { hover: keys.hover } : {}) });
    this.#pressOrInspect(keys.tap, activate);
  }

  // ------------------------------------------------------------------------------------------------------------
  // Glossary: a grid of bordered entry cards (D13's own read), each with a term,
  // definition, citation, and — the owner's "card art if applicable" — a strip of small
  // thumbnails for every card that carries it, tappable into Inspect.
  // ------------------------------------------------------------------------------------------------------------
  #drawGlossaryTab(rect: Rect, game: GameState | null, stops: Map<string, FocusStop>): readonly string[] {
    const entries =
      this.#scope === "table" && game
        ? rulesGlossaryOf(game, POOL_DEPS, this.#query, { includeConcepts: true })
        : rulesGlossaryPoolOf(POOL_CARDS, this.#query);
    if (entries.length === 0) {
      this.#b.text(rect.x, rect.y, t("rules.glossary.empty"), typeRole.body, {
        color: surface.ink.hex,
        alpha: ink.meta,
      });
      return [];
    }

    const geometry = glossaryGridColumns(rect.width);
    const heights = glossaryRowHeights(
      entries.map((entry) => ({
        definition: entry.definition,
        citeLabel: entry.playerCiteLabel,
        ...(entry.playerNote ? { playerNote: entry.playerNote } : {}),
        ...(entry.originNote ? { originNote: entry.originNote } : {}),
        cardRefCount: entry.cardRefs.length,
      })),
      geometry.columns,
      geometry.cellWidth,
    );
    // Every entry is a stop (so a term with no cards can still be reached and scrolled to), then its thumbnails.
    const rowIds: string[] = [];
    for (const entry of entries) {
      rowIds.push(`entry:${entry.id}`);
      const { shown } = glossaryThumbSlots(
        entry.cardRefs,
        glossaryTextWidth(geometry.cellWidth, isStatusEntry(entry.id)),
      );
      for (const ref of shown) rowIds.push(`entry:${entry.id}:card:${ref.cardId}`);
    }

    this.#listPanel(rect);
    const total = heights.reduce((sum, h) => sum + h, 0);
    this.#inScroll(rect, total, (b) => {
      let top = 0;
      heights.forEach((rowHeight, rowIndex) => {
        this.#glossaryRow(
          b,
          { x: rect.x, y: top, width: rect.width, height: rowHeight },
          geometry,
          entries,
          rowIndex,
          game,
        );
        top += rowHeight;
      });
    });

    entries.forEach((entry) => {
      const { shown } = glossaryThumbSlots(
        entry.cardRefs,
        glossaryTextWidth(geometry.cellWidth, isStatusEntry(entry.id)),
      );
      const first = shown[0];
      const originBoxId = game === null && entry.originNote ? entry.originBoxId : undefined;
      stops.set(
        `row:entry:${entry.id}`,
        this.#listStop(
          `entry:${entry.id}`,
          // The "Added in ... ▸" link when it has one (no game running), else the first card; a bare term does nothing.
          () => {
            if (originBoxId) this.#openOriginBox(originBoxId);
            else if (first) this.#inspectRef(first, game);
          },
          first ? { inspect: () => this.#inspectRef(first, game) } : {},
        ),
      );
      for (const ref of shown) {
        const key = `entry:${entry.id}:card:${ref.cardId}`;
        stops.set(
          `row:${key}`,
          this.#listStop(key, () => this.#inspectRef(ref, game), { inspect: () => this.#inspectRef(ref, game) }),
        );
      }
    });
    return rowIds;
  }

  #glossaryRow(
    b: SheetBuilder,
    rowRect: Rect,
    geometry: ReturnType<typeof glossaryGridColumns>,
    entries: readonly RulesEntry[],
    rowIndex: number,
    game: GameState | null,
  ): void {
    const startIndex = rowIndex * geometry.columns;
    const countInRow = Math.min(geometry.columns, entries.length - startIndex);
    for (let col = 0; col < countInRow; col++) {
      const entry = entries[startIndex + col]!;
      const cell = glossaryCellRect(geometry, rowRect, col);
      const cardRect: Rect = { x: cell.x + 4, y: cell.y + 2, width: cell.width - 8, height: cell.height - 4 };
      const isStatus = isStatusEntry(entry.id);

      b.box(cardRect, {
        fill: surface.card.hex,
        stroke: surface.ink.hex,
        strokeWidth: border.object,
        key: `entry:${entry.id}`,
      });
      if (isStatus)
        b.box(
          { x: cardRect.x, y: cardRect.y, width: 6, height: cardRect.height },
          { fill: status[entry.id as "stunned" | "confused" | "tough"].hex },
        );

      const textX = cardRect.x + (isStatus ? 18 : 12);
      const textWidth = glossaryTextWidth(geometry.cellWidth, isStatus);
      let y = cardRect.y + 10;

      // The status hue alone never carries the meaning (colorblind-safe): the term itself is
      // always the plain word "Stunned"/"Confused"/"Tough", never only the stripe's color.
      const term = b.text(textX, y, entry.displayName, typeRole.barTitle, {
        size: GLOSSARY_TERM_SIZE,
        color: surface.ink.hex,
        fitWidth: textWidth,
      });
      y += term.height + 6;

      const definition = b.text(textX, y, entry.definition, typeRole.body, {
        size: GLOSSARY_DEFINITION_SIZE,
        color: surface.ink.hex,
        alpha: ink.body,
        lineSpacing: 3,
        wrapWidth: textWidth,
      });
      y += definition.height + 6;

      // Player-facing: the source(s) alone, no "(not in this repo)"/"· UNVERIFIED" bookkeeping
      // (owner feedback, 2026-09-29 — those flags are this repo's own implementer notes, not
      // something a player asked to read). The label's own real height is measured, not assumed —
      // a cite that wraps to two lines (a long product name) used to have the paragraph below it
      // drawn straight through it at a fixed 16px advance; see `rules-glossary-grid.ts`'s matching
      // height estimate for why every entry's own row is tall enough for this already.
      const cite = b.text(textX, y, entry.playerCiteLabel, typeRole.label, {
        size: GLOSSARY_CITE_SIZE,
        color: surface.ink.hex,
        alpha: ink.label,
        wrapWidth: textWidth,
      });
      y += cite.height + 4;
      if (entry.playerNote) {
        const noteText = b.text(textX, y, entry.playerNote, typeRole.body, {
          size: GLOSSARY_DEFINITION_SIZE,
          color: surface.ink.hex,
          alpha: ink.secondary,
          lineSpacing: 3,
          wrapWidth: textWidth,
        });
        y += noteText.height + 4;
      }

      if (entry.originNote && entry.originBoxId) {
        // Where the entry was added, linking to that box's page in How to play. Only with no game running:
        // opening a How to play page would leave a game in progress.
        const originBoxId = entry.originBoxId;
        const linkable = game === null;
        const originText = b.text(
          textX,
          y,
          linkable ? `${entry.originNote} ▸` : entry.originNote,
          linkable ? { ...typeRole.body, weight: 700 } : typeRole.body,
          {
            size: GLOSSARY_DEFINITION_SIZE,
            color: surface.ink.hex,
            alpha: linkable ? ink.body : ink.secondary,
            lineSpacing: 3,
            wrapWidth: textWidth,
          },
        );
        if (linkable) {
          const key = `origin:${entry.id}`;
          b.tap(key, { x: textX, y, width: textWidth, height: originText.height });
          this.#press(key, () => this.#openOriginBox(originBoxId));
        }
        y += originText.height + 4;
      }

      if (entry.cardRefs.length > 0) {
        y += 8;
        const { shown, overflow } = glossaryThumbSlots(entry.cardRefs, textWidth);
        const tileHeight = GLOSSARY_THUMB_SIZE * 1.4 + GLOSSARY_THUMB_CAPTION;
        shown.forEach((ref, index) => {
          const tileRect: Rect = {
            x: textX + index * (GLOSSARY_THUMB_SIZE + 8),
            y,
            width: GLOSSARY_THUMB_SIZE,
            height: Math.min(tileHeight, cardRect.y + cardRect.height - y - 4),
          };
          const source = artFor(this.#cardForRef(ref, game), this.#faceForRef(ref, game));
          const key = `entry:${entry.id}:card:${ref.cardId}`;
          this.#tile(
            b,
            tileRect,
            ref.name,
            source,
            {
              tap: key,
              hover: this.#hoverSlot(ref.cardId, key, game && ref.instanceId ? this.#faceForRef(ref, game) : undefined),
            },
            () => this.#inspectRef(ref, game),
          );
        });
        if (overflow > 0) {
          b.text(
            textX + shown.length * (GLOSSARY_THUMB_SIZE + 8),
            y + GLOSSARY_THUMB_SIZE * 0.7,
            t("rules.thumbsMore", { count: overflow }),
            typeRole.label,
            { color: surface.ink.hex, alpha: ink.meta },
          );
        }
      }
    }
  }

  /** Leaves the Rules reference (and the How to play screens under it) for the box page an entry was added with. */
  #openOriginBox(boxId: string): void {
    for (const key of [SCENES.howToPlay, SCENES.newInBox]) {
      if (this.scene.isActive(key)) this.scene.stop(key);
    }
    goToScreen(this, SCENES.newInBox, { boxId });
  }

  #cardForRef(ref: RulesCardRef, game: GameState | null): AnyCard | undefined {
    if (game && ref.instanceId) return game.cardPool[ref.cardId];
    return CARDS_BY_ID.get(ref.cardId);
  }

  #faceForRef(ref: RulesCardRef, game: GameState | null): CardFace {
    if (game && ref.instanceId) return faceOf(game, ref.instanceId as InstanceId);
    return defaultFaceFor(this.#cardForRef(ref, game));
  }

  #inspectRef(ref: RulesCardRef, game: GameState | null): void {
    if (game && ref.instanceId)
      this.scene.launch(SCENES.inspect, { instanceId: ref.instanceId as InstanceId } satisfies InspectData);
    else
      this.scene.launch(SCENES.inspect, {
        card: { cardId: ref.cardId as CardId, face: defaultFaceFor(this.#cardForRef(ref, game)) },
      } satisfies InspectData);
  }

  // ------------------------------------------------------------------------------------------------------------
  // Villain phase: the six RRG 1.8 p. 47 steps, in sequence, the live step highlighted, with the
  // main scheme's/villain's own scan or a bundled encounter card back illustrating a step that has one.
  // ------------------------------------------------------------------------------------------------------------
  #drawVillainPhaseTab(rect: Rect, game: GameState | null, stops: Map<string, FocusStop>): readonly string[] {
    const citationRect: Rect = {
      x: rect.x,
      y: rect.y + rect.height - VILLAIN_PHASE_CITATION_HEIGHT,
      width: rect.width,
      height: VILLAIN_PHASE_CITATION_HEIGHT,
    };
    const listRect: Rect = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: Math.max(0, rect.height - VILLAIN_PHASE_CITATION_HEIGHT - 4),
    };
    this.#b.text(
      citationRect.x,
      citationRect.y + citationRect.height / 2,
      t("rules.villain.citation"),
      typeRole.label,
      {
        color: surface.ink.hex,
        alpha: ink.meta,
        origin: [0, 0.5],
      },
    );

    const steps = villainPhaseOrder(game ?? undefined);
    const charWidth = 5.6;
    const artColumnWidth = 96;
    const textWidth = Math.max(1, listRect.width - artColumnWidth - 24 - 24);
    const rowHeight = Math.max(
      110,
      ...steps.map((step) => 24 + estimateWrappedLines(step.detail, textWidth, charWidth) * 16 + 24),
    );
    this.#listPanel(listRect);
    this.#inScroll(listRect, rowHeight * steps.length, (b) => {
      steps.forEach((step, index) => {
        this.#villainStep(
          b,
          { x: listRect.x, y: index * rowHeight, width: listRect.width, height: rowHeight },
          step,
          index,
          artColumnWidth,
          textWidth,
          game,
        );
      });
    });
    // One stop per step, so the pad walks the steps and the list follows. Reading them is all there is to do.
    return steps.map((_step, index) => {
      const key = `step:${index}`;
      stops.set(
        `row:${key}`,
        this.#listStop(key, () => {}),
      );
      return key;
    });
  }

  #villainStep(
    b: SheetBuilder,
    rect: Rect,
    step: VillainPhaseStep,
    index: number,
    artColumnWidth: number,
    textWidth: number,
    game: GameState | null,
  ): void {
    const cardRect: Rect = { x: rect.x + 4, y: rect.y + 2, width: rect.width - 8, height: rect.height - 4 };
    b.box(cardRect, {
      fill: step.current ? surface.ink.hex : surface.card.hex,
      stroke: surface.ink.hex,
      strokeWidth: 3,
      key: `step:${index}`,
    });
    const ink1 = step.current ? surface.paper.hex : surface.ink.hex;

    let textX = cardRect.x + 16;
    if (step.art) {
      const artRect: Rect = {
        x: cardRect.x + 12,
        y: cardRect.y + 12,
        width: artColumnWidth,
        height: cardRect.height - 24,
      };
      const source = this.#artForStep(step, game);
      const cardId = this.#cardIdForStep(step, game);
      b.image(artRect, {
        src: source?.url ?? null,
        fill: surface.parchment.hex,
        // Still loading draws nothing further — the parchment ground is the neutral state. Only a source that failed
        // to load, or that never existed for a step with art, says so.
        ...(source ? { missing: t("rules.noScan") } : {}),
        color: ink1,
        ...(cardId
          ? { hover: this.#hoverSlot(cardId, `step${index}`, game ? this.#stepFace(step, game) : undefined) }
          : {}),
      });
      textX = artRect.x + artRect.width + 16;
    }

    if (step.current) {
      b.text(textX, cardRect.y + 8, t("rules.villain.now"), typeRole.label, { color: ink1, alpha: 1 });
    }
    const titleY = cardRect.y + (step.current ? 22 : 12);
    const title = b.text(textX, titleY, step.label, typeRole.barTitle, { size: 18, color: ink1 });
    b.text(textX, titleY + title.height + 4, step.detail, typeRole.body, {
      color: ink1,
      alpha: step.current ? 0.9 : ink.body,
      wrapWidth: textWidth,
    });
  }

  #artForStep(step: VillainPhaseStep, game: GameState | null): ArtSource | null {
    if (step.art === "encounterBack") return CARD_BACKS.encounter;
    // No live game means no live main scheme/villain instance to point at — rather than a gray
    // "no scan" box (owner feedback, 2026-09-29: two of them side by side outside a game read as
    // broken art, not "nothing to show yet"), fall back to the same bundled encounter card back
    // steps 3-4 always use. It's not *this* step's own picture, but it's a real illustration, and
    // every step already reads its own current/label/detail text regardless of the art column.
    if (!game) return CARD_BACKS.encounter;
    const instanceId = this.#instanceForStep(step, game);
    if (!instanceId) return null;
    const cardId = getInstance(game, instanceId)?.cardId;
    if (!cardId) return null;
    return artFor(game.cardPool[cardId], faceOf(game, instanceId));
  }

  #instanceForStep(step: VillainPhaseStep, game: GameState): InstanceId | null {
    return step.art === "mainScheme"
      ? game.mainScheme.instanceId
      : step.art === "villain"
        ? game.activeVillainId
        : null;
  }

  /** The card a step's scan is of (a live scheme or villain), for its hover popover; null for a card back. */
  #cardIdForStep(step: VillainPhaseStep, game: GameState | null): string | null {
    if (!game) return null;
    const instanceId = this.#instanceForStep(step, game);
    return instanceId ? (getInstance(game, instanceId)?.cardId ?? null) : null;
  }

  #stepFace(step: VillainPhaseStep, game: GameState): CardFace | undefined {
    const instanceId = this.#instanceForStep(step, game);
    return instanceId ? faceOf(game, instanceId) : undefined;
  }

  // ------------------------------------------------------------------------------------------------------------
  // Card list: every encounter set the pool knows, "IN THIS GAME" first under "On your table"
  // scope, the rest ("NOT IN THIS GAME") following (or omitted entirely) — each a Bangers header
  // over a wrapped grid of real card thumbnails.
  // ------------------------------------------------------------------------------------------------------------
  #drawCardListTab(rect: Rect, game: GameState | null, stops: Map<string, FocusStop>): readonly string[] {
    const groups = rulesCardListOf(game, POOL_CARDS, POOL_ENCOUNTER_SETS);
    const visible = this.#scope === "table" ? groups.filter((group) => group.inGame) : groups;
    if (visible.length === 0) {
      this.#b.text(
        rect.x,
        rect.y,
        game ? t("rules.cardList.emptyGame") : t("rules.cardList.emptyPool"),
        typeRole.body,
        { color: surface.ink.hex, alpha: ink.meta },
      );
      return [];
    }

    const geometry = poolGridGeometry(rect.width, 1, isDesktopType(), cardSizeFactor(appSession().settings.cardSize));
    const slots: CardListSlot[] = [];
    let sawInGame = false;
    let sawNotInGame = false;
    for (const group of visible) {
      if (group.inGame && !sawInGame) {
        slots.push({ kind: "sectionLabel", text: t("rules.cardList.inGame") });
        sawInGame = true;
      } else if (!group.inGame && !sawNotInGame && this.#scope === "all") {
        slots.push({ kind: "sectionLabel", text: t("rules.cardList.notInGame") });
        sawNotInGame = true;
      }
      slots.push({ kind: "header", group });
      const rows = Math.max(1, Math.ceil(group.cards.length / geometry.columns));
      for (let r = 0; r < rows; r++)
        slots.push({
          kind: "gridRow",
          group,
          startIndex: r * geometry.columns,
          count: Math.min(geometry.columns, group.cards.length - r * geometry.columns),
        });
    }

    const heights = slots.map((slot) =>
      slot.kind === "sectionLabel"
        ? SECTION_LABEL_HEIGHT
        : slot.kind === "header"
          ? SET_HEADER_HEIGHT
          : geometry.cellHeight,
    );
    this.#listPanel(rect);
    this.#inScroll(
      rect,
      heights.reduce((sum, h) => sum + h, 0),
      (b) => {
        let top = 0;
        slots.forEach((slot, index) => {
          this.#cardListSlot(
            b,
            { x: rect.x, y: top, width: rect.width, height: heights[index]! },
            slot,
            index,
            geometry,
            game,
          );
          top += heights[index]!;
        });
      },
    );

    const rowIds: string[] = [];
    for (const slot of slots) {
      if (slot.kind !== "gridRow") continue;
      for (let col = 0; col < slot.count; col++) {
        const card = slot.group.cards[slot.startIndex + col]!;
        const id = `${slot.group.setId}:${card.cardId}`;
        rowIds.push(id);
        stops.set(
          `row:${id}`,
          this.#listStop(`card:${id}`, () => this.#inspectPoolCard(card, game), {
            inspect: () => this.#inspectPoolCard(card, game),
          }),
        );
      }
    }
    return rowIds;
  }

  #cardListSlot(
    b: SheetBuilder,
    rect: Rect,
    slot: CardListSlot,
    index: number,
    geometry: ReturnType<typeof poolGridGeometry>,
    game: GameState | null,
  ): void {
    // Matches the grid cells' own left inset (`cardRect.x = cell.x + 4` below) so a header/label
    // row's own text lines up under the card art's own left edge instead of starting flush under
    // the list's outer border.
    if (slot.kind === "sectionLabel") {
      b.text(rect.x + CARD_LIST_INSET, rect.y + rect.height / 2, slot.text, typeRole.label, {
        size: 11,
        color: surface.ink.hex,
        alpha: ink.secondary,
        origin: [0, 0.5],
      });
      return;
    }
    if (slot.kind === "header") {
      // A Bangers heading with a full-bleed rule filling the rest of its row (`sectionHeader`'s own shape).
      const x = rect.x + CARD_LIST_INSET;
      const y = rect.y + 4;
      const width = rect.width - CARD_LIST_INSET * 2;
      const heading = b.text(
        x,
        y,
        tPlural("rules.cardList.setHeader", slot.group.cards.length, { name: slot.group.setName }).toUpperCase(),
        typeRole.barTitle,
        { size: 19, color: surface.ink.hex, fitWidth: Math.max(10, width) },
      );
      const ruleX = x + heading.width + 10;
      const ruleEnd = x + width;
      if (ruleX < ruleEnd)
        b.box(
          { x: ruleX, y: y + heading.height / 2 - 1.5, width: ruleEnd - ruleX, height: 3 },
          { fill: surface.ink.hex },
        );
      return;
    }

    for (let col = 0; col < slot.count; col++) {
      const card = slot.group.cards[slot.startIndex + col]!;
      const cell = poolCellRect(geometry, rect, col);
      const cardRect: Rect = { x: cell.x + 4, y: cell.y + 2, width: cell.width - 8, height: cell.height - 4 };
      b.box(cardRect, { fill: surface.card.hex, stroke: surface.ink.hex, strokeWidth: border.object });
      const artRect: Rect = {
        x: cardRect.x + 2,
        y: cardRect.y + 2,
        width: cardRect.width - 4,
        height: cardRect.height - geometry.captionHeight - 4,
      };
      const poolCard = this.#cardForListEntry(card, game);
      const source = artFor(poolCard, defaultFaceFor(poolCard));
      // Still loading draws nothing further — the parchment ground is the neutral "coming soon" state. Only a
      // confirmed-missing scan (no `source` at all, or a file that fails to load) says so in words.
      b.image(artRect, {
        src: source?.url ?? null,
        fill: surface.parchment.hex,
        missing: t("rules.noScan"),
        color: surface.ink.hex,
      });
      const ruleY = artRect.y + artRect.height + 2;
      b.box({ x: cardRect.x, y: ruleY, width: cardRect.width, height: 2.5 }, { fill: surface.ink.hex });
      b.text(cardRect.x + 8, ruleY + 6, card.name, typeRole.rowTitle, {
        color: surface.ink.hex,
        fitWidth: cardRect.width - 16,
      });
      const key = `card:${slot.group.setId}:${card.cardId}`;
      b.tap(key, cardRect, { inspect: true, hover: this.#hoverSlot(card.cardId, `cell${index}.${col}`) });
      this.#pressOrInspect(key, () => this.#inspectPoolCard(card, game));
    }
  }

  #cardForListEntry(card: RulesCardListCard, game: GameState | null): AnyCard | undefined {
    if (game) {
      const live = game.cardPool[card.cardId];
      if (live) return live;
    }
    return CARDS_BY_ID.get(card.cardId);
  }

  #inspectPoolCard(card: RulesCardListCard, game: GameState | null): void {
    this.scene.launch(SCENES.inspect, {
      card: { cardId: card.cardId as CardId, face: defaultFaceFor(this.#cardForListEntry(card, game)) },
    } satisfies InspectData);
  }
}

const isStatusEntry = (id: string): id is "stunned" | "confused" | "tough" =>
  id === "stunned" || id === "confused" || id === "tough";

/** The text column's own width inside one glossary entry card at `cellWidth` — matches `#glossaryRow`'s own `cardRect`/`textX` math exactly, so the stop-building pass in `#drawGlossaryTab` agrees with what's actually drawn. */
function glossaryTextWidth(cellWidth: number, isStatus: boolean): number {
  const cardWidth = cellWidth - 8;
  return Math.max(1, cardWidth - (isStatus ? 18 : 12) - 12);
}

/**
 * How many of `cardRefs` fit in a strip `textWidth` px wide, reserving one slot for "+N more" the
 * moment there's an overflow — never drawing the ceiling-th thumbnail flush against (or past) the
 * card's own edge with nowhere left to say how many more there are (the bug a fixed six-thumbnail
 * cap ran into on a narrower card: the "+N more" label itself had nowhere to go but past the border).
 */
function glossaryThumbSlots(
  cardRefs: readonly RulesCardRef[],
  textWidth: number,
): { readonly shown: readonly RulesCardRef[]; readonly overflow: number } {
  const maxSlots = Math.max(1, Math.min(MAX_GLOSSARY_THUMBS, Math.floor((textWidth + 8) / (GLOSSARY_THUMB_SIZE + 8))));
  if (cardRefs.length <= maxSlots) return { shown: cardRefs, overflow: 0 };
  const shown = cardRefs.slice(0, Math.max(1, maxSlots - 1));
  return { shown, overflow: cardRefs.length - shown.length };
}

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
 * - **Glossary**: a virtualized grid of bordered entry cards (`view/rules-glossary-grid.ts`) —
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
 *   captions, tap or long-press/right-click opening Inspect. Virtualized at grid-row granularity
 *   (`ui/variable-list.ts`'s `McVariableList` — a plain `McVirtualList` can't mix a short header
 *   slot with a taller card-grid-row slot in one uniform-height list).
 *
 * No rules text was invented for this pass: every glossary definition and citation is
 * unchanged from `@mc/content`'s `schema/glossary.ts` (S6) and this module's own three
 * table-state entries — only the presentation and the new card associations are new.
 *
 * Back returns to Pause (`this.scene.stop()` — Pause is still running underneath, since it
 * launched this the same way every other overlay in this app is launched).
 */
import { isDesktopType } from "../ui/desktop-type.js";
import Phaser from "phaser";
import type { AnyCard, CardId } from "@mc/content";
import { getInstance, type GameState, type InstanceId } from "@mc/engine";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS, POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { artFor, CARD_BACKS, type CardFace } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { faceOf } from "../view/board-model.js";
import { ink, status, surface, typeRole } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import {
  McButton,
  McCardTile,
  McTabs,
  McTextInput,
  fitText,
  label,
  paintDotGrid,
  paintPanel,
  sectionHeader,
} from "../ui/widgets.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { McVariableList } from "../ui/variable-list.js";
import { ListScroll } from "../view/list-scroll.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { poolCellRect, poolColumnAt, poolGridGeometry } from "../view/deck-pool-grid.js";
import {
  glossaryCellRect,
  glossaryGridColumns,
  glossaryRowHeights,
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
import { FocusRoute, type FocusStop } from "./focus-route.js";
import type { InspectData } from "./inspect.js";
import { SCENES } from "./keys.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { OverlayMotion } from "../ui/transitions.js";

const TABS: readonly { readonly id: RulesTab; readonly label: string }[] = [
  { id: "glossary", label: "Glossary" },
  { id: "villainPhase", label: "Villain phase" },
  { id: "cardList", label: "Card list" },
];

/** Which cards to point a glossary entry's thumbnail strip at, and how many before "+N more". */
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
}

/** One flattened slot of the Card list tab's `McVariableList`. */
type CardListSlot =
  | { readonly kind: "sectionLabel"; readonly text: string }
  | { readonly kind: "header"; readonly group: RulesCardListGroup }
  | {
      readonly kind: "gridRow";
      readonly group: RulesCardListGroup;
      readonly startIndex: number;
      readonly count: number;
    };

export class RulesOverlay extends Phaser.Scene {
  #activeTab: RulesTab = "glossary";
  #query = "";
  #scope: RulesScope = "table";
  #searchInput: McTextInput | null = null;
  #tabsWidget: McTabs | null = null;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

  // A `McVariableList`, not `McVirtualList`: rows are entry-card *grid rows*, and each needs only
  // as much height as its own tallest cell (no thumbnail strip vs. one) — a plain `McVirtualList`
  // draws every row at one uniform height, which meant every row on the tab was as tall as the
  // single tallest entry anywhere on it (rules-glossary-grid.ts's own `glossaryRowHeights` doc
  // comment).
  #glossaryList: McVariableList | null = null;
  #glossaryScroll = new VariableListScroll();
  #villainList: McVirtualList | null = null;
  #villainScroll = new ListScroll();
  #cardListList: McVariableList | null = null;
  #cardListScroll = new VariableListScroll();
  #motion = new OverlayMotion();

  constructor() {
    super(SCENES.rules);
  }

  create(data: RulesSceneData = {}): void {
    this.#motion = new OverlayMotion();
    this.#activeTab = data.initialTab ?? "glossary";
    this.#query = data.initialQuery ?? "";
    const { game } = appSession().store.state;
    this.#scope = game ? "table" : "all";
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    // A scan that arrives after this scene's first draw (art loads lazily, per card — `art/card-art.ts`'s own
    // doc comment) must still show up: every card thumbnail on this screen (the glossary strip, the card list
    // grid) is requested fresh on every `#draw`, so the fix is the same one-line subscription Decks and Inspect
    // already use, not a redraw loop of its own.
    const artOff = cardArt(this).onArrived(() => this.#draw());
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect) || (this.#searchInput?.focused ?? false),
      onCancel: () => this.#close(),
      onPage: (direction) => this.#activeList()?.scrollByPage(direction),
      onHomeEnd: (edge) => (edge === "home" ? this.#activeList()?.scrollToStart() : this.#activeList()?.scrollToEnd()),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      artOff();
      this.#searchInput?.destroy();
      this.#searchInput = null;
      this.#tabsWidget?.destroy();
      this.#tabsWidget = null;
      this.#destroyLists();
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    this.#draw();
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  #activeList(): { scrollByPage(direction: 1 | -1): void; scrollToStart(): void; scrollToEnd(): void } | null {
    if (this.#activeTab === "glossary") return this.#glossaryList;
    if (this.#activeTab === "villainPhase") return this.#villainList;
    return this.#cardListList;
  }

  #destroyLists(): void {
    this.#glossaryList?.destroy();
    this.#glossaryList = null;
    this.#villainList?.destroy();
    this.#villainList = null;
    this.#cardListList?.destroy();
    this.#cardListList = null;
  }

  #setTab(tab: RulesTab): void {
    if (tab === this.#activeTab) return;
    this.#activeTab = tab;
    this.#glossaryScroll.reset();
    this.#villainScroll.reset();
    this.#cardListScroll.reset();
    this.#draw();
  }

  #setScope(scope: RulesScope): void {
    if (scope === this.#scope) return;
    this.#scope = scope;
    this.#glossaryScroll.reset();
    this.#cardListScroll.reset();
    this.#draw();
  }

  #onQueryChange(value: string): void {
    this.#query = value;
    this.#glossaryScroll.reset();
    // The glossary grid's own row heights depend on the filtered entries, so a query change needs
    // the same rebuild a tab/scope change gets — cheaper redraws that skip it would either clip a
    // newly-tallest card or leave stale empty rows, and this screen redraws are cheap (a few dozen
    // entry cards at most).
    this.#draw();
  }

  #draw(): void {
    // Already answering Back (or an inline query/tab change beat it there) —
    // don't redraw over the outgoing sheet mid-fade.
    if (this.#motion.leaving) return;
    this.#tabsWidget?.destroy();
    this.#tabsWidget = null;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#destroyLists();
    const kept = this.#searchInput ? [this.#searchInput.gameObject] : [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const layout = rulesLayout({ x: 0, y: 0, width, height }, this.#activeTab);
    const { game } = appSession().store.state;

    // Full-screen ground: an opaque void backdrop (nothing from Pause/the board can show through
    // a full-bleed screen, by construction — the owner's "layering" complaint's other half), then
    // the ink chrome, then the paper body with its felt dot grid underneath everything drawn on it.
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 1).fillRect(0, 0, width, height);
    const panelsFrom = this.children.list.length;
    const paper = this.add.graphics();
    paper
      .fillStyle(surface.paper.hex, 1)
      .fillRect(0, layout.chrome.height, width, Math.max(0, height - layout.chrome.height));
    paintDotGrid(
      this,
      { x: 0, y: layout.chrome.height, width, height: Math.max(0, height - layout.chrome.height) },
      "paper",
      { spacing: 6, radius: 1, alpha: 0.1 },
    );
    const chrome = this.add.graphics();
    chrome
      .fillStyle(surface.ink.hex, 1)
      .fillRect(layout.chrome.x, layout.chrome.y, layout.chrome.width, layout.chrome.height);

    const stops = new Map<string, FocusStop>();

    const backRect: Rect = {
      x: layout.header.x + 16,
      y: layout.header.y + (layout.header.height - 36) / 2,
      width: 90,
      height: 36,
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "◂ Back",
        type: typeRole.rowTitle,
        rect: backRect,
        onClick: () => this.#close(),
      }),
    );
    stops.set("back", { rect: backRect, activate: () => this.#close() });
    this.add
      .text(
        backRect.x + backRect.width + 14,
        layout.header.y + layout.header.height / 2,
        caseOf(typeRole.barTitle, "Rules reference"),
        { ...textStyle(typeRole.barTitle, surface.paper.hex), fontSize: "24px" },
      )
      .setOrigin(0, 0.5);

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
        const caption = label(
          this,
          layout.scope.x + 16,
          layout.scope.y + layout.scope.height / 2,
          this.#scope === "table" ? "Filtered to what's on your table" : "Showing all rules, not just the table",
          typeRole.label,
          surface.paper.hex,
          ink.secondary,
        )
          .setOrigin(0, 0.5)
          .setFontSize(10);
        fitText(caption, captionWidth, 10);
      }
      // Custom-painted rather than `McButton`'s `onInk`/`primary` skins, whose own "selected" state
      // is Hero Red — this screen has no forward action to spend that on ("one red per screen", and
      // this one needs none), so the active option is a solid paper pill instead and the inactive one
      // a plain paper outline; a `zone` handles the click the same way `McButton` would.
      this.#drawScopeOption(
        allRect,
        "All rules",
        this.#scope === "all",
        () => this.#setScope("all"),
        stops,
        "scope:all",
      );
      this.#drawScopeOption(
        tableRect,
        "On your table",
        this.#scope === "table",
        () => this.#setScope("table"),
        stops,
        "scope:table",
      );
    } else {
      const caption = label(
        this,
        layout.scope.x + 16,
        layout.scope.y + layout.scope.height / 2,
        "Showing the card pool — no game in progress.",
        typeRole.label,
        surface.paper.hex,
        ink.secondary,
      )
        .setOrigin(0, 0.5)
        .setFontSize(10);
      fitText(caption, layout.scope.width - 32, 10);
    }

    this.#tabsWidget = new McTabs(this, {
      rect: layout.tabs,
      tabs: TABS.map((tab) => ({ id: tab.id, label: tab.label })),
      activeId: this.#activeTab,
      onSelect: (id) => this.#setTab(id as RulesTab),
    });
    const cellWidth = layout.tabs.width / TABS.length;
    TABS.forEach((tab, index) => {
      stops.set(`tab:${tab.id}`, {
        rect: { x: layout.tabs.x + index * cellWidth, y: layout.tabs.y, width: cellWidth, height: layout.tabs.height },
        activate: () => this.#setTab(tab.id),
      });
    });

    let rowIds: readonly string[] = [];

    if (this.#activeTab === "glossary") {
      if (this.#searchInput) this.#searchInput.layout(layout.search);
      else
        this.#searchInput = new McTextInput(this, {
          rect: layout.search,
          value: this.#query,
          placeholder: 'Search rules — "retaliate", "confused"…',
          onChange: (v) => this.#onQueryChange(v),
        });
      stops.set("search", { rect: layout.search, activate: () => this.#searchInput?.focus() });
      rowIds = this.#drawGlossaryTab(layout.body, game, stops);
    } else if (this.#activeTab === "villainPhase") {
      this.#searchInput?.destroy();
      this.#searchInput = null;
      rowIds = this.#drawVillainPhaseTab(layout.body, game);
    } else {
      this.#searchInput?.destroy();
      this.#searchInput = null;
      rowIds = this.#drawCardListTab(layout.body, game, stops);
    }

    this.#route?.set(
      rulesFocusOrder({
        tabIds: TABS.map((t) => t.id),
        showScopeToggle,
        showSearch: this.#activeTab === "glossary",
        rowIds,
      }),
      stops,
    );

    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
  }

  /** One "All rules" / "On your table" segment — see `#draw`'s own comment on why this isn't a `McButton`. */
  #drawScopeOption(
    rect: Rect,
    text: string,
    selected: boolean,
    onClick: () => void,
    stops: Map<string, FocusStop>,
    stopId: string,
  ): void {
    const g = this.add.graphics();
    if (selected) g.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    else g.lineStyle(2, surface.paper.hex, ink.secondary).strokeRect(rect.x, rect.y, rect.width, rect.height);
    this.add
      .text(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        caseOf(typeRole.label, text),
        textStyle(typeRole.label, selected ? surface.ink.hex : surface.paper.hex, selected ? 1 : ink.secondary),
      )
      .setOrigin(0.5);
    const zone = this.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on("pointerup", onClick);
    stops.set(stopId, { rect, activate: onClick });
  }

  // ------------------------------------------------------------------------------------------------------------
  // Glossary: a virtualized grid of bordered entry cards (D13's own read), each with a term,
  // definition, citation, and — the owner's "card art if applicable" — a strip of small
  // thumbnails for every card that carries it, tappable into Inspect.
  // ------------------------------------------------------------------------------------------------------------
  #drawGlossaryTab(rect: Rect, game: GameState | null, stops: Map<string, FocusStop>): readonly string[] {
    const entries =
      this.#scope === "table" && game
        ? rulesGlossaryOf(game, POOL_DEPS, this.#query)
        : rulesGlossaryPoolOf(POOL_CARDS, this.#query);
    if (entries.length === 0) {
      this.add.text(
        rect.x,
        rect.y,
        "No rules terms match that search.",
        textStyle(typeRole.body, surface.ink.hex, ink.meta),
      );
      return [];
    }

    const geometry = glossaryGridColumns(rect.width);
    const heights = glossaryRowHeights(
      entries.map((entry) => ({ definition: entry.definition, cardRefCount: entry.cardRefs.length })),
      geometry.columns,
      geometry.cellWidth,
    );
    const rowIds: string[] = [];
    for (const entry of entries) {
      const { shown } = glossaryThumbSlots(
        entry.cardRefs,
        glossaryTextWidth(geometry.cellWidth, isStatusEntry(entry.id)),
      );
      for (const ref of shown) rowIds.push(`entry:${entry.id}:card:${ref.cardId}`);
    }

    const renderRow = (rowIndex: number, rowRect: Rect): VirtualListRow =>
      this.#renderGlossaryRow(rowRect, geometry, entries, rowIndex, game);
    this.#glossaryList = new McVariableList(this, { rect, heights, renderRow, scroll: this.#glossaryScroll });
    const list = this.#glossaryList;

    entries.forEach((entry, entryIndex) => {
      const rowIndex = Math.floor(entryIndex / geometry.columns);
      const { shown } = glossaryThumbSlots(
        entry.cardRefs,
        glossaryTextWidth(geometry.cellWidth, isStatusEntry(entry.id)),
      );
      shown.forEach((ref) => {
        stops.set(`entry:${entry.id}:card:${ref.cardId}`, {
          rect: () => list.rectFor(rowIndex),
          activate: () => this.#inspectRef(ref, game),
          inspect: () => this.#inspectRef(ref, game),
          ensureVisible: () => list.scrollIntoView(rowIndex),
        });
      });
    });
    return rowIds;
  }

  #renderGlossaryRow(
    rowRect: Rect,
    geometry: ReturnType<typeof glossaryGridColumns>,
    entries: readonly RulesEntry[],
    rowIndex: number,
    game: GameState | null,
  ): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const startIndex = rowIndex * geometry.columns;
    const countInRow = Math.min(geometry.columns, entries.length - startIndex);
    for (let col = 0; col < countInRow; col++) {
      const entry = entries[startIndex + col]!;
      const cell = glossaryCellRect(geometry, rowRect, col);
      const cardRect: Rect = { x: cell.x + 4, y: cell.y + 2, width: cell.width - 8, height: cell.height - 4 };
      const isStatus = isStatusEntry(entry.id);

      const g = this.add.graphics();
      paintPanel(g, cardRect, "card", "rest");
      objects.push(g);
      if (isStatus) {
        const stripe = this.add.graphics();
        stripe
          .fillStyle(status[entry.id as "stunned" | "confused" | "tough"].hex, 1)
          .fillRect(cardRect.x, cardRect.y, 6, cardRect.height);
        objects.push(stripe);
      }

      const textX = cardRect.x + (isStatus ? 18 : 12);
      const textWidth = glossaryTextWidth(geometry.cellWidth, isStatus);
      let y = cardRect.y + 10;

      // The status hue alone never carries the meaning (colorblind-safe): the term itself is
      // always the plain word "Stunned"/"Confused"/"Tough", never only the stripe's colour.
      const term = this.add.text(textX, y, caseOf(typeRole.barTitle, entry.displayName), {
        ...textStyle(typeRole.barTitle, surface.ink.hex),
        fontSize: "20px",
      });
      fitText(term, textWidth, 20);
      objects.push(term);
      y += term.height + 6;

      const definition = this.add
        .text(textX, y, entry.definition, textStyle(typeRole.body, surface.ink.hex, ink.body))
        .setWordWrapWidth(textWidth);
      objects.push(definition);
      y += definition.height + 6;

      const flags = [
        entry.unverified ? " · UNVERIFIED" : "",
        entry.conflict ? " · RULING CONFLICT — see below" : "",
      ].join("");
      objects.push(
        label(
          this,
          textX,
          y,
          `${entry.citeLabel}${flags}`,
          typeRole.label,
          surface.ink.hex,
          ink.label,
        ).setWordWrapWidth(textWidth),
      );
      y += 16;
      if (entry.conflict) {
        const conflictText = this.add
          .text(textX, y, entry.conflict, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
          .setWordWrapWidth(textWidth);
        objects.push(conflictText);
        y += conflictText.height + 4;
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
          const tile = new McCardTile(this, {
            rect: tileRect,
            label: ref.name,
            artHeight: Math.max(0, tileRect.height - GLOSSARY_THUMB_CAPTION),
            onClick: () => this.#inspectRef(ref, game),
            onInspect: () => this.#inspectRef(ref, game),
            paintArt: (slot) => {
              const key = cardArt(this).request(this, artFor(this.#cardForRef(ref, game), this.#faceForRef(ref, game)));
              return drawArt(this, key, slot) !== null;
            },
          });
          objects.push(...tile.objects);
        });
        if (overflow > 0) {
          objects.push(
            label(
              this,
              textX + shown.length * (GLOSSARY_THUMB_SIZE + 8),
              y + GLOSSARY_THUMB_SIZE * 0.7,
              `+${overflow} more`,
              typeRole.label,
              surface.ink.hex,
              ink.meta,
            ),
          );
        }
      }
    }
    return { objects };
  }

  #cardForRef(ref: RulesCardRef, game: GameState | null): AnyCard | undefined {
    if (game && ref.instanceId) return game.cardPool[ref.cardId];
    return CARDS_BY_ID.get(ref.cardId);
  }

  #faceForRef(ref: RulesCardRef, game: GameState | null): CardFace {
    if (game && ref.instanceId) return faceOf(game, ref.instanceId as InstanceId);
    return { kind: "front" };
  }

  #inspectRef(ref: RulesCardRef, game: GameState | null): void {
    if (game && ref.instanceId)
      this.scene.launch(SCENES.inspect, { instanceId: ref.instanceId as InstanceId } satisfies InspectData);
    else
      this.scene.launch(SCENES.inspect, {
        card: { cardId: ref.cardId as CardId, face: { kind: "front" } },
      } satisfies InspectData);
  }

  // ------------------------------------------------------------------------------------------------------------
  // Villain phase: the six RRG 1.8 p. 47 steps, in sequence, the live step highlighted, with the
  // main scheme's/villain's own scan or a bundled encounter card back illustrating a step that has one.
  // ------------------------------------------------------------------------------------------------------------
  #drawVillainPhaseTab(rect: Rect, game: GameState | null): readonly string[] {
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
    label(
      this,
      citationRect.x,
      citationRect.y + citationRect.height / 2,
      'RRG 1.8 p. 47 "Villain Phase".',
      typeRole.label,
      surface.ink.hex,
      ink.meta,
    ).setOrigin(0, 0.5);

    const steps = villainPhaseOrder(game ?? undefined);
    const charWidth = 5.6;
    const artColumnWidth = 96;
    const textWidth = Math.max(1, listRect.width - artColumnWidth - 24 - 24);
    const rowHeight = Math.max(
      110,
      ...steps.map((step) => 24 + estimateWrappedLines(step.detail, textWidth, charWidth) * 16 + 24),
    );
    const renderRow = (index: number, rowRect: Rect): VirtualListRow =>
      this.#renderVillainStep(rowRect, steps[index]!, artColumnWidth, textWidth, game);
    this.#villainList = new McVirtualList(this, {
      rect: listRect,
      rowHeight,
      count: steps.length,
      renderRow,
      scroll: this.#villainScroll,
    });
    return [];
  }

  #renderVillainStep(
    rect: Rect,
    step: VillainPhaseStep,
    artColumnWidth: number,
    textWidth: number,
    game: GameState | null,
  ): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const cardRect: Rect = { x: rect.x + 4, y: rect.y + 2, width: rect.width - 8, height: rect.height - 4 };
    const g = this.add.graphics();
    if (step.current) g.fillStyle(surface.ink.hex, 1).fillRect(cardRect.x, cardRect.y, cardRect.width, cardRect.height);
    else g.fillStyle(surface.card.hex, 1).fillRect(cardRect.x, cardRect.y, cardRect.width, cardRect.height);
    g.lineStyle(3, surface.ink.hex, 1).strokeRect(cardRect.x, cardRect.y, cardRect.width, cardRect.height);
    objects.push(g);
    const ink1 = step.current ? surface.paper.hex : surface.ink.hex;

    let textX = cardRect.x + 16;
    if (step.art) {
      const artRect: Rect = {
        x: cardRect.x + 12,
        y: cardRect.y + 12,
        width: artColumnWidth,
        height: cardRect.height - 24,
      };
      const artBg = this.add.graphics();
      artBg.fillStyle(surface.parchment.hex, 1).fillRect(artRect.x, artRect.y, artRect.width, artRect.height);
      objects.push(artBg);
      const source = this.#artForStep(step, game);
      const key = source ? cardArt(this).request(this, source) : null;
      const img = key ? drawArt(this, key, artRect) : null;
      if (img) objects.push(img);
      else
        objects.push(
          label(
            this,
            artRect.x + artRect.width / 2,
            artRect.y + artRect.height / 2,
            "no scan",
            typeRole.label,
            ink1,
            ink.meta,
          ).setOrigin(0.5),
        );
      textX = artRect.x + artRect.width + 16;
    }

    if (step.current) {
      objects.push(label(this, textX, cardRect.y + 8, "← HAPPENING NOW", typeRole.label, ink1, 1));
    }
    const title = this.add.text(
      textX,
      cardRect.y + (step.current ? 22 : 12),
      caseOf({ ...typeRole.barTitle }, step.label),
      { ...textStyle(typeRole.barTitle, ink1), fontSize: "18px" },
    );
    objects.push(title);
    const detail = this.add
      .text(
        textX,
        cardRect.y + (step.current ? 22 : 12) + title.height + 4,
        step.detail,
        textStyle(typeRole.body, ink1, step.current ? 0.9 : ink.body),
      )
      .setWordWrapWidth(textWidth);
    objects.push(detail);
    return { objects };
  }

  #artForStep(step: VillainPhaseStep, game: GameState | null): { readonly key: string; readonly url: string } | null {
    if (step.art === "encounterBack") return CARD_BACKS.encounter;
    if (!game) return null;
    const instanceId =
      step.art === "mainScheme" ? game.mainScheme.instanceId : step.art === "villain" ? game.activeVillainId : null;
    if (!instanceId) return null;
    const cardId = getInstance(game, instanceId)?.cardId;
    if (!cardId) return null;
    return artFor(game.cardPool[cardId], faceOf(game, instanceId));
  }

  // ------------------------------------------------------------------------------------------------------------
  // Card list: every encounter set the pool knows, "IN THIS GAME" first under "On your table"
  // scope, the rest ("NOT IN THIS GAME") following (or omitted entirely) — each a Bangers header
  // over a wrapped grid of real card thumbnails. Virtualized at grid-row granularity: a plain
  // `McVirtualList` can't mix a short header slot with a taller grid-row slot in one list.
  // ------------------------------------------------------------------------------------------------------------
  #drawCardListTab(rect: Rect, game: GameState | null, stops: Map<string, FocusStop>): readonly string[] {
    const groups = rulesCardListOf(game, POOL_CARDS, POOL_ENCOUNTER_SETS);
    const visible = this.#scope === "table" ? groups.filter((group) => group.inGame) : groups;
    if (visible.length === 0) {
      this.add.text(
        rect.x,
        rect.y,
        game ? "This game has no encounter-side cards to list." : "No encounter sets in the pool.",
        textStyle(typeRole.body, surface.ink.hex, ink.meta),
      );
      return [];
    }

    const geometry = poolGridGeometry(rect.width, 1, isDesktopType());
    const slots: CardListSlot[] = [];
    let sawInGame = false;
    let sawNotInGame = false;
    for (const group of visible) {
      if (group.inGame && !sawInGame) {
        slots.push({ kind: "sectionLabel", text: "IN THIS GAME" });
        sawInGame = true;
      } else if (!group.inGame && !sawNotInGame && this.#scope === "all") {
        slots.push({ kind: "sectionLabel", text: "NOT IN THIS GAME" });
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
    const renderRow = (index: number, rowRect: Rect): VirtualListRow =>
      this.#renderCardListSlot(rowRect, slots[index]!, geometry, game);
    const onRowActivate = (index: number, pointer: Phaser.Input.Pointer): void => {
      const slot = slots[index];
      if (slot?.kind !== "gridRow") return;
      const list = this.#cardListList;
      if (!list) return;
      const column = poolColumnAt(geometry, list.rectFor(index), pointer.x, slot.count);
      if (column === null) return;
      const card = slot.group.cards[slot.startIndex + column];
      if (card) this.#inspectPoolCard(card);
    };
    this.#cardListList = new McVariableList(this, {
      rect,
      heights,
      renderRow,
      scroll: this.#cardListScroll,
      onRowActivate,
    });
    const list = this.#cardListList;

    const rowIds: string[] = [];
    slots.forEach((slot, index) => {
      if (slot.kind !== "gridRow") return;
      for (let col = 0; col < slot.count; col++) {
        const card = slot.group.cards[slot.startIndex + col]!;
        rowIds.push(`${slot.group.setId}:${card.cardId}`);
        stops.set(`${slot.group.setId}:${card.cardId}`, {
          rect: () => poolCellRect(geometry, list.rectFor(index), col),
          activate: () => this.#inspectPoolCard(card),
          ensureVisible: () => list.scrollIntoView(index),
        });
      }
    });
    return rowIds;
  }

  #renderCardListSlot(
    rect: Rect,
    slot: CardListSlot,
    geometry: ReturnType<typeof poolGridGeometry>,
    game: GameState | null,
  ): VirtualListRow {
    // Matches the grid cells' own left inset (`cardRect.x = cell.x + 4` below) so a header/label
    // row's own text lines up under the card art's own left edge instead of starting flush under
    // the list's outer border.
    if (slot.kind === "sectionLabel") {
      return {
        objects: [
          label(
            this,
            rect.x + CARD_LIST_INSET,
            rect.y + rect.height / 2,
            slot.text,
            typeRole.label,
            surface.ink.hex,
            ink.secondary,
          )
            .setOrigin(0, 0.5)
            .setFontSize(11),
        ],
      };
    }
    if (slot.kind === "header") {
      // Every object `sectionHeader` draws must land in this row's own `objects` — anything
      // created straight off `scene.add.*` and not returned here is parented outside
      // `McVariableList`'s row layer, the one thing that actually gets masked and repositioned by
      // scroll (`ui/variable-list.ts`'s own doc comment) — a header drawn that way stays put while
      // the grid rows around it scroll past.
      const objects: Phaser.GameObjects.GameObject[] = [];
      sectionHeader(
        this,
        rect.x + CARD_LIST_INSET,
        rect.y + 4,
        rect.width - CARD_LIST_INSET * 2,
        `${slot.group.setName.toUpperCase()} · ${slot.group.cards.length} CARD${slot.group.cards.length === 1 ? "" : "S"}`,
        surface.ink.hex,
        undefined,
        objects,
      );
      return { objects };
    }

    const objects: Phaser.GameObjects.GameObject[] = [];
    for (let col = 0; col < slot.count; col++) {
      const card = slot.group.cards[slot.startIndex + col]!;
      const cell = poolCellRect(geometry, rect, col);
      const cardRect: Rect = { x: cell.x + 4, y: cell.y + 2, width: cell.width - 8, height: cell.height - 4 };
      const g = this.add.graphics();
      paintPanel(g, cardRect, "card", "rest");
      objects.push(g);
      const artRect: Rect = {
        x: cardRect.x + 2,
        y: cardRect.y + 2,
        width: cardRect.width - 4,
        height: cardRect.height - geometry.captionHeight - 4,
      };
      const artFill = this.add.graphics();
      artFill.fillStyle(surface.parchment.hex, 1).fillRect(artRect.x, artRect.y, artRect.width, artRect.height);
      objects.push(artFill);
      const poolCard = this.#cardForListEntry(card, game);
      const key = cardArt(this).request(this, artFor(poolCard, { kind: "front" }));
      const art = drawArt(this, key, artRect);
      if (art) objects.push(art);
      else
        objects.push(
          label(
            this,
            artRect.x + artRect.width / 2,
            artRect.y + artRect.height / 2,
            "no scan",
            typeRole.label,
            surface.ink.hex,
            ink.meta,
          ).setOrigin(0.5),
        );
      const ruleY = artRect.y + artRect.height + 2;
      const rule = this.add.graphics();
      rule.fillStyle(surface.ink.hex, 1).fillRect(cardRect.x, ruleY, cardRect.width, 2.5);
      objects.push(rule);
      const name = this.add.text(cardRect.x + 8, ruleY + 6, card.name, textStyle(typeRole.rowTitle, surface.ink.hex));
      fitText(name, cardRect.width - 16);
      objects.push(name);
    }
    return { objects };
  }

  #cardForListEntry(card: RulesCardListCard, game: GameState | null): AnyCard | undefined {
    if (game) {
      const live = game.cardPool[card.cardId];
      if (live) return live;
    }
    return CARDS_BY_ID.get(card.cardId);
  }

  #inspectPoolCard(card: RulesCardListCard): void {
    this.scene.launch(SCENES.inspect, {
      card: { cardId: card.cardId as CardId, face: { kind: "front" } },
    } satisfies InspectData);
  }
}

const isStatusEntry = (id: string): id is "stunned" | "confused" | "tough" =>
  id === "stunned" || id === "confused" || id === "tough";

/** The text column's own width inside one glossary entry card at `cellWidth` — matches `#renderGlossaryRow`'s own `cardRect`/`textX` math exactly, so the stop-building pass in `#drawGlossaryTab` agrees with what's actually drawn. */
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

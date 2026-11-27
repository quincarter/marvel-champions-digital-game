/**
 * The Trophy Room: every achievement (`progression/achievements.ts`, docs/achievements.md) in one scrolling list under
 * a header that shows the player's rank, lifetime points and the way to the next rank. Reached from Title and from
 * Extras; Back returns to Title. "Your stats" at the top bar's right (X on a pad) opens the Stats screen
 * (`scenes/player-stats.ts`).
 *
 * Read-only. Each family is a heading that folds and opens with a tap or A (#479); every one starts folded and the
 * room remembers which the player opened. A Filters bar under the header folds away too (Y on a pad): it sorts the
 * families and the achievements in them by category, completion, points or name, either way, and Expand all / Collapse
 * all (R3) opens or folds every family. A pad or keyboard walks the headings and achievement rows (each a focus stop,
 * the list follows the ring); A on an achievement opens it in a sheet that spells out the whole line, B closes it,
 * then B leaves. LB / RB jump between the headings. A tap on a row works through the panel's own tap (a drag or a
 * swipe that lifts over a row presses nothing).
 * Rows and wording come from `view/trophy-room-model.ts`; this scene draws them. State is a word as well as a look:
 * EARNED, LOCKED or SOON.
 *
 * **The list and the achievement's sheet are one Lit panel over the canvas** (`mc-sheet`, `dom/sheet-builder.ts`), at
 * the rects the Phaser list drew them: the headings, pack headings and achievement cards scroll natively, and only the
 * rows near the view are built, so a long list stays light. The top bar, the rank header and the Filters bar stay
 * Phaser (the pad's glyph hints and the buttons' own hover are theirs); the scene keeps the focus route (its ring drawn
 * in the DOM, `dom/dom-ring.ts`), the sort and the open families.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSheet } from "@mc/ui";
import { accent, border, hit, ink, surface, typeRole, type TypeSpec } from "../tokens.js";
import { bangers, campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { McButton, fitText } from "../ui/widgets.js";
import { addPressShield } from "../ui/press-shield.js";
import { rememberTrophyRoomView, trophyRoomView } from "../platform/trophy-room-view.js";
import { drawChoiceRow } from "./roster-panel.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { clipToView, familyTarget, pageTarget } from "../view/focus-list.js";
import type { Rect } from "../view/layout.js";
import {
  trophyHeaderOf,
  trophyRowHeightsOf,
  trophyRowsOf,
  trophySortLabel,
  trophySorts,
  type TrophyHeader,
  type TrophyRow,
  type TrophySort,
  type TrophyView,
} from "../view/trophy-room-model.js";
import { ACHIEVEMENTS, ACHIEVEMENT_FAMILIES, type AchievementFamily } from "../progression/achievements.js";
import { achievementStatusesNow, lifetimeChampionPoints, refreshUnlocks } from "../progression/progression.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { PlayerStatsData } from "./player-stats.js";

/** Room at each row's right edge for the list's own scrollbar. */
const GUTTER = 14;
/** Between the filter bar's rows. */
const BAR_GAP = 6;
/** A label in the type of `typeRole.label` but written as given (Phaser drew it so; capitals only where the words are). */
const AS_WRITTEN_LABEL: TypeSpec = { ...typeRole.label, uppercase: false };
/** The scrolling list's key in the panel. */
const LIST = "list";

/** An achievement's stop, by its id: the same achievement keeps it however the list folds or sorts. */
const keyOfAchievement = (id: string): string => `row:${id}`;

const keyOfRow = (row: TrophyRow): string =>
  row.kind === "section" ? `sec:${row.id}` : row.kind === "group" ? `grp:${row.id}` : keyOfAchievement(row.id);

/** What the last draw laid out, for the panel's own redraws (the list scrolling) and the focus stops. */
interface ListLayout {
  readonly width: number;
  readonly height: number;
  readonly phone: boolean;
  readonly listRect: Rect;
  /** Each row's top in the list's content space, and the list's whole height. */
  readonly tops: readonly number[];
  readonly heights: readonly number[];
  readonly total: number;
}

export class TrophyRoomScene extends Phaser.Scene {
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #alive = false;
  #hints!: GlyphHints;
  #glyphs!: SheetGlyphs;
  #rows: readonly TrophyRow[] = [];
  /** The achievement whose sheet is open (its id, so a redraw that re-sorts the list keeps it), or null. */
  #open: string | null = null;
  /** The row that had focus, to give it back when the sheet closes. */
  #lastRow: string | null = null;
  #listHeight = 0;
  /** The sheet was opened from the route (its row had focus), so closing it gives focus back; a tap leaves none. */
  #focusOnClose = false;
  /** Kept across redraws and visits (Phaser reuses this scene instance): where the list was left. */
  #listTop = 0;
  /** The sort and the open families, read at each visit and saved on each change. */
  #view: TrophyView = trophyRoomView();
  /** The sort chips are showing; folded at each visit. */
  #filtersOpen = false;
  /** The screen's one Lit panel: the list, and the achievement's sheet over the screen. Made on the first paint. */
  #region: DomRegion<McSheet> | null = null;
  #layout: ListLayout | null = null;
  #built: { readonly from: number; readonly to: number } | null = null;
  #actions = new Map<string, () => void>();
  #placed = new WeakSet<HTMLElement>();
  #scrollFrame = 0;

  constructor() {
    super(SCENES.trophyRoom);
  }

  create(): void {
    this.#alive = true;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    this.#open = null;
    this.#lastRow = null;
    this.#view = trophyRoomView();
    this.#filtersOpen = false;
    this.#region = null;
    this.#layout = null;
    this.#built = null;
    this.#hints = new GlyphHints(this);
    this.#glyphs = new SheetGlyphs(this, () => this.#draw());
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => (this.#open !== null ? this.#closeSheet() : this.#back()),
      onPage: (direction) => this.#pageFocus(direction),
      onTab: (direction) => this.#jumpFamily(direction),
      onHomeEnd: (edge) => {
        const all = this.#rowIndexes();
        this.#focusRow(edge === "home" ? all[0] : all.at(-1));
      },
      onScroll: (_dx, dy) => (this.#open === null ? this.#scroller()?.scrollBy({ top: dy }) : undefined),
      onFocusChange: (key) => {
        if (key?.startsWith("row:")) this.#lastRow = key;
      },
      // Y (and the Inspect key) shows or folds the filters: no row here has anything else to inspect.
      onInspect: () => {
        if (this.#open === null) this.#toggleFilters();
        return true;
      },
      // R3 (and the Expand key) opens every family, or folds them all once every one is open.
      onExpand: () => {
        if (this.#open === null) this.#expandAll();
      },
      // X (G / H on the keyboard) opens Your stats.
      onToggle: () => this.#openStats(),
    });
    const offLanguage = onLanguageChange(() => this.#draw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      offLanguage();
      this.#hints.dispose();
      this.#glyphs.dispose();
      this.scale.off("resize", this.#draw, this);
      this.#destroyWidgets();
      // The panel goes with the scene (`DomRegion`); the next visit makes a new one.
      this.#region = null;
    });
    this.#draw();
    // The type measured before the fonts were in: lay the rows out again once they are.
    void (typeof document === "undefined" ? undefined : document.fonts?.ready)?.then(() => {
      if (this.#alive) this.#draw();
    });
    fadeScreenIn(this);
    // Saves may have changed since Boot read them (a game just won): read again, then redraw once.
    void refreshUnlocks()
      .catch(() => false)
      .then(() => this.#draw());
  }

  #scroller(): HTMLElement | null {
    return this.#region?.element.elementOf(LIST) ?? null;
  }

  #back(): void {
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.title);
  }

  #openStats(): void {
    if (this.#open !== null) return;
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.playerStats, { from: SCENES.trophyRoom } satisfies PlayerStatsData);
  }

  #setView(view: TrophyView): void {
    this.#view = view;
    rememberTrophyRoomView(view);
    this.#draw();
  }

  /**
   * Opens or folds families. Stops are keyed by what they show, so focus stays on its row while others come and go;
   * a focused achievement folded away hands focus to its family's heading.
   */
  #setExpanded(expanded: ReadonlySet<AchievementFamily>): void {
    const focused = this.#route?.focused ?? null;
    // A pack's own achievement (`pack:<id>/<name>`) is not in ACHIEVEMENTS: it always sits in Mods.
    const family: AchievementFamily | undefined =
      focused === null
        ? undefined
        : (ACHIEVEMENTS.find((a) => keyOfAchievement(a.id) === focused)?.family ??
          (focused.startsWith(keyOfAchievement("pack:")) ? "mods" : undefined));
    this.#setView({ ...this.#view, expanded });
    if (family !== undefined && !expanded.has(family)) this.#route?.focusKey(`sec:${family}`);
  }

  #toggleFamily(id: AchievementFamily): void {
    const expanded = new Set(this.#view.expanded);
    if (!expanded.delete(id)) expanded.add(id);
    this.#setExpanded(expanded);
  }

  /** Whether every family is open, so the button folds them all instead. */
  #allExpanded(): boolean {
    return ACHIEVEMENT_FAMILIES.every((f) => this.#view.expanded.has(f.id));
  }

  #expandAll(): void {
    this.#setExpanded(this.#allExpanded() ? new Set() : new Set(ACHIEVEMENT_FAMILIES.map((f) => f.id)));
  }

  #setSort(sort: TrophySort): void {
    this.#setView({ ...this.#view, sort });
  }

  #setDescending(descending: boolean): void {
    this.#setView({ ...this.#view, descending });
  }

  #toggleFilters(): void {
    this.#filtersOpen = !this.#filtersOpen;
    this.#draw();
  }

  /** Every list row's index: headings and achievements, all of them stops. */
  #rowIndexes(): number[] {
    return this.#rows.map((_, index) => index);
  }

  #focusRow(index: number | undefined): void {
    const row = index === undefined ? undefined : this.#rows[index];
    if (row && this.#open === null) this.#route?.focusKey(keyOfRow(row));
  }

  /** The list index of the focused stop, or null when focus is on the bar, Back or nowhere. */
  #focusedIndex(): number | null {
    const key = this.#route?.focused ?? null;
    const index = this.#rows.findIndex((row) => keyOfRow(row) === key);
    return index === -1 ? null : index;
  }

  /** PageUp / PageDown: focus moves a screenful of rows. */
  #pageFocus(direction: 1 | -1): void {
    if (this.#open !== null) return;
    const step = Math.max(1, Math.floor((this.#listHeight || 300) / 70) - 1);
    this.#focusRow(pageTarget(this.#rowIndexes(), this.#focusedIndex(), direction, step));
  }

  /** LB / RB: the next family's heading; back, this family's heading, then the previous. */
  #jumpFamily(direction: 1 | -1): void {
    if (this.#open !== null) return;
    const headings: number[] = [];
    this.#rows.forEach((row, index) => {
      if (row.kind === "section") headings.push(index);
    });
    this.#focusRow(familyTarget(headings, this.#focusedIndex(), direction));
  }

  #closeSheet(): void {
    this.#open = null;
    this.#draw();
    if (this.#focusOnClose && this.#lastRow) this.#route?.focusKey(this.#lastRow);
  }

  #openSheet(id: string): void {
    const key = keyOfAchievement(id);
    this.#focusOnClose = this.#route?.focused === key;
    this.#lastRow = key;
    this.#open = id;
    this.#draw();
  }

  #destroyWidgets(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
  }

  /** A row's box on the screen now, from the list's scroll. */
  #rowOnScreen(index: number): Rect {
    const layout = this.#layout!;
    const top = layout.listRect.y + layout.tops[index]! - (this.#scroller()?.scrollTop ?? this.#listTop);
    // Clipped to the list, so the ring never floats over the header while a row is scrolled partly out.
    return clipToView(
      { x: layout.listRect.x, y: top, width: layout.listRect.width - GUTTER, height: layout.heights[index]! },
      layout.listRect,
    );
  }

  /** Brings a row into view: the least scroll that shows all of it. */
  #showRow(index: number): void {
    const layout = this.#layout;
    const scroller = this.#scroller();
    if (!layout || !scroller) return;
    const top = layout.tops[index]!;
    const bottom = top + layout.heights[index]!;
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (bottom > scroller.scrollTop + layout.listRect.height) scroller.scrollTop = bottom - layout.listRect.height;
  }

  #draw(): void {
    if (!this.#alive) return;
    this.#destroyWidgets();
    destroyChildren(this);
    this.#glyphs.reset();

    const frame = campaignFrame(this);
    const { width, height, phone, gutter } = frame;
    const statuses = achievementStatusesNow();
    const header = trophyHeaderOf(lifetimeChampionPoints(), statuses);
    const rows = trophyRowsOf(statuses, this.#view);
    this.#rows = rows;
    this.#hints.reset();
    const heights = trophyRowHeightsOf(phone);
    const stops = new Map<string, FocusStop>();

    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    const bar = drawTopBar(this, {
      backLabel: phone ? "◂" : `◂ ${t("trophies.backTitle")}`,
      onBack: () => this.#back(),
      hints: this.#open === null ? this.#hints : null,
      title: t("trophies.title"),
    });
    if (bar.back) this.#buttons.push(bar.back);
    if (bar.backRect) stops.set("back", { rect: bar.backRect, activate: () => this.#back() });
    // "Your stats" (X on a pad) at the bar's right; the earned count it displaced sits over the rank bar instead.
    const statsWidth = phone ? 92 : 150;
    const statsRect: Rect = {
      x: width - (phone ? 12 : 22) - statsWidth,
      y: (bar.height - hit.target) / 2,
      width: statsWidth,
      height: hit.target,
    };
    const statsButton = new McButton(this, {
      kind: "onInk",
      label: t(phone ? "trophies.statsShort" : "trophies.stats"),
      type: typeRole.backLabel,
      rect: statsRect,
      onClick: () => this.#openStats(),
    });
    this.#buttons.push(statsButton);
    if (this.#open === null) this.#hints.button(statsButton, ["guide"], "ink");
    stops.set("stats", { rect: statsRect, activate: () => this.#openStats() });

    const headerRect: Rect = {
      x: gutter,
      y: bar.height + 12,
      width: width - gutter * 2,
      height: phone ? 120 : 118,
    };
    this.#drawHeader(headerRect, header, phone);
    const filterOrder: string[] = [];
    const barBottom = this.#drawFilterBar(headerRect.y + headerRect.height + 10, gutter, width, stops, filterOrder);

    const listTop = barBottom + 10;
    const listRect: Rect = {
      x: gutter,
      y: listTop,
      width: width - gutter * 2,
      height: Math.max(60, height - listTop - gutter),
    };
    const rowHeights = rows.map((row) =>
      row.kind === "section" ? heights.section : row.kind === "group" ? heights.group : heights.achievement,
    );
    const tops: number[] = [];
    let total = 0;
    for (const h of rowHeights) {
      tops.push(total);
      total += h;
    }
    this.#layout = { width, height, phone, listRect, tops, heights: rowHeights, total };
    this.#listHeight = listRect.height;

    const order: string[] = [...(bar.backRect ? ["back"] : []), "stats", ...filterOrder];
    rows.forEach((row, index) => {
      // A pack's heading is a label: nothing to press, so the focus ring walks past it.
      if (row.kind === "group") return;
      const key = keyOfRow(row);
      order.push(key);
      stops.set(key, {
        rect: () => this.#rowOnScreen(index),
        view: () => this.#layout?.listRect ?? listRect,
        activate: () => (row.kind === "section" ? this.#toggleFamily(row.id) : this.#openSheet(row.id)),
        ensureVisible: () => this.#showRow(index),
      });
    });

    const sheetRow = rows.find((row) => row.kind === "achievement" && row.id === this.#open);
    if (!sheetRow) this.#open = null;
    let sheetStop: FocusStop | null = null;
    if (sheetRow?.kind === "achievement") {
      // The sheet takes every press: a shield over the screen, under the panel's own parts.
      addPressShield(this, { x: 0, y: 0, width, height });
      sheetStop = {
        rect: this.#sheetRects(sheetRow, width, height, phone).close,
        activate: () => this.#closeSheet(),
      };
    }
    this.#paintPanel(sheetRow?.kind === "achievement" ? sheetRow : null);
    if (sheetStop) {
      this.#route?.set(["close"], new Map([["close", sheetStop]]));
      this.#route?.focusKey("close");
    } else this.#route?.set(order, stops);
  }

  /** What a key does when the panel reports a tap on it. */
  #press(key: string, action: () => void): void {
    this.#actions.set(key, action);
  }

  /**
   * Builds the rows near the view (and the sheet, when one is open) as the panel's parts, hands them over and renders
   * now. Also the list's own redraw when a scroll nears the edge of the rows built.
   */
  #paintPanel(sheet: Extract<TrophyRow, { kind: "achievement" }> | null = this.#sheetNow()): void {
    const layout = this.#layout;
    if (!layout || !this.#alive) return;
    this.#actions = new Map();
    this.#glyphs.reset();
    // The panel is the list's box, or (a sheet open) the whole screen.
    const region: Rect = sheet
      ? { x: 0, y: 0, width: layout.width, height: layout.height }
      : { x: 0, y: layout.listRect.y, width: layout.width, height: Math.max(0, layout.height - layout.listRect.y) };
    const b = new SheetBuilder(this.game, { x: region.x, y: region.y }, isDesktopType);
    const { listRect } = layout;
    const scrolled = this.#scroller()?.scrollTop ?? this.#listTop;
    // Rows from a view above the top to two views below it.
    let from = 0;
    while (from < this.#rows.length && layout.tops[from]! + layout.heights[from]! < scrolled - listRect.height) from++;
    let to = from;
    while (to < this.#rows.length && layout.tops[to]! < scrolled + listRect.height * 2) to++;
    this.#built = { from, to };
    b.scroll(LIST, listRect, layout.total, (inner) => {
      for (let index = from; index < to; index++) this.#drawRow(inner, this.#rows[index]!, index, layout);
    });
    if (sheet) this.#drawSheet(b, sheet, layout.width, layout.height, layout.phone);
    this.#mount(region, b);
  }

  /** The row whose sheet is open now, if it is still listed. */
  #sheetNow(): Extract<TrophyRow, { kind: "achievement" }> | null {
    const row = this.#rows.find((r) => r.kind === "achievement" && r.id === this.#open);
    return row?.kind === "achievement" ? row : null;
  }

  /** Hands the built parts to the panel (made once, so the list's scroll survives a redraw) and renders them now. */
  #mount(rect: Rect, b: SheetBuilder): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      this.#region = new DomRegion(this, element, rect);
    }
    const region = this.#region;
    region.setRect(rect);
    region.element.nodes = b.nodes;
    renderNow(region.element);
    const scroller = this.#scroller();
    if (scroller) {
      // The list comes back to where it was left (a redraw, or a visit's return from Stats).
      if (!this.#placed.has(scroller)) {
        scroller.scrollTop = this.#listTop;
        this.#placed.add(scroller);
        scroller.addEventListener(
          "scroll",
          () => {
            this.#listTop = scroller.scrollTop;
            this.#onListScroll();
          },
          { passive: true },
        );
      }
    }
  }

  /** The list scrolled: build again once the view nears the edge of the rows built, so what scrolls in is there. */
  #onListScroll(): void {
    if (this.#scrollFrame) return;
    this.#scrollFrame = requestAnimationFrame(() => {
      this.#scrollFrame = 0;
      const built = this.#built;
      const layout = this.#layout;
      if (!built || !layout || !this.#alive) return;
      const slack = layout.listRect.height / 2;
      const top = this.#listTop;
      const bottom = top + layout.listRect.height;
      const builtTop = layout.tops[built.from] ?? 0;
      const builtBottom = built.to < this.#rows.length ? layout.tops[built.to]! : layout.total;
      if ((built.from > 0 && top < builtTop + slack) || (built.to < this.#rows.length && bottom > builtBottom - slack))
        this.#paintPanel();
    });
  }

  /**
   * The filter bar, from `top`: the Filters button (the sort in force on it, Y on a pad) and Expand all / Collapse all
   * (R3) side by side, then, while the filters are open, the four sorts and the two directions as chips. Adds its
   * stops in reading order and returns where it ends.
   */
  #drawFilterBar(top: number, gutter: number, width: number, stops: Map<string, FocusStop>, order: string[]): number {
    const inner = width - gutter * 2;
    const h = hit.target;
    const expandWidth = Math.min(160, Math.floor(inner * 0.4));
    const filtersRect: Rect = { x: gutter, y: top, width: inner - expandWidth - BAR_GAP, height: h };
    // Not `drawFiltersControl`: its Y glyph is the pad's alone, and here the keyboard's Inspect key opens it too.
    const filters = new McButton(this, {
      kind: "secondary",
      label: `${this.#filtersOpen ? "▾" : "▸"} ${t("trophies.sortBy", { sort: trophySortLabel(this.#view) })}`,
      type: typeRole.rowTitle,
      rect: filtersRect,
      onClick: () => this.#toggleFilters(),
    });
    this.#buttons.push(filters);
    if (this.#open === null) this.#hints.button(filters, ["inspect"], "paper");
    stops.set("filters-toggle", { rect: filtersRect, activate: () => this.#toggleFilters() });
    order.push("filters-toggle");
    const expandRect: Rect = { x: filtersRect.x + filtersRect.width + BAR_GAP, y: top, width: expandWidth, height: h };
    const expand = new McButton(this, {
      kind: "secondary",
      label: t(this.#allExpanded() ? "trophies.collapseAll" : "trophies.expandAll"),
      type: typeRole.rowTitle,
      rect: expandRect,
      onClick: () => this.#expandAll(),
    });
    this.#buttons.push(expand);
    if (this.#open === null) this.#hints.button(expand, ["expand"], "paper");
    stops.set("expand-all", { rect: expandRect, activate: () => this.#expandAll() });
    order.push("expand-all");
    if (!this.#filtersOpen) return top + h;

    const sortRect: Rect = { x: gutter, y: top + h + BAR_GAP, width: inner, height: h };
    const sorts = trophySorts();
    drawChoiceRow(
      this,
      sortRect,
      sorts.map((sort) => ({
        id: sort.id,
        text: sort.label,
        selected: this.#view.sort === sort.id,
        onClick: () => this.#setSort(sort.id),
      })),
      "sort",
      this.#buttons,
      stops,
    );
    order.push(...sorts.map((sort) => `sort:${sort.id}`));
    const dirRect: Rect = { x: gutter, y: sortRect.y + h + BAR_GAP, width: inner, height: h };
    drawChoiceRow(
      this,
      dirRect,
      [
        {
          id: "asc",
          text: t("trophies.ascending"),
          selected: !this.#view.descending,
          onClick: () => this.#setDescending(false),
        },
        {
          id: "desc",
          text: t("trophies.descending"),
          selected: this.#view.descending,
          onClick: () => this.#setDescending(true),
        },
      ],
      "dir",
      this.#buttons,
      stops,
    );
    order.push("dir:asc", "dir:desc");
    return dirRect.y + h;
  }

  /** The sheet's words: the state line, as it reads. */
  #sheetFacts(row: Extract<TrophyRow, { kind: "achievement" }>): string {
    const earned = row.state === "earned";
    const facts = [`${earned ? "✓ " : ""}${row.stateLabel}`];
    if (row.reward) facts.push(row.reward);
    if (row.packName) facts.push(t("trophies.fromPack", { name: row.packName }));
    if (row.progress) facts.push(t("trophies.progress", { progress: row.progressLabel }));
    return facts.join("   ");
  }

  /** Where the sheet's panel and Close button sit, from the words' measured heights. */
  #sheetRects(
    row: Extract<TrophyRow, { kind: "achievement" }>,
    width: number,
    height: number,
    phone: boolean,
  ): {
    readonly panel: Rect;
    readonly close: Rect;
    readonly name: number;
    readonly state: number;
    readonly detail: number;
  } {
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    const panelW = Math.min(width - 24, 520);
    const pad = 20;
    const textW = panelW - pad * 2;
    const name = b.measure(row.name, bangers(phone ? 24 : 28), { wrapWidth: textW }).height;
    const state = b.measure(this.#sheetFacts(row), AS_WRITTEN_LABEL, { wrapWidth: textW }).height;
    const detail = b.measure(row.detail, typeRole.body, { size: 15, wrapWidth: textW }).height;
    const closeH = 48;
    const panelH = pad + name + 8 + state + 12 + detail + 18 + closeH + pad;
    const panel: Rect = {
      x: (width - panelW) / 2,
      y: Math.max(8, (height - panelH) / 2),
      width: panelW,
      height: panelH,
    };
    const close: Rect = {
      x: panel.x + (panel.width - 160) / 2,
      y: panel.y + panel.height - pad - closeH,
      width: 160,
      height: closeH,
    };
    return { panel, close, name, state, detail };
  }

  /** The sheet for one achievement: the whole line, unclipped, over a dimmed screen. */
  #drawSheet(
    b: SheetBuilder,
    row: Extract<TrophyRow, { kind: "achievement" }>,
    width: number,
    height: number,
    phone: boolean,
  ): void {
    const { panel, close, name, state } = this.#sheetRects(row, width, height, phone);
    const pad = 20;
    const textW = panel.width - pad * 2;
    b.box({ x: 0, y: 0, width, height }, { fill: surface.ink.hex, fillAlpha: 0.6 });
    // Outside tap target first (below the panel), so a tap on the dimmed ground closes the sheet.
    this.#press("sheet:outside", () => this.#closeSheet());
    b.tap("sheet:outside", { x: 0, y: 0, width, height });
    b.box(panel, { fill: surface.paper.hex, stroke: surface.ink.hex, strokeWidth: 3, key: "sheet" });
    b.text(panel.x + pad, panel.y + pad, row.name, bangers(phone ? 24 : 28), {
      color: surface.ink.hex,
      wrapWidth: textW,
    });
    const stateY = panel.y + pad + name + 8;
    b.text(panel.x + pad, stateY, this.#sheetFacts(row), AS_WRITTEN_LABEL, {
      color: surface.ink.hex,
      wrapWidth: textW,
    });
    b.text(panel.x + pad, stateY + state + 12, row.detail, typeRole.body, {
      size: 15,
      color: surface.ink.hex,
      wrapWidth: textW,
    });
    this.#glyphs.button(b, {
      key: "close",
      rect: close,
      label: t("trophies.close"),
      look: "primary",
      type: typeRole.menuButton,
      ids: ["cancel"],
      ground: "paper",
    });
    this.#press("close", () => this.#closeSheet());
  }

  #drawHeader(rect: Rect, header: TrophyHeader, phone: boolean): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    const pad = phone ? 12 : 18;
    const inner = rect.width - pad * 2;
    this.add
      .text(
        rect.x + pad,
        rect.y + 10,
        header.rankLabel.toUpperCase(),
        textStyle(typeRole.label, surface.paper.hex, 0.8),
      )
      .setLetterSpacing(1.1);
    const points = this.add
      .text(rect.x + rect.width - pad, rect.y + 10, header.pointsLabel.toUpperCase(), {
        ...textStyle(typeRole.label, surface.paper.hex, 1),
      })
      .setOrigin(1, 0)
      .setLetterSpacing(1.1);
    fitText(points, Math.max(80, inner * 0.55), typeRole.label.size);
    const title = this.add
      .text(
        rect.x + pad,
        rect.y + 28,
        header.title.toUpperCase(),
        textStyle(bangers(phone ? 26 : 34), surface.paper.hex),
      )
      .setLetterSpacing(1);
    fitText(title, inner, phone ? 26 : 34);

    // Next-rank caption over the bar: the number to go on the left, the earned count on the right.
    const captionY = rect.y + rect.height - (phone ? 46 : 42);
    const next = this.add.text(
      rect.x + pad,
      captionY,
      header.nextLabel,
      textStyle(typeRole.body, surface.paper.hex, 0.9),
    );
    next.setFontSize(12);
    {
      const earned = this.add
        .text(rect.x + rect.width - pad, captionY, header.earnedLabel, textStyle(typeRole.body, surface.paper.hex, 0.9))
        .setOrigin(1, 0)
        .setFontSize(12);
      fitText(next, inner - earned.width - 12, 12);
    }

    const track: Rect = { x: rect.x + pad, y: rect.y + rect.height - 24, width: inner, height: 12 };
    g.lineStyle(2, surface.paper.hex, 1).strokeRect(track.x, track.y, track.width, track.height);
    if (header.fraction > 0) {
      g.fillStyle(accent.heroRed.hex, 1).fillRect(
        track.x + 3,
        track.y + 3,
        Math.max(2, (track.width - 6) * header.fraction),
        track.height - 6,
      );
    }
  }

  /** One row's parts in the list's content space (`x` the screen's, `y` from the list's top). */
  #drawRow(b: SheetBuilder, row: TrophyRow, index: number, layout: ListLayout): void {
    const phone = layout.phone;
    const rect: Rect = {
      x: layout.listRect.x,
      y: layout.tops[index]!,
      width: layout.listRect.width,
      height: layout.heights[index]!,
    };
    const innerWidth = rect.width - GUTTER;
    const inkHex = surface.ink.hex;

    if (row.kind === "section") {
      // A folding heading over a rule: the chevron says whether the family is open, the count what is under it.
      b.sectionHeader(
        { x: rect.x, y: rect.y, width: innerWidth, height: rect.height - 2 },
        { heading: row.title.toUpperCase(), count: row.count, open: row.expanded, titleSize: phone ? 20 : 24 },
      );
      const key = keyOfRow(row);
      b.tap(key, { x: rect.x, y: rect.y, width: innerWidth, height: rect.height });
      this.#press(key, () => this.#toggleFamily(row.id));
      return;
    }

    if (row.kind === "group") {
      // A pack's heading inside Mods: its name and how many it has earned, under a thin rule. Not pressable.
      b.sectionHeader(
        { x: rect.x + 4, y: rect.y, width: innerWidth - 4, height: rect.height - 2 },
        { heading: t("trophies.fromPack", { name: row.title }).toUpperCase(), count: row.count, size: "small" },
      );
      return;
    }

    // Earned: solid ink card, paper text. Locked: parchment, outlined. Soon: parchment with a dashed-looking dim.
    const box: Rect = { x: rect.x, y: rect.y + 3, width: innerWidth, height: rect.height - 6 };
    const earned = row.state === "earned";
    const fg = earned ? surface.paper.hex : inkHex;
    const dim = row.state === "untracked" ? 0.6 : 1;
    b.box(box, { fill: earned ? inkHex : surface.parchment.hex });
    b.box(box, { stroke: inkHex, strokeWidth: border.detail, alpha: row.state === "untracked" ? 0.45 : 1 });

    // The state chip, top-right: a word and a mark, never a color alone.
    const chipLabel = `${earned ? "✓ " : ""}${row.stateLabel}`;
    const chipSize = b.measure(chipLabel, AS_WRITTEN_LABEL);
    const chipWidth = chipSize.width + 14;
    const chip: Rect = {
      x: box.x + box.width - 10 - chipWidth,
      y: box.y + 8,
      width: chipWidth,
      height: chipSize.height + 8,
    };
    if (earned) b.box(chip, { fill: surface.paper.hex });
    else b.box(chip, { stroke: inkHex, strokeWidth: 1.5, alpha: dim });
    b.text(chip.x + 7, chip.y + 4, chipLabel, AS_WRITTEN_LABEL, { color: earned ? inkHex : fg });

    const textWidth = box.width - 20 - chipWidth - 8;
    b.text(box.x + 12, box.y + 8, row.name, typeRole.rowTitle, {
      size: 15,
      color: fg,
      alpha: dim,
      fitWidth: textWidth,
    });
    b.text(box.x + 12, box.y + 30, row.detail, typeRole.body, {
      size: 12,
      color: fg,
      alpha: earned ? 0.85 : 0.75 * dim,
      wrapWidth: textWidth,
      maxLines: phone ? 3 : 2,
    });
    if (row.reward) {
      b.text(chip.x + chip.width, chip.y + chip.height + 6, row.reward, AS_WRITTEN_LABEL, {
        size: 11,
        color: fg,
        alpha: earned ? 0.9 : 0.8 * dim,
        origin: [1, 0],
        fitWidth: chipWidth + 60,
      });
    }
    if (row.progress) {
      const track: Rect = { x: box.x + 12, y: box.y + box.height - 18, width: textWidth - 54, height: 10 };
      b.box(track, { stroke: fg, strokeWidth: 1.5 });
      if (row.progress.fraction > 0) {
        b.box(
          {
            x: track.x + 2,
            y: track.y + 2,
            width: Math.max(2, (track.width - 4) * row.progress.fraction),
            height: track.height - 4,
          },
          { fill: accent.heroRed.hex },
        );
      }
      b.text(track.x + track.width + 8, track.y + track.height / 2, row.progressLabel, AS_WRITTEN_LABEL, {
        size: 11,
        color: fg,
        origin: [0, 0.5],
      });
    }
    const key = keyOfRow(row);
    b.tap(key, box);
    this.#press(key, () => {
      if (this.#open === null) this.#openSheet(row.id);
    });
  }
}

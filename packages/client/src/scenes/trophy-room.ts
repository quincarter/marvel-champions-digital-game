/**
 * The Trophy Room: every achievement (`progression/achievements.ts`, docs/achievements.md) in one scrolling list under
 * a header that shows the player's rank, lifetime points and the way to the next rank. Reached from Title and from
 * Extras; Back returns to Title.
 *
 * Read-only. Each family is a heading that folds and opens with a tap or A (#479); every one starts folded and the
 * room remembers which the player opened. A Filters bar under the header folds away too (Y on a pad): it sorts the
 * families and the achievements in them by category, completion, points or name, either way, and Expand all / Collapse
 * all (R3) opens or folds every family. A pad or keyboard walks the headings and achievement rows (each a focus stop,
 * the list follows the ring); A on an achievement opens it in a sheet that spells out the whole line, B closes it,
 * then B leaves. LB / RB jump between the headings. A tap on a row works through the list's own tap path (a drag or a
 * swipe that lifts over a row presses nothing).
 * Rows and wording come from `view/trophy-room-model.ts`; this scene draws them. State is a word as well as a look:
 * EARNED, LOCKED or SOON.
 */
import Phaser from "phaser";
import { accent, hit, ink, surface, typeRole } from "../tokens.js";
import { bangers, campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { onTap } from "../ui/tap.js";
import { McButton, fitText, fitWrapped } from "../ui/widgets.js";
import { rememberTrophyRoomView, trophyRoomView } from "../platform/trophy-room-view.js";
import { drawChoiceRow } from "./roster-panel.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { clipToView, familyTarget, pageTarget } from "../view/focus-list.js";
import { ListScroll } from "../view/list-scroll.js";
import type { Rect } from "../view/layout.js";
import {
  trophyHeaderOf,
  trophyRowHeightsOf,
  trophyRowsOf,
  trophySortLabel,
  TROPHY_SORTS,
  type TrophyHeader,
  type TrophyRow,
  type TrophySort,
  type TrophyView,
} from "../view/trophy-room-model.js";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_FAMILIES,
  achievementStatuses,
  type AchievementFamily,
} from "../progression/achievements.js";
import { achievementHistory, lifetimeChampionPoints, refreshUnlocks } from "../progression/progression.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

/** Room at each row's right edge for the list's own scrollbar. */
const GUTTER = 14;
/** Between the filter bar's rows. */
const BAR_GAP = 6;

/** An achievement's stop, by its id: the same achievement keeps it however the list folds or sorts. */
const keyOfAchievement = (id: string): string => `row:${id}`;

const keyOfRow = (row: TrophyRow): string => (row.kind === "section" ? `sec:${row.id}` : keyOfAchievement(row.id));

export class TrophyRoomScene extends Phaser.Scene {
  #buttons: McButton[] = [];
  #list: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  #alive = false;
  #hints!: GlyphHints;
  #rows: readonly TrophyRow[] = [];
  /** The achievement whose sheet is open (its id, so a redraw that re-sorts the list keeps it), or null. */
  #open: string | null = null;
  /** The row that had focus, to give it back when the sheet closes. */
  #lastRow: string | null = null;
  #listHeight = 0;
  /** The sheet was opened from the route (its row had focus), so closing it gives focus back; a tap leaves none. */
  #focusOnClose = false;
  /** Kept across redraws and visits (Phaser reuses this scene instance). */
  readonly #scroll = new ListScroll();
  /** The sort and the open families, read at each visit and saved on each change. */
  #view: TrophyView = trophyRoomView();
  /** The sort chips are showing; folded at each visit. */
  #filtersOpen = false;

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
    this.#hints = new GlyphHints(this);
    this.#route = new FocusRoute(this, {
      onCancel: () => (this.#open !== null ? this.#closeSheet() : this.#back()),
      onPage: (direction) => this.#pageFocus(direction),
      onTab: (direction) => this.#jumpFamily(direction),
      onHomeEnd: (edge) => {
        const all = this.#rowIndexes();
        this.#focusRow(edge === "home" ? all[0] : all.at(-1));
      },
      onScroll: (_dx, dy) => (this.#open === null ? this.#list?.scrollByPx(dy) : undefined),
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
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#hints.dispose();
      this.scale.off("resize", this.#draw, this);
      this.#destroyWidgets();
    });
    this.#draw();
    fadeScreenIn(this);
    // Saves may have changed since Boot read them (a game just won): read again, then redraw once.
    void refreshUnlocks()
      .catch(() => false)
      .then(() => this.#draw());
  }

  #back(): void {
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.title);
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
    const family = focused === null ? undefined : ACHIEVEMENTS.find((a) => keyOfAchievement(a.id) === focused)?.family;
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
    this.#list?.destroy();
    this.#list = null;
  }

  #draw(): void {
    if (!this.#alive) return;
    this.#destroyWidgets();
    destroyChildren(this);

    const frame = campaignFrame(this);
    const { width, height, phone, gutter } = frame;
    const statuses = achievementStatuses(achievementHistory());
    const header = trophyHeaderOf(lifetimeChampionPoints(), statuses);
    const rows = trophyRowsOf(statuses, this.#view);
    this.#rows = rows;
    this.#hints.reset();
    const heights = trophyRowHeightsOf(phone);
    const stops = new Map<string, FocusStop>();

    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    const bar = drawTopBar(this, {
      backLabel: phone ? "◂" : "◂ TITLE",
      onBack: () => this.#back(),
      hints: this.#open === null ? this.#hints : null,
      title: "Trophy Room",
      ...(phone ? {} : { right: header.earnedLabel }),
    });
    if (bar.back) this.#buttons.push(bar.back);
    if (bar.backRect) stops.set("back", { rect: bar.backRect, activate: () => this.#back() });

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
    const list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: heights.achievement,
      rowHeightOf: (index) => (rows[index]!.kind === "section" ? heights.section : heights.achievement),
      count: rows.length,
      scroll: this.#scroll,
      background: false,
      renderRow: (index, rect) => this.#renderRow(rows[index]!, rect, phone),
      onRowActivate: (index) => {
        if (this.#open !== null) return;
        const row = rows[index];
        if (row?.kind === "section") this.#toggleFamily(row.id);
        else if (row) this.#openSheet(row.id);
      },
    });
    this.#list = list;
    this.#listHeight = listRect.height;

    const order: string[] = [...(bar.backRect ? ["back"] : []), ...filterOrder];
    rows.forEach((row, index) => {
      const key = keyOfRow(row);
      order.push(key);
      stops.set(key, {
        rect: () => {
          // Clipped to the list, so the ring never floats over the header while a row is scrolled partly out.
          const r = list.rectFor(index);
          return clipToView({ ...r, width: r.width - GUTTER }, listRect);
        },
        activate: () => (row.kind === "section" ? this.#toggleFamily(row.id) : this.#openSheet(row.id)),
        ensureVisible: () => list.scrollIntoView(index),
      });
    });

    const sheetRow = rows.find((row) => row.kind === "achievement" && row.id === this.#open);
    if (!sheetRow) this.#open = null;
    if (sheetRow?.kind === "achievement") {
      const closeStop = this.#drawSheet(sheetRow, width, height, phone);
      this.#route?.set(["close"], new Map([["close", closeStop]]));
      this.#route?.focusKey("close");
    } else this.#route?.set(order, stops);
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
      label: `${this.#filtersOpen ? "▾" : "▸"} Sort: ${trophySortLabel(this.#view)}`,
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
      label: this.#allExpanded() ? "Collapse all" : "Expand all",
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
    drawChoiceRow(
      this,
      sortRect,
      TROPHY_SORTS.map((sort) => ({
        id: sort.id,
        text: sort.label,
        selected: this.#view.sort === sort.id,
        onClick: () => this.#setSort(sort.id),
      })),
      "sort",
      this.#buttons,
      stops,
    );
    order.push(...TROPHY_SORTS.map((sort) => `sort:${sort.id}`));
    const dirRect: Rect = { x: gutter, y: sortRect.y + h + BAR_GAP, width: inner, height: h };
    drawChoiceRow(
      this,
      dirRect,
      [
        { id: "asc", text: "Ascending ▲", selected: !this.#view.descending, onClick: () => this.#setDescending(false) },
        { id: "desc", text: "Descending ▼", selected: this.#view.descending, onClick: () => this.#setDescending(true) },
      ],
      "dir",
      this.#buttons,
      stops,
    );
    order.push("dir:asc", "dir:desc");
    return dirRect.y + h;
  }

  /** The sheet for one achievement: the whole line, unclipped. Returns its Close stop. */
  #drawSheet(
    row: Extract<TrophyRow, { kind: "achievement" }>,
    width: number,
    height: number,
    phone: boolean,
  ): FocusStop {
    const depth = 800;
    this.add.rectangle(0, 0, width, height, surface.ink.hex, 0.6).setOrigin(0, 0).setDepth(depth);
    const panelW = Math.min(width - 24, 520);
    const pad = 20;
    const textW = panelW - pad * 2;
    const earned = row.state === "earned";
    const facts = [`${earned ? "✓ " : ""}${row.stateLabel}`];
    if (row.reward) facts.push(row.reward);
    if (row.progress) facts.push(`Progress ${row.progressLabel}`);
    const name = this.add
      .text(0, 0, row.name, textStyle(bangers(phone ? 24 : 28), surface.ink.hex))
      .setWordWrapWidth(textW)
      .setDepth(depth + 1);
    const state = this.add
      .text(0, 0, facts.join("   "), textStyle(typeRole.label, surface.ink.hex, 1))
      .setWordWrapWidth(textW)
      .setDepth(depth + 1);
    const detail = this.add
      .text(0, 0, row.detail, textStyle(typeRole.body, surface.ink.hex, 1))
      .setFontSize(15)
      .setWordWrapWidth(textW)
      .setDepth(depth + 1);
    const closeH = 48;
    const panelH = pad + name.height + 8 + state.height + 12 + detail.height + 18 + closeH + pad;
    const panel: Rect = {
      x: (width - panelW) / 2,
      y: Math.max(8, (height - panelH) / 2),
      width: panelW,
      height: panelH,
    };
    // Outside tap target first (below the panel), so a tap on the dimmed ground closes the sheet.
    const outside = this.add
      .zone(0, 0, width, height)
      .setOrigin(0, 0)
      .setInteractive()
      .setDepth(depth + 0.2);
    onTap(outside, () => this.#closeSheet(), "trophy-sheet-outside");
    this.add
      .rectangle(panel.x, panel.y, panel.width, panel.height, surface.paper.hex)
      .setOrigin(0, 0)
      .setStrokeStyle(3, surface.ink.hex)
      .setInteractive()
      .setDepth(depth + 0.5);
    name.setPosition(panel.x + pad, panel.y + pad);
    state.setPosition(panel.x + pad, name.y + name.height + 8);
    detail.setPosition(panel.x + pad, state.y + state.height + 12);
    const closeRect: Rect = {
      x: panel.x + (panel.width - 160) / 2,
      y: panel.y + panel.height - pad - closeH,
      width: 160,
      height: closeH,
    };
    const close = new McButton(this, {
      kind: "primary",
      label: "Close",
      type: typeRole.menuButton,
      rect: closeRect,
      onClick: () => this.#closeSheet(),
    });
    close.container.setDepth(depth + 2);
    this.#buttons.push(close);
    this.#hints.button(close, ["cancel"], "paper");
    return { rect: closeRect, activate: () => this.#closeSheet() };
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
    if (phone) {
      const earned = this.add
        .text(rect.x + rect.width - pad, captionY, header.earnedLabel, textStyle(typeRole.body, surface.paper.hex, 0.9))
        .setOrigin(1, 0)
        .setFontSize(12);
      fitText(next, inner - earned.width - 12, 12);
    } else fitText(next, inner, 12);

    const track: Rect = { x: rect.x + pad, y: rect.y + rect.height - 24, width: inner, height: 12 };
    g.lineStyle(2, surface.paper.hex, 1).strokeRect(track.x, track.y, track.width, track.height);
    if (header.fraction > 0) {
      g.fillStyle(surface.paper.hex, 1).fillRect(
        track.x + 3,
        track.y + 3,
        Math.max(2, (track.width - 6) * header.fraction),
        track.height - 6,
      );
    }
  }

  #renderRow(row: TrophyRow, rect: Rect, phone: boolean): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const innerWidth = rect.width - GUTTER;

    if (row.kind === "section") {
      const g = this.add.graphics();
      g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y + rect.height - 4, innerWidth, 2);
      const title = this.add
        .text(
          rect.x,
          rect.y + rect.height - 12,
          // The chevron says whether the family is open; the count says what is under it.
          `${row.expanded ? "▾" : "▸"} ${row.title.toUpperCase()}`,
          textStyle(bangers(phone ? 20 : 24), surface.ink.hex),
        )
        .setOrigin(0, 1)
        .setLetterSpacing(1);
      fitText(title, innerWidth - 120, phone ? 20 : 24);
      const count = this.add
        .text(
          rect.x + innerWidth,
          rect.y + rect.height - 12,
          row.count,
          textStyle(typeRole.rowTitle, surface.ink.hex, ink.secondary),
        )
        .setOrigin(1, 1)
        .setFontSize(13);
      objects.push(g, title, count);
      return { objects };
    }

    // Earned: solid ink card, paper text. Locked: parchment, outlined. Soon: parchment with a dashed-looking dim.
    const box: Rect = { x: rect.x, y: rect.y + 3, width: innerWidth, height: rect.height - 6 };
    const earned = row.state === "earned";
    const fg = earned ? surface.paper.hex : surface.ink.hex;
    const dim = row.state === "untracked" ? 0.6 : 1;
    const g = this.add.graphics();
    g.fillStyle(earned ? surface.ink.hex : surface.parchment.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    g.lineStyle(2, surface.ink.hex, row.state === "untracked" ? 0.45 : 1).strokeRect(
      box.x + 1,
      box.y + 1,
      box.width - 2,
      box.height - 2,
    );
    objects.push(g);

    // The state chip, top-right: a word and a mark, never a color alone.
    const chipText = this.add
      .text(0, 0, `${earned ? "✓ " : ""}${row.stateLabel}`, textStyle(typeRole.label, earned ? surface.ink.hex : fg, 1))
      .setOrigin(0, 0);
    const chipWidth = chipText.width + 14;
    const chip: Rect = {
      x: box.x + box.width - 10 - chipWidth,
      y: box.y + 8,
      width: chipWidth,
      height: chipText.height + 8,
    };
    const chipG = this.add.graphics();
    if (earned) chipG.fillStyle(surface.paper.hex, 1).fillRect(chip.x, chip.y, chip.width, chip.height);
    else chipG.lineStyle(1.5, surface.ink.hex, dim).strokeRect(chip.x, chip.y, chip.width, chip.height);
    chipText.setPosition(chip.x + 7, chip.y + 4);
    objects.push(chipG, chipText);

    const textWidth = box.width - 20 - chipWidth - 8;
    const name = this.add.text(box.x + 12, box.y + 8, row.name, textStyle(typeRole.rowTitle, fg, dim)).setFontSize(15);
    fitText(name, textWidth, 15);
    objects.push(name);

    const detail = this.add.text(
      box.x + 12,
      box.y + 30,
      row.detail,
      textStyle(typeRole.body, fg, earned ? 0.85 : 0.75 * dim),
    );
    fitWrapped(detail, textWidth, phone ? 3 : 2, 12);
    objects.push(detail);

    if (row.reward) {
      const reward = this.add
        .text(
          chip.x + chip.width,
          chip.y + chip.height + 6,
          row.reward,
          textStyle(typeRole.label, fg, earned ? 0.9 : 0.8 * dim),
        )
        .setOrigin(1, 0)
        .setFontSize(11);
      fitText(reward, chipWidth + 60, 11);
      objects.push(reward);
    }

    if (row.progress) {
      const track: Rect = { x: box.x + 12, y: box.y + box.height - 18, width: textWidth - 54, height: 10 };
      const bar = this.add.graphics();
      bar.lineStyle(1.5, fg, 1).strokeRect(track.x, track.y, track.width, track.height);
      if (row.progress.fraction > 0) {
        bar
          .fillStyle(earned ? surface.paper.hex : accent.heroRed.hex, 1)
          .fillRect(track.x + 2, track.y + 2, Math.max(2, (track.width - 4) * row.progress.fraction), track.height - 4);
      }
      const count = this.add
        .text(
          track.x + track.width + 8,
          track.y + track.height / 2,
          row.progressLabel,
          textStyle(typeRole.label, fg, 1),
        )
        .setOrigin(0, 0.5)
        .setFontSize(11);
      objects.push(bar, count);
    }
    return { objects };
  }
}

/**
 * The Trophy Room: every achievement (`progression/achievements.ts`, docs/achievements.md) in one scrolling list under
 * a header that shows the player's rank, lifetime points and the way to the next rank. Reached from Title and from
 * Extras; Back returns to Title. "Your stats" at the top bar's right (X on a pad) opens the Stats screen
 * (`scenes/player-stats.ts`).
 *
 * Read-only. Each family is a heading that folds and opens with a tap or A (#479); every one starts folded and the
 * room remembers which the player opened. A Filters bar under the header folds away too (Y on a pad): it sorts the
 * families and the achievements in them by category, completion, points or name, either way, and Expand all / Collapse
 * all (R3) opens or folds every family. A pad or keyboard walks the headings and achievement cards (each a focus stop,
 * the list follows the ring); A on an achievement opens it in a sheet that spells out the whole line, B closes it,
 * then B leaves. LB / RB jump between the headings. A tap works through the elements' own tap (a drag or a swipe that
 * lifts over a card presses nothing). State is a word as well as a look: EARNED, LOCKED or SOON.
 *
 * **The screen is one custom element**, `mc-trophy-room-page` (`views/trophy-room/`), composing the sections in
 * `components/trophy-room/`: the rank header, the filters bar, the list of families and achievement cards, and the
 * achievement's sheet. Rows and wording come from `view/trophy-room-model.ts` (`trophy-room/trophy-room-page-model.ts`
 * builds the page's model); layout is the page's CSS. This scene mounts it, handles the `mc-trophy-room` events and keeps
 * what is a decision: the sort and the open families, the open sheet, the focus route (its ring drawn in the panel layer)
 * and navigation.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/trophy-room/mc-trophy-room-page/mc-trophy-room-page.js";
import type { TrophyRoomEventDetail } from "../components/trophy-room/shared/trophy-room-events.types.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { renderDeep } from "../dom/element-render.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { onLanguageChange } from "../language-change.js";
import { ACHIEVEMENTS, ACHIEVEMENT_FAMILIES, type AchievementFamily } from "../progression/achievements.js";
import { refreshUnlocks } from "../progression/progression.js";
import { rememberTrophyRoomView, trophyRoomView } from "../platform/trophy-room-view.js";
import { surface } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { familyTarget, pageTarget } from "../view/focus-list.js";
import type { TrophyRow, TrophySort, TrophyView } from "../view/trophy-room-model.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { PlayerStatsData } from "./player-stats.js";
import { allExpanded, buildTrophyRoomPage } from "./trophy-room/trophy-room-page-model.js";
import { keyOfAchievementRow, keyOfTrophyRow, trophyStopOrder } from "./trophy-room/trophy-room-keys.js";

/** An achievement's stop, by its id: the same achievement keeps it however the list folds or sorts. */
const keyOfAchievement = keyOfAchievementRow;

export class TrophyRoomScene extends Phaser.Scene {
  #mounted: MountedElement<HTMLElementTagNameMap["mc-trophy-room-page"]> | null = null;
  #route: FocusRoute | null = null;
  #alive = false;
  #glyphs!: ControlGlyphs;
  #rows: readonly TrophyRow[] = [];
  /** The achievement whose sheet is open (its id, so a redraw that re-sorts the list keeps it), or null. */
  #open: string | null = null;
  /** The row that had focus, to give it back when the sheet closes. */
  #lastRow: string | null = null;
  /** The sheet was opened from the route (its row had focus), so closing it gives focus back; a tap leaves none. */
  #focusOnClose = false;
  /** Kept across redraws and visits (Phaser reuses this scene instance): where the list was left. */
  #listTop = 0;
  /** The sort and the open families, read at each visit and saved on each change. */
  #view: TrophyView = trophyRoomView();
  /** The sort chips are showing; folded at each visit. */
  #filtersOpen = false;
  readonly #listened = new WeakSet<HTMLElement>();
  #stamp = 0;

  constructor() {
    super(SCENES.trophyRoom);
  }

  create(): void {
    this.#alive = true;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#open = null;
    this.#lastRow = null;
    this.#view = trophyRoomView();
    this.#filtersOpen = false;
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-trophy-room-page", { x: 0, y: 0, width, height });
    this.#mounted = mounted;
    mounted.element.addEventListener("mc-trophy-room", (event) => this.#heard(event.detail));
    this.#unbindStops = bindStopFocus(mounted.element, (key) => this.#route?.focusKey(key), { visibleOnly: true });
    this.#glyphs = new ControlGlyphs(this, () => this.#draw());
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
    this.scale.on("resize", this.#draw, this);
    const offLanguage = onLanguageChange(() => this.#draw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      offLanguage();
      this.#glyphs.dispose();
      this.scale.off("resize", this.#draw, this);
      this.#unbindStops?.();
      this.#unbindStops = null;
      // The page goes with the scene (`DomRegion`); the next visit makes a new one.
      this.#mounted = null;
    });
    this.#draw();
    // The words measured before the fonts were in: lay the bar out again once they are.
    void (typeof document === "undefined" ? undefined : document.fonts?.ready)?.then(() => {
      if (this.#alive) this.#draw();
    });
    fadeScreenIn(this);
    // Saves may have changed since Boot read them (a game just won): read again, then redraw once.
    void refreshUnlocks()
      .catch(() => false)
      .then(() => this.#draw());
  }

  #unbindStops: (() => void) | null = null;

  #scroller(): HTMLElement | null {
    return this.#mounted?.element.listScroller ?? null;
  }

  #heard(detail: TrophyRoomEventDetail): void {
    switch (detail.type) {
      case "back":
        return this.#back();
      case "stats":
        return this.#openStats();
      case "filters-toggle":
        return this.#toggleFilters();
      case "expand-all":
        return this.#expandAll();
      case "sort":
        return this.#setView({ ...this.#view, sort: detail.sort satisfies TrophySort });
      case "direction":
        return this.#setView({ ...this.#view, descending: detail.descending });
      case "family":
        return this.#toggleFamily(detail.id);
      case "achievement":
        if (this.#open === null) this.#openSheet(detail.id);
        return;
      case "close":
        return this.#closeSheet();
    }
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
    if (family !== undefined && !expanded.has(family))
      void this.#drawn().then(() => this.#route?.focusKey(`sec:${family}`));
  }

  #toggleFamily(id: AchievementFamily): void {
    const expanded = new Set(this.#view.expanded);
    if (!expanded.delete(id)) expanded.add(id);
    this.#setExpanded(expanded);
  }

  #expandAll(): void {
    this.#setExpanded(allExpanded(this.#view) ? new Set() : new Set(ACHIEVEMENT_FAMILIES.map((f) => f.id)));
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
    if (row && this.#open === null) this.#route?.focusKey(keyOfTrophyRow(row));
  }

  /** The list index of the focused stop, or null when focus is on the bar, Back or nowhere. */
  #focusedIndex(): number | null {
    const key = this.#route?.focused ?? null;
    const index = this.#rows.findIndex((row) => keyOfTrophyRow(row) === key);
    return index === -1 ? null : index;
  }

  /** PageUp / PageDown: focus moves a screenful of rows. */
  #pageFocus(direction: 1 | -1): void {
    if (this.#open !== null) return;
    const step = Math.max(1, Math.floor((this.#scroller()?.clientHeight || 300) / 70) - 1);
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
    void this.#drawn().then(() => {
      if (this.#focusOnClose && this.#lastRow) this.#route?.focusKey(this.#lastRow);
    });
  }

  #openSheet(id: string): void {
    const key = keyOfAchievement(id);
    this.#focusOnClose = this.#route?.focused === key;
    this.#lastRow = key;
    this.#open = id;
    this.#draw();
  }

  #drawing: Promise<void> = Promise.resolve();

  /** Resolves once the draw in flight has set the page and read its stops. */
  #drawn(): Promise<void> {
    return this.#drawing;
  }

  #draw(): void {
    this.#drawing = this.#render();
  }

  /** Sets the page from the achievements and the state, and reads its stops once it has drawn. */
  async #render(): Promise<void> {
    const mounted = this.#mounted;
    if (!this.#alive || !mounted) return;
    const { region, element } = mounted;
    const stamp = ++this.#stamp;
    const { width, height } = this.scale.gameSize;
    this.#glyphs.reset();
    const build = buildTrophyRoomPage({
      scene: this,
      view: this.#view,
      filtersOpen: this.#filtersOpen,
      openId: this.#open,
      glyphs: this.#glyphs,
    });
    this.#glyphs.settled();
    this.#rows = build.rows;
    if (!build.sheetRow) this.#open = null;
    region.setRect({ x: 0, y: 0, width, height });
    element.model = build.model;
    await renderDeep(element);
    if (stamp !== this.#stamp || !this.#alive) return;
    this.#placeList(element.listScroller);
    this.#syncStops(build.sheetRow !== null);
  }

  /** The list comes back to where it was left (a redraw, or a visit's return from Stats). */
  #placeList(scroller: HTMLElement | null): void {
    if (!scroller || this.#listened.has(scroller)) return;
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

  /** The route's stops, read from the rendered page: the bar, the filters, the rows (or, with a sheet up, only its Close). */
  #syncStops(sheetOpen: boolean): void {
    const mounted = this.#mounted;
    const route = this.#route;
    if (!mounted || !route) return;
    const { region, element } = mounted;
    const stops = new Map<string, FocusStop>(focusStopsOf(element, (target) => region.rectOf(target)));
    if (sheetOpen) {
      route.set(["close"], stops);
      route.focusKey("close");
      return;
    }
    route.set(trophyStopOrder(this.#rows, this.#filtersOpen, [...stops.keys()]), stops);
  }
}

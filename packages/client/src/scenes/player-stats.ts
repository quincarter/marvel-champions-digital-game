/**
 * Stats: what the player's finished games say about how they play (`view/player-stats-model.ts`). Reached from the
 * Trophy Room (X on a pad); Back returns there.
 *
 * Read-only. A record header, then one scrolling list of sections (Overview, Heroes, Villains, Side schemes, and one
 * per hero for their cards) that fold and open with a tap or A; the Overview starts open, and the screen remembers what
 * the player opened until the app closes. Expand all / Collapse all (R3) opens or folds them all, LB / RB jump between
 * the headings, and a pad or keyboard walks every row (the list follows the ring). A tap works through the list's own
 * tap path, so a swipe that lifts over a heading presses nothing. A row about one card opens the card hover popover
 * under a resting mouse.
 *
 * The rows are folded in a worker (`view/player-stats-client.ts`), from the saves' rows this scene reads when it opens.
 */
import Phaser from "phaser";
import { accent, hit, ink, surface, typeRole } from "../tokens.js";
import { bangers, campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { McButton, fitText, fitWrapped } from "../ui/widgets.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { clipToView, familyTarget, pageTarget } from "../view/focus-list.js";
import { ListScroll } from "../view/list-scroll.js";
import type { Rect } from "../view/layout.js";
import { loadPlayerStats } from "../view/player-stats-client.js";
import {
  DEFAULT_OPEN_SECTIONS,
  statsListOf,
  statsRowHeightsOf,
  type PlayerStats,
  type StatsHeader,
  type StatsListRow,
} from "../view/player-stats-model.js";
import { appSession } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

/** Room at each row's right edge for the list's own scrollbar. */
const GUTTER = 14;

const keyOfRow = (row: StatsListRow): string => (row.kind === "section" ? `sec:${row.id}` : `row:${row.id}`);

/** The sections the player opened, kept while the app runs (Phaser reuses the scene; this outlives it too). */
let openSections: ReadonlySet<string> = DEFAULT_OPEN_SECTIONS;

export class PlayerStatsScene extends Phaser.Scene {
  #buttons: McButton[] = [];
  #list: McVirtualList | null = null;
  #listRect: Rect | null = null;
  #route: FocusRoute | null = null;
  #hover: HoverPreview | null = null;
  #alive = false;
  #hints!: GlyphHints;
  #stats: PlayerStats | null = null;
  #failed = false;
  #rows: readonly StatsListRow[] = [];
  #listHeight = 0;
  readonly #scroll = new ListScroll();

  constructor() {
    super(SCENES.playerStats);
  }

  create(): void {
    this.#alive = true;
    this.#stats = null;
    this.#failed = false;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    this.#hints = new GlyphHints(this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCardIds(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    this.#route = new FocusRoute(this, {
      onCancel: () => this.#back(),
      onPage: (direction) => this.#pageFocus(direction),
      onTab: (direction) => this.#jumpSection(direction),
      onHomeEnd: (edge) => this.#focusRow(edge === "home" ? 0 : this.#rows.length - 1),
      onScroll: (_dx, dy) => this.#list?.scrollByPx(dy),
      onExpand: () => this.#expandAll(),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#hints.dispose();
      this.#hover?.destroy();
      this.#hover = null;
      this.scale.off("resize", this.#draw, this);
      this.#destroyWidgets();
    });
    this.#draw();
    fadeScreenIn(this);
    void appSession()
      .store.listSaves()
      .then((saves) => loadPlayerStats(saves))
      .then(
        (stats) => {
          this.#stats = stats;
        },
        () => {
          this.#failed = true;
        },
      )
      .then(() => this.#draw());
  }

  #back(): void {
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.trophyRoom);
  }

  #setOpen(next: ReadonlySet<string>): void {
    const focused = this.#route?.focused ?? null;
    const section = this.#rows.find((row) => keyOfRow(row) === focused);
    openSections = next;
    this.#draw();
    // A focused row folded away hands focus to its section's heading.
    if (section && section.kind !== "section" && !next.has(section.sectionId)) {
      this.#route?.focusKey(`sec:${section.sectionId}`);
    }
  }

  #toggleSection(id: string): void {
    const next = new Set(openSections);
    if (!next.delete(id)) next.add(id);
    this.#setOpen(next);
  }

  #allOpen(): boolean {
    return (this.#stats?.sections ?? []).every((section) => openSections.has(section.id));
  }

  #expandAll(): void {
    const ids = (this.#stats?.sections ?? []).map((section) => section.id);
    this.#setOpen(this.#allOpen() ? new Set() : new Set(ids));
  }

  #focusRow(index: number | undefined): void {
    const row = index === undefined ? undefined : this.#rows[index];
    if (row) this.#route?.focusKey(keyOfRow(row));
  }

  #focusedIndex(): number | null {
    const key = this.#route?.focused ?? null;
    const index = this.#rows.findIndex((row) => keyOfRow(row) === key);
    return index === -1 ? null : index;
  }

  #pageFocus(direction: 1 | -1): void {
    const step = Math.max(1, Math.floor((this.#listHeight || 300) / 60) - 1);
    this.#focusRow(
      pageTarget(
        this.#rows.map((_, index) => index),
        this.#focusedIndex(),
        direction,
        step,
      ),
    );
  }

  /** LB / RB: the next section's heading; back, this section's heading, then the previous. */
  #jumpSection(direction: 1 | -1): void {
    const headings: number[] = [];
    this.#rows.forEach((row, index) => {
      if (row.kind === "section") headings.push(index);
    });
    this.#focusRow(familyTarget(headings, this.#focusedIndex(), direction));
  }

  /** The card rows on screen now, each clipped to the list. */
  #hoverCardIds(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const list = this.#list;
    const view = this.#listRect;
    if (!list || !view) return found;
    this.#rows.forEach((row, index) => {
      if (row.kind !== "stat" || !row.cardId) return;
      const r = list.rectFor(index);
      const shown = clipHoverRect({ ...r, width: r.width - GUTTER }, view);
      // `through`: the list takes taps by position, so no row is an interactive object of its own.
      if (shown) found.set(hoverSlotOf(row.cardId, index), { ...shown, cardId: row.cardId, through: true });
    });
    return found;
  }

  #destroyWidgets(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#list?.destroy();
    this.#list = null;
    this.#listRect = null;
  }

  #draw(): void {
    if (!this.#alive) return;
    this.#destroyWidgets();
    destroyChildren(this);

    const frame = campaignFrame(this);
    const { width, height, phone, gutter } = frame;
    const stats = this.#stats;
    this.#hints.reset();
    const stops = new Map<string, FocusStop>();

    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    const bar = drawTopBar(this, {
      backLabel: phone ? "◂" : "◂ TROPHIES",
      onBack: () => this.#back(),
      hints: this.#hints,
      title: "Your stats",
      ...(phone || !stats ? {} : { right: stats.header.played }),
    });
    if (bar.back) this.#buttons.push(bar.back);
    if (bar.backRect) stops.set("back", { rect: bar.backRect, activate: () => this.#back() });
    const order: string[] = bar.backRect ? ["back"] : [];

    if (!stats) {
      this.#rows = [];
      this.add
        .text(
          width / 2,
          bar.height + 80,
          this.#failed ? "Your games could not be read." : "Reading your games…",
          textStyle(typeRole.body, surface.ink.hex, ink.secondary),
        )
        .setOrigin(0.5, 0);
      this.#route?.set(order, stops);
      return;
    }

    const headerRect: Rect = { x: gutter, y: bar.height + 12, width: width - gutter * 2, height: phone ? 108 : 104 };
    this.#drawHeader(headerRect, stats.header, phone);

    const expandRect: Rect = {
      x: gutter + headerRect.width - Math.min(180, headerRect.width),
      y: headerRect.y + headerRect.height + 10,
      width: Math.min(180, headerRect.width),
      height: hit.target,
    };
    const expand = new McButton(this, {
      kind: "secondary",
      label: this.#allOpen() ? "Collapse all" : "Expand all",
      type: typeRole.rowTitle,
      rect: expandRect,
      onClick: () => this.#expandAll(),
    });
    this.#buttons.push(expand);
    this.#hints.button(expand, ["expand"], "paper");
    stops.set("expand-all", { rect: expandRect, activate: () => this.#expandAll() });
    order.push("expand-all");

    const rows = statsListOf(stats, openSections);
    this.#rows = rows;
    const heights = statsRowHeightsOf(phone);
    const heightOf = (row: StatsListRow): number =>
      row.kind === "section" ? heights.section : row.kind === "note" ? heights.note : heights.stat;
    const listTop = expandRect.y + expandRect.height + 8;
    const listRect: Rect = {
      x: gutter,
      y: listTop,
      width: width - gutter * 2,
      height: Math.max(60, height - listTop - gutter),
    };
    const list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: heights.stat,
      rowHeightOf: (index) => heightOf(rows[index]!),
      count: rows.length,
      scroll: this.#scroll,
      background: false,
      renderRow: (index, rect) => this.#renderRow(rows[index]!, rect, phone),
      onRowActivate: (index) => {
        const row = rows[index];
        if (row?.kind === "section") this.#toggleSection(row.id);
      },
    });
    this.#list = list;
    this.#listRect = listRect;
    this.#listHeight = listRect.height;

    rows.forEach((row, index) => {
      const key = keyOfRow(row);
      order.push(key);
      stops.set(key, {
        rect: () => {
          const r = list.rectFor(index);
          return clipToView({ ...r, width: r.width - GUTTER }, listRect);
        },
        activate: () => (row.kind === "section" ? this.#toggleSection(row.id) : undefined),
        ensureVisible: () => list.scrollIntoView(index),
      });
    });
    this.#route?.set(order, stops);
    this.#hover?.onDraw();
  }

  #drawHeader(rect: Rect, header: StatsHeader, phone: boolean): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    const pad = phone ? 12 : 18;
    const inner = rect.width - pad * 2;
    this.add
      .text(rect.x + pad, rect.y + 10, "WINS–LOSSES", textStyle(typeRole.label, surface.paper.hex, 0.8))
      .setLetterSpacing(1.1);
    const rate = this.add
      .text(
        rect.x + rect.width - pad,
        rect.y + 10,
        header.rate.toUpperCase(),
        textStyle(typeRole.label, surface.paper.hex, 1),
      )
      .setOrigin(1, 0)
      .setLetterSpacing(1.1);
    fitText(rate, Math.max(80, inner * 0.5), typeRole.label.size);
    const record = this.add
      .text(rect.x + pad, rect.y + 26, header.record, textStyle(bangers(phone ? 30 : 36), surface.paper.hex))
      .setLetterSpacing(1);
    fitText(record, inner * 0.5, phone ? 30 : 36);
    const streak = this.add
      .text(rect.x + rect.width - pad, rect.y + 34, header.streak, textStyle(typeRole.body, surface.paper.hex, 0.9))
      .setOrigin(1, 0)
      .setFontSize(12);
    fitText(streak, inner * 0.5, 12);

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

  #renderRow(row: StatsListRow, rect: Rect, phone: boolean): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const innerWidth = rect.width - GUTTER;

    if (row.kind === "section") {
      const g = this.add.graphics();
      g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y + rect.height - 4, innerWidth, 2);
      const title = this.add
        .text(
          rect.x,
          rect.y + rect.height - 12,
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

    if (row.kind === "note") {
      const text = this.add.text(
        rect.x + 4,
        rect.y + 10,
        row.text,
        textStyle(typeRole.label, surface.ink.hex, ink.secondary),
      );
      fitWrapped(text, innerWidth - 8, 2, 11);
      objects.push(text);
      return { objects };
    }

    // A headline fact is solid ink with paper text; every other row is parchment, outlined.
    const box: Rect = { x: rect.x, y: rect.y + 3, width: innerWidth, height: rect.height - 6 };
    const filled = row.highlight === true;
    const fg = filled ? surface.paper.hex : surface.ink.hex;
    const g = this.add.graphics();
    g.fillStyle(filled ? surface.ink.hex : surface.parchment.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(box.x + 1, box.y + 1, box.width - 2, box.height - 2);
    objects.push(g);

    const value = this.add
      .text(box.x + box.width - 12, box.y + 8, row.value, textStyle(typeRole.rowTitle, fg, 1))
      .setOrigin(1, 0)
      .setFontSize(15);
    fitText(value, box.width * 0.45, 15);
    const textWidth = box.width - 24 - value.width - 12;
    const label = this.add.text(box.x + 12, box.y + 8, row.label, textStyle(typeRole.rowTitle, fg, 1)).setFontSize(15);
    fitText(label, textWidth, 15);
    objects.push(value, label);
    if (row.detail) {
      const detail = this.add.text(
        box.x + 12,
        box.y + 30,
        row.detail,
        textStyle(typeRole.body, fg, filled ? 0.85 : 0.75),
      );
      fitWrapped(detail, box.width - 24, phone ? 2 : 1, 12);
      objects.push(detail);
    }
    return { objects };
  }
}

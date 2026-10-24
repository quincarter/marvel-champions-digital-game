/**
 * The Trophy Room: every achievement (`progression/achievements.ts`, docs/achievements.md) in one scrolling list under
 * a header that shows the player's rank, lifetime points and the way to the next rank. Reached from Title and from
 * Extras; Back returns to Title.
 *
 * Read-only. A pad or keyboard walks the achievement rows (each a focus stop, the list follows the ring); A opens one
 * in a sheet that spells out the whole line, B closes it, then B leaves. LB / RB jump between the families. A tap on a
 * row opens the same sheet through the list's own tap path (a drag or a swipe that lifts over a row opens nothing).
 * Rows and wording come from `view/trophy-room-model.ts`; this scene draws them. State is a word as well as a look:
 * EARNED, LOCKED or SOON.
 */
import Phaser from "phaser";
import { accent, ink, surface, typeRole } from "../tokens.js";
import { bangers, campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { onTap } from "../ui/tap.js";
import { McButton, fitText, fitWrapped } from "../ui/widgets.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { ListScroll } from "../view/list-scroll.js";
import type { Rect } from "../view/layout.js";
import {
  trophyHeaderOf,
  trophyRowHeightsOf,
  trophyRowsOf,
  type TrophyHeader,
  type TrophyRow,
} from "../view/trophy-room-model.js";
import { achievementStatuses } from "../progression/achievements.js";
import { achievementHistory, lifetimeChampionPoints, refreshUnlocks } from "../progression/progression.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

/** Room at each row's right edge for the list's own scrollbar. */
const GUTTER = 14;

export class TrophyRoomScene extends Phaser.Scene {
  #buttons: McButton[] = [];
  #list: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  #alive = false;
  #hints!: GlyphHints;
  #rows: readonly TrophyRow[] = [];
  /** The achievement row whose sheet is open, or null. */
  #open: number | null = null;
  /** The row that had focus, to give it back when the sheet closes. */
  #lastRow: string | null = null;
  #listHeight = 0;
  /** Kept across redraws and visits (Phaser reuses this scene instance). */
  readonly #scroll = new ListScroll();

  constructor() {
    super(SCENES.trophyRoom);
  }

  create(): void {
    this.#alive = true;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    this.#open = null;
    this.#lastRow = null;
    this.#hints = new GlyphHints(this);
    this.#route = new FocusRoute(this, {
      onCancel: () => (this.#open !== null ? this.#closeSheet() : this.#back()),
      onPage: (direction) => this.#pageFocus(direction),
      onTab: (direction) => this.#jumpFamily(direction),
      onHomeEnd: (edge) => {
        const all = this.#achievementIndexes();
        this.#focusRow(edge === "home" ? all[0] : all.at(-1));
      },
      onScroll: (_dx, dy) => this.#list?.scrollByPx(dy),
      onFocusChange: (key) => {
        if (key?.startsWith("row:")) this.#lastRow = key;
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

  #achievementIndexes(): number[] {
    const out: number[] = [];
    this.#rows.forEach((row, index) => {
      if (row.kind === "achievement") out.push(index);
    });
    return out;
  }

  #focusRow(index: number | undefined): void {
    if (index !== undefined && this.#open === null) this.#route?.focusKey(`row:${index}`);
  }

  /** The row index of the focused stop, or null when focus is on Back or nowhere. */
  #focusedIndex(): number | null {
    const key = this.#route?.focused;
    return key?.startsWith("row:") ? Number(key.slice(4)) : null;
  }

  /** PageUp / PageDown: focus moves a screenful of rows. */
  #pageFocus(direction: 1 | -1): void {
    if (this.#open !== null) return;
    const all = this.#achievementIndexes();
    const at = this.#focusedIndex();
    const here = at === null ? (direction === 1 ? -1 : all.length) : all.indexOf(at);
    const step = Math.max(1, Math.floor((this.#listHeight || 300) / 70) - 1);
    this.#focusRow(all[Math.min(all.length - 1, Math.max(0, here + direction * step))]);
  }

  /** LB / RB: the first row of the next family; back, the start of this one, then the previous. */
  #jumpFamily(direction: 1 | -1): void {
    if (this.#open !== null) return;
    const starts = this.#achievementIndexes().filter((i) => this.#rows[i - 1]?.kind === "section");
    const at = this.#focusedIndex() ?? -1;
    if (direction === 1) this.#focusRow(starts.find((i) => i > at) ?? starts.at(-1));
    else this.#focusRow([...starts].reverse().find((i) => i < at) ?? starts[0]);
  }

  #closeSheet(): void {
    this.#open = null;
    this.#draw();
    if (this.#lastRow) this.#route?.focusKey(this.#lastRow);
  }

  #openSheet(index: number): void {
    if (this.#rows[index]?.kind !== "achievement") return;
    this.#lastRow = `row:${index}`;
    this.#open = index;
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
    const rows = trophyRowsOf(statuses);
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

    const listTop = headerRect.y + headerRect.height + 12;
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
      onRowActivate: (index) => (this.#open === null ? this.#openSheet(index) : undefined),
    });
    this.#list = list;
    this.#listHeight = listRect.height;

    const order: string[] = bar.backRect ? ["back"] : [];
    rows.forEach((row, index) => {
      if (row.kind !== "achievement") return;
      const key = `row:${index}`;
      order.push(key);
      stops.set(key, {
        rect: () => {
          // Clipped to the list, so the ring never floats over the header while a row is scrolled partly out.
          const r = list.rectFor(index);
          const top = Math.max(r.y, listRect.y);
          const bottom = Math.min(r.y + r.height, listRect.y + listRect.height);
          return { x: r.x, y: top, width: r.width - GUTTER, height: Math.max(1, bottom - top) };
        },
        activate: () => this.#openSheet(index),
        ensureVisible: () => list.scrollIntoView(index),
      });
    });

    if (this.#open !== null) {
      const row = rows[this.#open] as Extract<TrophyRow, { kind: "achievement" }>;
      const closeStop = this.#drawSheet(row, width, height, phone);
      this.#route?.set(["close"], new Map([["close", closeStop]]));
      this.#route?.focusKey("close");
    } else this.#route?.set(order, stops);
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
          row.title.toUpperCase(),
          textStyle(bangers(phone ? 20 : 24), surface.ink.hex),
        )
        .setOrigin(0, 1)
        .setLetterSpacing(1);
      fitText(title, innerWidth - 70, phone ? 20 : 24);
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

/**
 * Art & Credits: the fan-project notice and then who made the card scans, art, comics, music and tools, in one
 * scrolling list (`content/credits.ts`, worded and ordered by `view/credits-model.ts`). Reached from Extras; Back
 * returns there.
 *
 * Read-only: no row is a control and no web address opens from here, so a swipe that ends over a row can fire
 * nothing (CLAUDE.md, no tap on finger lift); the only presses are the top bar's Back and the list's own scrolling.
 * An entry whose artist or source the repo does not record says so in its credit line, in words.
 */
import Phaser from "phaser";
import { ink, surface, typeRole } from "../tokens.js";
import { bangers, campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, fitText } from "../ui/widgets.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { ListScroll } from "../view/list-scroll.js";
import type { Rect } from "../view/layout.js";
import {
  CREDITS_TEXT,
  creditsRowHeightOf,
  creditsRowsOf,
  shownInLabelOf,
  type CreditsRow,
} from "../view/credits-model.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

/** Room at each row's right edge for the list's own scrollbar. */
const GUTTER = 14;
const PAD = 12;

export class CreditsScene extends Phaser.Scene {
  #buttons: McButton[] = [];
  #list: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  #alive = false;
  /** Kept across redraws and visits (Phaser reuses this scene instance). */
  readonly #scroll = new ListScroll();

  constructor() {
    super(SCENES.credits);
  }

  create(): void {
    this.#alive = true;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    this.#route = new FocusRoute(this, {
      onCancel: () => this.#back(),
      onPage: (direction) => this.#list?.scrollByPage(direction),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#draw, this);
      this.#destroyWidgets();
    });
    this.#draw();
    fadeScreenIn(this);
  }

  #back(): void {
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.extras);
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
    const rows = creditsRowsOf();
    const stops = new Map<string, FocusStop>();

    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    const bar = drawTopBar(this, {
      backLabel: phone ? "◂" : "◂ EXTRAS",
      onBack: () => this.#back(),
      title: "Art & Credits",
    });
    if (bar.back) this.#buttons.push(bar.back);
    if (bar.backRect) stops.set("back", { rect: bar.backRect, activate: () => this.#back() });

    const listTop = bar.height + 12;
    const listRect: Rect = {
      x: gutter,
      y: listTop,
      width: width - gutter * 2,
      height: Math.max(60, height - listTop - gutter),
    };
    // Entries wrap inside the box, clear of the scrollbar gutter and the box padding.
    const textWidth = listRect.width - GUTTER - PAD * 2;
    this.#list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: 120,
      rowHeightOf: (index) => creditsRowHeightOf(rows[index]!, textWidth),
      count: rows.length,
      scroll: this.#scroll,
      background: false,
      renderRow: (index, rect) => this.#renderRow(rows[index]!, rect, textWidth, phone),
    });

    this.#route?.set(bar.backRect ? ["back"] : [], stops);
  }

  #renderRow(row: CreditsRow, rect: Rect, textWidth: number, phone: boolean): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const innerWidth = rect.width - GUTTER;
    const wrapped = (
      x: number,
      y: number,
      text: string,
      size: number,
      alpha = 1,
      color: number = surface.ink.hex,
    ): Phaser.GameObjects.Text => {
      const t = this.add
        .text(x, y, text, textStyle(typeRole.body, color, alpha))
        .setFontSize(size)
        .setWordWrapWidth(textWidth, true)
        .setLineSpacing(size * 0.4 - 4);
      objects.push(t);
      return t;
    };

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
      fitText(title, innerWidth - 40, phone ? 20 : 24);
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

    const box: Rect = { x: rect.x, y: rect.y + 3, width: innerWidth, height: rect.height - 6 };
    const g = this.add.graphics();
    objects.push(g);
    if (row.kind === "notice") {
      g.fillStyle(surface.ink.hex, 1).fillRect(box.x, box.y, box.width, box.height);
      wrapped(box.x + PAD, box.y + 8, row.text, CREDITS_TEXT.notice, 1, surface.paper.hex);
      return { objects };
    }

    const { entry } = row;
    g.fillStyle(surface.parchment.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(box.x + 1, box.y + 1, box.width - 2, box.height - 2);
    let y = box.y + 8;
    const place = (text: string, size: number, alpha: number, bold = false): void => {
      const t = wrapped(box.x + PAD, y, text, size, alpha);
      if (bold) t.setStyle({ ...textStyle(typeRole.rowTitle, surface.ink.hex, alpha) }).setFontSize(size);
      t.setWordWrapWidth(textWidth, true);
      y += t.height + 2;
    };
    place(entry.title, CREDITS_TEXT.title, 1, true);
    place(shownInLabelOf(entry), CREDITS_TEXT.small, 0.75);
    place(entry.credit, CREDITS_TEXT.body, 0.95);
    place(entry.notice, CREDITS_TEXT.small, 0.75);
    if (entry.url) place(entry.url, CREDITS_TEXT.small, 0.75);
    return { objects };
  }
}

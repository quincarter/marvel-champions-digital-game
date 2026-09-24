/**
 * The Extras reader: one rulebook as plain text (`content/books.ts`, parsed by `view/book-model.ts`). A contents
 * list with a search field, the open section's text, ◂ PREV / NEXT ▸ through the book, and a button per PDF that
 * opens the repo's copy of the original.
 *
 * Wide screens show the contents beside the text; a phone shows one at a time (the contents first, a section once
 * one is picked, "☰ CONTENTS" to go back). Back returns to Extras' Rulebooks tab.
 */
import Phaser from "phaser";
import { accent, ink, surface, typeRole } from "../tokens.js";
import { bangers, campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTextInput, fitText } from "../ui/widgets.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { ListScroll } from "../view/list-scroll.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import type { Rect } from "../view/layout.js";
import { searchBook, type BookBlock, type BookSection } from "../view/book-model.js";
import { REPO_FILE_URL, bookById, loadBook, type BookSpec } from "../content/books.js";
import { openExternal } from "../platform/platform.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { ExtrasSceneData } from "./extras.js";

export interface ExtrasReaderData {
  readonly bookId: string;
}

/** Contents beside the text from this width up. */
const SIDE_BY_SIDE_MIN = 820;
const TOC_WIDTH = 300;
const TOC_ROW = 40;
const TOOLBAR = 44;
const NAV_BAR = 56;

export class ExtrasReaderScene extends Phaser.Scene {
  #book: BookSpec | null = null;
  #sections: readonly BookSection[] | null = null;
  #failed = false;
  #current = 0;
  #query = "";
  /** A phone's single pane: the contents, or the open section. */
  #pane: "toc" | "section" = "toc";
  #alive = false;
  #buttons: McButton[] = [];
  #search: McTextInput | null = null;
  #toc: McVirtualList | null = null;
  #region: McScrollRegion | null = null;
  #route: FocusRoute | null = null;
  readonly #tocScroll = new ListScroll();
  readonly #textScroll = new VariableListScroll();

  constructor() {
    super(SCENES.extrasReader);
  }

  create(data: ExtrasReaderData): void {
    this.#book = bookById(data.bookId) ?? null;
    this.#sections = null;
    this.#failed = false;
    this.#current = 0;
    this.#query = "";
    this.#pane = "toc";
    this.#alive = true;
    this.#tocScroll.reset();
    this.#textScroll.reset();
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    this.#route = new FocusRoute(this, {
      blocked: () => this.#search?.focused ?? false,
      onCancel: () => this.#back(),
      onPage: (direction) => this.#region?.scrollByPx(direction * 320),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#draw, this);
      this.#destroyWidgets();
      this.#search?.destroy();
      this.#search = null;
    });
    this.#draw();
    fadeScreenIn(this);
    const book = this.#book;
    if (!book) return;
    loadBook(book)
      .then((sections) => {
        this.#sections = sections;
        this.#draw();
      })
      .catch(() => {
        this.#failed = true;
        this.#draw();
      });
  }

  #back(): void {
    if (this.#pane === "section" && !this.#sideBySide()) {
      this.#pane = "toc";
      this.#draw();
      return;
    }
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.extras, { tab: "books" } satisfies ExtrasSceneData);
  }

  #sideBySide(): boolean {
    return this.scale.gameSize.width >= SIDE_BY_SIDE_MIN;
  }

  #open(index: number): void {
    const total = this.#sections?.length ?? 0;
    if (total === 0) return;
    this.#current = Math.max(0, Math.min(total - 1, index));
    this.#pane = "section";
    this.#textScroll.reset();
    this.#draw();
  }

  #onQuery(value: string): void {
    this.#query = value;
    this.#tocScroll.reset();
    this.#draw();
  }

  #destroyWidgets(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#toc?.destroy();
    this.#toc = null;
    this.#region?.destroy();
    this.#region = null;
  }

  #draw(): void {
    if (!this.#alive) return;
    this.#destroyWidgets();
    const kept = this.#search ? [this.#search.gameObject] : [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);

    const { width, height, gutter } = campaignFrame(this);
    const book = this.#book;
    const sections = this.#sections;
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];

    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    const wide = this.#sideBySide();
    const showToc = wide || this.#pane === "toc";
    const showText = wide || this.#pane === "section";
    const bar = drawTopBar(this, {
      backLabel: wide ? "◂ EXTRAS" : "◂",
      onBack: () => this.#back(),
      title: book?.title ?? "Rulebook",
      ...(sections && sections.length > 0 && showText ? { right: `${this.#current + 1} / ${sections.length}` } : {}),
    });
    if (bar.back) this.#buttons.push(bar.back);
    if (bar.backRect) {
      stops.set("back", { rect: bar.backRect, activate: () => this.#back() });
      order.push("back");
    }

    const bodyTop = bar.height;
    const tocRect: Rect = wide
      ? { x: 0, y: bodyTop, width: TOC_WIDTH, height: height - bodyTop }
      : { x: 0, y: bodyTop, width, height: height - bodyTop };
    const textRect: Rect = wide
      ? { x: TOC_WIDTH, y: bodyTop, width: width - TOC_WIDTH, height: height - bodyTop }
      : { x: 0, y: bodyTop, width, height: height - bodyTop };

    if (!book || this.#failed || !sections) {
      this.#search?.setVisible(false);
      const message = !book ? "That book isn't in this build." : this.#failed ? "Couldn't load this book." : "Loading…";
      this.add
        .text(gutter, bodyTop + 24, message, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setFontSize(15);
      this.#route?.set(order, stops);
      return;
    }

    if (showToc) this.#drawContents(book, sections, tocRect, wide, stops, order);
    else this.#search?.setVisible(false);
    if (showText) this.#drawSection(book, sections, textRect, wide, stops, order);
    this.#route?.set(order, stops);
  }

  #drawContents(
    book: BookSpec,
    sections: readonly BookSection[],
    rect: Rect,
    wide: boolean,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const pad = 12;
    this.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.parchment.hex).setOrigin(0, 0);
    if (wide) this.add.rectangle(rect.x + rect.width - 2, rect.y, 2, rect.height, surface.ink.hex).setOrigin(0, 0);

    let y = rect.y + pad;
    const searchRect: Rect = { x: rect.x + pad, y, width: rect.width - pad * 2 - (wide ? 2 : 0), height: TOOLBAR - 8 };
    if (this.#search) {
      this.#search.layout(searchRect);
      this.#search.setVisible(true);
    } else {
      this.#search = new McTextInput(this, {
        rect: searchRect,
        value: this.#query,
        placeholder: "Search this book…",
        type: typeRole.body,
        onChange: (value) => this.#onQuery(value),
      });
    }
    stops.set("search", { rect: searchRect, activate: () => this.#search?.focus() });
    order.push("search");
    y += searchRect.height + 10;

    // A phone has no toolbar beside the text, so the PDF buttons sit here, under the search.
    if (!wide && book.pdfs.length > 0) {
      y = this.#drawPdfButtons(book, { x: rect.x + pad, y, width: rect.width - pad * 2, height: 36 }, stops, order);
      y += 10;
    }

    const matches = searchBook(sections, this.#query);
    const listRect: Rect = {
      x: rect.x + 4,
      y,
      width: rect.width - 8 - (wide ? 2 : 0),
      height: rect.y + rect.height - y,
    };
    if (matches.length === 0) {
      this.add
        .text(
          rect.x + pad,
          y + 4,
          "No section mentions that.",
          textStyle(typeRole.body, surface.ink.hex, ink.secondary),
        )
        .setFontSize(13);
      return;
    }
    let toc: McVirtualList;
    const current = this.#current;
    toc = new McVirtualList(this, {
      rect: listRect,
      rowHeight: TOC_ROW,
      count: matches.length,
      scroll: this.#tocScroll,
      background: false,
      renderRow: (row, rowRect) => this.#tocRow(sections[matches[row]!]!, rowRect, matches[row] === current && wide),
      onRowActivate: (row) => this.#open(matches[row]!),
    });
    this.#toc = toc;
    matches.forEach((index, row) => {
      const id = `toc:${index}`;
      stops.set(id, {
        rect: () => toc.rectFor(row),
        activate: () => this.#open(index),
        ensureVisible: () => toc.scrollIntoView(row),
      });
      order.push(id);
    });
  }

  #tocRow(section: BookSection, rect: Rect, selected: boolean): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics();
    if (selected) g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y + 2, rect.width - 10, rect.height - 4);
    g.fillStyle(surface.ink.hex, 0.12).fillRect(rect.x + 8, rect.y + rect.height - 1, rect.width - 26, 1);
    objects.push(g);
    const title = this.add
      .text(
        rect.x + 10,
        rect.y + rect.height / 2,
        section.title,
        textStyle(typeRole.rowTitle, selected ? surface.paper.hex : surface.ink.hex),
      )
      .setOrigin(0, 0.5)
      .setFontSize(13);
    fitText(title, rect.width - 30, 13);
    objects.push(title);
    return { objects };
  }

  /** One button per PDF, side by side; returns the y under them. */
  #drawPdfButtons(book: BookSpec, rect: Rect, stops: Map<string, FocusStop>, order: string[]): number {
    const gap = 8;
    const each = (rect.width - gap * (book.pdfs.length - 1)) / book.pdfs.length;
    book.pdfs.forEach((pdf, index) => {
      const buttonRect: Rect = { x: rect.x + index * (each + gap), y: rect.y, width: each, height: rect.height };
      const open = (): void => openExternal(REPO_FILE_URL(pdf.path));
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: `${pdf.label} ↗`,
          type: typeRole.label,
          rect: buttonRect,
          onClick: open,
        }),
      );
      stops.set(`pdf:${index}`, { rect: buttonRect, activate: open });
      order.push(`pdf:${index}`);
    });
    return rect.y + rect.height;
  }

  #drawSection(
    book: BookSpec,
    sections: readonly BookSection[],
    rect: Rect,
    wide: boolean,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const section = sections[this.#current];
    if (!section) return;
    const pad = wide ? 28 : 16;
    let top = rect.y;

    if (!wide) {
      const tocRect: Rect = { x: rect.x + pad, y: top + 8, width: 150, height: 36 };
      const toContents = (): void => this.#back();
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: "☰ CONTENTS",
          type: typeRole.label,
          rect: tocRect,
          onClick: toContents,
        }),
      );
      stops.set("contents", { rect: tocRect, activate: toContents });
      order.push("contents");
      top += 52;
    } else if (book.pdfs.length > 0) {
      const width = Math.min(rect.width - pad * 2, 220 * book.pdfs.length);
      this.#drawPdfButtons(
        book,
        { x: rect.x + rect.width - pad - width, y: top + 10, width, height: 36 },
        stops,
        order,
      );
      top += 56;
    }

    // ◂ PREV / NEXT ▸ at the foot, through the whole book whatever the search shows.
    const navY = rect.y + rect.height - NAV_BAR;
    this.add.rectangle(rect.x, navY, rect.width, NAV_BAR, surface.ink.hex).setOrigin(0, 0);
    const navWidth = Math.min(180, (rect.width - pad * 3) / 2);
    const prevRect: Rect = { x: rect.x + pad, y: navY + 8, width: navWidth, height: NAV_BAR - 16 };
    const nextRect: Rect = {
      x: rect.x + rect.width - pad - navWidth,
      y: navY + 8,
      width: navWidth,
      height: NAV_BAR - 16,
    };
    const prev = (): void => this.#open(this.#current - 1);
    const next = (): void => this.#open(this.#current + 1);
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "◂ PREV",
        type: typeRole.label,
        rect: prevRect,
        enabled: this.#current > 0,
        onClick: prev,
      }),
      new McButton(this, {
        kind: "onInk",
        label: "NEXT ▸",
        type: typeRole.label,
        rect: nextRect,
        enabled: this.#current < sections.length - 1,
        onClick: next,
      }),
    );
    stops.set("prev", { rect: prevRect, activate: prev });
    stops.set("next", { rect: nextRect, activate: next });

    const textRect: Rect = { x: rect.x + pad, y: top, width: rect.width - pad * 2, height: navY - top - 8 };
    const before = this.children.list.length;
    const bottom = this.#drawBlocks(section, textRect);
    const drawn = this.children.list.slice(before);
    this.#region = new McScrollRegion(this, {
      rect: textRect,
      heights: [Math.max(1, bottom - textRect.y + 24)],
      scroll: this.#textScroll,
    });
    this.#region.content.add(drawn);
    order.push("prev", "next");
  }

  /** The section's title and blocks, top to bottom from `rect.y`; returns the y under the last one. */
  #drawBlocks(section: BookSection, rect: Rect): number {
    const width = Math.max(120, rect.width - 12);
    let y = rect.y + 8;
    const title = this.add
      .text(rect.x, y, section.title.toUpperCase(), textStyle(bangers(26, 1), surface.ink.hex))
      .setWordWrapWidth(width);
    y += title.height + 6;
    this.add.rectangle(rect.x, y, Math.min(width, 120), 3, accent.heroRed.hex).setOrigin(0, 0);
    y += 16;
    for (const block of section.blocks) y = this.#drawBlock(block, rect.x, y, width) + 10;
    return y;
  }

  #drawBlock(block: BookBlock, x: number, y: number, width: number): number {
    const body = (text: string, left: number, alpha = 0.92) =>
      this.add
        .text(left, y, text, textStyle(typeRole.body, surface.ink.hex, alpha))
        .setFontSize(15)
        .setLineSpacing(4)
        .setWordWrapWidth(Math.max(80, width - (left - x)));
    switch (block.kind) {
      case "heading": {
        const heading = this.add
          .text(x, y + 6, block.text, textStyle(typeRole.sectionHeader, surface.ink.hex))
          .setWordWrapWidth(width);
        return heading.y + heading.height;
      }
      case "paragraph":
        return y + body(block.text, x).height;
      case "bullet": {
        const left = x + 14 + block.depth * 18;
        this.add
          .text(left - 14, y, block.depth > 0 ? "–" : "•", textStyle(typeRole.body, accent.heroRed.hex))
          .setFontSize(15);
        return y + body(block.text, left).height;
      }
      case "quote": {
        const text = this.add
          .text(x + 16, y + 8, block.text, {
            ...textStyle(typeRole.body, surface.ink.hex, 0.85),
            fontStyle: "italic",
          })
          .setFontSize(14)
          .setLineSpacing(3)
          .setWordWrapWidth(Math.max(80, width - 28));
        const box = this.add.graphics();
        box.fillStyle(surface.parchment.hex, 1).fillRect(x, y, width, text.height + 16);
        box.fillStyle(accent.heroRed.hex, 1).fillRect(x, y, 4, text.height + 16);
        // Behind the text it frames.
        this.children.moveBelow(box as unknown as Phaser.GameObjects.GameObject, text);
        return y + text.height + 16;
      }
    }
  }
}

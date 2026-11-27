/**
 * The Extras reader: one rulebook as plain text (`content/books.ts`, parsed by `view/book-model.ts`). A contents
 * list with a search field, the open section's text, ◂ PREV / NEXT ▸ through the book, and a button per PDF that
 * opens the repo's copy of the original. A page that is all art (a cover, a comic page) shows the box's own picture
 * of it (`art/campaigns/<id>/rulebook/`), fitted to the reading area, fetched the first time it is opened.
 *
 * Wide screens show the contents beside the text; a phone shows one at a time (the contents first, a section once
 * one is picked, "☰ CONTENTS" to go back). Back returns to Extras' Rulebooks tab.
 *
 * **One Lit panel over the canvas** (`mc-sheet`, `dom/sheet-builder.ts`, as `scenes/extras.ts` is): the ink top bar
 * (`dom/sheet-top-bar.ts`), the contents with a real `<input>` search (`mc-search-field`) and its scrolling list, and
 * the section as an `mc-article` that wraps and scrolls natively, so no block is measured here. Matching stays in
 * `view/book-model.ts#searchBook` (accent-free, forgiving of a typo in a title). The scene keeps the focus route (ring
 * drawn in the DOM, `dom/dom-ring.ts`: A or Enter on the search stop puts the caret in the field, B or Esc takes it
 * out, then backs out), navigation and loading the book.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McArticle, McArticleBlock, McSearchDetail, McSearchField, McSheet } from "@mc/ui";
import { CAMPAIGN_ART, campaignRulebookPageFor } from "../art/campaign-art.js";
import { surface, typeRole } from "../tokens.js";
import { campaignFrame } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { cssOf } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import type { Rect } from "../view/layout.js";
import { searchBook, type BookBlock, type BookSection } from "../view/book-model.js";
import { REPO_FILE_URL, bookById, loadBook, type BookSpec } from "../content/books.js";
import { openExternal } from "../platform/platform.js";
import { inputDevice } from "../platform/input-device.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { sheetTopBar } from "../dom/sheet-top-bar.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
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
/** The scrolling keys in the panel. */
const TOC = "toc";
const TEXT = "reader-text";
const SEARCH = "search";

/** A book block as the article draws it: an illustration becomes the page picture (or the conversion's note). */
function articleBlockOf(book: BookSpec, block: BookBlock): McArticleBlock {
  if (block.kind !== "illustration") return block;
  const picture =
    book.pageArtId && block.page !== null ? campaignRulebookPageFor(CAMPAIGN_ART, book.pageArtId, block.page) : null;
  return { kind: "picture", src: picture?.url ?? null, fallback: block.text };
}

export class ExtrasReaderScene extends Phaser.Scene {
  #book: BookSpec | null = null;
  #sections: readonly BookSection[] | null = null;
  #failed = false;
  #current = 0;
  #query = "";
  /** A phone's single pane: the contents, or the open section. */
  #pane: "toc" | "section" = "toc";
  #alive = false;
  #route: FocusRoute | null = null;
  #glyphs!: SheetGlyphs;
  /** The screen, one Lit panel over the canvas; made on the first draw and kept, so the search keeps its caret. */
  #region: DomRegion<McSheet> | null = null;
  #actions = new Map<string, () => void>();
  /** True while the caret is in the search field (the route stands aside). */
  #searchFocused = false;
  /** The contents list or the text starts from its top on the next draw (a new query, a new section). */
  #tocFromTop = true;
  /** The text pane shown last, to tell a new section from a redraw. */
  #shownSection = -1;

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
    this.#region = null;
    this.#searchFocused = false;
    this.#tocFromTop = true;
    this.#shownSection = -1;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    const offLanguage = onLanguageChange(() => this.#draw());
    this.#glyphs = new SheetGlyphs(this, () => this.#draw());
    // Before the route: A, B or Start takes the caret out of the search field.
    bindTextFieldEscape(this, () => ({ focused: this.#searchFocused, blur: () => this.#field()?.blurInput() }));
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#searchFocused,
      onCancel: () => this.#back(),
      // LB / RB read the previous or next section.
      onTab: (direction) => {
        const total = this.#sections?.length ?? 0;
        const showing = this.#sideBySide() || this.#pane === "section";
        if (total > 0 && showing && this.#current + direction >= 0 && this.#current + direction < total)
          this.#open(this.#current + direction);
      },
      onPage: (direction) => this.#textScroller()?.scrollBy({ top: direction * 320 }),
      onScroll: (_dx, dy) => this.#textScroller()?.scrollBy({ top: dy }),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#draw, this);
      offLanguage();
      this.#glyphs.dispose();
      // The panel goes with the scene (`DomRegion`); the next open makes a new one.
      this.#region = null;
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

  #field(): McSearchField | null {
    return (this.#region?.element.elementOf(SEARCH) as McSearchField | null) ?? null;
  }

  #textScroller(): HTMLElement | null {
    return (this.#region?.element.elementOf(TEXT) as McArticle | null)?.scroller ?? null;
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
    this.#draw();
  }

  #onQuery(value: string): void {
    if (value === this.#query) return;
    this.#query = value;
    this.#tocFromTop = true;
    this.#draw();
  }

  #draw(): void {
    if (!this.#alive) return;
    destroyChildren(this);
    this.#actions = new Map();
    this.#glyphs.reset();

    const frame = campaignFrame(this);
    const { width, height, gutter } = frame;
    const book = this.#book;
    const sections = this.#sections;
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);

    // The ground under the panel too: the chrome buttons' holes in the panel (the dark mode toggle) show the canvas.
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    this.add.rectangle(0, 0, width, frame.topBar, surface.ink.hex).setOrigin(0, 0);
    b.box({ x: 0, y: 0, width, height }, { fill: surface.paper.hex });
    const wide = this.#sideBySide();
    const showToc = wide || this.#pane === "toc";
    const showText = wide || this.#pane === "section";
    const bar = sheetTopBar(b, this.#glyphs, {
      frame,
      backLabel: wide ? t("reader.back") : "◂",
      title: book?.title ?? t("reader.rulebook"),
      ...(sections && sections.length > 0 && showText ? { right: `${this.#current + 1} / ${sections.length}` } : {}),
    });
    if (bar.backRect) {
      this.#actions.set("back", () => this.#back());
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
      const message = !book ? t("reader.noBook") : this.#failed ? t("reader.failed") : t("reader.loading");
      b.text(gutter, bodyTop + 24, message, typeRole.body, { size: 15, color: surface.ink.hex, alpha: 0.75 });
      this.#mount(width, height, b);
      this.#route?.set(order, stops);
      return;
    }

    if (showToc) this.#drawContents(b, book, sections, tocRect, wide, stops, order);
    if (showText) this.#drawSection(b, book, sections, textRect, wide, stops, order);
    this.#mount(width, height, b);
    this.#route?.set(order, stops);
  }

  /** Hands the built parts to the panel (made once, so the search keeps its caret) and renders them now. */
  #mount(width: number, height: number, builder: SheetBuilder): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      element.addEventListener("mc-search", (event) => {
        this.#onQuery((event as CustomEvent<McSearchDetail>).detail.value);
      });
      element.addEventListener("mc-search-focus", (event) => {
        this.#searchFocused = (event as CustomEvent<{ focused: boolean }>).detail.focused;
      });
      this.#region = new DomRegion(this, element, { x: 0, y: 0, width, height });
    }
    const region = this.#region;
    region.setRect({ x: 0, y: 0, width, height });
    region.element.nodes = builder.nodes;
    renderNow(region.element);
    if (this.#tocFromTop) {
      const toc = region.element.elementOf(TOC);
      if (toc) {
        toc.scrollTop = 0;
        this.#tocFromTop = false;
      }
    }
    // A new section reads from its top; a redraw of the same one keeps the place.
    const shown = this.#pane === "section" || this.#sideBySide() ? this.#current : -1;
    if (shown !== this.#shownSection) {
      const text = this.#textScroller();
      if (text) text.scrollTop = 0;
      this.#shownSection = shown;
    }
  }

  /** A stop inside the contents list: its box is read off the panel, so it follows the scroll. */
  #tocStop(key: string, activate: () => void): FocusStop {
    const region = (): DomRegion<McSheet> | null => this.#region;
    return {
      rect: () => {
        const found = region()?.element.elementOf(key);
        return found ? region()!.rectOf(found) : { x: 0, y: 0, width: 0, height: 0 };
      },
      view: () => {
        const found = region()?.element.elementOf(TOC);
        return found ? region()!.rectOf(found) : { x: 0, y: 0, width: 0, height: 0 };
      },
      activate,
      ensureVisible: () => region()?.element.elementOf(key)?.scrollIntoView({ block: "nearest" }),
    };
  }

  #drawContents(
    b: SheetBuilder,
    book: BookSpec,
    sections: readonly BookSection[],
    rect: Rect,
    wide: boolean,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const pad = 12;
    b.box(rect, { fill: surface.parchment.hex });
    if (wide)
      b.box({ x: rect.x + rect.width - 2, y: rect.y, width: 2, height: rect.height }, { fill: surface.ink.hex });

    let y = rect.y + pad;
    const searchRect: Rect = { x: rect.x + pad, y, width: rect.width - pad * 2 - (wide ? 2 : 0), height: TOOLBAR - 8 };
    const steam = inputDevice().mode === "pad" && inputDevice().pad?.steam === true;
    b.search(searchRect, {
      key: SEARCH,
      value: this.#query,
      placeholder: t("reader.search"),
      clearLabel: t("reader.clear"),
      ...(steam ? { focusPlaceholder: t("reader.steamKeyboard") } : {}),
    });
    stops.set(SEARCH, { rect: searchRect, activate: () => this.#field()?.focusInput() });
    order.push(SEARCH);
    y += searchRect.height + 10;

    // A phone has no toolbar beside the text, so the PDF buttons sit here, under the search.
    if (!wide && book.pdfs.length > 0) {
      y = this.#drawPdfButtons(b, book, { x: rect.x + pad, y, width: rect.width - pad * 2, height: 36 }, stops, order);
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
      b.emptyState({ x: rect.x + pad, y: y + 4 }, t("reader.noMatch"), { size: 13 });
      return;
    }
    const current = this.#current;
    b.scroll(TOC, listRect, matches.length * TOC_ROW, (inner) => {
      matches.forEach((index, row) => {
        const rowRect: Rect = { x: listRect.x, y: row * TOC_ROW, width: listRect.width, height: TOC_ROW };
        const selected = index === current && wide;
        if (selected)
          inner.box(
            { x: rowRect.x, y: rowRect.y + 2, width: rowRect.width - 10, height: rowRect.height - 4 },
            { fill: surface.ink.hex },
          );
        inner.box(
          { x: rowRect.x + 8, y: rowRect.y + rowRect.height - 1, width: rowRect.width - 26, height: 1 },
          {
            fill: surface.ink.hex,
            fillAlpha: 0.12,
          },
        );
        inner.text(rowRect.x + 10, rowRect.y + rowRect.height / 2, sections[index]!.title, typeRole.rowTitle, {
          size: 13,
          color: selected ? surface.paper.hex : surface.ink.hex,
          origin: [0, 0.5],
          fitWidth: rowRect.width - 30,
        });
        const id = `toc:${index}`;
        inner.tap(id, rowRect);
        this.#actions.set(id, () => this.#open(index));
        stops.set(
          id,
          this.#tocStop(id, () => this.#open(index)),
        );
        order.push(id);
      });
    });
  }

  /** One button per PDF, side by side; returns the y under them. */
  #drawPdfButtons(b: SheetBuilder, book: BookSpec, rect: Rect, stops: Map<string, FocusStop>, order: string[]): number {
    const gap = 8;
    const each = (rect.width - gap * (book.pdfs.length - 1)) / book.pdfs.length;
    book.pdfs.forEach((pdf, index) => {
      const buttonRect: Rect = { x: rect.x + index * (each + gap), y: rect.y, width: each, height: rect.height };
      const open = (): void => openExternal(REPO_FILE_URL(pdf.path));
      b.button({
        key: `pdf:${index}`,
        rect: buttonRect,
        label: `${pdf.label} ↗`,
        look: "secondary",
        type: typeRole.label,
      });
      this.#actions.set(`pdf:${index}`, open);
      stops.set(`pdf:${index}`, { rect: buttonRect, activate: open });
      order.push(`pdf:${index}`);
    });
    return rect.y + rect.height;
  }

  #drawSection(
    b: SheetBuilder,
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
      const contentsRect: Rect = { x: rect.x + pad, y: top + 8, width: 150, height: 36 };
      const toContents = (): void => this.#back();
      b.button({
        key: "contents",
        rect: contentsRect,
        label: t("reader.contents"),
        look: "secondary",
        type: typeRole.label,
      });
      this.#actions.set("contents", toContents);
      stops.set("contents", { rect: contentsRect, activate: toContents });
      order.push("contents");
      top += 52;
    } else if (book.pdfs.length > 0) {
      const width = Math.min(rect.width - pad * 2, 220 * book.pdfs.length);
      this.#drawPdfButtons(
        b,
        book,
        { x: rect.x + rect.width - pad - width, y: top + 10, width, height: 36 },
        stops,
        order,
      );
      top += 56;
    }

    // ◂ PREV / NEXT ▸ at the foot, through the whole book whatever the search shows.
    const navY = rect.y + rect.height - NAV_BAR;
    b.box({ x: rect.x, y: navY, width: rect.width, height: NAV_BAR }, { fill: surface.ink.hex });
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
    const atStart = this.#current <= 0;
    const atEnd = this.#current >= sections.length - 1;
    b.button({
      key: "prev",
      rect: prevRect,
      label: t("reader.prev"),
      look: "onInk",
      type: typeRole.label,
      ...(atStart ? { disabled: true as const } : {}),
    });
    b.button({
      key: "next",
      rect: nextRect,
      label: t("reader.next"),
      look: "onInk",
      type: typeRole.label,
      ...(atEnd ? { disabled: true as const } : {}),
    });
    this.#actions.set("prev", prev);
    this.#actions.set("next", next);
    stops.set("prev", { rect: prevRect, activate: prev });
    stops.set("next", { rect: nextRect, activate: next });

    // The text itself: one native scroller, so a long section wraps and scrolls without being measured here.
    const article: Rect = { x: rect.x + pad, y: top, width: rect.width - pad * 2, height: navY - top - 8 };
    b.article(article, {
      key: TEXT,
      model: { title: section.title, blocks: section.blocks.map((block) => articleBlockOf(book, block)) },
      pictureMax: Math.max(240, article.height - 100),
      pad: 0,
    });
    order.push("prev", "next");
  }
}

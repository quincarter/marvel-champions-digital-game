/**
 * The Extras reader: one rulebook as plain text (`content/books.ts`, parsed by `view/book-model.ts`). A contents list with
 * a search field, the open section's text, PREV / NEXT through the book, and a button per PDF that opens the repo's copy
 * of the original. A page that is all art (a cover, a comic page) shows the box's own picture of it
 * (`art/campaigns/<id>/rulebook/`), fitted to the reading area, fetched the first time it is opened.
 *
 * Wide screens show the contents beside the text; a phone shows one at a time (the contents first, a section once one is
 * picked, "CONTENTS" to go back). Back returns to Extras' Rulebooks tab.
 *
 * **The whole screen is one page element**, `mc-reader-page` (`views/reader/`), made of the shared `mc-reader` frame
 * (`@mc/ui`) and the section elements of `components/reader/`. This scene only mounts it, sets its model
 * (`scenes/extras-reader/page-model.ts`; the matching stays `view/book-model.ts#searchBook`, accent-free and forgiving of a
 * typo in a title) and handles its `mc-reader` events. It keeps the focus route (the page's `data-stop` parts, read by
 * `dom/element-stops.ts`: A or Enter on the search stop puts the caret in the field, B or Esc takes it out, then backs
 * out), navigation and loading the book.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/reader/mc-reader-page/mc-reader-page.js";
import { surface } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { campaignFrame } from "../ui/campaign-chrome.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { REPO_FILE_URL, bookById, loadBook, type BookSpec } from "../content/books.js";
import type { BookSection } from "../view/book-model.js";
import { openExternal } from "../platform/platform.js";
import { inputDevice } from "../platform/input-device.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { settleElements } from "../dom/element-settle.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { hintGlyphOf } from "../dom/hint-glyph.js";
import type { ReaderEventDetail } from "../components/reader/shared/reader-events.types.js";
import { onLanguageChange } from "../language-change.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { readerPageModelOf } from "./extras-reader/page-model.js";
import { SCENES } from "./keys.js";
import type { ExtrasSceneData } from "./extras.js";

export interface ExtrasReaderData {
  readonly bookId: string;
}

/** Contents beside the text from this width up. */
const SIDE_BY_SIDE_MIN = 820;
const BACK_HEIGHT = 44;

type Page = MountedElement<HTMLElementTagNameMap["mc-reader-page"]>;

export class ExtrasReaderScene extends Phaser.Scene {
  #book: BookSpec | null = null;
  #sections: readonly BookSection[] | null = null;
  #failed = false;
  #current = 0;
  #query = "";
  /** A phone's single pane: the contents, or the open section. */
  #pane: "toc" | "text" = "toc";
  #alive = false;
  #leaving = false;
  #route: FocusRoute | null = null;
  #page: Page | null = null;
  #glyphs!: ControlGlyphs;
  #unbind: (() => void) | null = null;
  /** True while the caret is in the search field (the route stands aside). */
  #searchFocused = false;
  /** The contents list or the text starts from its top on the next draw (a new query, a new section). */
  #tocFromTop = true;
  /** The text pane shown last, to tell a new section from a redraw. */
  #shownSection = -1;
  #drawn = 0;

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
    this.#leaving = false;
    this.#page = null;
    this.#searchFocused = false;
    this.#tocFromTop = true;
    this.#shownSection = -1;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#compose, this);
    const offLanguage = onLanguageChange(() => this.#compose());
    this.#glyphs = new ControlGlyphs(this, () => this.#compose());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#compose, this);
      offLanguage();
      this.#unbind?.();
      this.#unbind = null;
      this.#glyphs.dispose();
      this.#page = null;
    });
    this.#mount();
    // Before the route: A, B or Start takes the caret out of the search field.
    bindTextFieldEscape(this, () => ({
      focused: this.#searchFocused,
      blur: () => this.#page?.element.searchField?.blurInput(),
    }));
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#searchFocused,
      onCancel: () => this.#back(),
      // LB / RB read the previous or next section.
      onTab: (direction) => {
        const total = this.#sections?.length ?? 0;
        const showing = this.#sideBySide() || this.#pane === "text";
        if (total > 0 && showing && this.#current + direction >= 0 && this.#current + direction < total)
          this.#open(this.#current + direction);
      },
      onPage: (direction) => this.#page?.element.textScroller?.scrollBy({ top: direction * 320 }),
      onScroll: (_dx, dy) => this.#page?.element.textScroller?.scrollBy({ top: dy }),
    });
    this.#compose();
    fadeScreenIn(this);
    const book = this.#book;
    if (!book) return;
    loadBook(book)
      .then((sections) => {
        this.#sections = sections;
        this.#compose();
      })
      .catch(() => {
        this.#failed = true;
        this.#compose();
      });
  }

  /** Mounts the page once, so the search keeps its caret across a redraw, and wires what it says. */
  #mount(): void {
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-reader-page", { x: 0, y: 0, width, height });
    this.#page = mounted;
    mounted.element.addEventListener("mc-reader", (event) => this.#heard(event.detail));
    this.#unbind = bindStopFocus(mounted.element, (key) => this.#route?.focusKey(key));
  }

  /** The page said something (a tap, or the focus route's click on a stop). */
  #heard(detail: ReaderEventDetail): void {
    if (this.#leaving) return;
    switch (detail.type) {
      case "back":
        return this.#back();
      case "toc":
        return this.#open(detail.index);
      case "contents":
        return this.#back();
      case "prev":
        return this.#open(this.#current - 1);
      case "next":
        return this.#open(this.#current + 1);
      case "pdf": {
        const pdf = this.#book?.pdfs[detail.index];
        if (pdf) openExternal(REPO_FILE_URL(pdf.path));
        return;
      }
      case "search":
        return this.#onQuery(detail.value);
      case "search-focus":
        this.#searchFocused = detail.focused;
        return;
    }
  }

  #back(): void {
    if (this.#pane === "text" && !this.#sideBySide()) {
      this.#pane = "toc";
      this.#compose();
      return;
    }
    this.#leaving = true;
    this.scale.off("resize", this.#compose, this);
    goToScreen(this, SCENES.extras, { tab: "books" } satisfies ExtrasSceneData);
  }

  #sideBySide(): boolean {
    return this.scale.gameSize.width >= SIDE_BY_SIDE_MIN;
  }

  #open(index: number): void {
    const total = this.#sections?.length ?? 0;
    if (total === 0) return;
    this.#current = Math.max(0, Math.min(total - 1, index));
    this.#pane = "text";
    this.#compose();
  }

  #onQuery(value: string): void {
    if (value === this.#query) return;
    this.#query = value;
    this.#tocFromTop = true;
    this.#compose();
  }

  /** Sets the page from the book and the search, then, once it has rendered, hands the route its stops. */
  #compose(): void {
    const mounted = this.#page;
    if (!this.#alive || this.#leaving || !mounted) return;
    const frame = campaignFrame(this);
    const { width, height, phone } = frame;
    const wide = this.#sideBySide();
    const input = inputDevice();
    this.#glyphs.reset();
    const backGlyph = hintGlyphOf(this.#glyphs.glyph("back", ["cancel"], "ink", BACK_HEIGHT));
    this.#glyphs.settled();
    mounted.region.setRect({ x: 0, y: 0, width, height });
    mounted.element.model = readerPageModelOf({
      book: this.#book,
      sections: this.#sections,
      failed: this.#failed,
      current: this.#current,
      query: this.#query,
      pane: this.#pane,
      wide,
      phone,
      height,
      padKeyboard: input.mode === "pad" && input.pad?.steam === true,
      backGlyph,
    });
    const draw = ++this.#drawn;
    void settleElements(mounted.element).then(() => draw === this.#drawn && this.#alive && this.#wire(mounted));
  }

  /** After a render: scroll resets, then the route's stops. */
  #wire({ element, region }: Page): void {
    const showText = this.#sideBySide() || this.#pane === "text";
    if (this.#tocFromTop) {
      const toc = element.contentsScroller;
      if (toc) {
        toc.scrollTop = 0;
        this.#tocFromTop = false;
      }
    }
    // A new section reads from its top; a redraw of the same one keeps the place.
    const shown = showText && this.#sections ? this.#current : -1;
    if (shown !== this.#shownSection) {
      const text = element.textScroller;
      if (text) text.scrollTop = 0;
      this.#shownSection = shown;
    }
    const stops = new Map<string, FocusStop>(focusStopsOf(element, (target) => region.rectOf(target)));
    const keys = [...stops.keys()];
    const pdfs = keys.filter((key) => key.startsWith("pdf:"));
    const toc = keys.filter((key) => key.startsWith("toc:"));
    const order = this.#sideBySide()
      ? ["back", "search", ...toc, ...pdfs, "prev", "next"]
      : this.#pane === "toc"
        ? ["back", "search", ...pdfs, ...toc]
        : ["back", "contents", "prev", "next"];
    this.#route?.set(
      order.filter((key) => stops.has(key)),
      stops,
    );
  }
}

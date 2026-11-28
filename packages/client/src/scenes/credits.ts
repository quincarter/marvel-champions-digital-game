/**
 * Art & Credits: the fan-project notice and then who made the card scans, art, comics, music and tools, in one
 * scrolling list (`content/credits.ts`, worded and ordered by `view/credits-model.ts`). Reached from Extras; Back
 * returns there.
 *
 * **The screen is one custom element**, `mc-credits-page` (`views/credits/`): the ink `mc-top-bar` over `@mc/ui`'s
 * `mc-credits-list`. Read-only: no row is a control and no web address opens from here, so a swipe that ends over a row
 * can fire nothing (CLAUDE.md, no tap on finger lift); the only press is the bar's Back. A pad or keyboard walks the
 * entries (each a focus stop that does nothing on A; the list follows the ring). An entry whose artist or source the
 * repo does not record says so in its credit line, in words.
 *
 * This scene mounts the page, sets its `model` and keeps what is a decision: the focus route (its ring drawn in the
 * panel layer, `dom/dom-ring.ts`), the glyph on Back, paging and the way back to Extras.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/credits/mc-credits-page/mc-credits-page.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { renderDeep } from "../dom/element-render.js";
import { focusStopsOf } from "../dom/element-stops.js";
import { hintGlyphOf } from "../dom/hint-glyph.js";
import { surface } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { clipToView } from "../view/focus-list.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { creditsRowsOf } from "../view/credits-model.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { barClearanceOf } from "./screen-bar.js";

/** How far a page (Page Up / Down, a shoulder button) scrolls, as a share of the list's height. */
const PAGE = 0.85;

export class CreditsScene extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #alive = false;
  #glyphs!: ControlGlyphs;
  #mounted: MountedElement<HTMLElementTagNameMap["mc-credits-page"]> | null = null;
  #stamp = 0;

  constructor() {
    super(SCENES.credits);
  }

  create(): void {
    this.#alive = true;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-credits-page", { x: 0, y: 0, width, height });
    this.#mounted = mounted;
    mounted.element.addEventListener("mc-credits", (event) => {
      if (event.detail.type === "back") this.#back();
    });
    this.#glyphs = new ControlGlyphs(this, () => this.#draw());
    this.#route = new FocusRoute(this, {
      onCancel: () => this.#back(),
      onPage: (direction) => this.#scrollBy(direction * this.#pageHeight()),
      onHomeEnd: (edge) => this.#scroller()?.scrollTo({ top: edge === "home" ? 0 : Number.MAX_SAFE_INTEGER }),
      onScroll: (_dx, dy) => this.#scrollBy(dy),
      ring: domFocusRing,
    });
    const offLanguage = onLanguageChange(() => this.#draw());
    this.scale.on("resize", this.#draw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      offLanguage();
      this.scale.off("resize", this.#draw, this);
      this.#glyphs.dispose();
      this.#mounted = null;
    });
    this.#draw();
    fadeScreenIn(this);
  }

  #back(): void {
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.extras);
  }

  #scroller(): HTMLElement | null {
    return this.#mounted?.element.scroller ?? null;
  }

  #scrollBy(dy: number): void {
    this.#scroller()?.scrollBy({ top: dy });
  }

  #pageHeight(): number {
    return (this.#scroller()?.clientHeight ?? 0) * PAGE;
  }

  #draw(): void {
    const mounted = this.#mounted;
    if (!this.#alive || !mounted) return;
    const { region, element } = mounted;
    const { width, height } = this.scale.gameSize;
    const form = formFactorFor(width, height);
    const phone = form === "phone" || form === "phoneLandscape";
    const stamp = ++this.#stamp;
    this.#glyphs.reset();
    const back = phone ? "◂" : t("credits.back");
    const title = t("credits.title");
    const glyph = this.#glyphs.glyph("back", ["cancel"], "ink", 44);
    this.#glyphs.settled();
    const clearance = barClearanceOf(this, {
      width,
      phone,
      back,
      title,
      endWidth: 0,
      backGlyph: glyph !== undefined,
    });
    const rows = creditsRowsOf();
    region.setRect({ x: 0, y: 0, width, height });
    element.model = {
      phone,
      bar: {
        title,
        backLabel: back,
        backGlyph: hintGlyphOf(glyph),
        titleDrop: clearance.drop,
        titleMaxRight: clearance.maxRight,
      },
      rows: rows.map((row) => (row.kind === "entry" ? { kind: "entry", title: row.title, lines: row.lines } : row)),
    };
    void renderDeep(element).then(() => {
      if (stamp !== this.#stamp || !this.#alive) return;
      this.#syncStops(rows);
    });
  }

  /** The route's stops: Back, then each entry (a stop that does nothing on A), the list following the ring. */
  #syncStops(rows: ReturnType<typeof creditsRowsOf>): void {
    const mounted = this.#mounted;
    if (!mounted || !this.#route) return;
    const { region, element } = mounted;
    const stops = new Map<string, FocusStop>(focusStopsOf(element, (target) => region.rectOf(target)));
    const order: string[] = stops.has("back") ? ["back"] : [];
    const view = (): Rect => {
      const scroller = this.#scroller();
      return scroller ? region.rectOf(scroller) : { x: 0, y: 0, width: 0, height: 0 };
    };
    rows.forEach((row, index) => {
      if (row.kind === "section") return;
      const key = `row:${index}`;
      order.push(key);
      const found = (): HTMLElement | null => element.rowElement(index);
      stops.set(key, {
        // Clipped to the list, so the ring never floats over the top bar while a row is scrolled partly out.
        rect: () => {
          const row = found();
          return row ? clipToView(region.rectOf(row), view()) : view();
        },
        view,
        activate: () => undefined,
        ensureVisible: () => found()?.scrollIntoView({ block: "nearest" }),
      });
    });
    this.#route.set(order, stops);
  }
}

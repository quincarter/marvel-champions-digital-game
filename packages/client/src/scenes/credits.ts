/**
 * Art & Credits: the fan-project notice and then who made the card scans, art, comics, music and tools, in one
 * scrolling list (`content/credits.ts`, worded and ordered by `view/credits-model.ts`). Reached from Extras; Back
 * returns there.
 *
 * Read-only: no row is a control and no web address opens from here, so a swipe that ends over a row can fire
 * nothing (CLAUDE.md, no tap on finger lift); the only presses are the top bar's Back and the list's own scrolling.
 * A pad or keyboard walks the entries (each a focus stop that does nothing on A; the list follows the ring).
 * An entry whose artist or source the repo does not record says so in its credit line, in words.
 *
 * The list is a Lit panel over the canvas (`@mc/ui`'s `mc-credits-list`, mounted with `dom/dom-region.ts`): native
 * text and scrolling, no Phaser objects to build or sign each frame. The top bar, Back and its glyph stay Phaser; the
 * focus ring is drawn in the DOM (`dom/dom-ring.ts`), since a Phaser ring would sit under the panel.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McCreditsList } from "@mc/ui";
import { surface } from "../tokens.js";
import { campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { cssOf } from "../ui/theme.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { McButton } from "../ui/widgets.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { clipToView } from "../view/focus-list.js";
import type { Rect } from "../view/layout.js";
import { creditsRowsOf } from "../view/credits-model.js";
import { DomRegion } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

/** How far a page (Page Up / Down, a shoulder button) scrolls, as a share of the list's height. */
const PAGE = 0.85;

export class CreditsScene extends Phaser.Scene {
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #alive = false;
  #hints!: GlyphHints;
  /** The list, a Lit panel over the canvas (`@mc/ui`'s `mc-credits-list`); made once a visit so its scroll stays. */
  #region: DomRegion<McCreditsList> | null = null;

  constructor() {
    super(SCENES.credits);
  }

  create(): void {
    this.#alive = true;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    this.#hints = new GlyphHints(this);
    this.#route = new FocusRoute(this, {
      onCancel: () => this.#back(),
      onPage: (direction) => this.#scrollBy(direction * this.#pageHeight()),
      onHomeEnd: (edge) => this.#scroller()?.scrollTo({ top: edge === "home" ? 0 : Number.MAX_SAFE_INTEGER }),
      onScroll: (_dx, dy) => this.#scrollBy(dy),
      ring: domFocusRing,
    });
    const offLanguage = onLanguageChange(() => this.#draw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      offLanguage();
      this.#hints.dispose();
      this.scale.off("resize", this.#draw, this);
      this.#destroyWidgets();
      this.#region = null;
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
  }

  #scroller(): HTMLElement | null {
    return this.#region?.element.scroller ?? null;
  }

  #scrollBy(dy: number): void {
    this.#scroller()?.scrollBy({ top: dy });
  }

  #pageHeight(): number {
    return (this.#region?.rect.height ?? 0) * PAGE;
  }

  #draw(): void {
    if (!this.#alive) return;
    this.#destroyWidgets();
    destroyChildren(this);

    const frame = campaignFrame(this);
    const { width, height, phone, gutter } = frame;
    const rows = creditsRowsOf();
    this.#hints.reset();
    const stops = new Map<string, FocusStop>();

    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    const bar = drawTopBar(this, {
      backLabel: phone ? "◂" : t("credits.back"),
      onBack: () => this.#back(),
      hints: this.#hints,
      title: t("credits.title"),
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
    if (!this.#region) this.#region = new DomRegion(this, document.createElement("mc-credits-list"), listRect);
    const region = this.#region;
    region.setRect(listRect);
    region.element.phone = phone;
    region.element.rows = rows.map((row) =>
      row.kind === "entry" ? { kind: "entry", title: row.title, lines: row.lines } : row,
    );

    const order: string[] = bar.backRect ? ["back"] : [];
    rows.forEach((row, index) => {
      if (row.kind === "section") return;
      const key = `row:${index}`;
      order.push(key);
      const element = (): HTMLElement | null => region.element.rowElement(index);
      stops.set(key, {
        // Clipped to the list, so the ring never floats over the top bar while a row is scrolled partly out.
        rect: () => {
          const row = element();
          return row ? clipToView(region.rectOf(row), listRect) : listRect;
        },
        view: listRect,
        activate: () => undefined,
        ensureVisible: () => element()?.scrollIntoView({ block: "nearest" }),
      });
    });
    this.#route?.set(order, stops);
  }
}

/**
 * The deck builder's search cheat sheet (issue #531): `view/search-help.ts`'s rows in a scrolling sheet. Each query has
 * Use, which puts it in the search box and closes the sheet, and Copy, since a canvas can't be selected. Like the other
 * sheets it switches off the launching screen's input while up.
 *
 * The box, the rows and their buttons are a Lit pop-up panel over the canvas (`dom/popup-sheet.ts`): the list scrolls
 * natively and every button is a tap, so a swipe that lifts over Use or Copy presses nothing.
 */
import Phaser from "phaser";
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import type { SheetBuilder } from "../dom/sheet-builder.js";
import { hit, ink, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import type { Rect } from "../view/layout.js";
import { SEARCH_HELP_ROWS } from "../view/search-help.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface SearchHelpSheetData {
  /** The scene that asked: its pointer input is off while this is up. */
  readonly from: string;
  /** The player chose Use: the sheet is already closed. */
  readonly onUse: (query: string) => void;
  /** The sheet closed, by any route. */
  readonly onClose: () => void;
}

const ROW_HEIGHT = 66;
const BUTTON_TYPE = { ...typeRole.label, size: 11 };
const QUERY_TYPE = { ...typeRole.mono, size: 13, weight: 700 as const };
const MEANING_TYPE = { ...typeRole.body, size: 12 };
const LIST = "help-list";
const INK = surface.ink.hex;

export class SearchHelpSheet extends Phaser.Scene {
  #data!: SearchHelpSheetData;
  #panel!: PopupSheet;
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();
  #order: string[] = [];
  readonly #actions = new Map<string, () => void>();
  /** The row whose Copy just ran, and whether it worked: its button says so. */
  #copied: { readonly index: number; readonly ok: boolean } | null = null;
  #listRect: Rect = { x: 0, y: 0, width: 0, height: 0 };

  constructor() {
    super(SCENES.searchHelp);
  }

  create(data: SearchHelpSheetData): void {
    this.#data = data;
    this.#copied = null;
    const from = this.scene.get(data.from);
    if (from) from.input.enabled = false;
    this.input.enabled = true;
    this.#panel = new PopupSheet(this, (key) => this.#actions.get(key)?.(), undefined, {
      onDismiss: () => this.#close(),
    });
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#panel.leaving,
      onCancel: () => this.#close(),
      onPage: (direction) => this.#scroller()?.scrollBy({ top: direction * this.#listRect.height * 0.8 }),
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      if (from) from.input.enabled = true;
      data.onClose();
    });
    this.#draw();
  }

  #scroller(): HTMLElement | null {
    return this.#panel.element?.elementOf(LIST) ?? null;
  }

  #close(): void {
    this.#panel.close();
  }

  #use(query: string): void {
    const { onUse } = this.#data;
    this.#panel.close(() => onUse(query));
  }

  #copy(index: number, query: string): void {
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    const done = (ok: boolean): void => {
      if (!this.sys.isActive()) return;
      this.#copied = { index, ok };
      this.#draw();
    };
    if (!clipboard?.writeText) {
      done(false);
      return;
    }
    clipboard.writeText(query).then(
      () => done(true),
      () => done(false),
    );
  }

  /** An element of the panel in game coordinates, or `fallback` while it is not drawn. */
  #boxOf(key: string, fallback: Rect): Rect {
    const found = this.#panel.element?.elementOf(key);
    return (found ? this.#panel.rectOf(found) : null) ?? fallback;
  }

  #draw(): void {
    destroyChildren(this);
    this.#actions.clear();
    this.#stops = new Map();
    this.#order = [];
    const { width, height } = this.scale.gameSize;
    // Swallows every press that lands on no control of this pop-up's own.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const b = this.#panel.begin(width, height);

    const phone = width < 600;
    const margin = phone ? 8 : 24;
    const boxWidth = Math.min(720, width - margin * 2);
    const box: Rect = { x: (width - boxWidth) / 2, y: margin, width: boxWidth, height: height - margin * 2 };
    b.box(box, { fill: surface.paper.hex });
    b.box(box, { stroke: INK, strokeWidth: 4 });

    const inner: Rect = { x: box.x + 16, y: box.y + 16, width: box.width - 32, height: box.height - 32 };
    const title = b.text(inner.x, inner.y, "Search cheat sheet", typeRole.barTitle, {
      color: INK,
      fitWidth: inner.width,
    });
    const listTop = inner.y + title.height + 12;
    const footerY = inner.y + inner.height - hit.primary;
    const listRect: Rect = { x: inner.x, y: listTop, width: inner.width, height: footerY - 12 - listTop };
    this.#listRect = listRect;

    const useWidth = phone ? 52 : 64;
    const copyWidth = phone ? 66 : 76;
    const buttonsWidth = useWidth + copyWidth + 6;
    // The list's own width is 12px narrower than its box (the scrollbar's room).
    const rowWidth = listRect.width - 12;
    const useRectOf = (rowY: number): Rect => ({
      x: listRect.x + rowWidth - 8 - 18 - buttonsWidth,
      y: rowY + (ROW_HEIGHT - 6 - hit.target) / 2,
      width: useWidth,
      height: hit.target,
    });
    const copyRectOf = (rowY: number): Rect => {
      const use = useRectOf(rowY);
      return { ...use, x: use.x + useWidth + 6, width: copyWidth };
    };

    const rect: Rect = { x: listRect.x, y: listRect.y, width: rowWidth, height: listRect.height };
    b.scrollFit(LIST, rect, (list) => {
      SEARCH_HELP_ROWS.forEach((row, index) => {
        const y = index * ROW_HEIGHT;
        this.#drawRow(
          list,
          row,
          index,
          { x: rect.x, y, width: rect.width, height: ROW_HEIGHT },
          {
            useRect: useRectOf(y),
            copyRect: copyRectOf(y),
            textWidth: rect.width - 8 - 20 - buttonsWidth - 8,
            listTop: listRect.y,
          },
        );
      });
      return SEARCH_HELP_ROWS.length * ROW_HEIGHT;
    });

    const closeRect: Rect = { x: inner.x, y: footerY, width: inner.width, height: hit.primary };
    this.#actions.set("back", () => this.#close());
    b.button({ key: "back", rect: closeRect, label: "Back", look: "secondary", type: BUTTON_TYPE });
    this.#stops.set("back", { rect: closeRect, activate: () => this.#close() });
    this.#order.push("back");
    this.#panel.mount(b, width, height);
    this.#route?.set(this.#order, this.#stops);
  }

  #drawRow(
    b: SheetBuilder,
    row: (typeof SEARCH_HELP_ROWS)[number],
    index: number,
    rect: Rect,
    at: { useRect: Rect; copyRect: Rect; textWidth: number; listTop: number },
  ): void {
    if (row.kind === "heading") {
      const text = b.measure(row.text, typeRole.barTitle, { fitWidth: rect.width - 28 });
      b.text(rect.x + 10, rect.y + ROW_HEIGHT - 12 - text.height, row.text, typeRole.barTitle, {
        color: INK,
        fitWidth: rect.width - 28,
      });
      return;
    }
    if (row.kind === "note") {
      b.text(rect.x + 10, rect.y + 4, row.text, MEANING_TYPE, {
        color: INK,
        wrapWidth: rect.width - 36,
        maxLines: 3,
      });
      return;
    }
    const body: Rect = { x: rect.x, y: rect.y, width: rect.width - 8, height: ROW_HEIGHT - 6 };
    b.box(body, { fill: surface.parchment.hex });
    b.box(body, { stroke: INK, strokeWidth: 2 });
    b.text(body.x + 10, body.y + 7, row.query, QUERY_TYPE, { color: INK, fitWidth: at.textWidth });
    b.text(body.x + 10, body.y + 26, row.meaning, MEANING_TYPE, {
      color: INK,
      alpha: ink.secondary,
      wrapWidth: at.textWidth,
      maxLines: 2,
    });
    const copied = this.#copied?.index === index ? this.#copied : null;
    const buttons: [string, Rect, string, () => void, boolean][] = [
      [`use:${index}`, at.useRect, "Use", () => this.#use(row.query), false],
      [
        `copy:${index}`,
        at.copyRect,
        copied ? (copied.ok ? "Copied" : "Failed") : "Copy",
        () => this.#copy(index, row.query),
        copied?.ok ?? false,
      ],
    ];
    for (const [key, buttonRect, label, run, selected] of buttons) {
      this.#actions.set(key, run);
      b.button({
        key,
        rect: buttonRect,
        label,
        look: "secondary",
        type: BUTTON_TYPE,
        ...(selected ? { selected } : {}),
      });
      this.#stops.set(key, {
        rect: () => this.#boxOf(key, { ...buttonRect, y: buttonRect.y + at.listTop }),
        activate: run,
        view: () => this.#boxOf(LIST, this.#listRect),
        ensureVisible: () => this.#panel.element?.elementOf(key)?.scrollIntoView({ block: "nearest" }),
      });
      this.#order.push(key);
    }
  }
}

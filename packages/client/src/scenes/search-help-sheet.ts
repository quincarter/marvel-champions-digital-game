/**
 * The deck builder's search cheat sheet (issue #531): `view/search-help.ts`'s rows in a scrolling sheet. Each query has
 * Use, which puts it in the search box and closes the sheet, and Copy, since a canvas can't be selected. Like the other
 * sheets it switches off the launching screen's input while up.
 */
import Phaser from "phaser";
import { hit, ink, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { McButton, clampLines, fitText } from "../ui/widgets.js";
import type { Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
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

export class SearchHelpSheet extends Phaser.Scene {
  #data!: SearchHelpSheetData;
  #buttons: McButton[] = [];
  #list: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  #scroll = new ListScroll();
  #hints!: GlyphHints;
  /** The row whose Copy just ran, and whether it worked: its button says so. */
  #copied: { readonly index: number; readonly ok: boolean } | null = null;

  constructor() {
    super(SCENES.searchHelp);
  }

  create(data: SearchHelpSheetData): void {
    this.#data = data;
    this.#scroll = new ListScroll();
    this.#copied = null;
    const from = this.scene.get(data.from);
    if (from) from.input.enabled = false;
    this.input.enabled = true;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#hints = new GlyphHints(this);
    this.#route = new FocusRoute(this, {
      onCancel: () => this.#close(),
      onPage: (direction) => this.#list?.scrollByPage(direction),
      onScroll: (_dx, dy) => this.#list?.scrollByPx(dy),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#hints.dispose();
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#list?.destroy();
      this.#list = null;
      if (from) from.input.enabled = true;
      data.onClose();
    });
    this.#draw();
  }

  #close(): void {
    this.scene.stop();
  }

  #use(query: string): void {
    const { onUse } = this.#data;
    this.scene.stop();
    onUse(query);
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

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#list?.destroy();
    this.#list = null;
    this.#hints.reset();
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);

    const phone = width < 600;
    const margin = phone ? 8 : 24;
    const boxWidth = Math.min(720, width - margin * 2);
    const box: Rect = { x: (width - boxWidth) / 2, y: margin, width: boxWidth, height: height - margin * 2 };
    const ground = this.add.graphics();
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);

    const inner: Rect = { x: box.x + 16, y: box.y + 16, width: box.width - 32, height: box.height - 32 };
    const title = this.add.text(inner.x, inner.y, "Search cheat sheet", textStyle(typeRole.barTitle, surface.ink.hex));
    fitText(title, inner.width, typeRole.barTitle.size);
    const listTop = title.y + title.height + 12;
    const footerY = inner.y + inner.height - hit.primary;
    const listRect: Rect = { x: inner.x, y: listTop, width: inner.width, height: footerY - 12 - listTop };

    const clip = (): Rect | null => this.#list?.rect ?? null;
    const suppressClick = (): boolean => this.#list?.isDragSuppressingClick ?? false;
    const useWidth = phone ? 52 : 64;
    const copyWidth = phone ? 66 : 76;
    const buttonsWidth = useWidth + copyWidth + 6;
    const useRectOf = (rowRect: Rect): Rect => ({
      x: rowRect.x + rowRect.width - 18 - buttonsWidth,
      y: rowRect.y + (ROW_HEIGHT - 6 - hit.target) / 2,
      width: useWidth,
      height: hit.target,
    });

    const renderRow = (index: number, rect: Rect): VirtualListRow => {
      const row = SEARCH_HELP_ROWS[index]!;
      const objects: Phaser.GameObjects.GameObject[] = [];
      if (row.kind === "heading") {
        const text = this.add.text(rect.x + 10, 0, row.text, textStyle(typeRole.barTitle, surface.ink.hex));
        fitText(text, rect.width - 28, typeRole.barTitle.size);
        text.setY(rect.y + ROW_HEIGHT - 12 - text.height);
        objects.push(text);
        return { objects };
      }
      if (row.kind === "note") {
        const text = this.add
          .text(rect.x + 10, rect.y + 4, row.text, textStyle(MEANING_TYPE, surface.ink.hex))
          .setWordWrapWidth(rect.width - 36);
        clampLines(text, 3);
        objects.push(text);
        return { objects };
      }
      const body: Rect = { x: rect.x, y: rect.y, width: rect.width - 8, height: ROW_HEIGHT - 6 };
      const g = this.add.graphics();
      g.fillStyle(surface.parchment.hex, 1).fillRect(body.x, body.y, body.width, body.height);
      g.lineStyle(2, surface.ink.hex, 1).strokeRect(body.x, body.y, body.width, body.height);
      objects.push(g);
      const textWidth = body.width - 20 - buttonsWidth - 8;
      const queryText = this.add.text(body.x + 10, body.y + 7, row.query, textStyle(QUERY_TYPE, surface.ink.hex));
      fitText(queryText, textWidth, QUERY_TYPE.size);
      objects.push(queryText);
      const meaning = this.add
        .text(body.x + 10, body.y + 26, row.meaning, textStyle(MEANING_TYPE, surface.ink.hex, ink.secondary))
        .setWordWrapWidth(textWidth);
      clampLines(meaning, 2);
      objects.push(meaning);

      const useRect = useRectOf(rect);
      const use = new McButton(this, {
        kind: "secondary",
        label: "Use",
        type: BUTTON_TYPE,
        rect: useRect,
        onClick: () => this.#use(row.query),
        clip,
        suppressClick,
      });
      objects.push(use.container);
      const copied = this.#copied?.index === index ? this.#copied : null;
      const copy = new McButton(this, {
        kind: "secondary",
        label: copied ? (copied.ok ? "Copied" : "Failed") : "Copy",
        type: BUTTON_TYPE,
        rect: { ...useRect, x: useRect.x + useWidth + 6, width: copyWidth },
        selected: copied?.ok ?? false,
        onClick: () => this.#copy(index, row.query),
        clip,
        suppressClick,
      });
      objects.push(copy.container);
      return { objects };
    };

    this.#list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: ROW_HEIGHT,
      count: SEARCH_HELP_ROWS.length,
      renderRow,
      scroll: this.#scroll,
    });
    const list = this.#list;
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    SEARCH_HELP_ROWS.forEach((row, index) => {
      if (row.kind !== "query") return;
      const key = `use:${index}`;
      stops.set(key, {
        rect: () => useRectOf(list.rectFor(index)),
        activate: () => this.#use(row.query),
        ensureVisible: () => list.scrollIntoView(index),
      });
      order.push(key);
    });

    const closeRect: Rect = { x: inner.x, y: footerY, width: inner.width, height: hit.primary };
    const back = new McButton(this, {
      kind: "secondary",
      label: "Back",
      type: BUTTON_TYPE,
      rect: closeRect,
      onClick: () => this.#close(),
    });
    this.#buttons.push(back);
    this.#hints.button(back, ["cancel"], "paper");
    stops.set("back", { rect: closeRect, activate: () => this.#close() });
    order.push("back");
    this.#route?.set(order, stops);
  }
}

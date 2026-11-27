/**
 * The deck builder's pack and wave picker (issue #977, benpap24): a press on the pack or wave button opens it, and
 * every pack (under its wave) or every wave is a row that toggles, so several are chosen at once instead of stepping
 * through them one at a time. "All" clears the choice. Each press applies at once (the pool behind updates); Done, B or
 * Escape closes it. Like the other sheets it switches off the launching screen's input while up.
 *
 * The box, the rows and their buttons are a Lit pop-up panel over the canvas (`dom/popup-sheet.ts`): the list scrolls
 * natively and every button is a tap, so a swipe that lifts over a row presses nothing.
 */
import Phaser from "phaser";
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import { hit, ink, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import type { FilterChoice } from "../view/deck-builder-model.js";
import { togglePick } from "../view/deck-builder-model.js";
import type { Rect } from "../view/layout.js";
import { poolPickRowsOf } from "../view/pool-pick-rows.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { t } from "../i18n/translate.js";

export interface PoolPickSheetData {
  /** The scene that asked: its pointer input is off while this is up. */
  readonly from: string;
  readonly title: string;
  /** What the pool offers plus every current pick, in release order (`choicesWithPicks`); a pack's `group` is its wave. */
  readonly choices: readonly FilterChoice[];
  readonly chosen: readonly string[];
  /** Every press: the new choice (empty is all). */
  readonly onChange: (chosen: readonly string[]) => void;
  /** The sheet closed, by any route. */
  readonly onClose: () => void;
}

const ROW_HEIGHT = hit.target + 6;
const BUTTON_TYPE = { ...typeRole.label, size: 12 };
const LIST = "pick-list";
const INK = surface.ink.hex;

export class PoolPickSheet extends Phaser.Scene {
  #data!: PoolPickSheetData;
  #chosen: readonly string[] = [];
  #panel!: PopupSheet;
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();
  #order: string[] = [];
  readonly #actions = new Map<string, () => void>();
  #listRect: Rect = { x: 0, y: 0, width: 0, height: 0 };

  constructor() {
    super(SCENES.poolPick);
  }

  create(data: PoolPickSheetData): void {
    this.#data = data;
    this.#chosen = data.chosen;
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

  #set(chosen: readonly string[]): void {
    this.#chosen = chosen;
    this.#data.onChange(chosen);
    this.#draw();
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
    const boxWidth = Math.min(520, width - margin * 2);
    const rows = poolPickRowsOf(this.#data.choices, this.#chosen);
    const innerWidth = boxWidth - 32;
    const title = b.measure(this.#data.title, typeRole.barTitle, { fitWidth: innerWidth });
    const subtitleText = t("deckBuilder.pickSubtitle");
    const subtitleFull = b.measure(subtitleText, typeRole.body, { size: 13, wrapWidth: innerWidth });
    const subtitleHeight = Math.min(subtitleFull.height, 13 * 1.45 * 2 + 2);
    const header = title.height + 4 + subtitleHeight + 12 + hit.target + 12;
    const chrome = 16 + header + 12 + hit.primary + 16;
    const boxHeight = Math.min(height - margin * 2, chrome + rows.length * ROW_HEIGHT);
    const box: Rect = {
      x: (width - boxWidth) / 2,
      y: Math.round((height - boxHeight) / 2),
      width: boxWidth,
      height: boxHeight,
    };
    b.box(box, { fill: surface.paper.hex });
    b.box(box, { stroke: INK, strokeWidth: 4 });

    const inner: Rect = { x: box.x + 16, y: box.y + 16, width: innerWidth, height: box.height - 32 };
    b.text(inner.x, inner.y, this.#data.title, typeRole.barTitle, { color: INK, fitWidth: innerWidth });
    const subtitleY = inner.y + title.height + 4;
    b.text(inner.x, subtitleY, subtitleText, typeRole.body, {
      size: 13,
      color: INK,
      alpha: ink.secondary,
      wrapWidth: innerWidth,
      maxLines: 2,
    });

    const allRect: Rect = { x: inner.x, y: subtitleY + subtitleHeight + 12, width: inner.width, height: hit.target };
    const pickAll = (): void => this.#set([]);
    this.#actions.set("pick:all", pickAll);
    b.button({
      key: "pick:all",
      rect: allRect,
      label: `${this.#chosen.length === 0 ? "✓ " : ""}${t("deckBuilder.pickAll")}`,
      look: "secondary",
      type: BUTTON_TYPE,
      selected: this.#chosen.length === 0,
    });
    this.#stops.set("pick:all", { rect: allRect, activate: pickAll });
    this.#order.push("pick:all");

    const footerY = inner.y + inner.height - hit.primary;
    const listTop = allRect.y + allRect.height + 12;
    const listRect: Rect = { x: inner.x, y: listTop, width: inner.width, height: footerY - 12 - listTop };
    this.#listRect = listRect;
    // The list's own width is 12px narrower than its box (the scrollbar's room).
    const rect: Rect = { x: listRect.x, y: listRect.y, width: listRect.width - 12, height: listRect.height };
    b.scrollFit(LIST, rect, (list) => {
      rows.forEach((row, index) => {
        const y = index * ROW_HEIGHT;
        if (row.kind === "heading") {
          const label = row.text.toUpperCase();
          const size = list.measure(label, typeRole.label, { fitWidth: rect.width - 14 });
          list.text(rect.x + 2, y + ROW_HEIGHT - 8 - size.height, label, typeRole.label, {
            color: INK,
            alpha: ink.label,
            fitWidth: rect.width - 14,
          });
          return;
        }
        const choiceRect: Rect = { x: rect.x, y, width: rect.width - 10, height: hit.target };
        const key = `pick:${row.id}`;
        const toggle = (): void => this.#set(togglePick(this.#chosen, row.id));
        this.#actions.set(key, toggle);
        list.button({
          key,
          rect: choiceRect,
          label: `${row.selected ? "✓ " : ""}${row.name}`,
          look: "secondary",
          type: BUTTON_TYPE,
          selected: row.selected,
        });
        this.#stops.set(key, {
          rect: () => this.#boxOf(key, { ...choiceRect, y: choiceRect.y + listRect.y }),
          activate: toggle,
          view: () => this.#boxOf(LIST, this.#listRect),
          ensureVisible: () => this.#panel.element?.elementOf(key)?.scrollIntoView({ block: "nearest" }),
        });
        this.#order.push(key);
      });
      return rows.length * ROW_HEIGHT;
    });

    const doneRect: Rect = { x: inner.x, y: footerY, width: inner.width, height: hit.primary };
    this.#actions.set("done", () => this.#close());
    b.button({ key: "done", rect: doneRect, label: t("deckBuilder.pickDone"), look: "primary", type: BUTTON_TYPE });
    this.#stops.set("done", { rect: doneRect, activate: () => this.#close() });
    this.#order.push("done");
    this.#panel.mount(b, width, height);
    this.#route?.set(this.#order, this.#stops);
  }
}

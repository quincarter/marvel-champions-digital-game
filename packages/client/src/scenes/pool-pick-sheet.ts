/**
 * The deck builder's pack and wave picker (issue #977, benpap24): a press on the pack or wave button opens it, and
 * every pack (under its wave) or every wave is a row that toggles, so several are chosen at once instead of stepping
 * through them one at a time. "All" clears the choice. Each press applies at once (the pool behind updates); Done, B or
 * Escape closes it. Like the other sheets it switches off the launching screen's input while up.
 */
import Phaser from "phaser";
import { hit, ink, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { McButton, clampLines, fitText } from "../ui/widgets.js";
import type { FilterChoice } from "../view/deck-builder-model.js";
import { togglePick } from "../view/deck-builder-model.js";
import type { Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { offeredPicks, poolPickRowsOf } from "../view/pool-pick-rows.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { t } from "../i18n/translate.js";

export interface PoolPickSheetData {
  /** The scene that asked: its pointer input is off while this is up. */
  readonly from: string;
  readonly title: string;
  /** What the pool offers, in release order; a pack's `group` is its wave. */
  readonly choices: readonly FilterChoice[];
  readonly chosen: readonly string[];
  /** Every press: the new choice (empty is all). */
  readonly onChange: (chosen: readonly string[]) => void;
  /** The sheet closed, by any route. */
  readonly onClose: () => void;
}

const ROW_HEIGHT = hit.target + 6;
const BUTTON_TYPE = { ...typeRole.label, size: 12 };

export class PoolPickSheet extends Phaser.Scene {
  #data!: PoolPickSheetData;
  #chosen: readonly string[] = [];
  #buttons: McButton[] = [];
  #list: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  #scroll = new ListScroll();
  #hints!: GlyphHints;

  constructor() {
    super(SCENES.poolPick);
  }

  create(data: PoolPickSheetData): void {
    this.#data = data;
    this.#chosen = offeredPicks(data.chosen, data.choices);
    // A pick the pool no longer offers (another filter emptied its pack) can't be seen to untick: drop it now, so the
    // pool and the button stop counting it.
    if (this.#chosen.length !== data.chosen.length) data.onChange(this.#chosen);
    this.#scroll = new ListScroll();
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

  #set(chosen: readonly string[]): void {
    this.#chosen = chosen;
    this.#data.onChange(chosen);
    this.#draw();
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
    const boxWidth = Math.min(520, width - margin * 2);
    const rows = poolPickRowsOf(this.#data.choices, this.#chosen);
    const title = this.add.text(0, 0, this.#data.title, textStyle(typeRole.barTitle, surface.ink.hex));
    const innerWidth = boxWidth - 32;
    fitText(title, innerWidth, typeRole.barTitle.size);
    const subtitle = this.add
      .text(0, 0, t("deckBuilder.pickSubtitle"), textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setFontSize(13)
      .setWordWrapWidth(innerWidth);
    clampLines(subtitle, 2);
    const header = title.height + 4 + subtitle.height + 12 + hit.target + 12;
    const chrome = 16 + header + 12 + hit.primary + 16;
    const boxHeight = Math.min(height - margin * 2, chrome + rows.length * ROW_HEIGHT);
    const box: Rect = {
      x: (width - boxWidth) / 2,
      y: Math.round((height - boxHeight) / 2),
      width: boxWidth,
      height: boxHeight,
    };
    const ground = this.add.graphics();
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    title.setDepth(1);
    subtitle.setDepth(1);

    const inner: Rect = { x: box.x + 16, y: box.y + 16, width: innerWidth, height: box.height - 32 };
    title.setPosition(inner.x, inner.y);
    subtitle.setPosition(inner.x, title.y + title.height + 4);

    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    const allRect: Rect = { x: inner.x, y: subtitle.y + subtitle.height + 12, width: inner.width, height: hit.target };
    const pickAll = (): void => this.#set([]);
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: `${this.#chosen.length === 0 ? "✓ " : ""}${t("deckBuilder.pickAll")}`,
        type: BUTTON_TYPE,
        rect: allRect,
        selected: this.#chosen.length === 0,
        onClick: pickAll,
      }),
    );
    stops.set("pick:all", { rect: allRect, activate: pickAll });
    order.push("pick:all");

    const footerY = inner.y + inner.height - hit.primary;
    const listTop = allRect.y + allRect.height + 12;
    const listRect: Rect = { x: inner.x, y: listTop, width: inner.width, height: footerY - 12 - listTop };
    const clip = (): Rect | null => this.#list?.rect ?? null;
    const suppressClick = (): boolean => this.#list?.isDragSuppressingClick ?? false;
    const choiceRectOf = (rowRect: Rect): Rect => ({
      x: rowRect.x,
      y: rowRect.y,
      width: rowRect.width - 10,
      height: hit.target,
    });
    const toggle = (id: string) => (): void =>
      this.#set(togglePick(offeredPicks(this.#chosen, this.#data.choices), id));

    const renderRow = (index: number, rect: Rect): VirtualListRow => {
      const row = rows[index]!;
      if (row.kind === "heading") {
        const text = this.add.text(
          rect.x + 2,
          0,
          row.text.toUpperCase(),
          textStyle(typeRole.label, surface.ink.hex, ink.label),
        );
        fitText(text, rect.width - 14, typeRole.label.size);
        text.setY(rect.y + ROW_HEIGHT - 8 - text.height);
        return { objects: [text] };
      }
      const button = new McButton(this, {
        kind: "secondary",
        label: `${row.selected ? "✓ " : ""}${row.name}`,
        type: BUTTON_TYPE,
        rect: choiceRectOf(rect),
        selected: row.selected,
        onClick: toggle(row.id),
        clip,
        suppressClick,
      });
      return { objects: [button.container] };
    };

    this.#list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: ROW_HEIGHT,
      count: rows.length,
      renderRow,
      scroll: this.#scroll,
    });
    const list = this.#list;
    rows.forEach((row, index) => {
      if (row.kind !== "choice") return;
      const key = `pick:${row.id}`;
      stops.set(key, {
        rect: () => choiceRectOf(list.rectFor(index)),
        activate: toggle(row.id),
        ensureVisible: () => list.scrollIntoView(index),
      });
      order.push(key);
    });

    const doneRect: Rect = { x: inner.x, y: footerY, width: inner.width, height: hit.primary };
    const done = new McButton(this, {
      kind: "primary",
      label: t("deckBuilder.pickDone"),
      type: BUTTON_TYPE,
      rect: doneRect,
      onClick: () => this.#close(),
    });
    this.#buttons.push(done);
    this.#hints.button(done, ["cancel"], "paper");
    stops.set("done", { rect: doneRect, activate: () => this.#close() });
    order.push("done");
    this.#route?.set(order, stops);
  }
}

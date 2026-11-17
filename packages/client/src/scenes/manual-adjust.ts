/**
 * "Manual adjust" (issue #791): launched from Pause, so a player can correct the table by hand after a bug or a misclick.
 *
 * Two steps in one sheet. First the things on the table, grouped (your hero, the villain, schemes, cards in play, cards
 * in hand), one row each; then the corrections for the one picked (damage, threat, status cards, counters, exhaust,
 * discard, draw, change form). Each press sends a `Command adjust` through the store and redraws from the new state, so
 * several corrections can be made in a row. The engine judges every one: a refusal shows its own text and changes
 * nothing. The first correction of a game asks first, because an adjusted game no longer counts toward stats.
 *
 * All the wording and the choice of corrections is `view/manual-adjust-model.ts`; this scene only draws it.
 */
import Phaser from "phaser";
import { accent, hit, ink, surface, typeRole } from "../tokens.js";
import { appSession } from "../session.js";
import { textStyle } from "../ui/theme.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { McButton, clampLines, fitText } from "../ui/widgets.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import type { Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import {
  adjustTargetOf,
  manualAdjustModel,
  type AdjustChoice,
  type AdjustModel,
  type AdjustTarget,
} from "../view/manual-adjust-model.js";
import { askToAdjustGame } from "./end-turn-confirm.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface ManualAdjustData {
  /** The scene that asked (Pause): its pointer input is off while this is up. */
  readonly from: string;
}

const BUTTON_TYPE = { ...typeRole.label, size: 12 };
const ROW_HEIGHT = 52;
const HEADING_HEIGHT = 30;
const FIRST_ADJUSTMENT_SENTENCE =
  "Manual adjust changes the table by hand: damage, threat, counters, status cards, cards in hand or in play. The engine still refuses anything that does not fit.";

/** One row of the target list: a group's heading, or a target. */
type ListRow =
  | { readonly kind: "heading"; readonly title: string }
  | { readonly kind: "target"; readonly target: AdjustTarget };

export class ManualAdjustOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #list: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  #hover: HoverPreview | null = null;
  #hints!: GlyphHints;
  #unsubscribe: (() => void) | null = null;
  #listScroll = new ListScroll();
  #targetScroll = new ListScroll();
  /** The target whose corrections are showing, or null for the list. */
  #targetId: string | null = null;
  #error: string | null = null;
  /** The last correction that went through, worded, so a press that changes nothing visible still says it did. */
  #done: string | null = null;
  #busy = false;
  /** Where the header's card is on screen, for its hover popover (target page only). */
  #headerHover: { readonly rect: Rect; readonly cardId: string } | null = null;

  constructor() {
    super(SCENES.manualAdjust);
  }

  create(data: ManualAdjustData): void {
    this.#targetId = null;
    this.#error = null;
    this.#done = null;
    this.#busy = false;
    this.#listScroll = new ListScroll();
    this.#targetScroll = new ListScroll();
    const from = this.scene.get(data.from);
    if (from) from.input.enabled = false;
    this.input.enabled = true;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#hints = new GlyphHints(this);
    // A correction that ends the game (the villain's last hit points, the scheme's last threat) closes this, so Game
    // Over is never left under it.
    this.#unsubscribe = appSession().store.subscribe((state) => {
      if (state.game?.outcome) {
        // Pause opened this; it goes too, as it does after a concession, and the Board hands off to Game Over.
        if (this.scene.isActive(SCENES.pause)) this.scene.stop(SCENES.pause);
        this.#close();
      } else this.#draw();
    });
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCards(),
      area: (pointer) => screenHoverArea(this, pointer, { blocked: () => this.scene.isActive(SCENES.inspect) }),
    });
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect) || this.scene.isActive(SCENES.endTurnConfirm),
      onCancel: () => this.#back(),
      onPage: (direction) => this.#list?.scrollByPage(direction),
      onScroll: (_dx, dy) => this.#list?.scrollByPx(dy),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#hints.dispose();
      this.scale.off("resize", onResize, this);
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#hover?.destroy();
      this.#hover = null;
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#list?.destroy();
      this.#list = null;
      if (from) from.input.enabled = true;
    });
    this.#draw();
  }

  /** The model of the game as it stands now, for whoever acts. */
  #model(): AdjustModel | null {
    const { game, perspectiveId } = appSession().store.state;
    return game ? manualAdjustModel(game, perspectiveId) : null;
  }

  /** Back one step: from a target to the list, from the list to Pause. */
  #back(): void {
    if (this.#targetId !== null) {
      this.#targetId = null;
      this.#error = null;
      this.#done = null;
      this.#draw();
    } else this.#close();
  }

  #close(): void {
    this.scene.stop();
  }

  #pick(target: AdjustTarget): void {
    this.#targetId = target.id;
    this.#targetScroll = new ListScroll();
    this.#error = null;
    this.#done = null;
    this.#draw();
  }

  /** Sends one correction, after the first-adjustment warning while the game still counts. */
  #apply(picked: AdjustChoice): void {
    if (this.#busy || this.scene.isActive(SCENES.endTurnConfirm)) return;
    const send = (): void => void this.#send(picked);
    if (appSession().store.state.adjusted) send();
    else askToAdjustGame(this, FIRST_ADJUSTMENT_SENTENCE, "Adjust anyway", send, () => undefined);
  }

  async #send(picked: AdjustChoice): Promise<void> {
    const { store } = appSession();
    this.#busy = true;
    try {
      const ok = await store.dispatch(picked.command);
      this.#error = ok ? null : (store.state.error ?? "The engine refused that adjustment.");
      this.#done = ok ? picked.label : null;
    } finally {
      this.#busy = false;
    }
    if (this.scene.isActive()) this.#draw();
  }

  /** The popover's cards: each target's row on the list, or the header's card on a target's page. */
  #hoverCards(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    if (this.#headerHover) {
      const { rect, cardId } = this.#headerHover;
      found.set(hoverSlotOf(cardId, "header"), { ...rect, cardId, through: true });
      return found;
    }
    const list = this.#list;
    const model = this.#model();
    if (!list || !model) return found;
    this.#rowsOf(model).forEach((row, index) => {
      if (row.kind !== "target" || row.target.cardId === null) return;
      const rect = clipHoverRect(list.rectFor(index), list.rect);
      if (!rect) return;
      const { cardId } = row.target;
      found.set(hoverSlotOf(cardId, `row${index}`), { ...rect, cardId, through: true });
    });
    return found;
  }

  #rowsOf(model: AdjustModel): readonly ListRow[] {
    return model.groups.flatMap((group): ListRow[] => [
      { kind: "heading", title: group.title },
      ...group.targets.map((target): ListRow => ({ kind: "target", target })),
    ]);
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#list?.destroy();
    this.#list = null;
    this.#headerHover = null;
    this.#hints.reset();
    destroyChildren(this);

    const model = this.#model();
    // A card that left play (discarded) takes its page with it: back to the list.
    if (this.#targetId !== null && (!model || !adjustTargetOf(model, this.#targetId))) this.#targetId = null;
    const target = model ? adjustTargetOf(model, this.#targetId) : null;

    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);

    const phone = width < 600;
    const margin = phone ? 8 : 24;
    const boxWidth = Math.min(680, width - margin * 2);
    const boxHeight = Math.min(height - margin * 2, 760);
    const box: Rect = {
      x: (width - boxWidth) / 2,
      y: Math.round((height - boxHeight) / 2),
      width: boxWidth,
      height: boxHeight,
    };
    const ground = this.add.graphics();
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    const inner: Rect = { x: box.x + 16, y: box.y + 16, width: box.width - 32, height: box.height - 32 };

    const title = this.add.text(inner.x, inner.y, "Manual adjust", textStyle(typeRole.barTitle, surface.ink.hex));
    fitText(title, inner.width, typeRole.barTitle.size);
    let y = title.y + title.height + 4;

    const subtitleText = target
      ? [target.name, target.detail].filter((part) => part.length > 0).join(" · ")
      : (model?.unavailable ?? "Pick what to correct. Each correction is made by hand and the game log says so.");
    const subtitle = this.add
      .text(
        inner.x,
        y,
        subtitleText,
        textStyle(target ? typeRole.rowTitle : typeRole.body, surface.ink.hex, ink.secondary),
      )
      .setFontSize(target ? 15 : 13)
      .setWordWrapWidth(inner.width);
    clampLines(subtitle, 2);
    if (target?.cardId)
      this.#headerHover = {
        rect: { x: inner.x, y, width: inner.width, height: subtitle.height },
        cardId: target.cardId,
      };
    y += subtitle.height + 6;

    // What the last press did, or why the engine refused it: words, with a mark, never colour alone.
    const note = this.#error
      ? { text: `✕ ${this.#error}`, color: accent.heroRed.hex }
      : this.#done
        ? { text: `✓ Done: ${this.#done}`, color: surface.ink.hex }
        : null;
    if (note) {
      const line = this.add
        .text(inner.x, y, note.text, textStyle(typeRole.label, note.color, 1))
        .setFontSize(12)
        .setWordWrapWidth(inner.width);
      clampLines(line, 2);
      y += line.height + 6;
    } else if (target) y += 22; // the result line's room, so the buttons stay put when it appears

    const footerY = inner.y + inner.height - hit.primary;
    const bodyRect: Rect = { x: inner.x, y: y + 4, width: inner.width, height: Math.max(0, footerY - 12 - (y + 4)) };
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    const clip = (): Rect | null => this.#list?.rect ?? null;
    const suppressClick = (): boolean => this.#list?.isDragSuppressingClick ?? false;

    if (model && !model.unavailable) {
      if (target) this.#drawChoices(target, bodyRect, clip, suppressClick, stops, order);
      else this.#drawTargets(model, bodyRect, clip, suppressClick, stops, order);
    }

    const done: Rect = target
      ? { x: inner.x + (inner.width + 12) / 2, y: footerY, width: (inner.width - 12) / 2, height: hit.primary }
      : { x: inner.x, y: footerY, width: inner.width, height: hit.primary };
    if (target) {
      const backRect: Rect = { x: inner.x, y: footerY, width: (inner.width - 12) / 2, height: hit.primary };
      const back = new McButton(this, {
        kind: "secondary",
        label: "Back to the list",
        type: BUTTON_TYPE,
        rect: backRect,
        onClick: () => this.#back(),
      });
      this.#buttons.push(back);
      stops.set("back", { rect: backRect, activate: () => this.#back() });
      order.push("back");
    }
    const doneButton = new McButton(this, {
      kind: "primary",
      label: "Done",
      type: BUTTON_TYPE,
      rect: done,
      onClick: () => this.#close(),
    });
    this.#buttons.push(doneButton);
    this.#hints.button(doneButton, [target ? "activate" : "cancel"], "ink");
    stops.set("done", { rect: done, activate: () => this.#close() });
    order.push("done");

    this.#route?.set(order, stops);
    this.#hover?.onDraw();
  }

  #drawTargets(
    model: AdjustModel,
    rect: Rect,
    clip: () => Rect | null,
    suppressClick: () => boolean,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const rows = this.#rowsOf(model);
    const renderRow = (index: number, at: Rect): VirtualListRow => {
      const row = rows[index]!;
      const objects: Phaser.GameObjects.GameObject[] = [];
      if (row.kind === "heading") {
        const text = this.add
          .text(at.x + 4, at.y + 8, row.title.toUpperCase(), textStyle(typeRole.label, surface.ink.hex, ink.secondary))
          .setFontSize(11);
        fitText(text, at.width - 16, 11);
        objects.push(text);
        return { objects };
      }
      const { target } = row;
      const button = new McButton(this, {
        kind: "secondary",
        label: target.detail ? `${target.name} · ${target.detail}` : target.name,
        type: BUTTON_TYPE,
        rect: { x: at.x + 4, y: at.y + 3, width: at.width - 14, height: ROW_HEIGHT - 6 },
        wrap: true,
        onClick: () => this.#pick(target),
        clip,
        suppressClick,
      });
      objects.push(button.container);
      return { objects };
    };
    this.#list = new McVirtualList(this, {
      rect,
      rowHeight: ROW_HEIGHT,
      rowHeightOf: (index) => (rows[index]!.kind === "heading" ? HEADING_HEIGHT : ROW_HEIGHT),
      count: rows.length,
      renderRow,
      scroll: this.#listScroll,
    });
    const list = this.#list;
    rows.forEach((row, index) => {
      if (row.kind !== "target") return;
      const key = `target:${row.target.id}`;
      stops.set(key, {
        rect: () => list.rectFor(index),
        activate: () => this.#pick(row.target),
        ensureVisible: () => list.scrollIntoView(index),
      });
      order.push(key);
    });
  }

  #drawChoices(
    target: AdjustTarget,
    rect: Rect,
    clip: () => Rect | null,
    suppressClick: () => boolean,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const columns = 2;
    const rowCount = Math.ceil(target.choices.length / columns);
    const gap = 8;
    const cellWidth = (rect.width - 14 - gap) / columns;
    const buttonRectOf = (at: Rect, column: number): Rect => ({
      x: at.x + 4 + column * (cellWidth + gap),
      y: at.y + 3,
      width: cellWidth,
      height: ROW_HEIGHT - 6,
    });
    const renderRow = (index: number, at: Rect): VirtualListRow => {
      const objects: Phaser.GameObjects.GameObject[] = [];
      for (let column = 0; column < columns; column++) {
        const picked = target.choices[index * columns + column];
        if (!picked) continue;
        const button = new McButton(this, {
          kind: "secondary",
          label: picked.label,
          type: BUTTON_TYPE,
          rect: buttonRectOf(at, column),
          wrap: true,
          onClick: () => this.#apply(picked),
          clip,
          suppressClick,
        });
        objects.push(button.container);
      }
      return { objects };
    };
    this.#list = new McVirtualList(this, {
      rect,
      rowHeight: ROW_HEIGHT,
      count: rowCount,
      renderRow,
      scroll: this.#targetScroll,
    });
    const list = this.#list;
    target.choices.forEach((picked, index) => {
      const row = Math.floor(index / columns);
      const key = `choice:${index}`;
      stops.set(key, {
        rect: () => buttonRectOf(list.rectFor(row), index % columns),
        activate: () => this.#apply(picked),
        ensureVisible: () => list.scrollIntoView(row),
      });
      order.push(key);
    });
  }
}

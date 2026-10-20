/**
 * "Pick a deck" (GitHub #219): the submenu Take your seats opens when a hero tile stands for several decks (a precon
 * for each aspect, the player's saved decks, tested community decks). One row per deck: the hero's picture, the deck's
 * name, its aspect stamps, where it came from, its card count, whether it is legal in words, and a Seat button.
 *
 * It decides nothing. The caller words each row from the facts the shelf tile already used (`view/hero-deck-groups.ts`)
 * and handles the pick with the very code a tap on a single-deck tile runs, so blocked reasons, locked decks and name
 * conflicts behave exactly as before. Like the other sheets it switches off the launching screen's input while up.
 */
import type { PictureFocus } from "../art/focus.js";
import Phaser from "phaser";
import { accent, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { cardFaces } from "../art/card-face-baker.js";
import { textStyle } from "../ui/theme.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { McButton, clampLines, fitText } from "../ui/widgets.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import type { HeroDeckRow } from "../view/hero-deck-groups.js";
import type { Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { renderArtThumb } from "./roster-panel.js";
import { SCENES } from "./keys.js";

export interface HeroDecksSheetRow {
  readonly row: HeroDeckRow;
  readonly stamps: readonly { readonly label: string; readonly fill: number; readonly ink: number }[];
}

export interface HeroDecksSheetData {
  /** The scene that asked: its pointer input is off while this is up. */
  readonly from: string;
  readonly heroName: string;
  /** The hero's identity card, which the pictures' hover popover shows. */
  readonly identityCardId: string;
  readonly artUrl: string | null;
  /** The hero art's focus point (`Picture.focus`), when `artUrl` is hero art. */
  readonly artFocus?: PictureFocus;
  readonly rows: readonly HeroDecksSheetRow[];
  /** The player chose a deck: the sheet is already closed. */
  readonly onPick: (deckId: string) => void;
}

const ROW_HEIGHT = 104;
const ROW_PAD = 10;
const THUMB_WIDTH = 56;
const THUMB_HEIGHT = ROW_HEIGHT - 6 - ROW_PAD * 2;
const BUTTON_TYPE = { ...typeRole.label, size: 12 };
const STAMP_TYPE = { ...typeRole.label, size: 9 };

/** A status word is never color alone: a leading mark says which kind it is. */
const STATUS_MARK = { ok: "✓", warning: "!", blocked: "✕", locked: "Locked ·" } as const;

export class HeroDecksSheet extends Phaser.Scene {
  #data!: HeroDecksSheetData;
  #buttons: McButton[] = [];
  #list: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  #scroll = new ListScroll();
  #hover: HoverPreview | null = null;

  constructor() {
    super(SCENES.heroDecks);
  }

  create(data: HeroDecksSheetData): void {
    this.#data = data;
    this.#scroll = new ListScroll();
    const from = this.scene.get(data.from);
    if (from) from.input.enabled = false;
    this.input.enabled = true;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCards(),
      area: (pointer) => screenHoverArea(this, pointer, { blocked: () => this.scene.isActive(SCENES.inspect) }),
    });
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect),
      onCancel: () => this.#close(),
      onPage: (direction) => this.#list?.scrollByPage(direction),
    });
    const offBaked = cardFaces(this).onBaked(() => this.#list?.layout(this.#list.rect));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offBaked();
      this.scale.off("resize", onResize, this);
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

  #close(): void {
    this.scene.stop();
  }

  #pick(deckId: string): void {
    const { onPick } = this.#data;
    this.scene.stop();
    onPick(deckId);
  }

  /** Where row `index`'s picture is on screen now. */
  #thumbRect(rowRect: Rect): Rect {
    return { x: rowRect.x + 4 + ROW_PAD, y: rowRect.y + ROW_PAD, width: THUMB_WIDTH, height: THUMB_HEIGHT };
  }

  /** The hero picture of every row on screen (the list scrolls without a draw), clipped to the list's window. */
  #hoverCards(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const list = this.#list;
    if (!list) return found;
    this.#data.rows.forEach((_, index) => {
      const rect = clipHoverRect(this.#thumbRect(list.rectFor(index)), list.rect);
      if (!rect) return;
      const cardId = this.#data.identityCardId;
      found.set(hoverSlotOf(cardId, `deck${index}`), { ...rect, cardId, face: { kind: "hero" }, through: true });
    });
    return found;
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#list?.destroy();
    this.#list = null;
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);

    const phone = width < 600;
    const margin = phone ? 8 : 24;
    const boxWidth = Math.min(680, width - margin * 2);
    const boxX = (width - boxWidth) / 2;
    const innerWidth = boxWidth - 32;
    const { rows } = this.#data;
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];

    const ground = this.add.graphics();
    const title = this.add.text(boxX + 16, 0, this.#data.heroName, textStyle(typeRole.barTitle, surface.ink.hex));
    fitText(title, innerWidth, typeRole.barTitle.size);
    const subtitle = this.add
      .text(
        boxX + 16,
        0,
        `${rows.length} decks. Pick the one this seat plays.`,
        textStyle(typeRole.body, surface.ink.hex, ink.secondary),
      )
      .setFontSize(13)
      .setWordWrapWidth(innerWidth);
    clampLines(subtitle, 2);

    const headerHeight = title.height + 4 + subtitle.height + 12;
    const chrome = 16 + headerHeight + 12 + hit.primary + 16;
    const maxHeight = height - margin * 2;
    const boxHeight = Math.min(maxHeight, chrome + rows.length * ROW_HEIGHT + 8);
    const box: Rect = { x: boxX, y: Math.round((height - boxHeight) / 2), width: boxWidth, height: boxHeight };
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    const inner: Rect = { x: box.x + 16, y: box.y + 16, width: innerWidth, height: box.height - 32 };
    title.setPosition(inner.x, inner.y);
    subtitle.setPosition(inner.x, title.y + title.height + 4);

    const footerY = inner.y + inner.height - hit.primary;
    const listTop = subtitle.y + subtitle.height + 12;
    const listRect: Rect = { x: inner.x, y: listTop, width: inner.width, height: footerY - 12 - listTop };

    const clip = (): Rect | null => this.#list?.rect ?? null;
    const suppressClick = (): boolean => this.#list?.isDragSuppressingClick ?? false;
    const buttonWidth = phone ? 76 : 96;
    const buttonRectOf = (rowRect: Rect): Rect => ({
      x: rowRect.x + 4 + (rowRect.width - 12) - ROW_PAD - buttonWidth,
      y: rowRect.y + (ROW_HEIGHT - 6 - hit.target) / 2,
      width: buttonWidth,
      height: hit.target,
    });

    const renderRow = (index: number, rect: Rect): VirtualListRow => {
      const { row, stamps } = rows[index]!;
      const body: Rect = { x: rect.x + 4, y: rect.y, width: rect.width - 12, height: ROW_HEIGHT - 6 };
      const objects: Phaser.GameObjects.GameObject[] = [];
      const g = this.add.graphics();
      g.fillStyle(surface.parchment.hex, 1).fillRect(body.x, body.y, body.width, body.height);
      g.lineStyle(2, surface.ink.hex, 1).strokeRect(body.x, body.y, body.width, body.height);
      objects.push(g);
      objects.push(renderArtThumb(this, this.#thumbRect(rect), this.#data.artUrl, 0.2, this.#data.artFocus));

      const textX = body.x + ROW_PAD + THUMB_WIDTH + 10;
      const textWidth = body.x + body.width - ROW_PAD - buttonWidth - 10 - textX;
      const name = this.add.text(textX, body.y + ROW_PAD, row.title, textStyle(typeRole.rowTitle, surface.ink.hex));
      fitText(name, textWidth, typeRole.rowTitle.size);
      objects.push(name);

      // Aspect stamps: the aspect's own card-frame color with its name on it, so the color is never the only clue.
      let stampX = textX;
      const stampY = body.y + ROW_PAD + 24;
      for (const stamp of stamps) {
        const text = this.add
          .text(0, 0, stamp.label.toUpperCase(), textStyle(STAMP_TYPE, stamp.ink))
          .setPadding(5, 2, 5, 2);
        const stampWidth = text.width;
        if (stampX + stampWidth > textX + textWidth) {
          text.destroy();
          break;
        }
        g.fillStyle(stamp.fill, 1).fillRect(stampX, stampY, stampWidth, text.height);
        g.lineStyle(1, surface.ink.hex, 1).strokeRect(stampX + 0.5, stampY + 0.5, stampWidth - 1, text.height - 1);
        text.setPosition(stampX, stampY);
        objects.push(text);
        stampX += stampWidth + 4;
      }

      const meta = this.add.text(
        textX,
        body.y + ROW_PAD + 46,
        `${row.source} · ${row.cards}`,
        textStyle(typeRole.label, surface.ink.hex, ink.label),
      );
      fitText(meta, textWidth, typeRole.label.size);
      objects.push(meta);

      const statusColor =
        row.statusKind === "ok"
          ? signal.heal.hex
          : row.statusKind === "warning"
            ? surface.ink.hex
            : row.statusKind === "locked"
              ? surface.ink.hex
              : accent.heroRed.hex;
      const status = this.add.text(
        textX,
        body.y + ROW_PAD + 62,
        `${STATUS_MARK[row.statusKind]} ${row.status}`,
        textStyle(typeRole.label, statusColor, 1),
      );
      fitText(status, textWidth, typeRole.label.size);
      objects.push(status);

      const seat = new McButton(this, {
        kind: row.enabled && row.action !== "Seated" ? "primary" : "secondary",
        label: row.action,
        type: BUTTON_TYPE,
        rect: buttonRectOf(rect),
        enabled: row.enabled,
        ...(row.enabled ? {} : { reason: row.status }),
        onClick: () => this.#pick(row.deckId),
        clip,
        suppressClick,
      });
      objects.push(seat.container);
      return { objects };
    };

    this.#list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: ROW_HEIGHT,
      count: rows.length,
      renderRow,
      scroll: this.#scroll,
    });
    const list = this.#list;
    rows.forEach(({ row }, index) => {
      const key = `deck:${row.deckId}`;
      stops.set(key, {
        rect: () => {
          const at = list.rectFor(index);
          return buttonRectOf({ ...at, x: at.x, width: at.width });
        },
        activate: () => (row.enabled ? this.#pick(row.deckId) : undefined),
        ensureVisible: () => list.scrollIntoView(index),
      });
      order.push(key);
    });

    const closeRect: Rect = { x: inner.x, y: footerY, width: inner.width, height: hit.primary };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Back",
        type: BUTTON_TYPE,
        rect: closeRect,
        onClick: () => this.#close(),
      }),
    );
    stops.set("back", { rect: closeRect, activate: () => this.#close() });
    order.push("back");

    this.#route?.set(order, stops);
    this.#hover?.onDraw();
  }
}

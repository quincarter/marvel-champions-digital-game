/**
 * "Pick a deck" (GitHub #219): the submenu Take your seats opens when a hero tile stands for several decks (a precon
 * for each aspect, the player's saved decks, tested community decks). One row per deck: the hero's picture, the deck's
 * name, its aspect stamps, where it came from, its card count, whether it is legal in words, and a Seat button.
 *
 * It decides nothing. The caller words each row from the facts the shelf tile already used (`view/hero-deck-groups.ts`)
 * and handles the pick with the very code a tap on a single-deck tile runs, so blocked reasons, locked decks and name
 * conflicts behave exactly as before. Like the other sheets it switches off the launching screen's input while up.
 *
 * The box, the rows and their buttons are a Lit pop-up panel over the canvas (`dom/popup-sheet.ts`), so Take your seats
 * stays shown under its scrim; the list scrolls natively and every control is a tap (a swipe's lift presses no Seat
 * button: the "no tap on finger lift" rule, issue #227). The card hover popover over each row's picture is drawn in the
 * canvas and seen through a hole.
 */
import Phaser from "phaser";
import type { Picture } from "../art/pictures.js";
import { PackLeases, refreshPackArt } from "../art/pack-art.js";
import { currentCardsById } from "../content/pool.js";
import { onArtChange } from "../language-change.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { heroTilePictureOf } from "../dom/hero-picture.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { t } from "../i18n/translate.js";
import { accent, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import type { HeroDeckRow } from "../view/hero-deck-groups.js";
import type { Rect } from "../view/layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
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
  /** The picture the screen chose for the hero (its tile copy is used); null: the identity's printed scan. The sheet holds its own leases on it. */
  readonly picture: Picture | null;
  readonly rows: readonly HeroDecksSheetRow[];
  /** The player chose a deck: the sheet is already closed. */
  readonly onPick: (deckId: string) => void;
}

export const ROW_HEIGHT = 104;
const ROW_PAD = 10;
const THUMB_WIDTH = 56;
const THUMB_HEIGHT = ROW_HEIGHT - 6 - ROW_PAD * 2;
const BUTTON_TYPE = { ...typeRole.label, size: 12 };
const STAMP_TYPE = { ...typeRole.label, size: 9 };
const LIST = "decks-list";

/** A status word is never color alone: a leading mark says which kind it is. */
const STATUS_MARK = { ok: "✓", warning: "!", blocked: "✕", locked: "" } as const;

export class HeroDecksSheet extends Phaser.Scene {
  #data!: HeroDecksSheetData;
  #panel!: PopupSheet;
  #glyphs!: SheetGlyphs;
  #route: FocusRoute | null = null;
  #hover: HoverPreview | null = null;
  #actions = new Map<string, () => void>();
  /** Each row's picture in the list's own coordinates, and the box the list shows (what a hover rect is clipped to). */
  #thumbs: Rect[] = [];
  #listRect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  #from: Phaser.Scene | null = null;
  /** The hero picture's blob URL, held while the rows' lazy images may still load it. */
  readonly #leases = new PackLeases();

  constructor() {
    super(SCENES.heroDecks);
  }

  create(data: HeroDecksSheetData): void {
    this.#data = data;
    this.#from = this.scene.get(data.from) ?? null;
    if (this.#from) this.#from.input.enabled = false;
    this.input.enabled = true;
    this.#panel = new PopupSheet(this, (key) => this.#actions.get(key)?.(), undefined, {
      onDismiss: () => this.#close(),
      // A pack picture's URL went stale before its lazy image loaded: read it again.
      onImageError: (key, src) => refreshPackArt(key, src ?? undefined),
    });
    this.#glyphs = new SheetGlyphs(this, () => this.#draw());
    this.scale.on("resize", this.#draw, this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCards(),
      area: (pointer) => screenHoverArea(this, pointer, { blocked: () => this.scene.isActive(SCENES.inspect) }),
    });
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.scene.isActive(SCENES.inspect) || this.#panel.leaving,
      onCancel: () => this.#close(),
      onPage: (direction) => {
        const scroller = this.#scroller();
        scroller?.scrollBy({ top: direction * scroller.clientHeight * 0.85 });
      },
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
    });
    // A picture that resolves later (a pack's) draws in place of the plain ground.
    const offArt = onArtChange(() => {
      if (this.sys.isActive()) this.#draw();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offArt();
      this.#leases.dispose();
      this.#glyphs.dispose();
      this.scale.off("resize", this.#draw, this);
      this.#hover?.destroy();
      this.#hover = null;
      if (this.#from) this.#from.input.enabled = true;
    });
    this.#draw();
  }

  #scroller(): HTMLElement | null {
    return this.#panel.element?.elementOf(LIST) ?? null;
  }

  #close(): void {
    this.#panel.close();
  }

  #pick(deckId: string): void {
    const { onPick } = this.#data;
    this.#panel.close(() => onPick(deckId));
  }

  /** The hero picture of every row on screen, clipped to the list's window: the list scrolls without a draw. */
  #hoverCards(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const scrolled = this.#scroller()?.scrollTop ?? 0;
    const cardId = this.#data.identityCardId;
    this.#thumbs.forEach((thumb, index) => {
      const rect = clipHoverRect({ ...thumb, y: thumb.y - scrolled + this.#listRect.y }, this.#listRect);
      if (rect)
        found.set(hoverSlotOf(cardId, `deck${index}`), { ...rect, cardId, face: { kind: "hero" }, through: true });
    });
    return found;
  }

  /** An element of the panel in game coordinates (it follows the list's scroll), or `fallback` while it is not drawn. */
  #boxOf(key: string, fallback: Rect): Rect {
    const found = this.#panel.element?.elementOf(key);
    return (found ? this.#panel.rectOf(found) : null) ?? fallback;
  }

  #draw(): void {
    this.#leases.begin();
    const picture = heroTilePictureOf(
      this.#data.picture,
      currentCardsById().get(this.#data.identityCardId),
      this.#leases,
    );
    this.#glyphs.reset();
    this.#actions = new Map();
    this.#thumbs = [];
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    const { width, height } = this.scale.gameSize;
    // Swallows every press that lands on no control of this pop-up's own.
    destroyChildren(this);
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();

    const b = this.#panel.begin(width, height);
    const phone = width < 600;
    const margin = phone ? 8 : 24;
    const boxWidth = Math.min(680, width - margin * 2);
    const innerWidth = boxWidth - 32;
    const { rows } = this.#data;

    const titleSize = b.measure(this.#data.heroName, typeRole.barTitle, { fitWidth: innerWidth });
    const subtitleText = t("seats.decksSheetSubtitle", { count: rows.length });
    const subtitle = b.measure(subtitleText, typeRole.body, { size: 13, wrapWidth: innerWidth, maxLines: 2 });
    const headerHeight = titleSize.height + 4 + subtitle.height + 12;
    const chrome = 16 + headerHeight + 12 + hit.primary + 16;
    const boxHeight = Math.min(height - margin * 2, chrome + rows.length * ROW_HEIGHT + 8);
    const box: Rect = {
      x: (width - boxWidth) / 2,
      y: Math.round((height - boxHeight) / 2),
      width: boxWidth,
      height: boxHeight,
    };
    b.box(box, { fill: surface.paper.hex });
    b.box(box, { stroke: surface.ink.hex, strokeWidth: 4 });
    const inner: Rect = { x: box.x + 16, y: box.y + 16, width: innerWidth, height: box.height - 32 };
    b.text(inner.x, inner.y, this.#data.heroName, typeRole.barTitle, { color: surface.ink.hex, fitWidth: innerWidth });
    b.text(inner.x, inner.y + titleSize.height + 4, subtitleText, typeRole.body, {
      size: 13,
      color: surface.ink.hex,
      alpha: ink.secondary,
      wrapWidth: innerWidth,
      maxLines: 2,
    });

    const footerY = inner.y + inner.height - hit.primary;
    const listTop = inner.y + titleSize.height + 4 + subtitle.height + 12;
    const listRect: Rect = { x: inner.x, y: listTop, width: inner.width - 12, height: footerY - 12 - listTop };
    this.#listRect = { ...listRect, width: listRect.width + 12 };
    const buttonWidth = phone ? 76 : 96;
    b.scrollFit(LIST, listRect, (list) => {
      rows.forEach(({ row, stamps }, index) => {
        const top = index * ROW_HEIGHT;
        const body: Rect = { x: listRect.x + 4, y: top, width: listRect.width - 12, height: ROW_HEIGHT - 6 };
        list.box(body, { fill: surface.parchment.hex });
        list.box(body, { stroke: surface.ink.hex, strokeWidth: 2 });
        const thumb: Rect = { x: body.x + ROW_PAD, y: top + ROW_PAD, width: THUMB_WIDTH, height: THUMB_HEIGHT };
        this.#thumbs.push(thumb);
        list.image(thumb, {
          src: picture.src,
          fill: surface.parchment.hex,
          cover: picture.cover,
          key: `deck-thumb:${row.deckId}`,
          ...(picture.retry !== undefined ? { retry: picture.retry } : {}),
        });
        list.box(thumb, { stroke: surface.ink.hex, strokeWidth: 1.5, alpha: ink.label });

        const textX = thumb.x + THUMB_WIDTH + 10;
        const textWidth = body.x + body.width - ROW_PAD - buttonWidth - 10 - textX;
        list.text(textX, top + ROW_PAD, row.title, typeRole.rowTitle, { color: surface.ink.hex, fitWidth: textWidth });
        // Aspect stamps: the aspect's own card-frame color with its name on it, so the color is never the only clue.
        let stampX = textX;
        const stampY = top + ROW_PAD + 24;
        for (const stamp of stamps) {
          const word = stamp.label.toUpperCase();
          const stampWidth = list.measure(word, STAMP_TYPE).width + 10;
          if (stampX + stampWidth > textX + textWidth) break;
          list.box({ x: stampX, y: stampY, width: stampWidth, height: 16 }, { fill: stamp.fill });
          list.box(
            { x: stampX + 0.5, y: stampY + 0.5, width: stampWidth - 1, height: 15 },
            { stroke: surface.ink.hex, strokeWidth: 1 },
          );
          list.text(stampX + 5, stampY + 8, word, STAMP_TYPE, { color: stamp.ink, origin: [0, 0.5] });
          stampX += stampWidth + 4;
        }
        list.text(textX, top + ROW_PAD + 46, `${row.source} · ${row.cards}`, typeRole.label, {
          color: surface.ink.hex,
          alpha: ink.label,
          fitWidth: textWidth,
        });
        const statusColor =
          row.statusKind === "ok"
            ? signal.heal.hex
            : row.statusKind === "warning" || row.statusKind === "locked"
              ? surface.ink.hex
              : accent.heroRed.hex;
        list.text(
          textX,
          top + ROW_PAD + 62,
          `${row.statusKind === "locked" ? t("seats.lockedMark") : STATUS_MARK[row.statusKind]} ${row.status}`,
          typeRole.label,
          { color: statusColor, fitWidth: textWidth },
        );
        const button: Rect = {
          x: body.x + body.width - ROW_PAD - buttonWidth,
          y: top + (ROW_HEIGHT - 6 - hit.target) / 2,
          width: buttonWidth,
          height: hit.target,
        };
        const key = `deck:${row.deckId}`;
        list.button({
          key,
          rect: button,
          label: row.action,
          look: row.enabled ? "primary" : "secondary",
          type: BUTTON_TYPE,
          ...(row.enabled ? {} : { disabled: row.status }),
        });
        this.#actions.set(key, () => (row.enabled ? this.#pick(row.deckId) : undefined));
        stops.set(key, {
          rect: () => this.#boxOf(key, { ...button, y: button.y + listTop }),
          activate: () => (row.enabled ? this.#pick(row.deckId) : undefined),
          view: () => this.#boxOf(LIST, this.#listRect),
          ensureVisible: () => this.#panel.element?.elementOf(key)?.scrollIntoView({ block: "nearest" }),
        });
        order.push(key);
      });
      return rows.length * ROW_HEIGHT;
    });

    const closeRect: Rect = { x: inner.x, y: footerY, width: inner.width, height: hit.primary };
    this.#glyphs.button(b, {
      key: "back",
      rect: closeRect,
      label: t("common.back"),
      look: "secondary",
      type: BUTTON_TYPE,
      ids: ["cancel"],
      ground: "paper",
    });
    this.#actions.set("back", () => this.#close());
    stops.set("back", { rect: closeRect, activate: () => this.#close() });
    order.push("back");

    this.#panel.mount(b, width, height, () => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
    this.#panel.forwardMouseMoves();
    this.#leases.end();
    this.#route?.set(order, stops);
    this.#hover?.onDraw();
  }
}

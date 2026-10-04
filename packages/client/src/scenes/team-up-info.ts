/**
 * The Team-Up panel: what a pair gives the table, opened from the badge on the Board's top bar
 * (`scenes/board/team-up-badge.ts`). Read `view/team-up-model.ts#teamUpDetail` for the content; this only draws it.
 *
 * Static, launched over the Board with a snapshot of the detail. Dismissed by Escape, the Close button, or a tap
 * outside the panel; every listed card opens Inspect (`SCENES.inspect`, brought above this overlay), and all of it is
 * reachable by the focus route. Informational only: it sends no command.
 */
import Phaser from "phaser";
import { ensurePictureLoaded, type Picture } from "../art/pictures.js";
import { accent, hit, surface, typeRole } from "../tokens.js";
import { setMask } from "../ui/rex.js";
import { textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { destroyChildren } from "../ui/destroy-children.js";
import type { Rect } from "../view/layout.js";
import type { TeamUpDetail } from "../view/team-up-model.js";
import { bakedBadge } from "./board/team-up-badge.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface TeamUpInfoData {
  readonly detail: TeamUpDetail;
  /** The pair's picture (its closeup, else its full picture), shown again in a circle at the top; null with no art. */
  readonly picture: Picture | null;
  /** The scene that asked: its pointer and keys are off while this is up. */
  readonly from: string;
}

const PAD = 18;
/** The circle at the top of the panel: its diameter on a wide screen and on a phone, and its ring. */
const PORTRAIT = { wide: 112, narrow: 84, ring: 4, gap: 10 } as const;

export class TeamUpInfoOverlay extends Phaser.Scene {
  #data!: TeamUpInfoData;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #masks: Phaser.GameObjects.Graphics[] = [];
  /** The cards list scrolls when the panel is taller than the screen; its position survives a redraw (a resize). */
  #region: McScrollRegion | null = null;
  readonly #scroll = new VariableListScroll();

  constructor() {
    super(SCENES.teamUpInfo);
  }

  create(data: TeamUpInfoData): void {
    this.#data = data;
    const from = this.scene.get(data.from);
    if (from) {
      from.input.enabled = false;
      if (from.input.keyboard) from.input.keyboard.enabled = false;
    }
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect),
      onCancel: () => this.scene.stop(),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      for (const mask of this.#masks) mask.destroy();
      this.#masks = [];
      this.#region?.destroy();
      this.#region = null;
      if (from) {
        from.input.enabled = true;
        if (from.input.keyboard) from.input.keyboard.enabled = true;
      }
    });
    this.#draw();
  }

  #inspect(cardId: string): void {
    this.scene.launch(SCENES.inspect, { card: { cardId, face: { kind: "front" } } });
    this.scene.bringToTop(SCENES.inspect);
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    for (const mask of this.#masks) mask.destroy();
    this.#masks = [];
    this.#region?.destroy();
    this.#region = null;
    destroyChildren(this);
    const { detail, picture } = this.#data;
    const { width, height } = this.scale.gameSize;

    // Outside the panel closes; the panel's own zone (below) swallows taps meant for it.
    this.add
      .zone(0, 0, width, height)
      .setOrigin(0, 0)
      .setInteractive()
      .on("pointerdown", () => this.scene.stop());
    this.add.graphics().fillStyle(surface.void.hex, 0.75).fillRect(0, 0, width, height);

    const boxWidth = Math.min(560, width - 24);
    const textWidth = boxWidth - PAD * 2;
    const ground = this.add.graphics();
    let y = 0;
    const texts: Phaser.GameObjects.Text[] = [];
    const place = (text: Phaser.GameObjects.Text, gap: number): Phaser.GameObjects.Text => {
      y += gap;
      text.setPosition(PAD, y);
      y += text.height;
      texts.push(text);
      return text;
    };
    const wrapped = (value: string, style: ReturnType<typeof textStyle>, size?: number): Phaser.GameObjects.Text => {
      const t = this.add.text(0, 0, value, style).setWordWrapWidth(textWidth).setLineSpacing(3);
      if (size) t.setFontSize(size);
      return t;
    };
    y = PAD;
    // The pair's picture again, in a circle above the title (the same crop the Board's badge shows).
    const portrait = picture ? (width < 520 ? PORTRAIT.narrow : PORTRAIT.wide) : 0;
    const portraitTop = y;
    if (portrait > 0) y += portrait + PORTRAIT.gap;
    texts.push(
      this.add
        .text(PAD, y, detail.title.toUpperCase(), textStyle(typeRole.barTitle, surface.ink.hex))
        .setWordWrapWidth(textWidth),
    );
    y += texts[0]!.height;
    place(wrapped(detail.rule, textStyle(typeRole.body, surface.ink.hex, 0.9), 14), 8);
    place(
      wrapped(
        detail.providers.map((p) => `${p.name}: ${p.by}.`).join("\n"),
        textStyle(typeRole.emphasis, surface.ink.hex),
        14,
      ),
      8,
    );
    place(wrapped(detail.status, textStyle(typeRole.body, surface.ink.hex, 0.9), 14), 6);

    // Each card row: name and cost, its text, where its copies are. Tap or Enter opens Inspect. The rows live in a
    // scrolling region, so a pair with many Team-Up cards (or a short phone) never pushes Close off the screen.
    const headerBottom = y;
    const rowTexts: Phaser.GameObjects.Text[][] = [];
    const cardRows: { top: number; height: number; cardId: string }[] = [];
    let contentY = 0;
    for (const card of detail.cards) {
      const top = contentY + 8;
      let cursor = top;
      const parts = [
        wrapped(`${card.name}  (cost ${card.cost})`, textStyle(typeRole.rowTitle, surface.ink.hex), 15),
        wrapped(card.text, textStyle(typeRole.body, surface.ink.hex, 0.9), 13),
        wrapped(card.copies.join("; "), textStyle(typeRole.label, surface.ink.hex, 0.75)),
      ];
      parts.forEach((part, index) => {
        cursor += index === 0 ? 6 : 4;
        part.setData("rel", cursor);
        cursor += part.height;
      });
      rowTexts.push(parts);
      cardRows.push({ top, height: cursor - top + 8, cardId: card.cardId });
      contentY = cursor + 8;
    }

    const buttonHeight = hit.primary;
    const fixedHeight = headerBottom + 8 + 16 + buttonHeight + PAD;
    const regionHeight = Math.max(0, Math.min(contentY, height - 24 - fixedHeight));
    const boxHeight = fixedHeight + regionHeight;
    const box: Rect = {
      x: Math.round((width - boxWidth) / 2),
      y: Math.max(12, Math.round((height - boxHeight) / 2)),
      width: boxWidth,
      height: boxHeight,
    };
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    for (const text of texts) text.setPosition(box.x + text.x, box.y + text.y).setDepth(2);
    if (picture && portrait > 0) {
      const radius = portrait / 2;
      const cx = box.x + box.width / 2;
      const cy = box.y + portraitTop + radius;
      ground.fillStyle(surface.ink.hex, 1).fillCircle(cx, cy, radius);
      const key = ensurePictureLoaded(this, picture, () => this.#draw());
      if (key) {
        const source = this.textures.get(key).getSourceImage() as { width: number; height: number };
        const baked = bakedBadge(this, key, source, portrait * 2);
        const image = this.add
          .image(cx - radius, cy - radius, baked)
          .setOrigin(0, 0)
          .setDisplaySize(portrait, portrait)
          .setDepth(2);
        const mask = this.make.graphics({}, false);
        mask.fillStyle(0xffffff).fillCircle(cx, cy, radius);
        this.#masks.push(mask);
        setMask(image, mask, "world");
      }
      this.add
        .graphics()
        .setDepth(3)
        .lineStyle(PORTRAIT.ring, accent.heroRed.hex, 1)
        .strokeCircle(cx, cy, radius - PORTRAIT.ring / 2);
    }
    this.add.zone(box.x, box.y, box.width, box.height).setOrigin(0, 0).setInteractive();

    // The scrolling list of cards: objects at their screen position with the list at the top, the region moves them.
    const regionRect: Rect = { x: box.x, y: box.y + headerBottom + 8, width: box.width, height: regionHeight };
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    if (cardRows.length > 0 && regionHeight > 0) {
      const region = new McScrollRegion(this, {
        rect: regionRect,
        heights: cardRows.map((row, i) => row.height + (i === cardRows.length - 1 ? 8 : 8)),
        scroll: this.#scroll,
        clipInteractive: true,
      });
      this.#region = region;
      region.root.setDepth(2);
      cardRows.forEach((row, i) => {
        for (const part of rowTexts[i]!) part.setPosition(box.x + PAD, regionRect.y + (part.getData("rel") as number));
        region.content.add(rowTexts[i]!);
        const zone = this.add
          .zone(box.x + 6, regionRect.y + row.top - 4, box.width - 12, row.height)
          .setOrigin(0, 0)
          .setInteractive({ useHandCursor: true })
          .on("pointerup", () => this.#inspect(row.cardId));
        region.content.add(zone);
        const outline = this.add.graphics();
        outline
          .lineStyle(1, surface.ink.hex, 0.3)
          .strokeRect(box.x + 6, regionRect.y + row.top - 4, box.width - 12, row.height);
        region.content.add(outline);
        const key = `card:${row.cardId}`;
        stops.set(key, {
          rect: () => ({
            x: box.x + 6,
            y: regionRect.y + row.top - 4 - this.#scroll.offsetPx,
            width: box.width - 12,
            height: row.height,
          }),
          activate: () => this.#inspect(row.cardId),
          inspect: () => this.#inspect(row.cardId),
          ensureVisible: () => region.scrollIntoView(i),
        });
        order.push(key);
      });
      region.syncInteractivity();
    }
    const closeRect: Rect = {
      x: box.x + PAD,
      y: box.y + box.height - PAD - buttonHeight,
      width: box.width - PAD * 2,
      height: buttonHeight,
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Close",
        type: { ...typeRole.label, size: 13 },
        rect: closeRect,
        onClick: () => this.scene.stop(),
      }),
    );
    stops.set("close", { rect: closeRect, activate: () => this.scene.stop() });
    order.push("close");
    this.#route?.set(order, stops);

    if (import.meta.env.DEV) {
      (window as unknown as { __mcTeamUpInfoDebug?: unknown }).__mcTeamUpInfoDebug = {
        box: () => box,
        closeRect: () => closeRect,
        cardRects: () =>
          cardRows.map((row) => ({
            x: box.x + 6,
            y: regionRect.y + row.top - 4 - this.#scroll.offsetPx,
            width: box.width - 12,
            height: row.height,
          })),
      };
    }
  }
}

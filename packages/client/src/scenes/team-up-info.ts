/**
 * The Team-Up panel: what a pair gives the table, opened from the badge on the Board's top bar
 * (`scenes/board/team-up-badge.ts`). Read `view/team-up-model.ts#teamUpDetail` for the content; this only draws it.
 *
 * Static, launched over the Board with a snapshot of the detail. Dismissed by Escape, the Close button, or a tap
 * outside the panel; every listed card opens Inspect (`SCENES.inspect`, brought above this overlay), and all of it is
 * reachable by the focus route. Informational only: it sends no command.
 */
import Phaser from "phaser";
import { hit, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { destroyChildren } from "../ui/destroy-children.js";
import type { Rect } from "../view/layout.js";
import type { TeamUpDetail } from "../view/team-up-model.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface TeamUpInfoData {
  readonly detail: TeamUpDetail;
  /** The scene that asked: its pointer and keys are off while this is up. */
  readonly from: string;
}

const PAD = 18;

export class TeamUpInfoOverlay extends Phaser.Scene {
  #data!: TeamUpInfoData;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

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
    destroyChildren(this);
    const { detail } = this.#data;
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
    texts.push(
      this.add
        .text(PAD, y, detail.title.toUpperCase(), textStyle(typeRole.barTitle, surface.ink.hex))
        .setWordWrapWidth(textWidth),
    );
    y += texts[0]!.height;
    place(wrapped(detail.rule, textStyle(typeRole.body, surface.ink.hex, 0.9), 14), 8);
    place(
      wrapped(
        detail.providers.map((p) => `${p.name}: ${p.by}.`).join("  "),
        textStyle(typeRole.emphasis, surface.ink.hex),
        14,
      ),
      8,
    );

    // Each card row: name and cost, its text, where its copies are. Tap or Enter opens Inspect.
    const cardRects: { rect: Rect; cardId: string }[] = [];
    for (const card of detail.cards) {
      const top = y + 14;
      place(wrapped(`${card.name}  (cost ${card.cost})`, textStyle(typeRole.rowTitle, surface.ink.hex), 15), 14);
      place(wrapped(card.text, textStyle(typeRole.body, surface.ink.hex, 0.9), 13), 4);
      place(wrapped(card.copies.join("; "), textStyle(typeRole.label, surface.ink.hex, 0.75)), 4);
      cardRects.push({ rect: { x: 0, y: top - 4, width: boxWidth, height: y - top + 8 }, cardId: card.cardId });
    }

    const buttonHeight = hit.primary;
    const boxHeight = y + 16 + buttonHeight + PAD;
    const box: Rect = {
      x: Math.round((width - boxWidth) / 2),
      y: Math.max(12, Math.round((height - boxHeight) / 2)),
      width: boxWidth,
      height: boxHeight,
    };
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    for (const text of texts) text.setPosition(box.x + text.x, box.y + text.y).setDepth(2);
    this.add.zone(box.x, box.y, box.width, box.height).setOrigin(0, 0).setInteractive();

    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    for (const { rect, cardId } of cardRects) {
      const abs: Rect = { x: box.x + 6, y: box.y + rect.y, width: rect.width - 12, height: rect.height };
      const key = `card:${cardId}`;
      this.add
        .zone(abs.x, abs.y, abs.width, abs.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", () => this.#inspect(cardId));
      ground.lineStyle(1, surface.ink.hex, 0.3).strokeRect(abs.x, abs.y, abs.width, abs.height);
      stops.set(key, { rect: abs, activate: () => this.#inspect(cardId), inspect: () => this.#inspect(cardId) });
      order.push(key);
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
        cardRects: () => cardRects.map((c) => ({ ...c.rect, x: box.x + 6, y: box.y + c.rect.y })),
      };
    }
  }
}

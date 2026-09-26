/**
 * "End your turn? You can still: …" — launched over the Board whenever `BoardController.dispatchExample("endTurn")`
 * finds something meaningful still open and Settings ▸ "Confirm before ending turn" is on
 * (`view/end-turn-confirm.ts`'s own doc comment covers what counts). Modeled on `scenes/unlock-confirm.ts`: same
 * scrim-and-box shape, same input-blocking of the scene underneath while it's up.
 */
import Phaser from "phaser";
import { hit, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import type { Rect } from "../view/layout.js";
import { FocusRoute } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { destroyChildren } from "../ui/destroy-children.js";

const buttonType = { ...typeRole.label, size: 13 };

export interface EndTurnConfirmData {
  readonly sentence: string;
  /** The scene that asked: its pointer input is off while this is up. */
  readonly from: string;
  readonly onConfirm: () => void;
}

export class EndTurnConfirmOverlay extends Phaser.Scene {
  #data!: EndTurnConfirmData;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.endTurnConfirm);
  }

  create(data: EndTurnConfirmData): void {
    this.#data = data;
    const from = this.scene.get(data.from);
    if (from) from.input.enabled = false;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, { onCancel: () => this.#answer(false) });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      if (from) from.input.enabled = true;
    });
    this.#draw();
  }

  #answer(confirmed: boolean): void {
    const { onConfirm } = this.#data;
    this.scene.stop();
    if (confirmed) onConfirm();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);

    const boxWidth = Math.min(560, width - 32);
    const textWidth = boxWidth - 40;
    const ground = this.add.graphics();
    const title = this.add
      .text(0, 0, "End your turn?", textStyle(typeRole.barTitle, surface.ink.hex))
      .setWordWrapWidth(textWidth);
    const body = this.add
      .text(0, 0, this.#data.sentence, textStyle(typeRole.body, surface.ink.hex, 0.9))
      .setFontSize(16)
      .setWordWrapWidth(textWidth)
      .setLineSpacing(4);
    const buttonHeight = hit.primary;
    const boxHeight = 20 + title.height + 12 + body.height + 20 + buttonHeight + 20;
    const box: Rect = {
      x: (width - boxWidth) / 2,
      y: Math.max(16, (height - boxHeight) / 2),
      width: boxWidth,
      height: boxHeight,
    };
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    title.setPosition(box.x + 20, box.y + 20);
    body.setPosition(box.x + 20, title.y + title.height + 12);

    const buttonWidth = (textWidth - 12) / 2;
    const buttonY = box.y + box.height - 20 - buttonHeight;
    const keepRect: Rect = { x: box.x + 20, y: buttonY, width: buttonWidth, height: buttonHeight };
    const endRect: Rect = { x: keepRect.x + buttonWidth + 12, y: buttonY, width: buttonWidth, height: buttonHeight };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Keep playing",
        type: buttonType,
        rect: keepRect,
        onClick: () => this.#answer(false),
      }),
      new McButton(this, {
        kind: "primary",
        label: "End turn",
        type: buttonType,
        rect: endRect,
        onClick: () => this.#answer(true),
      }),
    );
    const stops = new Map([
      ["cancel", { rect: keepRect, activate: () => this.#answer(false) }],
      ["ok", { rect: endRect, activate: () => this.#answer(true) }],
    ]);
    this.#route?.set(["cancel", "ok"], stops);
  }
}

/** Asks "End your turn?" over `scene`, and calls `onConfirm` only if the player says End turn. */
export function askToEndTurn(scene: Phaser.Scene, sentence: string, onConfirm: () => void): void {
  if (scene.scene.isActive(SCENES.endTurnConfirm)) return;
  scene.scene.launch(SCENES.endTurnConfirm, {
    sentence,
    from: scene.scene.key,
    onConfirm,
  } satisfies EndTurnConfirmData);
}

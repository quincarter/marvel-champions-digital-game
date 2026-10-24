/**
 * The "Controller connected" / "Controller disconnected" toast (`docs/controller-support.md`, On-screen hints): an
 * ink panel with a paper border, a drawn controller outline, one line of what happened and, on a connect, a Controls
 * button. It takes no focus and no pad input: only its own button (a pointer press) and Enter while it is up open
 * Controls. The scene runs only while a toast shows and stops itself after; `scenes/pad-toast-watch.ts` starts it.
 */
import Phaser from "phaser";
import { appSession } from "../session.js";
import { signal, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton, fitText } from "../ui/widgets.js";
import { padToastFrameAt, padToastRect, type PadToastMessage } from "../view/pad-toast.js";
import { SCENES } from "./keys.js";

export interface PadToastSceneData {
  readonly message: PadToastMessage;
}

export class PadToastScene extends Phaser.Scene {
  #message: PadToastMessage | null = null;
  #startedAt = 0;
  #button: McButton | null = null;
  #panel: Phaser.GameObjects.Container | null = null;

  constructor() {
    super(SCENES.padToast);
  }

  init(data: PadToastSceneData): void {
    this.#message = data.message;
  }

  create(): void {
    this.scale.on(Phaser.Scale.Events.RESIZE, this.#draw, this);
    // Enter opens Controls while a connect toast is up; nothing else on the keyboard is taken.
    this.input.keyboard?.on("keydown-ENTER", this.#openControls, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.#draw, this);
      this.input.keyboard?.off("keydown-ENTER", this.#openControls, this);
      this.#clear();
    });
    this.#startedAt = this.time.now;
    this.#draw();
  }

  override update(time: number): void {
    const message = this.#message;
    if (!message || !this.#panel) return;
    const frame = padToastFrameAt(time - this.#startedAt, message.holdMs, appSession().settings.reducedMotion);
    if (frame.done) {
      this.scene.stop();
      return;
    }
    this.#panel.setAlpha(frame.alpha).setY(-frame.lift);
  }

  debugState(): Record<string, unknown> {
    return { message: this.#message, hasButton: this.#button !== null };
  }

  #openControls(): void {
    if (!this.#message?.controlsButton) return;
    this.scene.stop();
    if (!this.scene.isActive(SCENES.controls)) this.scene.launch(SCENES.controls);
  }

  #clear(): void {
    this.#button?.destroy();
    this.#button = null;
    this.#panel?.destroy(true);
    this.#panel = null;
  }

  #draw(): void {
    const message = this.#message;
    if (!message) return;
    this.#clear();
    const { width, height } = this.scale.gameSize;
    const rect = padToastRect(width, height, message.controlsButton);
    const stacked = message.controlsButton && rect.height > 64;
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 10);
    g.lineStyle(2, surface.paper.hex, 1).strokeRoundedRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2, 10);
    drawControllerOutline(g, rect.x + 14, rect.y + 6, 52, message.kind === "disconnected");
    const textX = rect.x + 14 + 52 + 14;
    const buttonWidth = 96;
    const textRight = rect.x + rect.width - 14 - (message.controlsButton && !stacked ? buttonWidth + 10 : 0);
    const heading = this.add
      .text(textX, rect.y + 13, message.heading.toUpperCase(), textStyle(typeRole.label, signal.caution.hex))
      .setFontSize(11);
    fitText(heading, textRight - textX, 11);
    const items: Phaser.GameObjects.GameObject[] = [g, heading];
    if (message.detail) {
      const detail = this.add.text(textX, rect.y + 31, message.detail, textStyle(typeRole.rowTitle, surface.paper.hex));
      fitText(detail, textRight - textX, 12);
      items.push(detail);
    }
    this.#panel = this.add.container(0, 0, items).setDepth(1);
    if (message.controlsButton) {
      const area = stacked
        ? { x: rect.x + 14, y: rect.y + rect.height - 14 - 40, width: rect.width - 28, height: 40 }
        : {
            x: rect.x + rect.width - 14 - buttonWidth,
            y: rect.y + (rect.height - 40) / 2,
            width: buttonWidth,
            height: 40,
          };
      this.#button = new McButton(this, {
        kind: "secondary",
        label: "Controls",
        type: typeRole.rowTitle,
        rect: area,
        onClick: () => this.#openControls(),
      });
      this.#panel.add(this.#button.container);
    }
    this.#panel.setAlpha(0);
  }
}

/** A controller outline in paper strokes: body, D-pad and buttons. Slashed through when `off`. */
function drawControllerOutline(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, off: boolean): void {
  const w = size;
  const h = size * 0.62;
  const top = y + (size - h) / 2;
  const paper = surface.paper.hex;
  g.lineStyle(2, paper, 1);
  g.strokeRoundedRect(x + w * 0.04, top, w * 0.92, h, h * 0.42);
  const dx = x + w * 0.26;
  const dy = top + h * 0.45;
  const arm = h * 0.14;
  g.beginPath();
  g.moveTo(dx - arm, dy)
    .lineTo(dx + arm, dy)
    .moveTo(dx, dy - arm)
    .lineTo(dx, dy + arm)
    .strokePath();
  g.strokeCircle(x + w * 0.76, dy - h * 0.12, h * 0.07);
  g.strokeCircle(x + w * 0.67, dy + h * 0.08, h * 0.07);
  g.strokeCircle(x + w * 0.55, top + h * 0.7, h * 0.1);
  if (off) {
    g.lineStyle(3, signal.caution.hex, 1).beginPath();
    g.moveTo(x + 2, y + size - 4)
      .lineTo(x + size - 2, y + 4)
      .strokePath();
  }
}

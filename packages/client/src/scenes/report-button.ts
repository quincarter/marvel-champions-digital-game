/**
 * The Report button (#176): a bug icon in the top bar of the screen the player is on, which opens "Report an issue"
 * (`scenes/report-issue.ts`). Where it is drawn, and when it hides, is `view/report-button.ts`.
 *
 * It runs for the whole session from Boot, kept above every other scene, so it stays usable under the in-game
 * overlays that leave the Board's top bar showing. It is chrome, not an overlay: it never covers a search field
 * (`ui/widgets.ts`'s `CHROME_SCENES` check) and never turns another scene's input off.
 */
import Phaser from "phaser";
import { surface } from "../tokens.js";
import { reportSlots } from "../ui/report-slot.js";
import { reportButtonSlot } from "../view/report-button.js";
import type { Rect } from "../view/layout.js";
import { SCENES } from "./keys.js";

export class ReportButtonScene extends Phaser.Scene {
  #graphics: Phaser.GameObjects.Graphics | null = null;
  #zone: Phaser.GameObjects.Zone | null = null;
  #rect: Rect | null = null;
  #hovered = false;
  #pressed = false;

  constructor() {
    super(SCENES.reportButton);
  }

  create(): void {
    this.#graphics = this.add.graphics();
    this.#zone = this.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.#zone.on("pointerover", () => this.#setHovered(true));
    this.#zone.on("pointerout", () => {
      this.#pressed = false;
      this.#setHovered(false);
    });
    this.#zone.on("pointerdown", () => {
      this.#pressed = true;
    });
    this.#zone.on("pointerup", () => {
      if (!this.#pressed) return;
      this.#pressed = false;
      this.#setHovered(false);
      openReportIssue(this);
    });
    this.#place(null);
  }

  /**
   * Follows the slot every frame, since screens and overlays come and go without telling this scene, and stays on
   * top: a few screens bring their own overlay to the top of the scene list (Inspect over Set cards,
   * `scenes/board/searched-pick-sheet.ts` and `scenes/boot.ts`).
   */
  override update(): void {
    const manager = this.scene.manager;
    const last = manager.scenes.length - 1;
    const panelUp = manager.isActive(SCENES.reportIssue);
    if (panelUp && manager.getIndex(SCENES.reportIssue) !== last) manager.bringToTop(SCENES.reportIssue);
    else if (!panelUp && manager.getIndex(SCENES.reportButton) !== last) manager.bringToTop(SCENES.reportButton);
    const running = manager
      .getScenes(true)
      .map((scene) => ({ key: scene.scene.key, visible: scene.sys.settings.visible }));
    const slot = reportButtonSlot(running, reportSlots());
    this.#place(slot?.rect ?? null);
  }

  /** Read by the debug snapshot (`ui/debug-dump.ts`). */
  debugState(): Record<string, unknown> {
    return { rect: this.#rect };
  }

  #place(rect: Rect | null): void {
    const same =
      rect === this.#rect ||
      (rect !== null &&
        this.#rect !== null &&
        rect.x === this.#rect.x &&
        rect.y === this.#rect.y &&
        rect.width === this.#rect.width &&
        rect.height === this.#rect.height);
    if (same) return;
    this.#rect = rect;
    this.#draw();
  }

  #setHovered(hovered: boolean): void {
    if (this.#hovered === hovered) return;
    this.#hovered = hovered;
    this.#draw();
  }

  #draw(): void {
    const graphics = this.#graphics;
    const zone = this.#zone;
    if (!graphics || !zone) return;
    graphics.clear();
    const rect = this.#rect;
    if (!rect) {
      zone.disableInteractive();
      return;
    }
    // The design's ink chrome button, as MENU draws it: paper outline on ink, swapped on hover.
    const ground = this.#hovered ? surface.paper.hex : surface.ink.hex;
    const ink = this.#hovered ? surface.ink.hex : surface.paper.hex;
    graphics.fillStyle(ground, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    graphics.lineStyle(2, surface.paper.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    drawBugIcon(
      graphics,
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      Math.min(rect.width, rect.height) * 0.78,
      ink,
      ground,
    );
    zone.setPosition(rect.x, rect.y).setSize(rect.width, rect.height);
    zone.setInteractive({ useHandCursor: true });
    zone.input?.hitArea.setTo(0, 0, rect.width, rect.height);
  }
}

/** A bug, `size` px tall, centred on (`cx`, `cy`): the universal "report a problem" mark. */
export function drawBugIcon(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  size: number,
  color: number,
  /** The ground behind it, for the line that splits the wing cases. */
  ground: number,
): void {
  const unit = size / 20;
  const line = Math.max(1.5, unit * 1.6);
  graphics.fillStyle(color, 1).lineStyle(line, color, 1);
  // Body and head.
  graphics.fillEllipse(cx, cy + unit * 2.5, unit * 9, unit * 12);
  graphics.fillCircle(cx, cy - unit * 5, unit * 3.2);
  // Antennae.
  graphics.lineBetween(cx - unit * 1.5, cy - unit * 7.5, cx - unit * 4, cy - unit * 10);
  graphics.lineBetween(cx + unit * 1.5, cy - unit * 7.5, cx + unit * 4, cy - unit * 10);
  // Three legs a side.
  for (const [dy, reach, drop] of [
    [-1, 9, -2.5],
    [2.5, 9.5, 0],
    [6, 9, 3],
  ] as const) {
    graphics.lineBetween(cx - unit * 3.5, cy + unit * dy, cx - unit * reach, cy + unit * (dy + drop));
    graphics.lineBetween(cx + unit * 3.5, cy + unit * dy, cx + unit * reach, cy + unit * (dy + drop));
  }
  graphics.lineStyle(Math.max(1, unit), ground, 1).lineBetween(cx, cy - unit * 1.5, cx, cy + unit * 8);
}

/** Opens the report panel over whatever is on screen, once. */
export function openReportIssue(scene: Phaser.Scene): void {
  if (scene.scene.isActive(SCENES.reportIssue)) return;
  scene.scene.launch(SCENES.reportIssue);
}

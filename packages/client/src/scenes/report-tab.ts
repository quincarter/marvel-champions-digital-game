/**
 * The Report tab (#176): a small ink tab on the right edge of every screen, over every overlay, that opens
 * "Report an issue" (`scenes/report-issue.ts`). Where it sits and why is `view/report-tab.ts`.
 *
 * It runs for the whole session from Boot, registered after every other drawing scene so it is drawn above all of
 * them. A tap opens the panel; a drag moves the tab along the edge and is remembered on this device. It is chrome,
 * not an overlay: it never covers a search field (`ui/widgets.ts`'s `CHROME_SCENES` check) and never turns another
 * scene's input off.
 */
import Phaser from "phaser";
import { accent, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { formFactorFor } from "../view/layout.js";
import { parseReportTabFraction, reportTabFractionAt, reportTabGeometry } from "../view/report-tab.js";
import { SCENES } from "./keys.js";

const STORAGE_KEY = "mc-report-tab-y";
/** A press that moves farther than this is a drag, not a tap. */
const DRAG_SLOP = 8;

export class ReportTabScene extends Phaser.Scene {
  #fraction = parseReportTabFraction(readSaved());
  #graphics: Phaser.GameObjects.Graphics | null = null;
  #label: Phaser.GameObjects.Text | null = null;
  #zone: Phaser.GameObjects.Zone | null = null;
  #hovered = false;
  /** The press in progress: where it started, and whether it has become a drag. */
  #press: { readonly startY: number; readonly startFraction: number; dragging: boolean } | null = null;

  constructor() {
    super(SCENES.reportTab);
  }

  create(): void {
    this.#graphics = this.add.graphics();
    this.#label = this.add.text(0, 0, "REPORT", textStyle(typeRole.label, surface.paper.hex)).setOrigin(0.5);
    this.#label.setAngle(-90);
    this.#zone = this.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.#zone.on("pointerover", () => this.#setHovered(true));
    this.#zone.on("pointerout", () => this.#setHovered(false));
    this.#zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.#press = { startY: pointer.y, startFraction: this.#fraction, dragging: false };
    });
    this.input.on("pointermove", this.#onMove, this);
    this.input.on("pointerup", this.#onUp, this);
    this.input.on("pointerupoutside", this.#onUp, this);
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.input.off("pointermove", this.#onMove, this);
      this.input.off("pointerup", this.#onUp, this);
      this.input.off("pointerupoutside", this.#onUp, this);
    });
    this.#draw();
  }

  /**
   * Stays above everything: a few screens bring their own overlay to the top of the scene list (Inspect over Set
   * cards, `scenes/board/searched-pick-sheet.ts` and `scenes/boot.ts`), which would put it over the tab and the panel.
   */
  override update(): void {
    const manager = this.scene.manager;
    const last = manager.scenes.length - 1;
    const panelUp = manager.isActive(SCENES.reportIssue);
    if (panelUp && manager.getIndex(SCENES.reportIssue) !== last) manager.bringToTop(SCENES.reportIssue);
    else if (!panelUp && manager.getIndex(SCENES.reportTab) !== last) manager.bringToTop(SCENES.reportTab);
  }

  /** Read by the debug snapshot (`ui/debug-dump.ts`). */
  debugState(): Record<string, unknown> {
    return { fraction: this.#fraction };
  }

  #onMove(pointer: Phaser.Input.Pointer): void {
    const press = this.#press;
    if (!press || !pointer.isDown) return;
    if (!press.dragging && Math.abs(pointer.y - press.startY) < DRAG_SLOP) return;
    press.dragging = true;
    const { height } = this.scale.gameSize;
    this.#fraction = reportTabFractionAt(press.startFraction * height + (pointer.y - press.startY), height);
    this.#draw();
  }

  #onUp(): void {
    const press = this.#press;
    this.#press = null;
    if (!press) return;
    if (press.dragging) {
      writeSaved(String(this.#fraction));
      return;
    }
    this.#setHovered(false);
    openReportIssue(this);
  }

  #setHovered(hovered: boolean): void {
    if (this.#hovered === hovered) return;
    this.#hovered = hovered;
    this.#draw();
  }

  #draw(): void {
    const graphics = this.#graphics;
    const label = this.#label;
    const zone = this.#zone;
    if (!graphics || !label || !zone) return;
    const { width, height } = this.scale.gameSize;
    const { tab, hit, labelSize } = reportTabGeometry({ width, height }, formFactorFor(width, height), this.#fraction);
    const lifted = this.#hovered || this.#press?.dragging === true;
    graphics.clear();
    graphics
      .fillStyle(lifted ? accent.heroRed.hex : surface.ink.hex, 0.92)
      .fillRect(tab.x, tab.y, tab.width, tab.height);
    graphics.lineStyle(2, surface.paper.hex, 0.85).strokeRect(tab.x + 1, tab.y + 1, tab.width, tab.height - 2);
    label.setFontSize(labelSize).setPosition(tab.x + tab.width / 2, tab.y + tab.height / 2);
    zone.setPosition(hit.x, hit.y).setSize(hit.width, hit.height);
    zone.input?.hitArea.setTo(0, 0, hit.width, hit.height);
  }
}

/** Opens the report panel over whatever is on screen, once. */
export function openReportIssue(scene: Phaser.Scene): void {
  if (scene.scene.isActive(SCENES.reportIssue)) return;
  scene.scene.launch(SCENES.reportIssue);
}

function readSaved(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeSaved(value: string): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, value);
  } catch {
    // Private mode or blocked storage: the tab still moves, it just isn't remembered.
  }
}

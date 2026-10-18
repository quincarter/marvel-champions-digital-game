/**
 * The power saving notice: a short note that drops in over whatever screen is up when the device's power saving mode
 * turns on or off (`platform/power-saving.ts`), saying what the game changed. It looks like the music button's
 * "New song earned" notice, at the bottom of the screen.
 *
 * It runs for the whole session from Boot but is hidden except while a notice shows, and it takes no input, so it is
 * chrome (`CHROME_SCENES`): it never covers a search field or the Report button's slot.
 */
import Phaser from "phaser";
import { signal, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { fitText } from "../ui/widgets.js";
import { appSession } from "../session.js";
import { onPowerSavingChange, powerSavingState } from "../platform/power-saving.js";
import { powerSavingNoticeOf } from "../view/power-saving-notice.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { SCENES } from "./keys.js";

/** How long a notice stays up, and how long it slides when motion is allowed. */
const HOLD_MS = 5000;
const SLIDE_MS = 260;

export class PowerSavingNoticeScene extends Phaser.Scene {
  #container: Phaser.GameObjects.Container | null = null;
  #unsubscribe: (() => void) | null = null;

  constructor() {
    super(SCENES.powerSavingNotice);
  }

  create(): void {
    this.sys.setVisible(false);
    // Only the device's mode changing drops a notice in; the player's own Settings toggle needs none.
    this.#unsubscribe = onPowerSavingChange((state, change) => {
      if (change === "detected") this.show(state.detected);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#unsubscribe?.());
    // The mode may have been read before this scene existed (`?powersave=1`).
    if (powerSavingState().detected) this.show(true);
  }

  /** Read by the debug snapshot (`ui/debug-dump.ts`) and the e2e specs. */
  debugState(): Record<string, unknown> {
    return { showing: this.#container !== null, powerSaving: powerSavingState().detected };
  }

  /** Drops the notice in for `on`, replacing one already up. */
  show(on: boolean): void {
    this.#container?.destroy();
    this.#container = null;
    const { heading, body } = powerSavingNoticeOf(on, appSession().settings, powerSavingState().applied);
    const { width, height } = this.scale.gameSize;
    const formFactor = formFactorFor(width, height);
    const phone = formFactor === "phone" || formFactor === "phoneLandscape";
    // Along the bottom edge, clear of every screen's top bar and its Report and music buttons. It takes no input, so a
    // tap on whatever it covers still lands.
    const margin = phone ? 8 : 16;
    const boxWidth = phone ? width - 2 * margin : Math.min(420, width - 2 * margin);
    const rect: Rect = { x: (width - boxWidth) / 2, y: height - margin - 62, width: boxWidth, height: 62 };

    const container = this.add.container(0, 0);
    const accent = on ? signal.caution.hex : surface.paper.hex;
    const ground = this.add.graphics();
    ground.fillStyle(surface.ink.hex, 0.97).fillRect(rect.x, rect.y, rect.width, rect.height);
    ground.fillStyle(accent, 1).fillRect(rect.x, rect.y, 6, rect.height);
    ground.lineStyle(2, surface.paper.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    const mark = this.add.graphics();
    drawBatteryIcon(mark, rect.x + 34, rect.y + rect.height / 2, 24, accent, on);
    const textX = rect.x + 60;
    const title = this.add.text(textX, rect.y + 12, heading.toUpperCase(), textStyle(typeRole.label, accent));
    const line = this.add
      .text(textX, rect.y + 30, body, textStyle(typeRole.body, surface.paper.hex))
      .setFontSize(phone ? 13 : 14);
    fitText(title, rect.x + rect.width - 12 - textX, typeRole.label.size);
    fitText(line, rect.x + rect.width - 12 - textX, phone ? 13 : 14);
    container.add([ground, mark, title, line]);
    this.#container = container;
    this.sys.setVisible(true);

    const remove = (): void => {
      container.destroy();
      if (this.#container !== container) return;
      this.#container = null;
      this.sys.setVisible(false);
    };
    if (appSession().settings.reducedMotion) {
      this.time.delayedCall(HOLD_MS, remove);
      return;
    }
    const away = { y: height - rect.y + 12 };
    container.setPosition(0, away.y);
    this.tweens.add({
      targets: container,
      x: 0,
      y: 0,
      duration: SLIDE_MS,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: container,
          ...away,
          delay: HOLD_MS,
          duration: SLIDE_MS,
          ease: "Quad.easeIn",
          onComplete: remove,
        });
      },
    });
  }
}

/** A battery on its side, `size` px wide, centred on (`cx`, `cy`): low (one bar) while saving, full otherwise. */
function drawBatteryIcon(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  size: number,
  color: number,
  saving: boolean,
): void {
  const width = size;
  const height = size * 0.52;
  const left = cx - width / 2;
  const top = cy - height / 2;
  graphics.lineStyle(2, color, 1).strokeRect(left, top, width - 3, height);
  graphics.fillStyle(color, 1).fillRect(left + width - 3, cy - height / 5, 3, (height * 2) / 5);
  const inner = width - 3 - 6;
  graphics.fillRect(left + 3, top + 3, saving ? inner / 4 : inner, height - 6);
}

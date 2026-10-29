/**
 * The "Building your stats" toast (#529): while older games have their card numbers filled in
 * (`progression/stats-backfill.ts`), a small ink panel at the bottom centre says how far it has got (12 of 40, 30%,
 * with a bar), that it can be closed and keeps going in the background, and, when it is done, that Your stats is up to
 * date. Its ✕ closes it for the rest of the run; a press elsewhere on the panel does nothing, and one beside it lands
 * on the screen underneath. The scene runs only while it shows; `main.ts` starts it when a run begins.
 */
import Phaser from "phaser";
import { signal, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton, fitText } from "../ui/widgets.js";
import { backfillProgress, onBackfillProgress } from "../progression/stats-backfill.js";
import { BACKFILL_DONE_HOLD_MS, backfillToastRect, backfillToastTextOf } from "../view/backfill-toast.js";
import { SCENES } from "./keys.js";

/** Closed by the player: not shown again until the next launch's run. */
let dismissed = false;

export const backfillToastDismissed = (): boolean => dismissed;

export class BackfillToastScene extends Phaser.Scene {
  #close: McButton | null = null;
  #panel: Phaser.GameObjects.Container | null = null;
  #off: (() => void) | null = null;

  constructor() {
    super(SCENES.backfillToast);
  }

  create(): void {
    this.scale.on(Phaser.Scale.Events.RESIZE, this.#draw, this);
    this.#off = onBackfillProgress((progress) => {
      this.#draw();
      if (!progress.running) this.time.delayedCall(BACKFILL_DONE_HOLD_MS, () => this.scene.stop());
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#off?.();
      this.#off = null;
      this.scale.off(Phaser.Scale.Events.RESIZE, this.#draw, this);
      this.#clear();
    });
    this.#draw();
  }

  #dismiss(): void {
    dismissed = true;
    this.scene.stop();
  }

  #clear(): void {
    this.#close?.destroy();
    this.#close = null;
    this.#panel?.destroy(true);
    this.#panel = null;
  }

  #draw(): void {
    this.#clear();
    const { width, height } = this.scale.gameSize;
    const rect = backfillToastRect(width, height);
    const text = backfillToastTextOf(backfillProgress());
    const pad = 14;
    const closeSize = 44;
    const inner = rect.width - pad * 2 - closeSize - 8;
    // The panel takes a press on itself, so one meant for it never reaches what it covers (the rank badge).
    const shield = this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0).setInteractive();
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 0.96).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(2, surface.paper.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    const title = this.add.text(
      rect.x + pad,
      rect.y + 10,
      text.title,
      textStyle(typeRole.rowTitle, surface.paper.hex, 1),
    );
    title.setFontSize(15);
    fitText(title, inner, 15);
    const count = this.add
      .text(rect.x + pad, rect.y + 32, text.count, textStyle(typeRole.label, signal.caution.hex, 1))
      .setFontSize(12);
    fitText(count, inner, 12);
    const track = { x: rect.x + pad, y: rect.y + 52, width: rect.width - pad * 2, height: 10 };
    g.lineStyle(1.5, surface.paper.hex, 1).strokeRect(track.x, track.y, track.width, track.height);
    if (text.fraction > 0) {
      g.fillStyle(signal.caution.hex, 1).fillRect(
        track.x + 2,
        track.y + 2,
        Math.max(2, (track.width - 4) * text.fraction),
        track.height - 4,
      );
    }
    const note = this.add
      .text(rect.x + pad, rect.y + 68, text.note, textStyle(typeRole.body, surface.paper.hex, 0.85))
      .setFontSize(11);
    fitText(note, rect.width - pad * 2, 11);
    this.#panel = this.add.container(0, 0, [shield, g, title, count, note]);
    this.#close = new McButton(this, {
      kind: "onInk",
      label: "✕",
      type: typeRole.rowTitle,
      rect: { x: rect.x + rect.width - pad - closeSize + 6, y: rect.y + 4, width: closeSize, height: closeSize },
      onClick: () => this.#dismiss(),
    });
  }
}

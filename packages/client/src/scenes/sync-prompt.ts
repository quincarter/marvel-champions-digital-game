/**
 * Device sync's watcher (issue #276, step 2), running for the whole session from Boot and drawing nothing but one
 * line of text while it has something to say:
 *  - a game both devices changed: it opens `scenes/sync-conflict.ts` over whatever screen is up, one game at a time,
 *    and the next when that is answered;
 *  - Continue waiting on the check for newer saves: "Checking your other devices…" once it takes longer than a beat.
 * The line takes no input, so it is a chrome scene (`CHROME_SCENES`).
 */
import Phaser from "phaser";
import { surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { syncService } from "../sync/sync-wiring.js";
import type { PendingConflict } from "../sync/sync-service.js";
import type { SyncConflictSceneData } from "./sync-conflict.js";
import { SCENES } from "./keys.js";
import { CONFLICT_CLOSED } from "../view/sync-model.js";

/** How long Continue may wait before the line shows: a quick check should not flash text. */
export const CHECKING_DELAY_MS = 300;
export const CHECKING_TEXT = "Checking your other devices…";

export class SyncPromptScene extends Phaser.Scene {
  #queue: PendingConflict[] = [];
  #line: Phaser.GameObjects.Text | null = null;
  #timer: Phaser.Time.TimerEvent | null = null;
  #checking = false;
  /** A prompt has been launched and has not closed yet (it may still be loading, so `isActive` can't say). */
  #open = false;

  constructor() {
    super(SCENES.syncPrompt);
  }

  create(): void {
    this.#queue = [];
    const service = syncService();
    const stopConflicts = service.onConflict((pending) => {
      this.#queue.push(pending);
      this.#openNext();
    });
    const stopChecking = service.onResumeChecking((checking) => this.#setChecking(checking));
    // The overlay says so when it closes (it may still be loading when launched, so its events can't be waited on).
    const onClosed = (): void => {
      this.#open = false;
      this.time.delayedCall(0, () => this.#openNext());
    };
    this.game.events.on(CONFLICT_CLOSED, onClosed);
    const onResize = (): void => this.#place();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopConflicts();
      stopChecking();
      this.scale.off("resize", onResize, this);
      this.game.events.off(CONFLICT_CLOSED, onClosed);
    });
  }

  #setChecking(checking: boolean): void {
    this.#checking = checking;
    this.#timer?.remove(false);
    this.#timer = null;
    if (!checking) {
      this.#line?.destroy();
      this.#line = null;
      return;
    }
    this.#timer = this.time.delayedCall(CHECKING_DELAY_MS, () => {
      this.#timer = null;
      if (!this.#checking || this.#line) return;
      this.#line = this.add
        .text(0, 0, CHECKING_TEXT, textStyle(typeRole.label, surface.paper.hex))
        .setPadding(14, 8, 14, 8)
        .setBackgroundColor("#" + surface.ink.hex.toString(16).padStart(6, "0"))
        .setOrigin(0.5, 1);
      this.#place();
    });
  }

  #place(): void {
    const { width, height } = this.scale.gameSize;
    this.#line?.setPosition(width / 2, height - 24);
  }

  #openNext(): void {
    if (this.#open) return;
    const service = syncService();
    // A question already answered (unlink, or answered elsewhere) is no longer pending.
    while (this.#queue.length > 0 && !service.pendingConflicts().includes(this.#queue[0]!)) this.#queue.shift();
    const next = this.#queue.shift();
    if (!next) return;
    this.#open = true;
    this.scene.launch(SCENES.syncConflict, { pending: next } satisfies SyncConflictSceneData);
  }
}

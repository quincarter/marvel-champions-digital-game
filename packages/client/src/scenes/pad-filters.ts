/**
 * The filter chips' fold on Scenario select and Take your seats (`view/filters-layout.ts` has the rules): behind a
 * Filters button while a controller is in use or below the width breakpoint, opened and closed with Y (pad) or the
 * button. One per scene.
 */

import Phaser from "phaser";
import { onInputDeviceChange, padInputTracked } from "../platform/input-device.js";
import { appSession } from "../session.js";
import { filtersBehindButton } from "../view/filters-layout.js";
import { padModeFor } from "../view/pad-filters.js";

export class PadFilters {
  #opened = false;
  #lastBehind: boolean | null = null;

  /** `onChange`: pad mode began or ended, so the scene redraws with or without the chips. */
  constructor(scene: Phaser.Scene, onChange: () => void) {
    let lastPad = this.padMode;
    const off = onInputDeviceChange(() => {
      const now = this.padMode;
      if (now === lastPad) return;
      lastPad = now;
      this.#opened = false;
      if (scene.sys.isActive()) onChange();
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  /** A controller is the input in use (the "Show hints for" setting can pin it). */
  get padMode(): boolean {
    return padModeFor(padInputTracked(), appSession().settings.glyphSource);
  }

  /** Whether the chips are behind the Filters button at this game width. Crossing the breakpoint shuts them again. */
  behindButton(gameWidth: number): boolean {
    const behind = filtersBehindButton(gameWidth, this.padMode);
    if (behind !== this.#lastBehind) {
      this.#lastBehind = behind;
      this.#opened = false;
    }
    return behind;
  }

  /** Whether the chips are folded away right now: behind the button and not opened. */
  folded(gameWidth: number): boolean {
    return this.behindButton(gameWidth) && !this.#opened;
  }

  /** Opens the chips if folded, folds them if open. */
  toggle(): void {
    this.#opened = !this.#opened;
  }

  open(): void {
    this.#opened = true;
  }

  /** Back to folded (a new visit to the screen). */
  reset(): void {
    this.#opened = false;
    this.#lastBehind = null;
  }
}

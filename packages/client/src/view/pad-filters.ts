/**
 * Whether a controller is the input in use, for Scenario select and Take your seats (they fold their filter chips away (the owner, 2026-10-24, on a Steam Deck:
 * 21 pack chips in four rows took the top of the page while a controller was in use).
 *
 * "Pad mode" follows the controller, but a controller player also touches the trackpad, so a mouse move does not end
 * it: only a keyboard key or a touch does. The "Show hints for" setting pins it either way (a pinned controller is pad
 * mode whatever was pressed last; a pinned keyboard never is). Pure, so the rules are tested without a browser.
 */

import type { GlyphSource, InputEvent } from "./input-mode.js";

export class PadModeTracker {
  #active = false;

  /**
   * Feeds one input event; returns whether pad mode holds after it. A controller input starts it; a key press or a
   * touch ends it; the mouse (a trackpad, or coming to rest) changes nothing.
   */
  note(kind: InputEvent["kind"]): boolean {
    if (kind === "pad") this.#active = true;
    else if (kind === "key" || kind === "touch") this.#active = false;
    return this.#active;
  }

  reset(): void {
    this.#active = false;
  }

  get active(): boolean {
    return this.#active;
  }
}

/** Pad mode given what the tracker saw and the "Show hints for" setting. */
export function padModeFor(tracked: boolean, source: GlyphSource): boolean {
  return source === "pad" ? true : source === "keyboard" ? false : tracked;
}

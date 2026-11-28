import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { findKey, popupButton } from "../../shared/popup-parts.js";
import { McPlayerControlsStyles } from "./mc-player-controls.styles.js";
import type { PlayerControlsModel } from "./mc-player-controls.types.js";

/**
 * # Player controls
 * Shuffle and Next on one row, Pause (Play while paused) under them, and the slotted volume slider beside Pause.
 *
 * @element mc-player-controls
 * @attr slider - A slider is slotted beside Pause (reflected from the model).
 * @slot volume - The volume slider, beside Pause.
 * @fires mc-activate - `detail.key`: `shuffle`, `next` or `pause`.
 */
export class McPlayerControls extends LitElement {
  static override styles = [ThemeStyles, McPlayerControlsStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    slider: { type: Boolean, reflect: true },
  };

  declare model: PlayerControlsModel | null;
  declare slider: boolean;

  constructor() {
    super();
    this.model = null;
    this.slider = false;
  }

  override willUpdate(): void {
    this.slider = this.model?.withSlider ?? false;
  }

  /** The control's button, or whatever is slotted with this key (the slider's − and +). */
  elementOf(key: string): HTMLElement | null {
    const own = findKey(this.renderRoot as ShadowRoot, key);
    if (own) return own;
    for (const child of this.children) {
      const found = (child as HTMLElement & { elementOf?: (key: string) => HTMLElement | null }).elementOf?.(key);
      if (found) return found;
    }
    return null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const g = m.glyphs ?? {};
    return html`<div class="row">
        ${popupButton(this, m.shuffle, g[m.shuffle.key])}${popupButton(this, m.next, g[m.next.key])}
      </div>
      <div class="row pause">${popupButton(this, m.pause, g[m.pause.key])}<slot name="volume"></slot></div>`;
  }
}

import { html, type PropertyDeclarations, type TemplateResult } from "lit";
import { ThemeStyles, type ControlGlyphs } from "@mc/ui";
import { MusicElement } from "../shared/MusicElement.js";
import { McPlayerControlsStyles } from "./mc-player-controls.styles.js";
import type { McPlayerControlsProps } from "./mc-player-controls.types.js";

type ControlKey = "shuffle" | "next" | "pause";

/**
 * # Player controls
 * Shuffle and Next on one row, Pause (Play while paused) under them, and the slotted volume slider beside Pause. A
 * control with a `reason` is dimmed and presses nothing (no song earned yet).
 *
 * @element mc-player-controls
 * @attr slider - A slider is slotted beside Pause (reflected from `withSlider`).
 * @slot volume - The volume slider, beside Pause.
 * @fires mc-music - `{ type: "press", key }` with `shuffle`, `next` or `pause`.
 */
export class McPlayerControls extends MusicElement implements McPlayerControlsProps {
  static override styles = [ThemeStyles, McPlayerControlsStyles];

  static override properties: PropertyDeclarations = {
    shuffleLabel: { type: String, attribute: "shuffle-label" },
    nextLabel: { type: String, attribute: "next-label" },
    pauseLabel: { type: String, attribute: "pause-label" },
    shuffleOn: { type: Boolean, attribute: "shuffle-on" },
    paused: { type: Boolean },
    reason: { type: String },
    withSlider: { type: Boolean, reflect: true, attribute: "slider" },
    glyphs: { attribute: false },
  };

  declare shuffleLabel: string;
  declare nextLabel: string;
  declare pauseLabel: string;
  declare shuffleOn: boolean;
  declare paused: boolean;
  declare reason: string;
  declare withSlider: boolean;
  declare glyphs: ControlGlyphs;

  constructor() {
    super();
    this.shuffleLabel = "";
    this.nextLabel = "";
    this.pauseLabel = "";
    this.shuffleOn = false;
    this.paused = false;
    this.reason = "";
    this.withSlider = false;
    this.glyphs = {};
  }

  #button(key: ControlKey, label: string, selected: boolean, reason: string): TemplateResult {
    return html`<mc-popup-button
      .button=${{ key, kind: "secondary", label, selected, ...(reason === "" ? {} : { disabled: reason }) }}
      .glyph=${this.glyphs[key] ?? null}
      @mc-activate=${(event: Event) => {
        event.stopPropagation();
        this.press(key);
      }}
    ></mc-popup-button>`;
  }

  override render() {
    return html`<div class="row">
        ${this.#button("shuffle", this.shuffleLabel, this.shuffleOn, this.reason)}
        ${this.#button("next", this.nextLabel, false, this.reason)}
      </div>
      <div class="row pause">
        ${this.#button("pause", this.pauseLabel, this.paused, "")}<slot name="volume"></slot>
      </div>`;
  }
}

import { glyphLabelShift } from "@mc/ui";
import { html, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import type { PauseHeaderInput, PauseMode } from "../pause.types.js";
import { PauseElement } from "../shared/PauseElement.js";
import { McPauseHeaderStyles } from "./mc-pause-header.styles.js";

/**
 * # Pause header
 * "Paused", the status line (round, phase, seed, seat), a Civil War game's scenario sheet and the adjusted note. On the
 * phone it ends in the boxed ✕ that closes Pause (a 44px press target, with the B glyph while a pad is in use).
 *
 * Focus stop: `close`.
 *
 * @element mc-pause-header
 * @prop input - The header (`PauseHeaderInput`).
 * @attr mode - wide | phone.
 * @fires mc-pause - `{ type: "menu", id: "close" }` on a press on ✕.
 */
export class McPauseHeader extends PauseElement {
  static override styles = McPauseHeaderStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare input: PauseHeaderInput | null;
  declare mode: PauseMode;

  constructor() {
    super();
    this.input = null;
    this.mode = "wide";
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    const close = input.close;
    return html`<div class="titles">
        <h1 class="title">${input.title}</h1>
        <div class="status">${input.status}</div>
        ${
          input.blind.length > 0
            ? html`<ul class="blind">
                ${input.blind.map((line) => html`<li>${line}</li>`)}
              </ul>`
            : nothing
        }
        ${input.note ? html`<div class="note">${input.note}</div>` : nothing}
      </div>
      ${
        close
          ? html`<div class="ctl" style=${styleMap({ "--mc-label-shift": `${glyphLabelShift(close.glyph)}px` })}>
              <mc-button
                kind="secondary"
                plain
                data-stop="close"
                .label=${close.label}
                @mc-press=${() => this.say({ type: "menu", id: "close" })}
              ></mc-button>
              <mc-glyph-hint .glyph=${close.glyph}></mc-glyph-hint>
            </div>`
          : nothing
      }`;
  }
}

import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import type { SeatsHintsModel } from "../seats.types.js";
import { McSeatsHintsStyles } from "./mc-seats-hints.styles.js";

/**
 * # Seats hints
 * The row above the filters on a wide layout: "HEROES, SEAT 2 OF 4" and, while a keyboard or pad is in use, each key or
 * button with the word for what it does (LB / RB pick the seat, X clears it, Y moves between the filters and the list). A
 * hint with no glyph is not shown: a mouse or touch has no key to name, and a word alone would say nothing. It takes no
 * press and is no focus stop.
 *
 * @element mc-seats-hints
 * @prop model - The heading and hints (`SeatsHintsModel`).
 */
export class McSeatsHints extends LitElement {
  static override styles = [McSeatsHintsStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: SeatsHintsModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const row = this.model;
    if (!row) return nothing;
    return html`<div class="row">
      <h2 class="heading">${row.heading}</h2>
      ${row.hints.map((hint) =>
        hint.glyph && hint.glyph.openness > 0
          ? html`<span class="hint">
              <mc-glyph
                .specs=${hint.glyph.specs}
                .height=${hint.glyph.height}
                .ground=${hint.glyph.ground}
                .openness=${hint.glyph.openness}
                ?still=${hint.glyph.still ?? false}
              ></mc-glyph>
              <span class="word">${hint.word}</span>
            </span>`
          : nothing,
      )}
    </div>`;
  }
}

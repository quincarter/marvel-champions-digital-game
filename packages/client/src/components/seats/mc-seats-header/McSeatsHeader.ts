import { html, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { SeatsElement } from "../SeatsElement.js";
import type { SeatsHeaderModel } from "../seats.types.js";
import { McSeatsHeaderStyles } from "./mc-seats-header.styles.js";

/**
 * # Seats header
 * The ink bar across the top of Take your seats: Back (with the Cancel glyph while a keyboard or pad is in use), the
 * Bangers title and the step line at the right. The title keeps its name whole; the scene drops it under, or ends it
 * before, the dark mode tab that hangs from the top centre (`titleDrop`, `titleMaxRight`).
 *
 * @element mc-seats-header
 * @prop model - The bar (`SeatsHeaderModel`).
 * @fires mc-seats - `{ type: "action", action: "back" }`.
 */
export class McSeatsHeader extends SeatsElement {
  static override styles = [McSeatsHeaderStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: SeatsHeaderModel | null;

  constructor() {
    super();
    this.model = null;
  }

  protected override act(action: string): void {
    if (action === "back") this.emit({ type: "action", action: "back" });
  }

  override render() {
    const bar = this.model;
    if (!bar) return nothing;
    const glyph = bar.backGlyph;
    return html`<header class="bar">
      <button type="button" class="back" data-action="back" data-stop="back">
        ${
          glyph
            ? html`<mc-glyph
                class="glyph"
                .specs=${glyph.specs}
                .height=${glyph.height}
                .ground=${glyph.ground}
                .openness=${glyph.openness}
                ?still=${glyph.still ?? false}
              ></mc-glyph>`
            : nothing
        }
        <span class="word">${bar.backLabel}</span>
      </button>
      <h1
        class="title"
        style=${styleMap({
          "--drop": `${bar.titleDrop ?? 0}px`,
          "--max-right": bar.titleMaxRight == null ? "none" : `${bar.titleMaxRight}px`,
        })}
      >
        ${bar.title}
      </h1>
      <span class="step">${bar.step}</span>
    </header>`;
  }
}

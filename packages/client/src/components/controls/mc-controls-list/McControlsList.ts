import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import type { ControlsListSection } from "../controls.types.js";
import { McControlsListStyles } from "./mc-controls-list.styles.js";

/**
 * # Controls list
 * The lists of what each button or key does, a titled section at a time: each row is its glyph or glyphs, the action and
 * where it applies, with a faint rule under it. Read-only. The glyphs are `mc-glyph`s drawn from the live bindings, so a
 * remapped or Switch-swapped pad shows what it really presses.
 *
 * @element mc-controls-list
 * @prop sections - `ControlsListSection[]`.
 */
export class McControlsList extends LitElement {
  static override styles = [McControlsListStyles];

  static override properties: PropertyDeclarations = {
    sections: { attribute: false },
  };

  declare sections: readonly ControlsListSection[];

  constructor() {
    super();
    this.sections = [];
  }

  override render() {
    return html`${this.sections.map(
      (section) => html`<section data-section=${section.id}>
        <mc-section-heading onink .label=${section.title}></mc-section-heading>
        ${section.rows.map(
          (row) => html`<div class="row" data-row=${row.id}>
            <span class="glyphs">
              ${row.glyphs.length > 0 ? html`<mc-glyph .specs=${row.glyphs} .height=${24} ground="ink" still></mc-glyph>` : nothing}
            </span>
            <span class="words">
              <span class="action">${row.action}</span>
              <span class="note">${row.note}</span>
            </span>
          </div>`,
        )}
      </section>`,
    )}`;
  }
}

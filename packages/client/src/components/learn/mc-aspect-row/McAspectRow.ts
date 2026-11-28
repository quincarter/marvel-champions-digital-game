import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { McAspectRowStyles } from "./mc-aspect-row.styles.js";
import type { AspectRowModel } from "./mc-aspect-row.types.js";

/**
 * # Aspect row
 * One of the four playable aspects on the How to play hub: its chip (the aspect's frame colour with its name on it, never
 * colour alone), its tagline, and at the right a ✓ DONE once its Try it is finished or a quiet "▸". The row is a focus stop
 * `aspect:<aspect>`; a press raises `{ type: "aspect", aspect }` for the owner's section to turn into `mc-learn`.
 *
 * @element mc-aspect-row
 * @prop model - The row (`AspectRowModel`).
 * @fires mc-pressed - `PressDetail` whose action is `{ type: "aspect", aspect }`.
 */
export class McAspectRow extends LitElement {
  static override styles = [McAspectRowStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: AspectRowModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const row = this.model;
    if (!row) return nothing;
    return html`<mc-link-row .stop=${`aspect:${row.aspect}`} .action=${{ type: "aspect", aspect: row.aspect }}>
      <mc-aspect-chip aspect=${row.aspect} label=${row.name} height="22" size="12"></mc-aspect-chip>
      <div class="tagline">${row.tagline}</div>
      ${row.done ? html`<span slot="trail" class="done">${row.doneLabel}</span>` : nothing}
    </mc-link-row>`;
  }
}

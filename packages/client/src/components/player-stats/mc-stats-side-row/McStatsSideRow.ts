import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { McPress } from "@mc/ui";
import { McStatsSideRowStyles } from "./mc-stats-side-row.styles.js";
import type { McStatsSideRowProps, StatsSideRowModel } from "./mc-stats-side-row.types.js";

/**
 * # Side-list row
 * One villain in the Focus view's list, with its score; the one shown is filled (and says so to a screen reader). A press
 * shows that villain's tiles (focus stop `side:<row>`).
 *
 * @element mc-stats-side-row
 * @prop model - The row (`StatsSideRowModel`).
 * @fires mc-pressed - `{ type: "focus-row", row }`.
 */
export class McStatsSideRow extends McPress implements McStatsSideRowProps {
  static override styles = McStatsSideRowStyles;

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    model: { attribute: false },
    selected: { type: Boolean, reflect: true },
  };

  declare model: StatsSideRowModel | null;
  declare selected: boolean;

  constructor() {
    super();
    this.model = null;
    this.selected = false;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (!changed.has("model")) return;
    this.stop = this.model ? `side:${this.model.row}` : "";
    this.selected = this.model?.selected ?? false;
    this.action = this.model ? { type: "focus-row", row: this.model.row } : null;
    this.setAttribute("aria-pressed", this.selected ? "true" : "false");
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<span class="name">${model.name}</span><span class="score">${model.score}</span>`;
  }
}

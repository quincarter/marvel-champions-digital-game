import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { McPackStateChipStyles } from "./mc-pack-state-chip.styles.js";
import type { McPackStateChipProps } from "./mc-pack-state-chip.types.js";

/**
 * # Pack state chip
 * A pack's state, a mark and the words ("+ Install", "✓ Installed", "↑ Update", "! Needs a newer app", "✕ Withdrawn"):
 * never colour alone. The call to action (Install, Update) is the red one; the rest are an ink outline.
 *
 * @element mc-pack-state-chip
 */
export class McPackStateChip extends LitElement implements McPackStateChipProps {
  static override styles = [ThemeStyles, McPackStateChipStyles];

  static override properties: PropertyDeclarations = {
    text: { type: String },
    solid: { type: Boolean, reflect: true },
  };

  declare text: string;
  declare solid: boolean;

  constructor() {
    super();
    this.text = "";
    this.solid = false;
  }

  override render() {
    return html`<span class="chip">${this.text}</span>`;
  }
}

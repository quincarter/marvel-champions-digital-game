import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { McLegalityLinesStyles } from "./mc-legality-lines.styles.js";
import type { LegalityModel } from "./mc-legality-lines.types.js";

/**
 * # Legality lines
 * The deck's verdict in words, from the engine's own `validateDeck` (this decides nothing): the legal count or the problems,
 * a campaign's frozen reason, "unsaved changes" and the last status. Pure display, no press.
 *
 * @element mc-legality-lines
 * @prop model - The lines (`LegalityModel`).
 * @attr on-dark - On the ink panel: problems read in paper.
 */
export class McLegalityLines extends LitElement {
  static override styles = [ThemeStyles, McLegalityLinesStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    onDark: { type: Boolean, attribute: "on-dark", reflect: true },
  };

  declare model: LegalityModel | null;
  declare onDark: boolean;

  constructor() {
    super();
    this.model = null;
    this.onDark = false;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<p class="verdict ${model.ok ? "ok" : ""}" data-key="legality">${model.text}</p>
      ${model.frozen ? html`<p class="frozen">${model.frozen}</p>` : nothing}
      ${model.dirty ? html`<p class="dirty">${model.dirty}</p>` : nothing}
      ${model.status ? html`<p class="status" data-key="status">${model.status}</p>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-legality-lines": McLegalityLines;
  }
}

import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { designerLines } from "../../../view/matchup-grid.js";
import { McStatsCreditedStyles } from "./mc-stats-credited.styles.js";
import type { McStatsCreditedProps } from "./mc-stats-credited.types.js";

/**
 * # Credited name
 * A Matchups name that keeps a custom pack's designer credit in sight (issue #937): a name with no credit is cut by an
 * ellipsis as any name is; a credited one cuts the name and leaves the credit whole (after it on one line, on a line of its
 * own with two or more).
 *
 * @element mc-stats-credited
 * @attr label - The name, with "(by Designer)" when credited.
 * @attr lines - The most lines the name may take (1).
 */
export class McStatsCredited extends LitElement implements McStatsCreditedProps {
  static override styles = [McStatsCreditedStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    lines: { type: Number, reflect: true },
  };

  declare label: string;
  declare lines: number;

  constructor() {
    super();
    this.label = "";
    this.lines = 1;
  }

  override willUpdate(): void {
    this.style.setProperty("--name-lines", String(Math.max(1, this.lines - 1)));
  }

  override render() {
    const parts = designerLines(this.label);
    if (!parts) return html`<span class="name" title=${this.label}>${this.label}</span>`;
    return html`<span class="name" title=${this.label}>${parts[0]}</span>${
        parts[1] ? html`<span class="credit">${parts[1]}</span>` : nothing
      }`;
  }
}

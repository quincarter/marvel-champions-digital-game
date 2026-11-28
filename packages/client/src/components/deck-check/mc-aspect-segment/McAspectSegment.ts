import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { DeckCheckElement } from "../shared/DeckCheckElement.js";
import { McAspectSegmentStyles } from "./mc-aspect-segment.styles.js";
import type { McAspectSegmentProps } from "./mc-aspect-segment.types.js";

/**
 * # Aspect segment
 * One aspect of the deck's rail: a tile (green when the deck uses the aspect, dimmed when not, and the name says which
 * either way) with an "i" button at its end that opens the aspect's tip. The tile itself is read-only.
 *
 * @element mc-aspect-segment
 * @fires mc-deck-check - `{ type: "tip", aspect }` on a tap on the "i".
 */
export class McAspectSegment extends DeckCheckElement implements McAspectSegmentProps {
  static override styles = [ThemeStyles, McAspectSegmentStyles];

  static override properties: PropertyDeclarations = {
    aspect: { type: String, reflect: true },
    label: { type: String },
    chosen: { type: Boolean, reflect: true },
    tipLabel: { type: String, attribute: "tip-label" },
    tipOpen: { type: Boolean, attribute: "tip-open" },
  };

  declare aspect: string;
  declare label: string;
  declare chosen: boolean;
  declare tipLabel: string;
  declare tipOpen: boolean;

  constructor() {
    super();
    this.aspect = "";
    this.label = "";
    this.chosen = false;
    this.tipLabel = "";
    this.tipOpen = false;
  }

  override render() {
    return html`<div class="tile">${this.label}</div>
      ${
        this.tipLabel
          ? html`<mc-button
              class="info"
              kind="secondary"
              display
              label="i"
              data-key=${`aspect-info:${this.aspect}`}
              aria-label=${this.tipLabel}
              ?selected=${this.tipOpen}
              @mc-press=${() => this.emit({ type: "tip", aspect: this.aspect })}
            ></mc-button>`
          : nothing
      }`;
  }
}

import { html, LitElement, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "@mc/ui";
import "../mc-aspect-segment/mc-aspect-segment.js";
import { McDeckCompositionStyles } from "./mc-deck-composition.styles.js";
import type { AspectSegmentModel } from "../mc-aspect-segment/mc-aspect-segment.types.js";
import type { McDeckCompositionProps } from "./mc-deck-composition.types.js";

/**
 * # Deck composition
 * The rail's aspect section: a heading and one `mc-aspect-segment` per selectable aspect, over an ink rule. The
 * segments raise the tip events themselves; this only says which tip is open and where each segment is (`anchorOf`),
 * so the page can seat the plate beside it.
 *
 * @element mc-deck-composition
 */
export class McDeckComposition extends LitElement implements McDeckCompositionProps {
  static override styles = [ThemeStyles, McDeckCompositionStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    segments: { attribute: false },
    openTip: { attribute: false },
  };

  declare heading: string;
  declare segments: readonly AspectSegmentModel[];
  declare openTip: string | null;

  constructor() {
    super();
    this.heading = "";
    this.segments = [];
    this.openTip = null;
  }

  /** The segment element for an aspect: where the tip's plate anchors. */
  anchorOf(aspect: string): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(`mc-aspect-segment[aspect="${CSS.escape(aspect)}"]`);
  }

  override render() {
    return html`<div class="heading">${this.heading}</div>
      <div class="segments">
        ${repeat(
          this.segments,
          (segment) => segment.aspect,
          (segment) =>
            html`<mc-aspect-segment
              .aspect=${segment.aspect}
              .label=${segment.label}
              .chosen=${segment.chosen}
              .tipLabel=${segment.tipLabel}
              .tipOpen=${this.openTip === segment.aspect}
            ></mc-aspect-segment>`,
        )}
      </div>
      <div class="rule"></div>`;
  }
}

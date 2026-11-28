import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { McSegmentBarStyles } from "./mc-segment-bar.styles.js";
import type { McSegmentBarProps, SegmentBarPart } from "./mc-segment-bar.types.js";

/**
 * # Segment bar
 * A stacked bar: each part as wide as its share of the whole, in its own colour, with an ink frame. A part can carry its
 * words (so a share is never told by colour alone). A bar with a `total` larger than its parts leaves the rest empty.
 *
 * @element mc-segment-bar
 */
export class McSegmentBar extends LitElement implements McSegmentBarProps {
  static override styles = [ThemeStyles, McSegmentBarStyles];

  static override properties: PropertyDeclarations = {
    parts: { attribute: false },
    total: { type: Number },
    height: { type: Number },
    labels: { type: Boolean },
  };

  declare parts: readonly SegmentBarPart[];
  declare total: number;
  declare height: number;
  declare labels: boolean;

  constructor() {
    super();
    this.parts = [];
    this.total = 0;
    this.height = 12;
    this.labels = false;
  }

  override willUpdate(): void {
    this.style.setProperty("--bar-height", `${this.height}px`);
  }

  override render() {
    const sum = this.parts.reduce((n, part) => n + part.count, 0);
    const whole = Math.max(1, this.total > 0 ? this.total : sum);
    return html`<div class="bar" role="img">
      ${this.parts
        .filter((part) => part.count > 0)
        .map(
          (part) =>
            html`<div
              class="part"
              style=${styleMap({
                width: `${(part.count / whole) * 100}%`,
                "--part-color": part.color,
                ...(part.ink ? { "--part-ink": part.ink } : {}),
              })}
            >
              ${this.labels && part.label ? part.label : nothing}
            </div>`,
        )}
    </div>`;
  }
}

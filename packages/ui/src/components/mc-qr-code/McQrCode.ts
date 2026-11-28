import { html, LitElement, svg, type PropertyDeclarations } from "lit";
import { McQrCodeStyles } from "./mc-qr-code.styles.js";
import type { McQrCodeProps } from "./mc-qr-code.types.js";

/**
 * # QR code
 * A QR code drawn as one SVG path, scaled to the room it has, with a four-module quiet zone in the paper colour so a
 * phone camera reads it on any ground. The element encodes nothing: it draws the modules it is given (`rows`, one string
 * of "1" (dark) and "0" (light) per row), so a client chooses its own encoder. It carries a text label for assistive
 * technology.
 *
 * @element mc-qr-code
 * @attr label - What the code is, as assistive text (the link it opens).
 * @prop rows - The modules, one string per row.
 */
export class McQrCode extends LitElement implements McQrCodeProps {
  static override styles = [McQrCodeStyles];

  static override properties: PropertyDeclarations = {
    rows: { attribute: false },
    label: { type: String },
  };

  declare rows: readonly string[];
  declare label: string;

  constructor() {
    super();
    this.rows = [];
    this.label = "";
  }

  override render() {
    const size = this.rows.length;
    if (size === 0) return html``;
    const quiet = 4;
    const total = size + quiet * 2;
    let path = "";
    this.rows.forEach((row, y) => {
      for (let x = 0; x < row.length;) {
        if (row[x] !== "1") {
          x += 1;
          continue;
        }
        let end = x;
        while (end < row.length && row[end] === "1") end += 1;
        path += `M${x + quiet} ${y + quiet}h${end - x}v1h${x - end}z`;
        x = end;
      }
    });
    return html`<svg viewBox="0 0 ${total} ${total}" role="img" aria-label=${this.label} shape-rendering="crispEdges">
      ${svg`<rect width=${total} height=${total} class="light"></rect><path d=${path} class="dark"></path>`}
    </svg>`;
  }
}

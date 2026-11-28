import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { ViewerElement } from "../shared/ViewerElement.js";
import { McViewerTextStyles } from "./mc-viewer-text.styles.js";
import type { McViewerTextProps, ViewerPromo, ViewerLine } from "./mc-viewer-text.types.js";

/**
 * # Viewer text
 * The file's words beside the picture (below it on a narrow screen): the subtitle, the lines (a quote in italics), a promo
 * card's use-this-art control (the focus stop `promo`) with what to do when promo art is off, and the note about what is
 * still to earn. It scrolls on its own when the words are long.
 *
 * @element mc-viewer-text
 * @fires mc-viewer - `{ type: "promo" }`.
 */
export class McViewerText extends ViewerElement implements McViewerTextProps {
  static override styles = [ThemeStyles, McViewerTextStyles];

  static override properties: PropertyDeclarations = {
    subtitle: { type: String },
    lines: { attribute: false },
    promo: { attribute: false },
    note: { type: String },
    wide: { type: Boolean, reflect: true },
  };

  declare subtitle: string;
  declare lines: readonly ViewerLine[];
  declare promo: ViewerPromo | null;
  declare note: string;
  declare wide: boolean;

  constructor() {
    super();
    this.subtitle = "";
    this.lines = [];
    this.promo = null;
    this.note = "";
    this.wide = false;
  }

  override render() {
    return html`<div class="scroller">
      ${this.subtitle ? html`<p class="subtitle">${this.subtitle}</p>` : nothing}
      ${this.lines.map((line) => html`<p class=${line.quote ? "line quote" : "line"}>${line.text}</p>`)}
      ${
        this.promo
          ? html`<mc-button
                class="promo"
                kind="onInk"
                plain
                data-stop="promo"
                .label=${this.promo.label}
                @mc-press=${() => this.emit({ type: "promo" })}
              ></mc-button>
              ${this.promo.off ? html`<p class="alert">${this.promo.off}</p>` : nothing}`
          : nothing
      }
      ${this.note ? html`<p class="alert">${this.note}</p>` : nothing}
    </div>`;
  }
}

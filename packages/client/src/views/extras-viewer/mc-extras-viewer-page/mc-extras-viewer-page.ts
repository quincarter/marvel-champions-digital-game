import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { viewerEvent } from "../../../components/viewer/shared/viewer-events.types.js";
import "../../../components/viewer/mc-viewer-slide/mc-viewer-slide.js";
import "../../../components/viewer/mc-viewer-text/mc-viewer-text.js";
import { McExtrasViewerPageStyles } from "./mc-extras-viewer-page.styles.js";
import type { ViewerPageModel } from "./mc-extras-viewer-page.types.js";

/**
 * # Extras viewer (page)
 * One hero's or villain's file, or one piece of artwork, as one element that only composes: the header, the picture
 * (`mc-viewer-slide`) and the file's words (`mc-viewer-text`), beside each other on a wide screen and stacked on a narrow
 * one. The scene mounts it over its own scrim, sets `model` and listens for `mc-viewer`.
 *
 * @element mc-extras-viewer-page
 * @prop model - `ViewerPageModel`.
 * @fires mc-viewer - `ViewerEventDetail`, from any section.
 */
export class McExtrasViewerPage extends LitElement {
  static override styles = [ThemeStyles, McExtrasViewerPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    wide: { type: Boolean, reflect: true },
    compact: { type: Boolean, reflect: true },
  };

  declare model: ViewerPageModel | null;
  declare wide: boolean;
  declare compact: boolean;

  constructor() {
    super();
    this.model = null;
    this.wide = false;
    this.compact = false;
  }

  protected override willUpdate(): void {
    this.wide = this.model?.wide ?? false;
    this.compact = this.model?.compact ?? false;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<mc-top-bar class="bar" ?compact=${m.compact} .heading=${m.header.title}>
        <mc-button
          slot="end"
          class="close"
          kind="onInk"
          data-stop="close"
          .label=${"✕"}
          aria-label=${m.header.closeLabel}
          @mc-press=${(event: Event) => {
            event.stopPropagation();
            this.dispatchEvent(viewerEvent({ type: "close" }));
          }}
        ></mc-button>
      </mc-top-bar>
      <div class="body">
        <mc-viewer-slide
          .picture=${m.slide.picture}
          .caption=${m.slide.caption}
          .arrows=${m.slide.arrows}
          .empty=${m.slide.empty}
        ></mc-viewer-slide>
        ${
          m.text
            ? html`<mc-viewer-text
                ?wide=${m.wide}
                .subtitle=${m.text.subtitle}
                .lines=${m.text.lines}
                .promo=${m.text.promo}
                .note=${m.text.note}
              ></mc-viewer-text>`
            : nothing
        }
      </div>`;
  }
}

if (!customElements.get("mc-extras-viewer-page")) {
  customElements.define("mc-extras-viewer-page", McExtrasViewerPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-extras-viewer-page": McExtrasViewerPage;
  }
}

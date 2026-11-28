/**
 * The first-run chooser, the page: only composes. The picture with its banner (a left panel on a wide screen, the top 42%
 * of a narrow one), then the column of choices (the subtitle and the three guide levels as radio cards, the recommended
 * one holding the tutorial's lesson chips on a wide screen) and, under them, Suit up (and Back, wide). Each part is its own
 * element in `components/learn/`; this file registers them once (shared `@mc/ui` elements are defined by the ui entry) and
 * holds only what crosses them: the `mode` the scene sets from the screen's shape.
 *
 * In: `mode` and the `model`. Out: `mc-learn` (`LearnEventDetail`) from the parts and `mc-image-error` from the picture.
 */
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import "../../../components/learn/mc-guide-art/mc-guide-art.js";
import "../../../components/learn/mc-guide-options/mc-guide-options.js";
import "../../../components/learn/mc-guide-actions/mc-guide-actions.js";
import { GuideChooserPageStyles } from "./mc-guide-chooser-page.styles.js";
import type { GuideChooserMode, GuideChooserPageModel } from "./mc-guide-chooser-page.types.js";

export class McGuideChooserPage extends LitElement {
  static override styles = [GuideChooserPageStyles];

  static override properties: PropertyDeclarations = {
    mode: { type: String, reflect: true },
    model: { attribute: false },
  };

  declare mode: GuideChooserMode;
  declare model: GuideChooserPageModel | null;

  constructor() {
    super();
    this.mode = "narrow";
    this.model = null;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    const wide = this.mode === "wide";
    return html`<mc-guide-art ?wide=${wide} heading=${model.art.heading} .picture=${model.art.picture}></mc-guide-art>
      <div class="column">
        <div class="choices">
          <mc-guide-options
            subtitle=${model.options.subtitle}
            .options=${model.options.options}
            .chips=${model.options.chips}
          ></mc-guide-options>
        </div>
        <mc-guide-actions
          suit-label=${model.actions.suitLabel}
          back-label=${model.actions.backLabel}
          ?show-back=${wide}
          .backGlyph=${model.actions.backGlyph}
        ></mc-guide-actions>
      </div>`;
  }
}

if (!customElements.get("mc-guide-chooser-page")) {
  customElements.define("mc-guide-chooser-page", McGuideChooserPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-guide-chooser-page": McGuideChooserPage;
  }
}

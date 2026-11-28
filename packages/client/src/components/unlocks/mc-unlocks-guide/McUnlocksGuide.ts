import { html, LitElement, type PropertyDeclarations } from "lit";
import type { GuideSection } from "../../../view/progression-guide.js";
import { McUnlocksGuideStyles } from "./mc-unlocks-guide.styles.js";

/**
 * # Unlocks guide
 * "How it works": every section of the progression guide, top to bottom, in one natively scrolling region. Read-only.
 *
 * @element mc-unlocks-guide
 * @prop sections - `GuideSection[]` (heading, paragraphs, bullets), already translated.
 */
export class McUnlocksGuide extends LitElement {
  static override styles = [McUnlocksGuideStyles];

  static override properties: PropertyDeclarations = {
    sections: { attribute: false },
  };

  declare sections: readonly GuideSection[];

  constructor() {
    super();
    this.sections = [];
  }

  /** The scrolling element. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  /** Scrolls so section `index` starts at the top. */
  showSection(index: number): void {
    const section = this.renderRoot.querySelector<HTMLElement>(`[data-section="${index}"]`);
    const scroller = this.scroller;
    if (section && scroller) scroller.scrollTo({ top: section.offsetTop - scroller.offsetTop });
  }

  override render() {
    return html`<div class="scroller" data-key="guide-text">
      ${this.sections.map(
        (section, index) =>
          html`<section data-section=${index}>
            <h3>${section.heading}</h3>
            ${section.paragraphs.map((text) => html`<p>${text}</p>`)}
            ${
              section.bullets.length > 0
                ? html`<ul>
                    ${section.bullets.map((text) => html`<li>${text}</li>`)}
                  </ul>`
                : ""
            }
          </section>`,
      )}
    </div>`;
  }
}

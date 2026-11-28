/**
 * How to play, the hub's page: only composes. The ink header (the close and the title), then one natively scrolling body:
 * THE BASICS (the five lessons), ASPECTS and REFERENCE (side by side on a wide screen, stacked on a narrow one), NEW IN EACH
 * BOX (the box pages the player has unlocked, in the same two columns) and the red Continue learning. Each part is its own
 * element in `components/learn/`; this file registers them once (shared `@mc/ui` elements are defined by the ui entry) and
 * holds only what crosses them: the `mode` the scene sets from the screen's shape.
 *
 * In: `mode` and the `model`. Out: `mc-learn` (`LearnEventDetail`) from the parts. `scroller` is the body's native scroll
 * container, for the pad's stick and the scroll position kept across a visit to a lesson.
 */
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { learnEvent } from "../../../components/learn/shared/learn-events.types.js";
import "../../../components/learn/mc-lesson-list/mc-lesson-list.js";
import "../../../components/learn/mc-aspect-list/mc-aspect-list.js";
import "../../../components/learn/mc-link-list/mc-link-list.js";
import "../../../components/learn/mc-continue-bar/mc-continue-bar.js";
import { HowToPlayPageStyles } from "./mc-how-to-play-page.styles.js";
import type { HowToPlayMode, HowToPlayPageModel } from "./mc-how-to-play-page.types.js";

export class McHowToPlayPage extends LitElement {
  static override styles = HowToPlayPageStyles;

  static override properties: PropertyDeclarations = {
    mode: { type: String, reflect: true },
    model: { attribute: false },
  };

  declare mode: HowToPlayMode;
  declare model: HowToPlayPageModel | null;

  constructor() {
    super();
    this.mode = "narrow";
    this.model = null;
  }

  /** The body's native scroller. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".main");
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    const { header } = model;
    const wide = this.mode === "wide";
    return html`<mc-top-bar
        class="bar"
        variant="close"
        .heading=${header.heading}
        .backLabel=${header.closeLabel}
        .backGlyph=${header.glyph ?? null}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          this.dispatchEvent(learnEvent({ type: "close" }));
        }}
      ></mc-top-bar>
      <div class="main">
        <div class="column">
          <div class="top">
            <mc-lesson-list heading=${model.lessons.heading} .lessons=${model.lessons.rows}></mc-lesson-list>
            <div class="side">
              <mc-aspect-list heading=${model.aspects.heading} .aspects=${model.aspects.rows}></mc-aspect-list>
              <mc-link-list heading=${model.reference.heading} .rows=${model.reference.rows}></mc-link-list>
            </div>
          </div>
          <mc-link-list heading=${model.boxes.heading} columns=${wide ? 2 : 1} .rows=${model.boxes.rows}></mc-link-list>
          <mc-continue-bar label=${model.continue.label} ?starting=${model.continue.starting}></mc-continue-bar>
        </div>
      </div>`;
  }
}

if (!customElements.get("mc-how-to-play-page")) {
  customElements.define("mc-how-to-play-page", McHowToPlayPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-how-to-play-page": McHowToPlayPage;
  }
}

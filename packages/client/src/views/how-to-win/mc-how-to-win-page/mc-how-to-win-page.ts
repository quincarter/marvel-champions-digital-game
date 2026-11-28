/**
 * How to win, the page: only composes. The ink header (the close, "Lesson 1 of 5" and its progress ticks), the headline,
 * the three cards, the EVERY ROUND strip, and the two actions pinned under them. Each part is its own element in `components/learn/`; this
 * file registers them once (shared `@mc/ui` elements are defined by the ui entry) and holds only what crosses them: the
 * `mode` the scene sets from the screen's shape.
 *
 * In: `mode` and the `model`. Out: `mc-learn` (`LearnEventDetail`) from the parts, `mc-image-error` and the card hover and
 * Inspect events from the scans. `closeTip()` closes the open glossary tip.
 */
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { learnEvent } from "../../../components/learn/shared/learn-events.types.js";
import "../../../components/learn/mc-win-title/mc-win-title.js";
import "../../../components/learn/mc-win-cards/mc-win-cards.js";
import "../../../components/learn/mc-round-strip/mc-round-strip.js";
import "../../../components/learn/mc-win-actions/mc-win-actions.js";
import type { McWinCards } from "../../../components/learn/mc-win-cards/McWinCards.js";
import { HowToWinPageStyles } from "./mc-how-to-win-page.styles.js";
import type { HowToWinMode, HowToWinPageModel } from "./mc-how-to-win-page.types.js";

export class McHowToWinPage extends LitElement {
  static override styles = HowToWinPageStyles;

  static override properties: PropertyDeclarations = {
    mode: { type: String, reflect: true },
    model: { attribute: false },
  };

  declare mode: HowToWinMode;
  declare model: HowToWinPageModel | null;

  constructor() {
    super();
    this.mode = "narrow";
    this.model = null;
  }

  /** The page's native scroller. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".main");
  }

  /** Closes the open glossary tip; true when one was open (Escape then stays on the screen). */
  closeTip(): boolean {
    return this.renderRoot.querySelector<McWinCards>("mc-win-cards")?.closeTip() ?? false;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    const { header } = model;
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
      >
        <mc-step-ticks
          slot="end"
          count=${header.ticks.count}
          filled=${header.ticks.filled}
          label=${header.ticks.label}
        ></mc-step-ticks>
      </mc-top-bar>
      <div class="main">
        <div class="column">
          <mc-win-title first=${model.title.first} second=${model.title.second}></mc-win-title>
          <mc-win-cards mode=${this.mode} .input=${model.cards}></mc-win-cards>
          <mc-round-strip label=${model.round.label} .steps=${model.round.steps}></mc-round-strip>
        </div>
      </div>
      <div class="foot">
        <mc-win-actions
          tell-label=${model.actions.tellLabel}
          start-label=${model.actions.startLabel}
          ?starting=${model.actions.starting}
        ></mc-win-actions>
      </div>`;
  }
}

if (!customElements.get("mc-how-to-win-page")) {
  customElements.define("mc-how-to-win-page", McHowToWinPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-how-to-win-page": McHowToWinPage;
  }
}

import { html, nothing, type PropertyDeclarations } from "lit";
import { LearnElement } from "../shared/LearnElement.js";
import { McWinCardsStyles } from "./mc-win-cards.styles.js";
import type { WinCardModel, WinCardsInput, WinCardsMode } from "./mc-win-cards.types.js";

/**
 * # Win cards
 * The three cards of How to win: WIN (knock out the villain), LOSE (the main scheme finishes) and LOSE (you go down).
 * Wide, the tall WIN card sits at the left and the two LOSE cards stack at the right; narrow, the three stack in a column.
 * The scheme card's words carry the "threat" term (`mc-term-text`): its tip opens over the page, its glossary link and
 * the tip opening are `mc-learn` events. The scans raise the card hover events, which pass through to the scene. Its
 * `closeTip()` closes the open term tip and says whether one was open.
 *
 * @element mc-win-cards
 * @prop input - What it shows (`WinCardsInput`).
 * @attr mode - wide | narrow, set by the scene from the screen's shape.
 * @fires mc-learn - `{ type: "glossary", heading }` and `{ type: "tip", open }`.
 */
export class McWinCards extends LearnElement {
  static override styles = [McWinCardsStyles];

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare input: WinCardsInput | null;
  declare mode: WinCardsMode;

  constructor() {
    super();
    this.input = null;
    this.mode = "narrow";
  }

  /** Closes the open term tip; true when one was open (Escape then stays on the screen). */
  closeTip(): boolean {
    return this.renderRoot.querySelector("mc-term-text")?.closeTip() ?? false;
  }

  #card(model: WinCardModel, className: string, layout: "row" | "column", fill = false) {
    return html`<mc-win-card
      class=${className}
      tag=${model.tag}
      tone=${model.tone}
      heading=${model.heading}
      card-id=${model.cardId}
      art=${model.art}
      layout=${layout}
      ?fill=${fill}
      scan-key=${model.scanKey}
      .face=${model.face}
      .picture=${model.picture}
    >
      ${
        model.terms
          ? html`<mc-term-text .runs=${model.terms.runs} .tips=${model.terms.tips}></mc-term-text>`
          : html`<span>${model.body}</span>`
      }
    </mc-win-card>`;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`${this.#card(input.win, "win", this.mode === "wide" ? "column" : "row")}
    ${this.#card(input.scheme, "scheme", "row", this.mode === "wide")}
    ${this.#card(input.hero, "hero", "row", this.mode === "wide")}`;
  }
}

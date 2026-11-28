import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, watchedCard } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import { RulesElement } from "../shared/RulesElement.js";
import { McRulesStepStyles } from "./mc-rules-step.styles.js";
import type { McRulesStepProps, RulesStepModel } from "./mc-rules-step.types.js";

/**
 * # Rules step
 * One of the villain phase's six steps: its number and name (Bangers), what happens, and, where one applies, the picture
 * that illustrates it (the main scheme's or villain's own scan, or the encounter card back). The step the live game is on
 * is an ink card marked "HAPPENING NOW" in words as well as by its fill. A step is a focus stop, `row:step:<n>`; it has
 * nothing to press, so reading is all there is to do.
 *
 * @element mc-rules-step
 */
export class McRulesStep extends RulesElement implements McRulesStepProps {
  static override styles = [ThemeStyles, McRulesStepStyles];

  static override properties: PropertyDeclarations = {
    step: { attribute: false },
  };

  declare step: RulesStepModel | null;

  constructor() {
    super();
    this.step = null;
  }

  protected override willUpdate(): void {
    if (this.step) this.dataset.stop = `row:step:${this.step.index}`;
  }

  override render() {
    const step = this.step;
    if (!step) return nothing;
    const art = step.picture;
    return html`<div class=${step.current ? "card current" : "card"}>
      ${
        art
          ? html`<div class="art" ${watchedCard(() => (step.cardId ? { cardId: step.cardId, face: step.face } : null))}>
              ${art.src ? html`<img src=${art.src} alt="" loading="lazy" decoding="async" draggable="false" />` : nothing}
            </div>`
          : nothing
      }
      <div class="words">
        ${step.current ? html`<div class="now">${t("rules.villain.now")}</div>` : nothing}
        <div class="label">${step.label}</div>
        <p class="detail">${step.detail}</p>
      </div>
    </div>`;
  }
}

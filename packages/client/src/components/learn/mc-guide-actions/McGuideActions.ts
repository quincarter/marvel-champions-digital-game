import { glyphLabelShift, type ControlGlyph } from "@mc/ui";
import { html, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { LearnElement } from "../shared/LearnElement.js";
import { McGuideActionsStyles } from "./mc-guide-actions.styles.js";
import type { GuideActionsProps } from "./mc-guide-actions.types.js";

/**
 * # Guide actions
 * The chooser's two ways on: "Suit up", the screen's one red action (it records the picked level and goes on), and, on the
 * wide screen, a quiet "Back" (to Title with nothing saved) with the Cancel glyph on it while a keyboard or pad is in use.
 * The focus stops are `suit-up` and `back`.
 *
 * @element mc-guide-actions
 * @attr suit-label - Suit up, already translated.
 * @attr back-label - Back, already translated.
 * @attr show-back - The Back button is drawn (the wide screen only).
 * @prop back-glyph - The Cancel glyph on Back, or none.
 * @fires mc-learn - `{ type: "back" }` and `{ type: "suit-up" }`.
 */
export class McGuideActions extends LearnElement implements GuideActionsProps {
  static override styles = [McGuideActionsStyles];

  static override properties: PropertyDeclarations = {
    suitLabel: { type: String, attribute: "suit-label" },
    backLabel: { type: String, attribute: "back-label" },
    showBack: { type: Boolean, attribute: "show-back", reflect: true },
    backGlyph: { attribute: false },
  };

  declare suitLabel: string;
  declare backLabel: string;
  declare showBack: boolean;
  declare backGlyph: ControlGlyph | undefined;

  constructor() {
    super();
    this.suitLabel = "";
    this.backLabel = "";
    this.showBack = false;
    this.backGlyph = undefined;
  }

  override render() {
    return html`<mc-button
        class="suit"
        kind="primary"
        display
        data-stop="suit-up"
        .label=${this.suitLabel}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          this.emit({ type: "suit-up" });
        }}
      ></mc-button>
      ${
        this.showBack
          ? html`<div class="ctl" style=${styleMap({ "--mc-label-shift": `${glyphLabelShift(this.backGlyph)}px` })}>
              <mc-chip class="back" .stop=${"back"} label=${this.backLabel} .action=${{ type: "back" }}></mc-chip>
              <mc-glyph-hint .glyph=${this.backGlyph}></mc-glyph-hint>
            </div>`
          : nothing
      }`;
  }
}

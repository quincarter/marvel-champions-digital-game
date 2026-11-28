import { html, type PropertyDeclarations } from "lit";
import { ThemeStyles, type HintGlyph } from "@mc/ui";
import { RulesElement } from "../shared/RulesElement.js";
import "../mc-rules-scope/mc-rules-scope.js";
import { McRulesHeaderStyles } from "./mc-rules-header.styles.js";
import type { McRulesHeaderProps } from "./mc-rules-header.types.js";
import type { McRulesScopeProps } from "../mc-rules-scope/mc-rules-scope.types.js";

/**
 * # Rules header
 * The ink chrome band across the top: Back (with its Cancel glyph on a keyboard or pad), the title, and under them the
 * scope row (`mc-rules-scope`). Back is the focus stop `back`.
 *
 * @element mc-rules-header
 * @fires mc-rules - `{ type: "back" }` (and the scope row's `scope`).
 */
export class McRulesHeader extends RulesElement implements McRulesHeaderProps {
  static override styles = [ThemeStyles, McRulesHeaderStyles];

  static override properties: PropertyDeclarations = {
    backLabel: { type: String, attribute: "back-label" },
    heading: { type: String },
    backGlyph: { attribute: false },
    caption: { type: String },
    toggle: { attribute: false },
  };

  declare backLabel: string;
  declare heading: string;
  declare backGlyph: HintGlyph | null;
  declare caption: string;
  declare toggle: McRulesScopeProps["toggle"];

  constructor() {
    super();
    this.backLabel = "";
    this.heading = "";
    this.backGlyph = null;
    this.caption = "";
    this.toggle = null;
  }

  override render() {
    return html`<div class="title-row">
        <mc-hint-button
          class="back"
          kind="onInk"
          display
          hug
          data-stop="back"
          .label=${this.backLabel}
          .glyph=${this.backGlyph}
          @mc-press=${(event: Event) => {
            event.stopPropagation();
            this.emit({ type: "back" });
          }}
        ></mc-hint-button>
        <span class="title">${this.heading}</span>
      </div>
      <mc-rules-scope .caption=${this.caption} .toggle=${this.toggle}></mc-rules-scope>`;
  }
}

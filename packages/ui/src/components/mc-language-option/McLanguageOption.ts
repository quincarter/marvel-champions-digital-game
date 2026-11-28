import { LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { popupButton } from "../../shared/popup-parts.js";
import { McLanguageOptionStyles } from "./mc-language-option.styles.js";
import type { LanguageOption } from "./mc-language-option.types.js";

/**
 * # Language option
 * One row of the card language list: the language's name as a button, the current one marked.
 *
 * @element mc-language-option
 * @fires mc-activate - `detail.key`: the option was pressed.
 */
export class McLanguageOption extends LitElement {
  static override styles = [ThemeStyles, McLanguageOptionStyles];

  static override properties: PropertyDeclarations = {
    option: { attribute: false },
  };

  declare option: LanguageOption | null;

  constructor() {
    super();
    this.option = null;
  }

  override render() {
    return this.option ? popupButton(this, this.option) : nothing;
  }
}

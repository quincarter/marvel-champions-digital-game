import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import "../mc-button/mc-button.js";
import "../controls/mc-glyph-hint/mc-glyph-hint.js";
import { glyphLabelShift } from "../controls/mc-glyph-hint/mc-glyph-hint.types.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { McPopupButtonStyles } from "./mc-popup-button.styles.js";
import type { ControlGlyph, PopupButton } from "../../shared/popup.types.js";

/**
 * # Popup button
 * A pop-up's button: an `mc-button` that reports its press as `mc-activate`, with the key or pad glyph hung on it while
 * a keyboard or pad is the input in use. The inner button carries `data-stop` (the focus route's key).
 *
 * @element mc-popup-button
 * @fires mc-activate - `detail.key`: the button was pressed.
 */
export class McPopupButton extends LitElement {
  static override styles = [ThemeStyles, McPopupButtonStyles];

  static override properties: PropertyDeclarations = {
    button: { attribute: false },
    glyph: { attribute: false },
  };

  declare button: PopupButton | null;
  declare glyph: ControlGlyph | null;

  constructor() {
    super();
    this.button = null;
    this.glyph = null;
  }

  override willUpdate(): void {
    this.style.setProperty("--mc-label-shift", `${glyphLabelShift(this.glyph ?? undefined)}px`);
  }

  #press = (): void => {
    if (!this.button) return;
    this.dispatchEvent(
      new CustomEvent("mc-activate", { detail: { key: this.button.key }, bubbles: true, composed: true }),
    );
  };

  override render() {
    const b = this.button;
    if (!b) return nothing;
    const g = this.glyph;
    return html`<mc-button
        data-stop=${b.key}
        kind=${b.kind}
        .label=${b.label}
        ?selected=${b.selected ?? false}
        ?disabled=${b.disabled !== undefined}
        .reason=${b.disabled ?? ""}
        @mc-press=${this.#press}
      ></mc-button>
      ${g ? html`<mc-glyph-hint .glyph=${g}></mc-glyph-hint>` : nothing}`;
  }
}

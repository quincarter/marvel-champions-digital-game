import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { McButtonKind } from "../../shared/button.types.js";
import "../mc-button/mc-button.js";
import "../mc-glyph/mc-glyph.js";
import { GLYPH_TAB_WIDTH, layoutGlyph } from "../mc-glyph/glyph-layout.js";
import { McHintButtonStyles } from "./mc-hint-button.styles.js";
import type { HintGlyph } from "./mc-hint-button.types.js";

/** The room between the glyph and the word. */
const GAP = 8;

/**
 * # Hint button
 * An `mc-button` that carries a key or pad glyph beside its word while a keyboard or controller is in use (the word
 * keeps clear of it); with no glyph it is the plain button. The button is pressed by a tap only, as ever.
 *
 * @element mc-hint-button
 * @attr kind - As `mc-button`.
 * @attr label - The word, already translated.
 * @attr selected - On.
 * @attr disabled - Unavailable (dimmed); `reason` is its tooltip.
 * @attr pressable - With `disabled`: a tap still raises `mc-press`.
 * @attr display - A Bangers label.
 * @attr plain - A label in its own case.
 * @prop glyph - `HintGlyph`, or null for none.
 * @fires mc-press - A tap on an enabled button (from the inner `mc-button`, re-raised unchanged).
 */
export class McHintButton extends LitElement {
  static override styles = [ThemeStyles, McHintButtonStyles];

  static override properties: PropertyDeclarations = {
    kind: { type: String, reflect: true },
    label: { type: String },
    selected: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    pressable: { type: Boolean, reflect: true },
    display: { type: Boolean, reflect: true },
    plain: { type: Boolean, reflect: true },
    reason: { type: String },
    glyph: { attribute: false },
  };

  declare kind: McButtonKind;
  declare label: string;
  declare selected: boolean;
  declare disabled: boolean;
  declare pressable: boolean;
  declare display: boolean;
  declare plain: boolean;
  declare reason: string;
  declare glyph: HintGlyph | null;

  constructor() {
    super();
    this.kind = "secondary";
    this.label = "";
    this.selected = false;
    this.disabled = false;
    this.pressable = false;
    this.display = false;
    this.plain = false;
    this.reason = "";
    this.glyph = null;
  }

  /** The room the glyph takes at the button's left edge, so the word centres in what is left. */
  #inset(glyph: HintGlyph): number {
    if (!glyph.expanded) return 0;
    const { fullWidth } = layoutGlyph(glyph.specs, glyph.height);
    return Math.max(GLYPH_TAB_WIDTH, fullWidth) + GAP;
  }

  /** A focus stop `click()` (`detail` 0) presses an enabled button; a pointer click is the inner button's tap. */
  readonly #keyboardClick = (event: MouseEvent): void => {
    if (event.detail !== 0 || (this.disabled && !this.pressable)) return;
    this.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("click", this.#keyboardClick);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("click", this.#keyboardClick);
  }

  protected override updated(): void {
    this.style.setProperty("--mc-label-inset", `${this.glyph ? this.#inset(this.glyph) : 0}px`);
  }

  override render() {
    const glyph = this.glyph;
    return html`<mc-button
        .kind=${this.kind}
        .label=${this.label}
        ?selected=${this.selected}
        ?disabled=${this.disabled}
        ?pressable=${this.pressable}
        ?display=${this.display}
        ?plain=${this.plain}
        .reason=${this.reason}
      ></mc-button>
      ${
        glyph
          ? html`<mc-glyph
              .specs=${glyph.specs}
              .height=${glyph.height}
              .ground=${glyph.ground}
              .openness=${glyph.expanded ? 1 : 0}
              ?still=${glyph.still}
            ></mc-glyph>`
          : nothing
      }`;
  }
}

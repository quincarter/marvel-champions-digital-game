import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { onTap } from "../../shared/tap.js";
import { McButtonStyles } from "./mc-button.styles.js";

export type McButtonKind = "primary" | "secondary" | "quiet" | "onInk";

/**
 * # Button
 * The client's `McButton` as a web component: the same kinds and states, pressed only by a tap (press and release on
 * it, nothing scrolled between: `shared/tap.ts`), never by the lift that ends a swipe. It takes no keyboard focus of
 * its own: the game's focus route (keyboard and pad) presses it through the scene.
 *
 * @element mc-button
 * @attr kind - primary | secondary | quiet | onInk
 * @attr selected - The control's on / chosen state.
 * @attr disabled - Unavailable: kept in place, dimmed, presses do nothing. `reason` says why, as a tooltip.
 * @attr framed - The inner paper frame an "on" switch carries.
 * @attr display - A Bangers label.
 * @fires mc-press - A tap on an enabled button.
 */
export class McButton extends LitElement {
  static override styles = [ThemeStyles, McButtonStyles];

  static override properties: PropertyDeclarations = {
    kind: { type: String, reflect: true },
    label: { type: String },
    selected: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    framed: { type: Boolean, reflect: true },
    display: { type: Boolean, reflect: true },
    reason: { type: String },
  };

  declare kind: McButtonKind;
  declare label: string;
  declare selected: boolean;
  declare disabled: boolean;
  declare framed: boolean;
  declare display: boolean;
  declare reason: string;
  #stopTap: (() => void) | null = null;

  constructor() {
    super();
    this.kind = "secondary";
    this.label = "";
    this.selected = false;
    this.disabled = false;
    this.framed = false;
    this.display = false;
    this.reason = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#stopTap = onTap(
      this,
      () => this.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true })),
      { enabled: () => !this.disabled },
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopTap?.();
    this.#stopTap = null;
  }

  override render() {
    return html`<button
      type="button"
      tabindex="-1"
      aria-pressed=${this.selected ? "true" : "false"}
      aria-disabled=${this.disabled ? "true" : "false"}
      title=${this.disabled && this.reason ? this.reason : ""}
    >
      <span class="label">${this.label}</span>
    </button>`;
  }
}

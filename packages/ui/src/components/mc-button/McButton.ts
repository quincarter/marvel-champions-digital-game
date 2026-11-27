import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { onTap } from "../../shared/tap.js";
import type { McButtonKind } from "../../shared/button.types.js";
import { McButtonStyles } from "./mc-button.styles.js";

/**
 * # Button
 * The client's `McButton` as a web component: the same kinds and states, pressed only by a tap (press and release on
 * it, nothing scrolled between: `shared/tap.ts`), never by the lift that ends a swipe. It takes no keyboard focus of
 * its own: the game's focus route (keyboard and pad) presses it through the scene.
 *
 * @element mc-button
 * @attr kind - primary | secondary | quiet | onInk | rail (a tab cell: parchment, an ink fill when selected)
 * @attr selected - The control's on / chosen state.
 * @attr still - No label slide when a glyph makes room (reduced motion).
 * @attr disabled - Unavailable: kept in place, dimmed, presses do nothing. `reason` says why, as a tooltip.
 * @attr pressable - With `disabled`: still dimmed, but a tap raises `mc-press` (the screen says why it does nothing).
 * @attr framed - The inner paper frame an "on" switch carries.
 * @attr display - A Bangers label.
 * @attr plain - A label in its own case, with no tracking (a row title, as against the capitals of a label).
 * @fires mc-press - A tap on an enabled button.
 */
export class McButton extends LitElement {
  static override styles = [ThemeStyles, McButtonStyles];

  static override properties: PropertyDeclarations = {
    kind: { type: String, reflect: true },
    label: { type: String },
    selected: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    pressable: { type: Boolean, reflect: true },
    framed: { type: Boolean, reflect: true },
    display: { type: Boolean, reflect: true },
    plain: { type: Boolean, reflect: true },
    still: { type: Boolean, reflect: true },
    reason: { type: String },
  };

  declare kind: McButtonKind;
  declare label: string;
  declare selected: boolean;
  declare disabled: boolean;
  declare pressable: boolean;
  declare framed: boolean;
  declare display: boolean;
  declare plain: boolean;
  /** No label slide (reduced motion). */
  declare still: boolean;
  declare reason: string;
  #stopTap: (() => void) | null = null;
  #resize: ResizeObserver | null = null;

  constructor() {
    super();
    this.kind = "secondary";
    this.label = "";
    this.selected = false;
    this.disabled = false;
    this.pressable = false;
    this.framed = false;
    this.display = false;
    this.plain = false;
    this.still = false;
    this.reason = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#stopTap = onTap(
      this,
      () => this.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true })),
      { enabled: () => !this.disabled || this.pressable },
    );
    // The label is fitted to the button's own width, so a button sized after the fact (by its sheet) refits.
    if (typeof ResizeObserver !== "undefined") {
      this.#resize = new ResizeObserver(() => this.#fit());
      // Fitted against the fallback font until the web fonts are in: fit again then.
      void document.fonts?.ready.then(() => {
        if (this.isConnected) this.#fit();
      });
      this.#resize.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopTap?.();
    this.#stopTap = null;
    this.#resize?.disconnect();
    this.#resize = null;
  }

  override updated(): void {
    this.#fit();
  }

  /**
   * No label runs past its own button: it shrinks (down to the caption floor) to fit with 16px to spare, as the
   * client's Phaser `McButton` fits it. What still doesn't fit is cut with an ellipsis by the stylesheet.
   */
  #fit(): void {
    const label = this.renderRoot.querySelector<HTMLElement>(".label");
    if (!label || this.clientWidth === 0) return;
    label.style.fontSize = "";
    const style = getComputedStyle(label);
    const floor = parseFloat(style.getPropertyValue("--mc-small-8")) || 8;
    const room = this.clientWidth - 16;
    let size = parseFloat(style.fontSize);
    // An ellipsis-clipped label reports its full width as scrollWidth, so the loop measures the overflow itself.
    while (label.scrollWidth > room && size > floor) {
      size = Math.max(floor, size - 0.5);
      label.style.fontSize = `${size}px`;
    }
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

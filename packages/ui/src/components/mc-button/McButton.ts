import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
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
 * @attr hug - The button is as wide as its word (a chip): the label is never shrunk to fit, the button pads it instead.
 * @attr still - No label slide when a glyph makes room (reduced motion).
 * @attr disabled - Unavailable: kept in place, dimmed, presses do nothing. `reason` says why, as a tooltip.
 * @attr pressable - With `disabled`: still dimmed, but a tap raises `mc-press` (the screen says why it does nothing).
 * @attr framed - The inner paper frame an "on" switch carries.
 * @attr display - A Bangers label.
 * @attr row - A call to action with a second line: the label at the left over `subtitle`, a `chevron` at the right.
 * @attr subtitle-label - A row's subtitle as a small tracked caption.
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
    wrap: { type: Boolean, reflect: true },
    still: { type: Boolean, reflect: true },
    hug: { type: Boolean, reflect: true },
    reason: { type: String },
    row: { type: Boolean, reflect: true },
    subtitle: { type: String },
    subtitleLabel: { type: Boolean, reflect: true, attribute: "subtitle-label" },
    chevron: { type: Boolean },
  };

  declare kind: McButtonKind;
  declare label: string;
  declare selected: boolean;
  declare disabled: boolean;
  declare pressable: boolean;
  declare framed: boolean;
  declare display: boolean;
  declare plain: boolean;
  /** A label that wraps onto a second line (a built game's name), shrinking a step before it would need a third. */
  declare wrap: boolean;
  /** No label slide (reduced motion). */
  declare still: boolean;
  declare hug: boolean;
  declare reason: string;
  /** A row button (a call to action with a second line): the title at the left over an optional subtitle, a chevron at the right. */
  declare row: boolean;
  /** A row's second line, under its title. */
  declare subtitle: string;
  /** The second line as a small tracked caption rather than a sentence. */
  declare subtitleLabel: boolean;
  /** A row's "▸" at the right end. */
  declare chevron: boolean;
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
    this.wrap = false;
    this.still = false;
    this.hug = false;
    this.reason = "";
    this.row = false;
    this.subtitle = "";
    this.subtitleLabel = false;
    this.chevron = false;
  }

  #onClick = (event: MouseEvent): void => {
    if (event.detail !== 0 || (this.disabled && !this.pressable)) return;
    this.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.#stopTap = onTap(
      this,
      () => this.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true })),
      { enabled: () => !this.disabled || this.pressable },
    );
    // `click()` from the focus route (Enter on a `data-stop`) has no pointer press behind it (`detail` 0): it presses.
    this.addEventListener("click", this.#onClick);
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
    // A hugging button takes its width from the word, so there is nothing to fit it to.
    if (this.hug) return;
    const style = getComputedStyle(label);
    const floor = parseFloat(style.getPropertyValue("--mc-small-8")) || 8;
    // A row keeps its padding and the chevron's room clear as well.
    const room = this.clientWidth - (this.row ? (this.chevron ? 64 : 40) : 16);
    let size = parseFloat(style.fontSize);
    if (this.wrap) {
      // Two lines at most: a step smaller until the label's height fits the button.
      while (label.scrollHeight > this.clientHeight - 4 && size > floor) {
        size = Math.max(floor, size - 0.5);
        label.style.fontSize = `${size}px`;
      }
      return;
    }
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
      ${
        this.row
          ? html`<span class="text"
                ><span class="label">${this.label}</span
                >${this.subtitle ? html`<span class="sub">${this.subtitle}</span>` : nothing}</span
              >${this.chevron ? html`<span class="chevron" aria-hidden="true">▸</span>` : nothing}`
          : html`<span class="label">${this.label}</span>`
      }
    </button>`;
  }
}

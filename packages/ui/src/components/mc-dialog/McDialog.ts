import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { tapped } from "../../shared/tapped.js";
import { McDialogStyles } from "./mc-dialog.styles.js";

/**
 * # Dialog
 * A paper box with a 4px ink border over a scrim that dims the screen under it: a heading, a body that scrolls natively
 * and a footer. A tap on the scrim (never the lift that ends a swipe) raises `mc-dialog-dismiss`; the box itself takes
 * presses for its own parts. It fills the overlay region it is mounted in.
 *
 * @element mc-dialog
 * @attr heading - The title, already translated.
 * @attr width - The box's widest, px (520).
 * @attr tall - The box fills the height (a long list) instead of sizing to its body.
 * @slot - The body: scrolls when it outgrows the box.
 * @slot footer - Buttons under the body.
 * @fires mc-dialog-dismiss - A tap on the scrim.
 */
export class McDialog extends LitElement {
  static override styles = [ThemeStyles, McDialogStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    width: { type: Number },
    tall: { type: Boolean, reflect: true },
  };

  declare heading: string;
  declare width: number;
  declare tall: boolean;

  constructor() {
    super();
    this.heading = "";
    this.width = 520;
    this.tall = false;
  }

  /** The body's scroller, for the pad's stick and paging. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".body");
  }

  #dismiss = (): void => {
    this.dispatchEvent(new CustomEvent("mc-dialog-dismiss", { bubbles: true, composed: true }));
  };

  override willUpdate(): void {
    this.style.setProperty("--dialog-width", `${this.width}px`);
  }

  override render() {
    return html`<div class="scrim" ${tapped(this.#dismiss)}></div>
      <div class="box" role="dialog" aria-label=${this.heading}>
        <h2 class="heading">${this.heading}</h2>
        <slot name="intro"></slot>
        <div class="body"><slot></slot></div>
        <div class="footer"><slot name="footer"></slot></div>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-dialog": McDialog;
  }
}

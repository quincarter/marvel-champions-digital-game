import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { McToastStyles } from "./mc-toast.styles.js";
import type { McToastProps } from "./mc-toast.types.js";

/**
 * # Toast
 * A short note at the foot of the screen (a link copied, why an action failed). It stands over its positioned parent,
 * takes no press and says nothing while `text` is empty; the screen decides how long it stays. Announced politely.
 *
 * @element mc-toast
 * @attr text - What it says, already translated.
 * @cssprop --mc-toast-bottom - How far it floats above the parent's bottom edge (16px).
 */
export class McToast extends LitElement implements McToastProps {
  static override styles = [McToastStyles];

  static override properties: PropertyDeclarations = {
    text: { type: String },
    hidden: { type: Boolean, reflect: true },
  };

  declare text: string;
  declare hidden: boolean;

  constructor() {
    super();
    this.text = "";
    this.hidden = true;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("role", "status");
    this.setAttribute("aria-live", "polite");
  }

  protected override willUpdate(): void {
    this.hidden = this.text === "";
  }

  override render() {
    return this.text === "" ? nothing : html`<div class="note">${this.text}</div>`;
  }
}

import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import "../mc-controller-diagram/mc-controller-diagram.js";
import type { ControlsDiagramInput } from "../controls.types.js";
import { McControlsDiagramStyles } from "./mc-controls-diagram.styles.js";

/**
 * # Controls diagram
 * The controller tab's top: the drawing (`mc-controller-diagram`), the caption under it saying what the drawing shows, and,
 * while a pad is connected, the line of what the browser reports from it (a pad that is detected but never moves the game
 * shows here whether its presses reach the page at all). Read-only.
 *
 * @element mc-controls-diagram
 * @prop input - `ControlsDiagramInput`.
 */
export class McControlsDiagram extends LitElement {
  static override styles = [McControlsDiagramStyles];

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
  };

  declare input: ControlsDiagramInput | null;

  constructor() {
    super();
    this.input = null;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`<mc-controller-diagram .diagram=${input.diagram}></mc-controller-diagram>
      <p class="caption"><span>${input.caption}</span></p>
      ${input.testLine === null ? nothing : html`<p class="test" data-key="input-test"><span>${input.testLine}</span></p>`}`;
  }
}

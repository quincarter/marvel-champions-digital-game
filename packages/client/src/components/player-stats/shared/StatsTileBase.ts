import { LitElement, type PropertyDeclarations } from "lit";

/**
 * The base of the Overview's tile elements: a boxed fact that is a focus stop with nothing to press (a pad or keyboard
 * walks every tile). `stop` is the tile's key (`tile:record`), set on the host as `data-stop` so the focus route finds it.
 */
export abstract class StatsTileBase extends LitElement {
  static override properties: PropertyDeclarations = {
    stop: { type: String, reflect: true, attribute: "data-stop" },
  };

  declare stop: string;

  constructor() {
    super();
    this.stop = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Found by the route, never tabbed to: the route owns the keyboard.
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "-1");
  }
}

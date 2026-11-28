import { html, LitElement, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-menu-button/mc-menu-button.js";
import type { MenuButton } from "../mc-menu-button/mc-menu-button.types.js";
import { McMenuGridStyles } from "./mc-menu-grid.styles.js";

/**
 * # Menu grid
 * A set of `mc-menu-button`s laid out at the rects the client's layout gives them (a full row, or two side by side),
 * so the grid keeps the screen's own geometry. It owns no state: a tap on a button raises `mc-activate` with its key.
 *
 * @element mc-menu-grid
 * @fires mc-activate - `detail.key`: an enabled button was tapped.
 */
export class McMenuGrid extends LitElement {
  static override styles = [ThemeStyles, McMenuGridStyles];

  static override properties: PropertyDeclarations = {
    items: { attribute: false },
  };

  declare items: readonly MenuButton[];

  constructor() {
    super();
    this.items = [];
  }

  /** The element drawn for a button's key, for a focus stop's rect. */
  elementOf(key: string): HTMLElement | null {
    return this.renderRoot.querySelector(`[data-key="${CSS.escape(key)}"]`);
  }

  #activate(key: string): void {
    this.dispatchEvent(new CustomEvent("mc-activate", { detail: { key }, bubbles: true, composed: true }));
  }

  override render() {
    return html`${repeat(
      this.items,
      (item) => item.key,
      (item) =>
        html`<mc-menu-button
          data-key=${item.key}
          style=${`left:${item.rect.x}px;top:${item.rect.y}px;width:${item.rect.width}px;height:${item.rect.height}px`}
          .model=${item}
          @mc-press=${(event: Event) => {
            event.stopPropagation();
            this.#activate(item.key);
          }}
        ></mc-menu-button>`,
    )}`;
  }
}

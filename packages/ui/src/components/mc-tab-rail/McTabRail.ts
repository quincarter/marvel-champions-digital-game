import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-button/mc-button.js";
import type { TabRailTab } from "./mc-tab-rail.types.js";
import { McTabRailStyles } from "./mc-tab-rail.styles.js";

/**
 * # Tab rail
 * A recessed strip of equal cells (`mc-button` kind `rail`), the chosen one an ink fill, with an optional count badge
 * on a tab that has news. Pressed only by a tap, like every button.
 *
 * @element mc-tab-rail
 * @attr prefix - Put before a tab's id in its cell's `data-key` and in the key `mc-activate` reports ("tab:").
 * @attr size - The cells' label size in px (0 keeps the button's own).
 * @fires mc-activate - A tap on an available cell: `detail.key` is `prefix + id`, `detail.id` the tab's id.
 */
export class McTabRail extends LitElement {
  static override styles = [ThemeStyles, McTabRailStyles];

  static override properties: PropertyDeclarations = {
    tabs: { attribute: false },
    prefix: { type: String },
    size: { type: Number },
  };

  declare tabs: readonly TabRailTab[];
  declare prefix: string;
  declare size: number;

  constructor() {
    super();
    this.tabs = [];
    this.prefix = "tab:";
    this.size = 0;
  }

  override render() {
    return html`${this.tabs.map(
      (tab) =>
        html`<div class="cell">
          <mc-button
            data-key=${this.prefix + tab.id}
            kind="rail"
            style=${this.size ? `--mc-button-size:${this.size}px` : ""}
            .label=${tab.label}
            ?selected=${tab.selected ?? false}
            ?disabled=${tab.disabled !== undefined}
            .reason=${typeof tab.disabled === "string" ? tab.disabled : ""}
            @mc-press=${() =>
              this.dispatchEvent(
                new CustomEvent("mc-activate", {
                  detail: { key: this.prefix + tab.id, id: tab.id },
                  bubbles: true,
                  composed: true,
                }),
              )}
          ></mc-button>
          ${
            tab.badge && tab.badge > 0 && !tab.selected
              ? html`<span class="badge">${Math.min(9, tab.badge)}</span>`
              : nothing
          }
        </div>`,
    )}`;
  }
}

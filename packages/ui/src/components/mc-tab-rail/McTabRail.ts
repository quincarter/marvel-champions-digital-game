import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-button/mc-button.js";
import type { TabRailTab } from "../../shared/tab-rail.types.js";
import { McTabRailStyles } from "./mc-tab-rail.styles.js";

/**
 * # Tab rail
 * A recessed strip of equal cells (`mc-button` kind `rail`), the chosen one an ink fill, with an optional count badge
 * on a tab that has news. Pressed only by a tap, like every button. The chosen tab is named by the rail's `selected`
 * id or by a tab's own `selected`; either marks the cell (`aria-selected`, `selected`).
 *
 * @element mc-tab-rail
 * @prop tabs - The cells, in order (`TabRailTab`).
 * @attr selected - The chosen tab's id.
 * @attr prefix - Put before a tab's id in its cell's `data-key` and in the key `mc-activate` reports ("tab:").
 * @attr size - The cells' label size in px (0 keeps the button's own).
 * @fires mc-activate - A tap on an available cell: `detail.key` is `prefix + id`, `detail.id` the tab's id.
 */
export class McTabRail extends LitElement {
  static override styles = [ThemeStyles, McTabRailStyles];

  static override properties: PropertyDeclarations = {
    tabs: { attribute: false },
    selected: { type: String, reflect: true },
    prefix: { type: String },
    size: { type: Number },
    label: { type: String },
  };

  declare tabs: readonly TabRailTab[];
  declare selected: string;
  declare prefix: string;
  declare size: number;
  /** The rail's accessible name ("Filter by type"), already translated. */
  declare label: string;

  constructor() {
    super();
    this.tabs = [];
    this.selected = "";
    this.prefix = "tab:";
    this.size = 0;
    this.label = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("role", "tablist");
  }

  protected override updated(): void {
    if (this.label) this.setAttribute("aria-label", this.label);
    else this.removeAttribute("aria-label");
  }

  #press(tab: TabRailTab): void {
    if (this.#unavailable(tab)) return;
    this.dispatchEvent(
      new CustomEvent("mc-activate", {
        detail: { key: this.prefix + tab.id, id: tab.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #unavailable(tab: TabRailTab): boolean {
    return tab.disabled !== undefined && tab.disabled !== false;
  }

  override render() {
    return html`${repeat(
      this.tabs,
      (tab) => tab.id,
      (tab) => {
        const chosen = tab.selected === true || (this.selected !== "" && tab.id === this.selected);
        return html`<div class="cell">
          <mc-button
            data-key=${this.prefix + tab.id}
            kind="rail"
            role="tab"
            aria-selected=${chosen ? "true" : "false"}
            style=${this.size ? `--mc-button-size:${this.size}px` : ""}
            .label=${tab.label}
            ?selected=${chosen}
            ?disabled=${this.#unavailable(tab)}
            .reason=${typeof tab.disabled === "string" ? tab.disabled : ""}
            @mc-press=${() => this.#press(tab)}
          ></mc-button>
          ${
            tab.badge && tab.badge > 0 && !chosen
              ? html`<span class="badge">${tab.badge > 9 ? "9+" : tab.badge}</span>`
              : nothing
          }
        </div>`;
      },
    )}`;
  }
}

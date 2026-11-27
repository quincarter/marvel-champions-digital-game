import { html, LitElement, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-button/mc-button.js";
import type { McTabRailTab } from "./mc-tab-rail.types.js";
import { McTabRailStyles } from "./mc-tab-rail.styles.js";

/**
 * # Tab rail
 * A strip of equal cells, the chosen one an ink fill: built from `mc-button` cells (kind `rail`), so presses follow the
 * tap rule. Composes with any screen that has tabs (Extras, Rules, the deck screens).
 *
 * @element mc-tab-rail
 * @prop tabs - The cells, in order (`McTabRailTab`).
 * @attr selected - The chosen tab id.
 * @attr size - The label px size (a phone label never below its floor: the caller passes it).
 * @attr prefix - What the event key and each cell data-key start with (`tab:`).
 * @fires mc-activate - A tap on a cell; `detail.key` is `<prefix><id>`, `detail.id` the id.
 */
export class McTabRail extends LitElement {
  static override styles = [ThemeStyles, McTabRailStyles];

  static override properties: PropertyDeclarations = {
    tabs: { attribute: false },
    selected: { type: String, reflect: true },
    size: { type: Number },
    prefix: { type: String },
  };

  declare tabs: readonly McTabRailTab[];
  declare selected: string;
  declare size: number;
  declare prefix: string;

  constructor() {
    super();
    this.tabs = [];
    this.selected = "";
    this.size = 9;
    this.prefix = "tab:";
  }

  #press(tab: McTabRailTab): void {
    if (tab.disabled) return;
    this.dispatchEvent(
      new CustomEvent("mc-activate", {
        detail: { key: `${this.prefix}${tab.id}`, id: tab.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render() {
    return html`${repeat(
      this.tabs,
      (tab) => tab.id,
      (tab) =>
        html`<mc-button
          data-key=${`${this.prefix}${tab.id}`}
          style=${`--mc-button-size:${this.size}px`}
          kind="rail"
          .label=${tab.label}
          ?selected=${tab.id === this.selected}
          ?disabled=${tab.disabled ?? false}
          @mc-press=${() => this.#press(tab)}
        ></mc-button>`,
    )}`;
  }
}

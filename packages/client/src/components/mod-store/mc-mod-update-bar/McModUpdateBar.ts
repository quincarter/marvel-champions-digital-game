import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { ModStoreElement } from "../shared/ModStoreElement.js";
import { McModUpdateBarStyles } from "./mc-mod-update-bar.styles.js";
import type { McModUpdateBarProps } from "./mc-mod-update-bar.types.js";
import type { ModStoreSize } from "../shared/mod-store-size.types.js";
import type { UpdateAllAction, UpdateAllBar } from "../../../view/mod-store-update-all.js";

/**
 * # Update all bar
 * The bar over the grid (issue #957) when an installed pack has an update or a run has news: its words (and the run's
 * progress bar) on the left; "Update all" or "Stop" on the right, and "Show them" for failed packs the tab or search hid.
 * A phone with two buttons puts them in a row under the words.
 *
 * @element mc-mod-update-bar
 * @fires mc-mod-store - `{ type: "update-all", action }` with `update-all`, `stop` or `show-failed`.
 */
export class McModUpdateBar extends ModStoreElement implements McModUpdateBarProps {
  static override styles = [ThemeStyles, McModUpdateBarStyles];

  static override properties: PropertyDeclarations = {
    size: { type: String, reflect: true },
    bar: { attribute: false },
  };

  declare size: ModStoreSize;
  declare bar: UpdateAllBar | null;

  constructor() {
    super();
    this.size = "wide";
    this.bar = null;
  }

  #button(action: UpdateAllAction) {
    const show = action.id === "show-failed";
    const key = show ? "update-all-show" : "update-all";
    return html`<mc-button
      class=${show ? "show" : "main"}
      kind=${action.id === "update-all" ? "primary" : "secondary"}
      data-stop=${key}
      data-key=${key}
      .label=${action.id === "update-all" ? `↑ ${action.label}` : action.label}
      ?disabled=${!action.enabled}
      @mc-press=${() => {
        if (action.enabled) this.emit({ type: "update-all", action: action.id });
      }}
    ></mc-button>`;
  }

  override render() {
    const bar = this.bar;
    if (!bar) return nothing;
    const actions = [bar.show, bar.action].filter((one): one is UpdateAllAction => one !== null);
    return html`<div class="words">
        <div class=${bar.fraction !== null ? "text running" : "text"}>${bar.text}</div>
        ${
          bar.fraction !== null
            ? html`<div class="track" role="progressbar" aria-valuenow=${Math.round(bar.fraction * 100)}>
                <div class="fill" style=${`width:${bar.fraction * 100}%`}></div>
              </div>`
            : nothing
        }
      </div>
      <div class="buttons">${actions.map((action) => this.#button(action))}</div>`;
  }
}

import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type TabRailTab } from "@mc/ui";
import { ModStoreElement } from "../shared/ModStoreElement.js";
import { McModTabsStyles } from "./mc-mod-tabs.styles.js";
import type { McModTabsProps } from "./mc-mod-tabs.types.js";

/**
 * # Mod Store tabs
 * The six tabs (All, Heroes, Scenarios, Extras, Installed, Credits) as one rail, which wraps into two rows of three where
 * six tabs would cut their words short; on a phone the magnifier beside it folds the search box, sort and chips away or
 * brings them back. `LB / RB` step the tabs through the scene.
 *
 * @element mc-mod-tabs
 * @fires mc-mod-store - `{ type: "tab", tab }` and `{ type: "toggle-finders" }`.
 */
export class McModTabs extends ModStoreElement implements McModTabsProps {
  static override styles = [ThemeStyles, McModTabsStyles];

  static override properties: PropertyDeclarations = {
    tabs: { attribute: false },
    selected: { type: String },
    toggleLabel: { type: String, attribute: "toggle-label" },
    toggleShown: { type: Boolean, attribute: "toggle-shown" },
    toggleOpen: { type: Boolean, attribute: "toggle-open" },
  };

  declare tabs: readonly TabRailTab[];
  declare selected: string;
  declare toggleLabel: string;
  declare toggleShown: boolean;
  declare toggleOpen: boolean;

  constructor() {
    super();
    this.tabs = [];
    this.selected = "";
    this.toggleLabel = "";
    this.toggleShown = false;
    this.toggleOpen = false;
  }

  override render() {
    return html`<mc-tab-rail
        .tabs=${this.tabs}
        .selected=${this.selected}
        prefix="tab:"
        @mc-activate=${(event: CustomEvent<{ id: string }>) => {
          event.stopPropagation();
          this.emit({ type: "tab", tab: event.detail.id });
        }}
      ></mc-tab-rail>
      ${
        this.toggleShown
          ? html`<mc-search-toggle
              data-stop="finders-toggle"
              data-key="finders-toggle"
              .label=${this.toggleLabel}
              ?selected=${this.toggleOpen}
              @mc-press=${() => this.emit({ type: "toggle-finders" })}
            ></mc-search-toggle>`
          : nothing
      }`;
  }
}

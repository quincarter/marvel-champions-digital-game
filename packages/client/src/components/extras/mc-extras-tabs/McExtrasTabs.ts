import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type ControlGlyph, type TabRailTab } from "@mc/ui";
import { ExtrasElement } from "../shared/ExtrasElement.js";
import { McExtrasTabsStyles } from "./mc-extras-tabs.styles.js";
import type { McExtrasTabsProps } from "./mc-extras-tabs.types.js";

/**
 * # Extras tabs
 * The tab rail of the eight shelves (the generic `mc-tab-rail`: a recessed strip of equal cells, the chosen one an ink
 * fill), with the LB / RB hint under its right end while a pad is in use. Each tab is a focus stop, `tab:<id>`.
 *
 * @element mc-extras-tabs
 * @fires mc-extras - `{ type: "tab", id }`.
 */
export class McExtrasTabs extends ExtrasElement implements McExtrasTabsProps {
  static override styles = [ThemeStyles, McExtrasTabsStyles];

  static override properties: PropertyDeclarations = {
    tabs: { attribute: false },
    selected: { type: String },
    size: { type: Number },
    hint: { attribute: false },
  };

  declare tabs: readonly TabRailTab[];
  declare selected: string;
  declare size: number;
  declare hint: ControlGlyph | undefined;

  constructor() {
    super();
    this.tabs = [];
    this.selected = "";
    this.size = 0;
    this.hint = undefined;
  }

  override render() {
    const hint = this.hint;
    return html`<mc-tab-rail
        .tabs=${this.tabs}
        .selected=${this.selected}
        .size=${this.size}
        @mc-activate=${(event: CustomEvent<{ id: string }>) => {
          event.stopPropagation();
          this.emit({ type: "tab", id: event.detail.id });
        }}
      ></mc-tab-rail>
      ${
        hint
          ? html`<div class="hint">
              <mc-glyph
                .specs=${hint.specs}
                .height=${hint.height}
                .ground=${hint.ground}
                .openness=${hint.openness}
                ?still=${hint.still ?? false}
              ></mc-glyph>
            </div>`
          : nothing
      }`;
  }
}

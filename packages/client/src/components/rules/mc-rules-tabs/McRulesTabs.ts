import { html, type PropertyDeclarations } from "lit";
import { ThemeStyles, type TabRailTab } from "@mc/ui";
import { RulesElement } from "../shared/RulesElement.js";
import { McRulesTabsStyles } from "./mc-rules-tabs.styles.js";
import type { McRulesTabsProps } from "./mc-rules-tabs.types.js";

/**
 * # Rules tabs
 * The three tabs (Glossary, Villain phase, Card list) as the generic `mc-tab-rail`. Each is a focus stop, `tab:<id>`.
 *
 * @element mc-rules-tabs
 * @fires mc-rules - `{ type: "tab", tab }`.
 */
export class McRulesTabs extends RulesElement implements McRulesTabsProps {
  static override styles = [ThemeStyles, McRulesTabsStyles];

  static override properties: PropertyDeclarations = {
    tabs: { attribute: false },
    selected: { type: String },
  };

  declare tabs: readonly TabRailTab[];
  declare selected: string;

  constructor() {
    super();
    this.tabs = [];
    this.selected = "";
  }

  override render() {
    return html`<mc-tab-rail
      .tabs=${this.tabs}
      .selected=${this.selected}
      @mc-activate=${(event: CustomEvent<{ id: string }>) => {
        event.stopPropagation();
        this.emit({ type: "tab", tab: event.detail.id });
      }}
    ></mc-tab-rail>`;
  }
}

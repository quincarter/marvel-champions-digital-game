import { html, nothing, type PropertyDeclarations } from "lit";
import { tapped, ThemeStyles } from "@mc/ui";
import { RulesElement } from "../shared/RulesElement.js";
import type { RulesScope } from "../shared/rules-events.types.js";
import { McRulesScopeStyles } from "./mc-rules-scope.styles.js";
import type { McRulesScopeProps } from "./mc-rules-scope.types.js";

/**
 * # Rules scope
 * The row under the title: what the list is filtered to, in words, and, with a game running, the two-way toggle ("All
 * rules" / "On your table"). The chosen option is a solid paper pill, the other an outline (never color alone). Each option
 * is a focus stop, `scope:all` and `scope:table`.
 *
 * @element mc-rules-scope
 * @fires mc-rules - `{ type: "scope", scope }`.
 */
export class McRulesScope extends RulesElement implements McRulesScopeProps {
  static override styles = [ThemeStyles, McRulesScopeStyles];

  static override properties: PropertyDeclarations = {
    caption: { type: String },
    toggle: { attribute: false },
  };

  declare caption: string;
  declare toggle: McRulesScopeProps["toggle"];

  constructor() {
    super();
    this.caption = "";
    this.toggle = null;
  }

  #option(scope: RulesScope, label: string, selected: boolean) {
    const press = (): void => this.emit({ type: "scope", scope });
    return html`<div
      class=${selected ? "option on" : "option"}
      role="button"
      aria-pressed=${selected ? "true" : "false"}
      data-stop=${`scope:${scope}`}
      ${tapped(press)}
      @click=${(event: MouseEvent) => {
        if (event.detail === 0) press();
      }}
    >
      ${label}
    </div>`;
  }

  override render() {
    const toggle = this.toggle;
    return html`<span class="caption">${this.caption}</span> ${
        toggle
          ? html`<div class="toggle">
              ${this.#option("all", toggle.allLabel, toggle.scope === "all")}
              ${this.#option("table", toggle.tableLabel, toggle.scope === "table")}
            </div>`
          : nothing
      }`;
  }
}

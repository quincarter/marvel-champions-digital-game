import { html, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { RulesElement } from "../shared/RulesElement.js";
import "../mc-rules-card-set/mc-rules-card-set.js";
import { McRulesCardListStyles } from "./mc-rules-card-list.styles.js";
import type { McRulesCardListProps, RulesCardListItem } from "./mc-rules-card-list.types.js";

/**
 * # Rules card list
 * The Card list tab: every encounter set the pool knows in a scrolling list, the running game's own first under "IN THIS
 * GAME", the rest under "NOT IN THIS GAME", each an `mc-rules-card-set`; or what to say when there are none.
 *
 * @element mc-rules-card-list
 */
export class McRulesCardList extends RulesElement implements McRulesCardListProps {
  static override styles = [ThemeStyles, McRulesCardListStyles];

  static override properties: PropertyDeclarations = {
    items: { attribute: false },
    empty: { type: String },
    cardScale: { type: Number, attribute: "card-scale" },
    caption: { type: Number },
  };

  declare items: readonly RulesCardListItem[];
  declare empty: string;
  declare cardScale: number;
  declare caption: number;

  constructor() {
    super();
    this.items = [];
    this.empty = "";
    this.cardScale = 1;
    this.caption = 46;
  }

  /** The scrolling element. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  protected override willUpdate(): void {
    this.style.setProperty("--card-scale", String(this.cardScale));
    this.style.setProperty("--caption", `${this.caption}px`);
  }

  override render() {
    if (this.items.length === 0) return html`<mc-empty-state message=${this.empty}></mc-empty-state>`;
    return html`<div class="scroller">
      ${this.items.map((item) =>
        item.kind === "label"
          ? html`<div class="label">${item.text}</div>`
          : html`<mc-rules-card-set .set=${item.set}></mc-rules-card-set>`,
      )}
    </div>`;
  }
}

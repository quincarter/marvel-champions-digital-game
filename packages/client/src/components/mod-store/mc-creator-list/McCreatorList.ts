import { html, type PropertyDeclarations, type PropertyValues } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "@mc/ui";
import { ModStoreElement } from "../shared/ModStoreElement.js";
import { keepScroll, restoreScroll } from "../shared/list-scroll.js";
import "../mc-creator-row/mc-creator-row.js";
import { McCreatorListStyles } from "./mc-creator-list.styles.js";
import type { McCreatorListProps } from "./mc-creator-list.types.js";
import type { CreatorModel } from "../mc-creator-row/mc-creator-row.types.js";
import type { ModStoreSize } from "../shared/mod-store-size.types.js";

/**
 * # Credits
 * The Credits tab: a line saying who the list is, then one `mc-creator-row` per creator in a native scrolling list. With
 * no creators yet it says so in place of the list.
 *
 * @element mc-creator-list
 */
export class McCreatorList extends ModStoreElement implements McCreatorListProps {
  static override styles = [ThemeStyles, McCreatorListStyles];

  static override properties: PropertyDeclarations = {
    size: { type: String, reflect: true },
    intro: { type: String },
    empty: { type: String },
    credits: { attribute: false },
  };

  declare size: ModStoreSize;
  declare intro: string;
  declare empty: string;
  declare credits: readonly CreatorModel[];

  constructor() {
    super();
    this.size = "wide";
    this.intro = "";
    this.empty = "";
    this.credits = [];
  }

  /** The native scroller: what the pad's stick and paging move. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".scroller");
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has("credits")) restoreScroll("credits", this.scroller);
    this.emitRendered();
  }

  override render() {
    return html`<p class="intro">${this.intro}</p>
      ${
        this.credits.length === 0
          ? html`<p class="empty">${this.empty}</p>`
          : html`<div
              class="scroller list"
              data-key="list:credits"
              @scroll=${(event: Event) => keepScroll("credits", (event.target as HTMLElement).scrollTop)}
            >
              ${repeat(
                this.credits,
                (credit) => credit.name,
                (credit) => html`<mc-creator-row .size=${this.size} .credit=${credit}></mc-creator-row>`,
              )}
            </div>`
      }`;
  }
}

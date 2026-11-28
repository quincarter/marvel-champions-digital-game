import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { ThemeStyles } from "@mc/ui";
import { ModStorePress } from "../shared/ModStorePress.js";
import type { ModStoreEventDetail } from "../shared/mod-store-events.types.js";
import { McCreatorRowStyles } from "./mc-creator-row.styles.js";
import type { ModStoreSize } from "../shared/mod-store-size.types.js";
import type { CreatorModel, McCreatorRowProps } from "./mc-creator-row.types.js";

/**
 * # Creator row
 * One creator on the Credits tab: a red bar down the left edge, as a comic's credits box, their name, how many packs and
 * which. A tap shows their packs on All.
 *
 * @element mc-creator-row
 * @fires mc-mod-store - `{ type: "creator", name }`.
 */
export class McCreatorRow extends ModStorePress implements McCreatorRowProps {
  static override styles = [ThemeStyles, McCreatorRowStyles];

  static override properties: PropertyDeclarations = {
    ...ModStorePress.properties,
    size: { type: String, reflect: true },
    credit: { attribute: false },
  };

  declare size: ModStoreSize;
  declare credit: CreatorModel | null;

  constructor() {
    super();
    this.size = "wide";
    this.credit = null;
  }

  protected override pressed(): ModStoreEventDetail | null {
    return this.credit ? { type: "creator", name: this.credit.name } : null;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("credit") && this.credit) {
      this.stop = `creator:${this.credit.name}`;
      this.setAttribute("data-key", this.stop);
    }
  }

  override render() {
    const credit = this.credit;
    if (!credit) return nothing;
    return html`<div class="bar"></div>
      <div class="head">
        <span class="name">${credit.name}</span>
        <span class="count">${credit.countText}</span>
      </div>
      <div class="line">${credit.line}</div>`;
  }
}

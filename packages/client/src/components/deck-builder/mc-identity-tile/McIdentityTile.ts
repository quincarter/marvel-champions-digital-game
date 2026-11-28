import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { McPress } from "@mc/ui";
import type { DeckBuilderEventDetail } from "../shared/deck-builder-events.types.js";
import { McIdentityTileStyles } from "./mc-identity-tile.styles.js";
import type { IdentityTileModel } from "./mc-identity-tile.types.js";

/**
 * # Identity tile
 * A hero on the picker: the hero's own art over a name bar. A tap anywhere on it picks the hero; a hold, a right-click or
 * the route's Inspect opens the hero's card (a mouse over the art opens the card popover). It is the `identity:<id>` stop.
 *
 * @element mc-identity-tile
 * @prop model - The hero (`IdentityTileModel`).
 * @fires mc-pressed - `action` `pick-hero`; `holdAction` `hero-inspect` (`DeckBuilderEventDetail`).
 */
export class McIdentityTile extends McPress {
  static override styles = [McIdentityTileStyles];

  static override properties: PropertyDeclarations = { ...McPress.properties, model: { attribute: false } };

  declare model: IdentityTileModel | null;

  constructor() {
    super();
    this.model = null;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (!changed.has("model") || !this.model) return;
    this.stop = `identity:${this.model.id}`;
    this.action = { type: "pick-hero", id: this.model.id } satisfies DeckBuilderEventDetail;
    this.holdAction = { type: "hero-inspect", id: this.model.id } satisfies DeckBuilderEventDetail;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<div class="art">
        <mc-card-art .picture=${model.picture} card-id=${model.id} .frame=${0}></mc-card-art>
      </div>
      <div class="bar"><span>${model.name}</span></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-identity-tile": McIdentityTile;
  }
}

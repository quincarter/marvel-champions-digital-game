import { html, nothing, type PropertyDeclarations } from "lit";
import { McPress } from "@mc/ui";
import type { DeckBuilderEventDetail } from "../shared/deck-builder-events.types.js";
import { McIdentityRowStyles } from "./mc-identity-row.styles.js";
import type { IdentityRowModel } from "./mc-identity-row.types.js";

/**
 * # Identity row
 * The chosen identity above the builder (issue #920): one card-like row with the hero's picture, its name and a "Read
 * card" cue. A tap (never a lift) and the pad's stop open Inspect on the hero side, whose toggle flips to the alter ego, so
 * a player can read what the hero does while building. On desktop the picture opens the card popover too.
 *
 * Focus stop: `identity-card`.
 *
 * @element mc-identity-row
 * @prop model - The row (`IdentityRowModel`).
 * @attr layout - phone: the row spans the column.
 * @fires mc-pressed - `action` `identity-card` (`DeckBuilderEventDetail`).
 */
export class McIdentityRow extends McPress {
  static override styles = [McIdentityRowStyles];

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    model: { attribute: false },
    layout: { type: String, reflect: true },
  };

  declare model: IdentityRowModel | null;
  declare layout: string;

  constructor() {
    super();
    this.model = null;
    this.layout = "wide";
    this.stop = "identity-card";
    this.action = { type: "identity-card" } satisfies DeckBuilderEventDetail;
    this.holdAction = { type: "identity-card" } satisfies DeckBuilderEventDetail;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<mc-card-art
        .picture=${model.picture}
        card-id=${model.cardId}
        .face=${{ kind: "hero" }}
        .frame=${0}
      ></mc-card-art>
      <div class="words">
        <span class="label">${model.label}</span>
        <span class="name">${model.name}</span>
      </div>
      <span class="cue">${model.cue}</span>`;
  }
}

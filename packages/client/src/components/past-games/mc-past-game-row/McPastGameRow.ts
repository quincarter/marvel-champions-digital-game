import { McPress } from "@mc/ui";
import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { McPastGameRowStyles } from "./mc-past-game-row.styles.js";
import type { McPastGameRowProps, PastGameRowModel } from "./mc-past-game-row.types.js";
import "../mc-past-game-pictures/mc-past-game-pictures.js";
import "../mc-past-game-summary/mc-past-game-summary.js";

/**
 * # Past game row
 * One finished game in the list: the villain's and the heroes' pictures and how it went, in a framed card that is itself
 * the control (`McPress`: a tap, never the lift that ends a swipe, or the route's Enter, raises `mc-pressed` with the
 * `action` its list gave it). The game whose details show wears the heavy red frame. The pictures are card pictures for
 * the hover popover; they take no press of their own.
 *
 * Needs `@mc/ui` defined. Focus stop: `game:<id>` (set by the list through `data-stop`).
 *
 * @element mc-past-game-row
 * @prop model - The row (`PastGameRowModel`).
 * @attr selected - The details show this game.
 * @fires mc-pressed - `PressDetail`, with the list's `action`.
 */
export class McPastGameRow extends McPress implements McPastGameRowProps {
  static override styles = [McPastGameRowStyles];

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    model: { attribute: false },
    selected: { type: Boolean, reflect: true },
  };

  declare model: PastGameRowModel | null;
  declare selected: boolean;

  constructor() {
    super();
    this.model = null;
    this.selected = false;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.setAttribute("aria-pressed", this.selected ? "true" : "false");
    if (this.model) this.setAttribute("aria-label", this.model.label);
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<div class="frame">
      <mc-past-game-pictures .pictures=${m.pictures}></mc-past-game-pictures>
      <mc-past-game-summary .model=${m.summary}></mc-past-game-summary>
    </div>`;
  }
}

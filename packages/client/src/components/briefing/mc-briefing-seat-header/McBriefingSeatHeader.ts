import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { McBriefingSeatHeaderStyles } from "./mc-briefing-seat-header.styles.js";
import type { SeatHeaderModel } from "./mc-briefing-seat-header.types.js";

/**
 * # Briefing seat header
 * The seat hero above its prompt: the roster own portrait (`art/heroes`) in a 3px ink frame, "SEAT 1 · COLOSSUS" in Bangers and the
 * deck aspect chips under the name (the same chips the role tiles wear).
 *
 * @element mc-briefing-seat-header
 * @prop model - `SeatHeaderModel`.
 * @attr phone - The phone size: a 56px portrait instead of 64px.
 */
export class McBriefingSeatHeader extends LitElement {
  static override styles = [ThemeStyles, McBriefingSeatHeaderStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: SeatHeaderModel | null;
  declare phone: boolean;

  constructor() {
    super();
    this.model = null;
    this.phone = false;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<div class="portrait">
        ${m.picture?.src ? html`<mc-picture-tile .picture=${m.picture} ground="ink" .frame=${0}></mc-picture-tile>` : nothing}
      </div>
      <div class="text">
        <span class="name display">${m.title}</span>
        ${
          m.stamps.length > 0
            ? html`<span class="chips"
                >${m.stamps.map(
                  (stamp) => html`<mc-aspect-chip aspect=${stamp.aspect} label=${stamp.label}></mc-aspect-chip>`,
                )}</span
              >`
            : nothing
        }
      </div>`;
  }
}

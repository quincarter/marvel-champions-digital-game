import { McPress } from "@mc/ui";
import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { McTrophyFamilyStyles } from "./mc-trophy-family.styles.js";
import type { McTrophyFamilyProps, TrophyFamilyModel } from "./mc-trophy-family.types.js";

/**
 * # Trophy family
 * A family's heading in the Trophy Room's list: a chevron, the Bangers name in capitals with the rule running on, and
 * how many of its achievements are earned ("3 of 7 · 43%"). It is the control that folds or opens the family (`McPress`:
 * a tap, never the lift that ends a swipe, or the route's Enter). The chevron and the count say whether it is open and
 * what is under it; `aria-expanded` says so too.
 *
 * Needs `@mc/ui` defined (`mc-section-heading`). Focus stop: `sec:<family id>` (set by the list through `data-stop`).
 *
 * @element mc-trophy-family
 * @prop model - The family (`TrophyFamilyModel`).
 * @fires mc-pressed - `PressDetail`, with the list's `action`.
 */
export class McTrophyFamily extends McPress implements McTrophyFamilyProps {
  static override styles = [McTrophyFamilyStyles];

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: TrophyFamilyModel | null;
  declare phone: boolean;

  constructor() {
    super();
    this.model = null;
    this.phone = false;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const m = this.model;
    if (!m) return;
    this.setAttribute("aria-expanded", m.expanded ? "true" : "false");
    this.setAttribute("aria-label", `${m.title}, ${m.count}`);
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<div class="row">
      <span class="chev" aria-hidden="true">${m.expanded ? "▾" : "▸"}</span>
      <mc-section-heading .label=${m.title.toUpperCase()} .right=${m.count}></mc-section-heading>
    </div>`;
  }
}

import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { McTrophyGroupStyles } from "./mc-trophy-group.styles.js";
import type { McTrophyGroupProps, TrophyGroupModel } from "./mc-trophy-group.types.js";

/**
 * # Trophy group
 * A pack's heading inside the Mods family ("From Silly pack", how many it has earned) over a thin rule. A label only:
 * it does not fold or open, takes no press and is not a focus stop, so the focus ring walks past it.
 *
 * Needs `@mc/ui` defined (`mc-section-heading`).
 *
 * @element mc-trophy-group
 * @prop model - The group (`TrophyGroupModel`).
 * @prop label - Its words (`trophies.fromPack`), in capitals.
 */
export class McTrophyGroup extends LitElement implements McTrophyGroupProps {
  static override styles = [McTrophyGroupStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    label: { type: String },
  };

  declare model: TrophyGroupModel | null;
  declare label: string;

  constructor() {
    super();
    this.model = null;
    this.label = "";
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<mc-section-heading .label=${this.label.toUpperCase()} .right=${m.count}></mc-section-heading>`;
  }
}

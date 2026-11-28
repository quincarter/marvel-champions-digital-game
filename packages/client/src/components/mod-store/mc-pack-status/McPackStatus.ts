import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { McPackStatusStyles } from "./mc-pack-status.styles.js";
import type { McPackStatusProps, PackStatusModel } from "./mc-pack-status.types.js";

/**
 * # Pack status
 * The line over a pack page's buttons: the progress bar (with its words and percentage) while installing, the last failure
 * in words (a "!" and Hero Red), or the requirement the pack is waiting on ("!" and ink). It keeps its height with nothing
 * to say, so the buttons never jump.
 *
 * @element mc-pack-status
 */
export class McPackStatus extends LitElement implements McPackStatusProps {
  static override styles = [ThemeStyles, McPackStatusStyles];

  static override properties: PropertyDeclarations = {
    status: { attribute: false },
  };

  declare status: PackStatusModel;

  constructor() {
    super();
    this.status = { kind: "none" };
  }

  override render() {
    const s = this.status;
    switch (s.kind) {
      case "failure":
        return html`<span class="line failure">! ${s.text}</span>`;
      case "requirement":
        return html`<span class="line">! ${s.text}</span>`;
      case "progress":
        return html`<span class="words">${s.text} ${Math.round(s.fraction * 100)}%</span>
          <div class="track" role="progressbar" aria-valuenow=${Math.round(s.fraction * 100)}>
            <div class="fill" style=${`width:${s.fraction * 100}%`}></div>
          </div>`;
      default:
        return nothing;
    }
  }
}

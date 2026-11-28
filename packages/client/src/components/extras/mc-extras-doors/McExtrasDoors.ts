import { html, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { ExtrasElement } from "../shared/ExtrasElement.js";
import { McExtrasDoorsStyles } from "./mc-extras-doors.styles.js";
import type { McExtrasDoorsProps } from "./mc-extras-doors.types.js";

/**
 * # Extras doors
 * The two doors out of Extras, side by side: the Trophy Room and Art and Credits. Each is a focus stop (`trophies`,
 * `credits`).
 *
 * @element mc-extras-doors
 * @fires mc-extras - `{ type: "door", id }`.
 */
export class McExtrasDoors extends ExtrasElement implements McExtrasDoorsProps {
  static override styles = [ThemeStyles, McExtrasDoorsStyles];

  static override properties: PropertyDeclarations = {
    trophiesLabel: { type: String, attribute: "trophies-label" },
    creditsLabel: { type: String, attribute: "credits-label" },
    stacked: { type: Boolean, reflect: true },
  };

  declare trophiesLabel: string;
  declare creditsLabel: string;
  declare stacked: boolean;

  constructor() {
    super();
    this.trophiesLabel = "";
    this.creditsLabel = "";
    this.stacked = false;
  }

  override render() {
    return html`<mc-button
        kind="secondary"
        data-stop="trophies"
        .label=${this.trophiesLabel}
        @mc-press=${() => this.emit({ type: "door", id: "trophies" })}
      ></mc-button>
      <mc-button
        kind="secondary"
        data-stop="credits"
        .label=${this.creditsLabel}
        @mc-press=${() => this.emit({ type: "door", id: "credits" })}
      ></mc-button>`;
  }
}

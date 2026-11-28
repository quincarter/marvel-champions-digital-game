import { html, svg, type PropertyDeclarations } from "lit";
import { PastGamesElement } from "../shared/PastGamesElement.js";
import { McPastGamesFileButtonStyles } from "./mc-past-games-file-button.styles.js";
import type { McPastGamesFileButtonProps, PastGamesFileModel } from "./mc-past-games-file-button.types.js";

/** An open folder: its back with the tab drawn as a line, its front swung open and filled (#858). */
const FOLDER = svg`<svg class="icon" viewBox="0 0 20 14" aria-hidden="true">
  <polyline points="0,14 0,0 7,0 9,2.5 18,2.5 18,5" fill="none" stroke="currentColor" stroke-width="2" />
  <polygon points="0,14 4,5 20,5 16,14" fill="currentColor" />
</svg>`;

/**
 * # Past games file button
 * "Open a replay file" in the top bar's right end: an `onInk` button with an open-folder mark at its left. It watches a
 * replay someone else made; dimmed while something is running. Stop: `open-file`.
 *
 * Needs `@mc/ui` defined (`mc-button`).
 *
 * @element mc-past-games-file-button
 * @prop model - The label and whether it is dimmed (`PastGamesFileModel`).
 * @attr phone - The narrower phone button.
 * @fires mc-past-games - `{ type: "open-file" }`.
 */
export class McPastGamesFileButton extends PastGamesElement implements McPastGamesFileButtonProps {
  static override styles = [McPastGamesFileButtonStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };

  declare model: PastGamesFileModel;
  declare phone: boolean;
  declare disabled: boolean;

  constructor() {
    super();
    this.model = { label: "", disabled: false };
    this.phone = false;
    this.disabled = false;
  }

  protected override willUpdate(): void {
    this.disabled = this.model.disabled;
  }

  override render() {
    return html`<mc-button
        kind="onInk"
        data-stop="open-file"
        data-key="open-file"
        ?disabled=${this.model.disabled}
        .label=${this.model.label}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          this.emit({ type: "open-file" });
        }}
      ></mc-button>
      ${FOLDER}`;
  }
}

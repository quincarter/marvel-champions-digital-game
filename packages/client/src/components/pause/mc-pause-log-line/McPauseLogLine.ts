import { McPress } from "@mc/ui";
import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import type { PauseLogLineInput } from "../pause.types.js";
import { McPauseLogLineStyles } from "./mc-pause-log-line.styles.js";

/**
 * # Pause log moment
 * A log line Undo can get back to: outlined, marked ↶ at its right edge, and a full touch target tall. A press rewinds
 * there (the scene asks the Board to undo that many steps and returns to the table).
 *
 * @element mc-pause-log-line
 * @prop line - The line (`PauseLogLineInput`, with a `stop`).
 * @fires mc-pressed - `PressDetail`, with `{ type: "moment", id }` as its action.
 */
export class McPauseLogLine extends McPress {
  static override styles = McPauseLogLineStyles;

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    line: { attribute: false },
  };

  declare line: PauseLogLineInput | null;

  constructor() {
    super();
    this.line = null;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (!changed.has("line") || !this.line) return;
    this.stop = this.line.stop ?? "";
    this.action = { type: "moment", id: this.line.id };
  }

  override render() {
    const line = this.line;
    if (!line) return nothing;
    return html`<div class="row">
      <span class="ref">${line.ref}</span>
      <span class="words">${line.words}</span>
      <span class="undo" aria-hidden="true">↶</span>
    </div>`;
  }
}

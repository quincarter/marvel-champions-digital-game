import { html, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import "../mc-pause-log-line/mc-pause-log-line.js";
import type { PauseLogInput } from "../pause.types.js";
import { PauseElement } from "../shared/PauseElement.js";
import { McPauseLogStyles } from "./mc-pause-log.styles.js";

/**
 * # Pause log
 * A heading over a parchment box of log lines, newest first, scrolling natively: "Jump to a moment" beside the Rules
 * reference, or the Full game log taking the pane (with a note on how to go back). The lines Undo can get back to are
 * outlined, marked ↶ and pressable (`mc-pause-log-line`); a line under the box says which they are.
 *
 * @element mc-pause-log
 * @prop input - The heading, the lines and the hint (`PauseLogInput`).
 * @fires mc-pause - `{ type: "moment", id }` on a press on an undoable line.
 */
export class McPauseLog extends PauseElement {
  static override styles = McPauseLogStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
  };

  declare input: PauseLogInput | null;

  constructor() {
    super();
    this.input = null;
  }

  /** The box's scrolling lines, for the scene to read back to the top after a new open. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".lines");
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`<header class="head">
        <h2 class="title">${input.title}</h2>
        ${input.note ? html`<p class="note">${input.note}</p>` : nothing}
      </header>
      <div class="frame">
        <div class="lines scroller">
          ${
            input.lines.length === 0
              ? html`<p class="empty">${input.empty}</p>`
              : repeat(
                  input.lines,
                  (line) => line.id,
                  (line) =>
                    line.stop
                      ? html`<mc-pause-log-line .line=${line}></mc-pause-log-line>`
                      : html`<div class="line">
                          <span class="ref">${line.ref}</span>
                          <span class="words">${line.words}</span>
                        </div>`,
                )
          }
        </div>
        <div class="hint">${input.hint}</div>
      </div>`;
  }
}

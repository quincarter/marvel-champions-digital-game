import { html, nothing, type PropertyDeclarations } from "lit";
import { LearnElement } from "../shared/LearnElement.js";
import type { AspectRowModel } from "../mc-aspect-row/mc-aspect-row.types.js";
import { McAspectListStyles } from "./mc-aspect-list.styles.js";
import type { AspectListProps } from "./mc-aspect-list.types.js";

/**
 * # Aspect list
 * ASPECTS on the How to play hub: its label over the four playable aspects (`mc-aspect-row`), one per line. A press on a
 * row is `{ type: "aspect", aspect }` as `mc-learn`.
 *
 * @element mc-aspect-list
 * @attr heading - ASPECTS, already translated.
 * @prop aspects - The rows (`AspectRowModel`).
 * @fires mc-learn - `{ type: "aspect", aspect }`.
 */
export class McAspectList extends LearnElement implements AspectListProps {
  static override styles = [McAspectListStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    aspects: { attribute: false },
  };

  declare heading: string;
  declare aspects: readonly AspectRowModel[];

  constructor() {
    super();
    this.heading = "";
    this.aspects = [];
  }

  override render() {
    if (this.aspects.length === 0) return nothing;
    return html`<div class="label">${this.heading}</div>
      <div class="rows">${this.aspects.map((row) => html`<mc-aspect-row .model=${row}></mc-aspect-row>`)}</div>`;
  }
}

import { html, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { StatsElement } from "../shared/StatsElement.js";
import "../mc-stats-side-row/mc-stats-side-row.js";
import { McStatsMatchupSideStyles } from "./mc-stats-matchup-side.styles.js";
import type { McStatsMatchupSideProps } from "./mc-stats-matchup-side.types.js";
import type { StatsSideRowModel } from "../mc-stats-side-row/mc-stats-side-row.types.js";

/**
 * # Focus view's side list
 * Every villain of the grid in a list of its own, the one shown filled. It scrolls natively and keeps the selected row in
 * view when the selection moves. Each row is a focus stop (`side:<row>`).
 *
 * @element mc-stats-matchup-side
 * @prop rows - The villains, in grid order (`StatsSideRowModel`).
 * @fires mc-player-stats - `{ type: "focus-row", row }`.
 */
export class McStatsMatchupSide extends StatsElement implements McStatsMatchupSideProps {
  static override styles = McStatsMatchupSideStyles;

  static override properties: PropertyDeclarations = { rows: { attribute: false } };

  declare rows: readonly StatsSideRowModel[];

  constructor() {
    super();
    this.rows = [];
  }

  protected override updated(): void {
    // The chosen row comes into view by scrolling this list only (never the page around it).
    const chosen = this.renderRoot.querySelector<HTMLElement>("mc-stats-side-row[selected]");
    if (!chosen) return;
    const top = chosen.offsetTop - this.offsetTop;
    if (top < this.scrollTop) this.scrollTop = top;
    else if (top + chosen.offsetHeight > this.scrollTop + this.clientHeight)
      this.scrollTop = top + chosen.offsetHeight - this.clientHeight;
  }

  override render() {
    return html`<div class="rows">
      ${repeat(
        this.rows,
        (row) => row.row,
        (row) => html`<mc-stats-side-row .model=${row}></mc-stats-side-row>`,
      )}
    </div>`;
  }
}

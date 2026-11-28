import { css } from "lit";

/** A parchment band with a 3px ink border and a 2px ink rule between cells: four across, or two by two. */
export const McScenarioStatsStyles = css`
  :host {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    background: var(--mc-fill-parchment);
    border: 3px solid var(--mc-line-ink);
  }
  :host([wide]) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  mc-scenario-stat-cell {
    min-height: 50px;
    border-top: 2px solid var(--mc-line-ink);
    border-left: 2px solid var(--mc-line-ink);
  }
  /* The band's edge is its own border: rules only between cells. */
  mc-scenario-stat-cell:nth-child(-n + 2) {
    border-top: 0;
  }
  mc-scenario-stat-cell:nth-child(odd) {
    border-left: 0;
  }
  :host([wide]) mc-scenario-stat-cell:nth-child(-n + 4) {
    border-top: 0;
  }
  :host([wide]) mc-scenario-stat-cell:nth-child(odd) {
    border-left: 2px solid var(--mc-line-ink);
  }
  :host([wide]) mc-scenario-stat-cell:nth-child(4n + 1) {
    border-left: 0;
  }
`;

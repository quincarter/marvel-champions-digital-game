import { css } from "lit";

export const McChartBarStyles = css`
  :host {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  /* --chart-height is the whole chart (set by mc-bar-chart); --ratio is this bar's count over the largest. */
  .bar {
    height: max(2px, calc(var(--ratio, 0) * (var(--chart-height, 84px) - 18px)));
    background: var(--tint, var(--mc-fill-ink));
    box-shadow: 0 0 0 1px var(--mc-line-ink);
  }
  :host([highlight]) .bar {
    background: var(--tint, var(--mc-fill-red));
    box-shadow: none;
  }
  .axis {
    height: 18px;
    padding-top: 8px;
    text-align: center;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    line-height: 10px;
    opacity: 0.6;
  }
`;

import { css } from "lit";

export const McDonutChartStyles = css`
  :host {
    display: inline-block;
    position: relative;
    width: var(--donut-size, 156px);
    height: var(--donut-size, 156px);
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .ring {
    fill: none;
  }
  .edge {
    fill: none;
    stroke: var(--mc-line-ink);
    stroke-width: 2;
  }
  .center {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    pointer-events: none;
  }
`;

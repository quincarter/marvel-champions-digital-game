import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McDeckChartsStyles = [
  BuilderBaseStyles,
  css`
    .tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 6px;
    }
    /* The wide rail's tabs are shorter than a touch target: only a mouse reaches them there. */
    .tabs mc-button {
      height: 30px;
    }
    mc-bar-chart {
      --chart-height: 90px;
    }
    :host([mode="tabs"]) mc-bar-chart {
      --chart-height: 74px;
    }
    mc-odds-panel {
      --odds-height: 44px;
    }
    :host([mode="tabs"]) mc-odds-panel {
      --odds-height: 30px;
    }
    .block + .block {
      margin-top: 16px;
    }
  `,
];

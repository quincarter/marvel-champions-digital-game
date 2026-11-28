import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

export const McStatsControlsStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    mc-stepper {
      --chip-on-fill: var(--mc-fill-red);
      --arrow-width: 78px;
    }
    :host([mode="phone"]) mc-stepper {
      --arrow-width: 64px;
    }
  `,
];

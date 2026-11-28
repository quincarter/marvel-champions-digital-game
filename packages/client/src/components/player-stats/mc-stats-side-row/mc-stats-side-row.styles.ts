import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

export const McStatsSideRowStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 46px;
      padding: 0 12px;
      background: var(--mc-fill-parchment);
      border: 2px solid var(--mc-line-ink);
      cursor: pointer;
      outline: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
    }
    :host([selected]) {
      background: var(--mc-fill-red);
      color: var(--mc-text-paper);
    }
    .name {
      min-width: 0;
      font-weight: 800;
      font-size: 14px;
    }
    .score {
      flex: none;
      font-size: 12px;
      font-weight: 700;
      opacity: 0.85;
    }
  `,
];
